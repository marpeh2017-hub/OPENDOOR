/**
 * Send caps on outbound automations.
 *
 * The 2026-09-09 audit found that `sendCapPerHour` / `sendCapPerDay` default to
 * `null`, which `SendCapService` correctly reads as "unlimited" — so an
 * automation could be taken live, able to message every resident in the tenant,
 * because nobody filled in a field. The cap machinery worked; nothing forced
 * anyone to use it.
 *
 * Two properties are held here:
 *   1. An outbound automation cannot REACH a live-sending state without a cap.
 *   2. When the cap is hit it HARD-STOPS the send rather than warning.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { SendCapService } from '../src/automations/send-cap.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const MARKER = `CAPS-${Date.now().toString(36)}`

describe('Automation send caps (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let caps: SendCapService
  let token: string
  let templateId: string
  const createdAutomationIds: string[] = []

  const http = () => request(app.getHttpServer())
  const auth = () => ({ Authorization: `Bearer ${token}` })

  const makeAutomation = async (body: Record<string, unknown>) => {
    const res = await http().post('/api/v1/automations').set(auth()).send(body)
    if (res.body?.id) createdAutomationIds.push(res.body.id)
    return res
  }

  const outboundBody = (extra: Record<string, unknown> = {}) => ({
    name: `${MARKER} outbound`,
    trigger: 'RESIDENT_CREATED',
    actions: [{ type: 'SEND_SMS', order: 0, config: { audience: 'RESIDENT', templateId } }],
    ...extra,
  })

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = mod.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    prisma = app.get(PrismaService)
    caps = app.get(SendCapService)

    const login = await http().post('/api/v1/auth/login')
      .send({ email: 'admin@opendoor.co.il', password: 'demo1234' })
    expect(login.status).toBe(200)
    token = login.body.accessToken

    await prisma.automation.deleteMany({ where: { name: { startsWith: 'CAPS-' } } })
    await prisma.communicationTemplate.deleteMany({ where: { name: { startsWith: 'CAPS-' } } })

    const tpl = await http().post('/api/v1/communication-templates').set(auth())
      .send({ name: `${MARKER} tpl`, channel: 'SMS', body: 'audit {{firstName}}' })
    expect(tpl.status).toBe(201)
    templateId = tpl.body.id
  }, 60_000)

  afterAll(async () => {
    await prisma.automation.deleteMany({ where: { name: { startsWith: 'CAPS-' } } })
    await prisma.communicationTemplate.deleteMany({ where: { name: { startsWith: 'CAPS-' } } })
    await app?.close()
  })

  describe('a cap is required before an automation can send for real', () => {
    it('creating one without a cap is still allowed — it is born inert', async () => {
      const res = await makeAutomation(outboundBody())
      expect(res.status).toBe(201)
      expect(res.body.dryRun).toBe(true)
      expect(res.body.isActive).toBe(false)
    })

    it('REFUSES to leave dry run when no cap is set', async () => {
      const made = await makeAutomation(outboundBody())
      await http().patch(`/api/v1/automations/${made.body.id}`).set(auth())
        .send({ isActive: true }).expect(200)

      const live = await http().patch(`/api/v1/automations/${made.body.id}/dry-run`)
        .set(auth()).send({ dryRun: false })
      expect(live.status).toBe(400)
      expect(live.body.code).toBe('AUTOMATION_SEND_CAP_REQUIRED')

      const row = await prisma.automation.findUniqueOrThrow({ where: { id: made.body.id } })
      expect(row.dryRun).toBe(true)   // unchanged — the refusal is not cosmetic
    })

    it('ALLOWS it once a positive cap exists', async () => {
      const made = await makeAutomation(outboundBody({ sendCapPerDay: 5 }))
      await http().patch(`/api/v1/automations/${made.body.id}`).set(auth())
        .send({ isActive: true }).expect(200)
      const live = await http().patch(`/api/v1/automations/${made.body.id}/dry-run`)
        .set(auth()).send({ dryRun: false })
      expect(live.status).toBe(200)
      expect(live.body.dryRun).toBe(false)
    })

    it('an hourly cap alone is enough — either bound limits the blast radius', async () => {
      const made = await makeAutomation(outboundBody({ sendCapPerHour: 3 }))
      await http().patch(`/api/v1/automations/${made.body.id}`).set(auth()).send({ isActive: true }).expect(200)
      await http().patch(`/api/v1/automations/${made.body.id}/dry-run`).set(auth())
        .send({ dryRun: false }).expect(200)
    })

    it('a cap of zero never reaches the guard — the DTO rejects it first', async () => {
      // @Min(1) on the DTO means "0" is a validation error at the door. Worth
      // locking in: it is the reason the service guard only has to consider
      // null, not zero.
      const made = await makeAutomation(outboundBody({ sendCapPerDay: 0 }))
      expect(made.status).toBe(400)
    })

    it('REFUSES to clear the cap on an automation that is already sending', async () => {
      const made = await makeAutomation(outboundBody({ sendCapPerDay: 5 }))
      await http().patch(`/api/v1/automations/${made.body.id}`).set(auth()).send({ isActive: true }).expect(200)
      await http().patch(`/api/v1/automations/${made.body.id}/dry-run`).set(auth()).send({ dryRun: false }).expect(200)

      // The dangerous edit: switch the ceiling off while it is live. `null`
      // passes @IsOptional() validation and would otherwise write straight
      // through to the column, restoring "unlimited".
      const cleared = await http().patch(`/api/v1/automations/${made.body.id}`).set(auth())
        .send({ sendCapPerDay: null })
      expect(cleared.status).toBe(400)
      expect(cleared.body.code).toBe('AUTOMATION_SEND_CAP_REQUIRED')

      const row = await prisma.automation.findUniqueOrThrow({ where: { id: made.body.id } })
      expect(row.sendCapPerDay).toBe(5)
    })

    it('does not obstruct a non-outbound automation', async () => {
      const made = await makeAutomation({
        name: `${MARKER} task only`,
        trigger: 'RESIDENT_CREATED',
        actions: [{ type: 'CREATE_TASK', order: 0, config: { title: 'x' } }],
      })
      expect(made.status).toBe(201)
      await http().patch(`/api/v1/automations/${made.body.id}`).set(auth())
        .send({ isActive: true }).expect(200)
    })
  })

  describe('the cap stops the send rather than warning about it', () => {
    it('permits only the remaining room, and zero once exhausted', async () => {
      const made = await makeAutomation(outboundBody({ sendCapPerHour: 3 }))
      const automation = { id: made.body.id, sendCapPerHour: 3, sendCapPerDay: null }

      const fresh = await caps.check(automation, 10)
      expect(fresh.allowed).toBe(3)
      expect(fresh.blocked).toBe(7)
      expect(fresh.reason).toBe('HOURLY_CAP')

      // Simulate three sends already made in the window.
      const resident = await prisma.resident.findFirstOrThrow({ select: { id: true, tenantId: true } })
      for (let i = 0; i < 3; i++) {
        await prisma.message.create({
          data: {
            tenantId: resident.tenantId, residentId: resident.id, automationId: automation.id,
            channel: 'SMS', direction: 'OUTBOUND', status: 'SENT',
            body: `${MARKER} filler ${i}`,
          },
        })
      }

      const exhausted = await caps.check(automation, 5)
      expect(exhausted.allowed).toBe(0)      // hard stop, not a warning
      expect(exhausted.blocked).toBe(5)

      await prisma.message.deleteMany({ where: { automationId: automation.id } })
    })

    it('an uncapped automation is unlimited — which is exactly why the guard above exists', async () => {
      const decision = await caps.check({ id: 'no-such-id', sendCapPerHour: null, sendCapPerDay: null }, 10_000)
      expect(decision.allowed).toBe(10_000)
      expect(decision.blocked).toBe(0)
    })
  })
})
