/**
 * Resident communications, RSVP and reminders E2E — Phases 3, 4 & 5.
 *
 * The gap this closes: `Notification.userId` is an FK to `User`, a Resident is
 * not a User, so a resident invited to a meeting was recorded and then never
 * told. The fix must NOT be "make residents Users", and this suite asserts the
 * separation directly — no `User` row is ever created for a resident, and the
 * resident's entire surface is a token, not a session.
 *
 * What is pinned here:
 *
 *   PHASE 3 — a resident attendee gets a real queued `Message` on a channel
 *   they consented to; `doNotContact` is absolute; a resident with no usable
 *   number is reported as unreachable rather than silently dropped; nothing
 *   crosses a tenant boundary.
 *
 *   PHASE 4 — the invitation token views and answers exactly one invitation.
 *   Expiry, revocation, replay ceiling and cross-tenant reach are each proved
 *   by attempting them, not by reading the code.
 *
 *   PHASE 5 — a reminder fires once and only once, a cancelled meeting produces
 *   none, and only actual attendees are reached.
 *
 * Both background timers (dispatch worker, reminder scanner) are disabled under
 * NODE_ENV=test, so every tick here is explicit.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { MeetingReminderService } from '../src/meetings/meeting-reminder.service'
import { MeetingAccessService } from '../src/meetings/meeting-access.service'
import { ResidentContactService, isRoutable } from '../src/messaging/resident-contact.service'
import { MessagingConfig } from '../src/messaging/messaging.config'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const A_SLUG = 'e2e-rescomm-a'
const B_SLUG = 'e2e-rescomm-b'
const MIN = 60_000

describe('Resident communications, RSVP and reminders (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let reminders: MeetingReminderService
  let access: MeetingAccessService
  let contacts: ResidentContactService

  let tenantAId: string
  let tenantBId: string
  let organiserId: string
  let staffId: string
  let organiserToken: string

  let projectAId: string
  /** Consenting SMS resident with a valid mobile. */
  let smsResidentId: string
  /** whatsappOptIn + preferred WHATSAPP. */
  let waResidentId: string
  /** doNotContact = true. */
  let mutedResidentId: string
  /** No phone, no email. */
  let unreachableResidentId: string
  /** Tenant B. */
  let foreignResidentId: string

  const token = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${role}@e2e-rescomm.test`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const makeUser = async (tenantId: string, email: string, role: string) => {
    const u = await prisma.user.create({
      data: {
        tenantId, email, firstName: 'צוות', lastName: 'בדיקה',
        role: role as any, passwordHash: 'not-a-real-hash-never-used',
      },
      select: { id: true },
    })
    return u.id
  }

  const makeProject = async (tenantId: string, code: string) => {
    const project = await prisma.project.create({
      data: { tenantId, code, name: `ResComm ${code}`, city: 'תל אביב' }, select: { id: true },
    })
    const complex = await prisma.complex.create({
      data: { projectId: project.id, name: `מתחם ${code}` }, select: { id: true },
    })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: 'רחוב הבדיקה 1', city: 'תל אביב' },
      select: { id: true },
    })
    return { projectId: project.id, buildingId: building.id }
  }

  let aptCounter = 0
  const makeResident = async (
    tenantId: string, buildingId: string, data: Record<string, any>,
  ) => {
    aptCounter += 1
    const apartment = await prisma.apartment.create({
      data: { buildingId, apartmentNumber: String(aptCounter) }, select: { id: true },
    })
    const r = await prisma.resident.create({
      data: {
        tenantId, apartmentId: apartment.id,
        firstName: 'דייר', lastName: String(aptCounter), ...data,
      },
      select: { id: true },
    })
    return r.id
  }

  const purge = async () => {
    for (const slug of [A_SLUG, B_SLUG]) {
      const t = await prisma.tenant.findUnique({ where: { slug } })
      if (!t) continue
      await prisma.meetingAccessToken.deleteMany({
        where: { attendee: { meeting: { tenantId: t.id } } },
      })
      await prisma.meetingReminderDispatch.deleteMany({
        where: { meeting: { tenantId: t.id } },
      })
      await prisma.meetingAttendee.deleteMany({ where: { meeting: { tenantId: t.id } } })
      await prisma.meeting.deleteMany({ where: { tenantId: t.id } })
      await prisma.message.deleteMany({ where: { tenantId: t.id } })
      await prisma.notification.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.apartment.deleteMany({
        where: { building: { complex: { project: { tenantId: t.id } } } },
      })
      await prisma.building.deleteMany({ where: { complex: { project: { tenantId: t.id } } } })
      await prisma.complex.deleteMany({ where: { project: { tenantId: t.id } } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } })
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0,
        }),
      })
      .compile()

    app = moduleFixture.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, transform: true, forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })
    reminders = app.get(MeetingReminderService, { strict: false })
    access = app.get(MeetingAccessService, { strict: false })
    contacts = app.get(ResidentContactService, { strict: false })

    await purge()
    const a = await prisma.tenant.create({ data: { name: 'E2E ResComm A', slug: A_SLUG } })
    const b = await prisma.tenant.create({ data: { name: 'E2E ResComm B', slug: B_SLUG } })
    tenantAId = a.id
    tenantBId = b.id

    organiserId = await makeUser(tenantAId, 'organiser@e2e-rescomm.test', 'PROJECT_MANAGER')
    staffId = await makeUser(tenantAId, 'staff@e2e-rescomm.test', 'FIELD_AGENT')
    organiserToken = token(organiserId, tenantAId, 'PROJECT_MANAGER')

    const chainA = await makeProject(tenantAId, 'RC-A')
    projectAId = chainA.projectId

    smsResidentId = await makeResident(tenantAId, chainA.buildingId, {
      phone: '054-777-8899', smsOptIn: true, whatsappOptIn: false, emailOptIn: false,
      preferredChannel: 'SMS' as any,
    })
    waResidentId = await makeResident(tenantAId, chainA.buildingId, {
      phone: '0525556677', smsOptIn: true, whatsappOptIn: true,
      preferredChannel: 'WHATSAPP' as any,
    })
    mutedResidentId = await makeResident(tenantAId, chainA.buildingId, {
      phone: '0501110000', smsOptIn: true, whatsappOptIn: true, doNotContact: true,
    })
    unreachableResidentId = await makeResident(tenantAId, chainA.buildingId, {
      phone: null, email: null, smsOptIn: true, emailOptIn: true,
    })

    const chainB = await makeProject(tenantBId, 'RC-B')
    foreignResidentId = await makeResident(tenantBId, chainB.buildingId, {
      phone: '0509998877', smsOptIn: true,
    })
  })

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  const asOrganiser = () => ({ Authorization: `Bearer ${organiserToken}` })

  const schedule = (body: Record<string, any>) =>
    request(app.getHttpServer())
      .post('/api/v1/meetings').set(asOrganiser())
      .send({
        title: 'אסיפת דיירים',
        startTime: new Date(Date.now() + 48 * 3600e3).toISOString(),
        projectId: projectAId,
        ...body,
      })

  const messagesFor = (residentId: string, meetingId?: string) =>
    prisma.message.findMany({
      where: {
        tenantId: tenantAId, residentId,
        ...(meetingId ? { idempotencyKey: { contains: `meeting:${meetingId}:` } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

  /* ══ Phase 3: residents actually get told ═══════════════════════════════ */

  describe('resident attendees receive a real message', () => {
    let meetingId: string

    beforeAll(async () => {
      const res = await schedule({
        attendees: [{ userId: staffId }, { residentId: smsResidentId }],
      })
      expect(res.status).toBe(201)
      meetingId = res.body.id
    })

    it('queues an SMS on the resident’s consented channel', async () => {
      const msgs = await messagesFor(smsResidentId, meetingId)
      expect(msgs).toHaveLength(1)
      expect(msgs[0].channel).toBe('SMS')
      expect(msgs[0].status).toBe('QUEUED')
      expect(msgs[0].direction).toBe('OUTBOUND')
      // Normalised from the stored `054-777-8899`.
      expect(msgs[0].toPhone).toBe('+972547778899')
    })

    it('the message carries a tokenised invitation link, not a login', async () => {
      const [msg] = await messagesFor(smsResidentId, meetingId)
      expect(msg.body).toContain('/he/meetings/invite/')
      expect(msg.body).not.toMatch(/password|סיסמה/i)
    })

    it('NO User row was created for the resident — identities stay separate', async () => {
      const resident = await prisma.resident.findUniqueOrThrow({
        where: { id: smsResidentId },
        select: { portalUserId: true },
      })
      expect(resident.portalUserId).toBeNull()
      expect(await prisma.user.count({ where: { tenantId: tenantAId } })).toBe(2) // organiser + staff
    })

    it('the resident gets no Notification row — that FK is still User-only', async () => {
      const notes = await prisma.notification.count({
        where: { tenantId: tenantAId, entityId: meetingId },
      })
      // The staff attendee only. The organiser excludes themselves.
      expect(notes).toBe(1)
    })

    it('staff attendees still get their in-app notification', async () => {
      expect(await prisma.notification.count({
        where: { userId: staffId, entityId: meetingId },
      })).toBe(1)
    })

    it('honours WHATSAPP as the preferred channel when opted in', async () => {
      const res = await schedule({
        title: 'וואטסאפ', attendees: [{ residentId: waResidentId }],
      })
      expect(res.status).toBe(201)
      const msgs = await messagesFor(waResidentId, res.body.id)
      expect(msgs).toHaveLength(1)
      expect(msgs[0].channel).toBe('WHATSAPP')
    })

    it('doNotContact blocks the message entirely', async () => {
      const res = await schedule({
        title: 'חסום', attendees: [{ residentId: mutedResidentId }],
      })
      expect(res.status).toBe(201)
      // Recorded as an attendee...
      expect(res.body.attendees).toHaveLength(1)
      // ...but not messaged, on any channel, ever.
      expect(await messagesFor(mutedResidentId)).toHaveLength(0)
    })

    it('a resident with no usable contact details is reported, not silently dropped', async () => {
      const route = await contacts.route(tenantAId, unreachableResidentId)
      expect(isRoutable(route)).toBe(false)
      if (!isRoutable(route)) expect(route.reason).toBe('NO_VALID_PHONE')

      const res = await schedule({
        title: 'ללא קשר', attendees: [{ residentId: unreachableResidentId }],
      })
      expect(res.status).toBe(201)
      expect(await messagesFor(unreachableResidentId)).toHaveLength(0)
    })

    it('a scheduling request still succeeds when no resident can be reached', async () => {
      // The contract that matters: delivery failure degrades the invitation, it
      // does not fail the meeting.
      const res = await schedule({
        title: 'עדיין מצליח',
        attendees: [{ residentId: mutedResidentId }, { residentId: unreachableResidentId }],
      })
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('scheduled')
    })

    it('cancelling the meeting messages residents and revokes their links', async () => {
      const res = await schedule({
        title: 'לביטול', attendees: [{ residentId: smsResidentId }],
      })
      const id = res.body.id
      expect((await messagesFor(smsResidentId, id))).toHaveLength(1)

      const cancelled = await request(app.getHttpServer())
        .patch(`/api/v1/meetings/${id}/cancel`).set(asOrganiser())
        .send({ reason: 'מזג אוויר' })
      expect(cancelled.status).toBe(200)

      const msgs = await messagesFor(smsResidentId, id)
      expect(msgs).toHaveLength(2)
      expect(msgs.some((m) => m.body.includes('ביטול'))).toBe(true)

      const tokens = await prisma.meetingAccessToken.findMany({
        where: { attendee: { meetingId: id } },
      })
      expect(tokens.length).toBeGreaterThan(0)
      expect(tokens.every((t) => t.revokedAt !== null)).toBe(true)
    })

    it('cross-tenant resident invitation is refused → 404, and no message', async () => {
      const res = await schedule({
        title: 'חוצה דיירים', attendees: [{ residentId: foreignResidentId }],
      })
      expect(res.status).toBe(404)
      expect(await prisma.message.count({ where: { residentId: foreignResidentId } })).toBe(0)
    })

    it('resending the same roster does not re-invite existing attendees', async () => {
      const res = await schedule({
        title: 'כפילות', attendees: [{ residentId: smsResidentId }],
      })
      const id = res.body.id
      expect(await messagesFor(smsResidentId, id)).toHaveLength(1)

      const again = await request(app.getHttpServer())
        .post(`/api/v1/meetings/${id}/attendees`).set(asOrganiser())
        .send({ attendees: [{ residentId: smsResidentId }] })
      expect(again.status).toBe(201)
      expect(await messagesFor(smsResidentId, id)).toHaveLength(1)
    })
  })

  /* ══ Phase 4: tokenised RSVP ════════════════════════════════════════════ */

  describe('resident RSVP through the invitation token', () => {
    let meetingId: string
    let attendeeId: string
    let inviteToken: string

    const invite = (t: string) =>
      request(app.getHttpServer()).get(`/api/v1/meeting-invitations/${t}`)
    const rsvp = (t: string, body: any) =>
      request(app.getHttpServer()).post(`/api/v1/meeting-invitations/${t}/rsvp`).send(body)

    beforeAll(async () => {
      const res = await schedule({
        title: 'אסיפה עם RSVP', attendees: [{ residentId: smsResidentId }],
      })
      meetingId = res.body.id
      attendeeId = res.body.attendees[0].id
      const row = await prisma.meetingAccessToken.findUniqueOrThrow({ where: { attendeeId } })
      inviteToken = row.token
    })

    it('the token is 48 random bytes, url-safe — the SigningSession precedent', () => {
      expect(inviteToken).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(Buffer.from(inviteToken, 'base64url')).toHaveLength(48)
    })

    it('views the invitation with NO authentication', async () => {
      const res = await invite(inviteToken)
      expect(res.status).toBe(200)
      expect(res.body.meeting.title).toBe('אסיפה עם RSVP')
      expect(res.body.attendee.rsvpStatus).toBe('pending')
    })

    it('does NOT leak the attendee roster, organiser, notes or tenant', async () => {
      const res = await invite(inviteToken)
      const flat = JSON.stringify(res.body)
      expect(res.body.meeting.attendees).toBeUndefined()
      expect(flat).not.toContain(tenantAId)
      expect(flat).not.toContain(organiserId)
      expect(flat).not.toContain('notes')
    })

    it('accepts an RSVP and persists it with respondedVia = token', async () => {
      const res = await rsvp(inviteToken, { rsvpStatus: 'accepted' })
      expect(res.status).toBe(201)
      expect(res.body.attendee.rsvpStatus).toBe('accepted')

      const row = await prisma.meetingAttendee.findUniqueOrThrow({ where: { id: attendeeId } })
      expect(row.rsvpStatus).toBe('accepted')
      expect(row.respondedVia).toBe('token')
      expect(row.respondedAt).not.toBeNull()
      // Still not a user.
      expect(row.userId).toBeNull()
    })

    it('the staff CRM sees the resident’s answer', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/meetings/${meetingId}`).set(asOrganiser())
      expect(res.status).toBe(200)
      const attendee = res.body.attendees.find((a: any) => a.id === attendeeId)
      expect(attendee.rsvpStatus).toBe('accepted')
    })

    it('a resident may change their mind', async () => {
      const res = await rsvp(inviteToken, { rsvpStatus: 'declined' })
      expect(res.status).toBe(201)
      expect((await prisma.meetingAttendee.findUniqueOrThrow({
        where: { id: attendeeId },
      })).rsvpStatus).toBe('declined')
    })

    it('rejects an invalid answer → 400', async () => {
      const res = await rsvp(inviteToken, { rsvpStatus: 'maybe-ish' })
      expect(res.status).toBe(400)
    })

    it('rejects resetting to pending → 400', async () => {
      const res = await rsvp(inviteToken, { rsvpStatus: 'pending' })
      expect(res.status).toBe(400)
    })

    it('rejects unknown fields (no mass assignment) → 400', async () => {
      const res = await rsvp(inviteToken, { rsvpStatus: 'accepted', attended: true })
      expect(res.status).toBe(400)
    })

    it('an unknown token → 404', async () => {
      const res = await invite('A'.repeat(64))
      expect(res.status).toBe(404)
    })

    it('a malformed/short token → 404, never a 500', async () => {
      for (const t of ['x', 'short', '../../etc/passwd']) {
        const res = await invite(encodeURIComponent(t))
        expect([404, 400]).toContain(res.status)
      }
    })

    it('a revoked token → 404', async () => {
      const res = await schedule({ title: 'לביטול טוקן', attendees: [{ residentId: waResidentId }] })
      const aId = res.body.attendees[0].id
      const t = (await prisma.meetingAccessToken.findUniqueOrThrow({
        where: { attendeeId: aId },
      })).token

      expect((await invite(t)).status).toBe(200)
      await access.revokeForMeeting(res.body.id)
      expect((await invite(t)).status).toBe(404)
      expect((await rsvp(t, { rsvpStatus: 'accepted' })).status).toBe(404)
    })

    it('an expired token → 409 with a distinct code', async () => {
      const res = await schedule({ title: 'פג תוקף', attendees: [{ residentId: waResidentId }] })
      const aId = res.body.attendees[0].id
      const row = await prisma.meetingAccessToken.update({
        where: { attendeeId: aId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      })
      const r = await invite(row.token)
      expect(r.status).toBe(409)
      expect(r.body.code).toBe('MEETING_INVITE_EXPIRED')
    })

    it('replay is bounded — the token dies at the use ceiling', async () => {
      const res = await schedule({ title: 'שחזור', attendees: [{ residentId: waResidentId }] })
      const aId = res.body.attendees[0].id
      const t = (await prisma.meetingAccessToken.findUniqueOrThrow({
        where: { attendeeId: aId },
      })).token

      await prisma.meetingAccessToken.update({
        where: { attendeeId: aId },
        data: { useCount: MessagingConfig.meetingTokenMaxUses - 1 },
      })
      // The last permitted use.
      expect((await rsvp(t, { rsvpStatus: 'accepted' })).status).toBe(201)
      // Everything after it is inert.
      expect((await rsvp(t, { rsvpStatus: 'declined' })).status).toBe(404)
      expect((await invite(t)).status).toBe(404)
    })

    it('concurrent replays cannot exceed the ceiling', async () => {
      const res = await schedule({ title: 'מרוץ טוקן', attendees: [{ residentId: waResidentId }] })
      const aId = res.body.attendees[0].id
      const t = (await prisma.meetingAccessToken.findUniqueOrThrow({
        where: { attendeeId: aId },
      })).token
      await prisma.meetingAccessToken.update({
        where: { attendeeId: aId },
        data: { useCount: MessagingConfig.meetingTokenMaxUses - 1 },
      })

      const results = await Promise.all(
        Array.from({ length: 6 }, () => rsvp(t, { rsvpStatus: 'accepted' })),
      )
      expect(results.filter((r) => r.status === 201)).toHaveLength(1)
      const after = await prisma.meetingAccessToken.findUniqueOrThrow({ where: { attendeeId: aId } })
      expect(after.useCount).toBe(MessagingConfig.meetingTokenMaxUses)
    })

    it('one token cannot reach another resident’s invitation', async () => {
      const res = await schedule({
        title: 'שני דיירים',
        attendees: [{ residentId: smsResidentId }, { residentId: waResidentId }],
      })
      const [first, second] = res.body.attendees
      const t = (await prisma.meetingAccessToken.findUniqueOrThrow({
        where: { attendeeId: first.id },
      })).token

      const view = await invite(t)
      expect(view.body.attendee.id).toBe(first.id)
      expect(view.body.attendee.id).not.toBe(second.id)

      await rsvp(t, { rsvpStatus: 'accepted' })
      // The other attendee is untouched.
      expect((await prisma.meetingAttendee.findUniqueOrThrow({
        where: { id: second.id },
      })).rsvpStatus).toBe('pending')
    })

    it('RSVP on a cancelled meeting → 409', async () => {
      const res = await schedule({ title: 'בוטלה RSVP', attendees: [{ residentId: waResidentId }] })
      const aId = res.body.attendees[0].id
      const t = (await prisma.meetingAccessToken.findUniqueOrThrow({
        where: { attendeeId: aId },
      })).token
      // Cancel by hand so the tokens are not revoked, isolating the status check.
      await prisma.meeting.update({
        where: { id: res.body.id }, data: { status: 'cancelled', cancelledAt: new Date() },
      })
      const r = await rsvp(t, { rsvpStatus: 'accepted' })
      expect(r.status).toBe(409)
    })

    it('attendance cannot be confirmed before the meeting has started → 409', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/meeting-invitations/${inviteToken}/attendance`)
        .send({ attended: true })
      expect(r.status).toBe(409)
    })

    it('attendance can be confirmed after it has started, in a separate column', async () => {
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { startTime: new Date(Date.now() - 3600e3) },
      })
      const r = await request(app.getHttpServer())
        .post(`/api/v1/meeting-invitations/${inviteToken}/attendance`)
        .send({ attended: true })
      expect(r.status).toBe(201)

      const row = await prisma.meetingAttendee.findUniqueOrThrow({ where: { id: attendeeId } })
      expect(row.attended).toBe(true)
      // RSVP is NOT overwritten — accepted-then-absent must stay representable.
      expect(row.rsvpStatus).toBe('declined')
    })
  })

  /* ══ Phase 4b: the Portal invitation page contract ══════════════════════ */

  /**
   * The Portal page at /he/meetings/invite/:token renders one of seven states,
   * and it decides which one PURELY from this payload. Phase 4 proved the API
   * behaves; this block proves the API tells the page enough to render every
   * state, which is a separate failure mode — the page shipped after the API,
   * and a missing `readOnly` or `cancelReason` would silently degrade it to a
   * blank card rather than an error anyone would notice.
   */
  describe('portal invitation page contract', () => {
    const invite = (t: string) =>
      request(app.getHttpServer()).get(`/api/v1/meeting-invitations/${t}`)
    const rsvp = (t: string, body: any) =>
      request(app.getHttpServer()).post(`/api/v1/meeting-invitations/${t}/rsvp`).send(body)

    /** Schedules a meeting for one resident and returns its live token. */
    const freshToken = async (title: string, extra: Record<string, any> = {}) => {
      const res = await schedule({ title, attendees: [{ residentId: waResidentId }], ...extra })
      expect(res.status).toBe(201)
      const attendeeId = res.body.attendees[0].id
      const row = await prisma.meetingAccessToken.findUniqueOrThrow({ where: { attendeeId } })
      return { meetingId: res.body.id as string, attendeeId, token: row.token }
    }

    it('the issued URL is the route the Portal page actually serves', async () => {
      const { attendeeId } = await freshToken('כתובת קישור')
      const issued = await access.issueForAttendee(attendeeId)
      expect(issued).not.toBeNull()
      // If this path ever changes, apps/portal/src/app/[locale]/meetings/invite/[token]
      // must move with it or every SMS link 404s.
      expect(issued!.url).toContain(`/he/meetings/invite/${issued!.token}`)
    })

    it('carries every field the page renders in its main state', async () => {
      const { token: t } = await freshToken('אסיפת דיירים לפורטל')
      const { body } = await invite(t).expect(200)

      // Meeting block — the details card.
      for (const key of [
        'id', 'title', 'description', 'location', 'isVirtual', 'meetingUrl',
        'startTime', 'endTime', 'status', 'cancelledAt', 'cancelReason', 'projectName',
      ]) {
        expect(body.meeting).toHaveProperty(key)
      }
      // Attendee block — the greeting and the answer badge.
      for (const key of ['id', 'residentName', 'rsvpStatus', 'respondedAt', 'attended']) {
        expect(body.attendee).toHaveProperty(key)
      }
      expect(typeof body.readOnly).toBe('boolean')
      expect(body.meeting.status).toBe('scheduled')
      expect(body.attendee.residentName.length).toBeGreaterThan(0)
      expect(body.readOnly).toBe(false)
    })

    it('a scheduled, unanswered invitation is writable — the page shows the buttons', async () => {
      const { token: t } = await freshToken('מצב כפתורים')
      const { body } = await invite(t).expect(200)
      expect(body.attendee.rsvpStatus).toBe('pending')
      expect(body.readOnly).toBe(false)
    })

    it('after answering, readOnly stays false so the answer can still be changed', async () => {
      const { token: t } = await freshToken('שינוי תשובה')
      const answered = await rsvp(t, { rsvpStatus: 'accepted' }).expect(201)
      expect(answered.body.attendee.rsvpStatus).toBe('accepted')
      expect(answered.body.attendee.respondedAt).not.toBeNull()
      expect(answered.body.readOnly).toBe(false)
    })

    it('readOnly flips true at the replay ceiling — the page stops offering to change', async () => {
      const { attendeeId, token: t } = await freshToken('תקרת שימושים')
      await prisma.meetingAccessToken.update({
        where: { attendeeId },
        data: { useCount: MessagingConfig.meetingTokenMaxUses - 1 },
      })
      const last = await rsvp(t, { rsvpStatus: 'accepted' }).expect(201)
      expect(last.body.readOnly).toBe(true)
    })

    it('a completed meeting is readOnly — the page shows "already held"', async () => {
      const { meetingId, token: t } = await freshToken('כבר התקיימה')
      await prisma.meeting.update({ where: { id: meetingId }, data: { status: 'completed' } })
      const { body } = await invite(t).expect(200)
      expect(body.meeting.status).toBe('completed')
      expect(body.readOnly).toBe(true)
    })

    it('a cancelled meeting is VIEWABLE with its reason — not a dead 404', async () => {
      const { meetingId, token: t } = await freshToken('בוטלה לפורטל')
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'אין קוורום' },
      })
      // The page needs the reason to explain itself, so view must still succeed.
      const { body } = await invite(t).expect(200)
      expect(body.meeting.status).toBe('cancelled')
      expect(body.meeting.cancelReason).toBe('אין קוורום')
      expect(body.meeting.cancelledAt).not.toBeNull()
      expect(body.readOnly).toBe(true)
      // ...but answering is refused server-side, not merely hidden in the UI.
      await rsvp(t, { rsvpStatus: 'accepted' }).expect(409)
    })

    it('exposes the virtual-meeting link when the meeting is online', async () => {
      const { token: t } = await freshToken('פגישה מקוונת', {
        isVirtual: true, meetingUrl: 'https://meet.example.test/abc',
      })
      const { body } = await invite(t).expect(200)
      expect(body.meeting.isVirtual).toBe(true)
      expect(body.meeting.meetingUrl).toBe('https://meet.example.test/abc')
    })

    it('distinguishes expired (409 + code) from not-found (404) so the page can too', async () => {
      const { attendeeId, token: expiredToken } = await freshToken('פג לפורטל')
      await prisma.meetingAccessToken.update({
        where: { attendeeId }, data: { expiresAt: new Date(Date.now() - MIN) },
      })
      const expired = await invite(expiredToken)
      expect(expired.status).toBe(409)
      expect(expired.body.code).toBe('MEETING_INVITE_EXPIRED')
      expect(typeof expired.body.message).toBe('string')

      const missing = await invite('Z'.repeat(64))
      expect(missing.status).toBe(404)
      expect(missing.body.code).toBe('MEETING_INVITE_NOT_FOUND')
    })

    it('the attendance answer round-trips through the same payload', async () => {
      const { meetingId, token: t } = await freshToken('נוכחות פורטל')
      await rsvp(t, { rsvpStatus: 'accepted' }).expect(201)
      await prisma.meeting.update({
        where: { id: meetingId }, data: { startTime: new Date(Date.now() - 3600e3) },
      })

      const before = await invite(t).expect(200)
      expect(before.body.attendee.attended).toBeNull()

      const after = await request(app.getHttpServer())
        .post(`/api/v1/meeting-invitations/${t}/attendance`)
        .send({ attended: true })
        .expect(201)
      expect(after.body.attendee.attended).toBe(true)
      // RSVP survives — the page renders both independently.
      expect(after.body.attendee.rsvpStatus).toBe('accepted')
    })

    it('leaks nothing the page has no business rendering', async () => {
      const { token: t } = await freshToken('דליפה לפורטל')
      const { body } = await invite(t).expect(200)
      const flat = JSON.stringify(body)
      expect(flat).not.toContain(tenantAId)
      expect(flat).not.toContain(t)          // the token never echoes back
      expect(body.attendee).not.toHaveProperty('residentId')
      expect(body.meeting).not.toHaveProperty('tenantId')
      expect(flat).not.toMatch(/passwordHash|nationalId|phone|email/i)
    })
  })

  /* ══ Phase 5: reminders ═════════════════════════════════════════════════ */

  describe('meeting reminders', () => {
    const OFFSET = MessagingConfig.reminderOffsetsMinutes[
      MessagingConfig.reminderOffsetsMinutes.length - 1
    ]

    /**
     * A meeting that is inside the smallest reminder window AND existed before
     * that window opened — the service deliberately refuses to fire a reminder
     * for a window the meeting was created inside (see the comment there), so
     * `createdAt` is backdated to make this a genuine due reminder rather than
     * an instant one.
     */
    const scheduleDue = async (title: string, attendees: any[]) => {
      const res = await schedule({
        title,
        startTime: new Date(Date.now() + (OFFSET - 5) * MIN).toISOString(),
        attendees,
      })
      expect(res.status).toBe(201)
      await prisma.meeting.update({
        where: { id: res.body.id },
        data: { createdAt: new Date(Date.now() - 2 * OFFSET * MIN) },
      })
      return res.body.id as string
    }

    it('sends one reminder to staff and residents', async () => {
      const id = await scheduleDue('תזכורת', [
        { userId: staffId }, { residentId: smsResidentId },
      ])
      const before = (await messagesFor(smsResidentId, id)).length

      const r = await reminders.scan()
      expect(r.remindersDispatched).toBeGreaterThanOrEqual(1)

      const msgs = await messagesFor(smsResidentId, id)
      expect(msgs.length).toBe(before + 1)
      expect(msgs[0].body).toContain('תזכורת')
      expect(msgs[0].idempotencyKey).toContain(`:reminder:${OFFSET}`)

      expect(await prisma.notification.count({
        where: { userId: staffId, entityId: id, title: { contains: 'תזכורת' } },
      })).toBe(1)
    })

    it('a second scan sends NO duplicate', async () => {
      const id = await scheduleDue('תזכורת יחידה', [
        { userId: staffId }, { residentId: smsResidentId },
      ])
      await reminders.scan()
      const afterFirst = (await messagesFor(smsResidentId, id)).length
      const notesFirst = await prisma.notification.count({ where: { entityId: id } })

      await reminders.scan()
      await reminders.scan()

      expect((await messagesFor(smsResidentId, id)).length).toBe(afterFirst)
      expect(await prisma.notification.count({ where: { entityId: id } })).toBe(notesFirst)

      // Exactly one dispatch row for this offset — the claim, not a guess.
      expect(await prisma.meetingReminderDispatch.count({
        where: { meetingId: id, offsetMinutes: OFFSET },
      })).toBe(1)
    })

    it('concurrent scans do not duplicate', async () => {
      const id = await scheduleDue('תזכורת מקבילה', [{ residentId: smsResidentId }])
      const before = (await messagesFor(smsResidentId, id)).length

      await Promise.all([reminders.scan(), reminders.scan(), reminders.scan()])

      expect((await messagesFor(smsResidentId, id)).length).toBe(before + 1)
      expect(await prisma.meetingReminderDispatch.count({
        where: { meetingId: id, offsetMinutes: OFFSET },
      })).toBe(1)
    })

    it('a CANCELLED meeting produces no reminder at all', async () => {
      const id = await scheduleDue('בוטלה', [{ residentId: smsResidentId }])
      const cancelRes = await request(app.getHttpServer())
        .patch(`/api/v1/meetings/${id}/cancel`).set(asOrganiser()).send({ reason: 'בוטל' })
      expect(cancelRes.status).toBe(200)

      const before = (await messagesFor(smsResidentId, id)).length
      await reminders.scan()

      expect((await messagesFor(smsResidentId, id)).length).toBe(before)
      expect(await prisma.meetingReminderDispatch.count({ where: { meetingId: id } })).toBe(0)
    })

    it('a meeting outside the window is not reminded yet', async () => {
      const res = await schedule({
        title: 'רחוקה',
        startTime: new Date(Date.now() + 40 * 24 * 3600e3).toISOString(),
        attendees: [{ residentId: smsResidentId }],
      })
      await reminders.scan()
      expect(await prisma.meetingReminderDispatch.count({
        where: { meetingId: res.body.id },
      })).toBe(0)
    })

    it('a meeting already in the past is not reminded', async () => {
      const res = await schedule({ title: 'עברה', attendees: [{ residentId: smsResidentId }] })
      await prisma.meeting.update({
        where: { id: res.body.id },
        data: { startTime: new Date(Date.now() - 3600e3) },
      })
      await reminders.scan()
      expect(await prisma.meetingReminderDispatch.count({
        where: { meetingId: res.body.id },
      })).toBe(0)
    })

    it('only actual attendees are reminded', async () => {
      const id = await scheduleDue('רק משתתפים', [{ residentId: smsResidentId }])
      await reminders.scan()
      // waResident was never invited to THIS meeting.
      const strayed = await prisma.message.count({
        where: { residentId: waResidentId, idempotencyKey: { contains: `meeting:${id}:` } },
      })
      expect(strayed).toBe(0)
    })

    it('an opted-out resident is not reminded either', async () => {
      const id = await scheduleDue('חסום תזכורת', [{ residentId: mutedResidentId }])
      await reminders.scan()
      expect(await messagesFor(mutedResidentId, id)).toHaveLength(0)
    })

    it('nothing is transmitted in development — every external channel simulates', async () => {
      /*
       * Asserted against the REGISTRY rather than by inspecting dispatched
       * rows. Rows are the weaker evidence here: the dispatcher is a global
       * worker, so a sibling suite running in another Jest worker can claim
       * these same rows with its own stubbed provider and the assertion would
       * be measuring that suite instead of this behaviour.
       *
       * The registry is the actual control. `MESSAGING_SIMULATE` defaults on
       * outside production, so every EXTERNAL channel must resolve to the
       * dev/no-op provider, which transmits nothing and stamps
       * `isSimulated: true`. PORTAL is exempt because its "provider" is our own
       * database — there is no external system to protect a resident from.
       */
      const registry = app.get(
        require('../src/messaging/provider-registry.service').ProviderRegistryService,
        { strict: false },
      )
      expect(MessagingConfig.forceSimulation).toBe(true)
      for (const channel of ['SMS', 'WHATSAPP', 'EMAIL']) {
        const provider = registry.resolve(channel as any)
        expect(provider.name).toBe('dev-noop')
        const result = await provider.send({
          messageId: 'probe', channel, toPhone: '+972500000000', body: 'x',
        } as any)
        expect(result.simulated).toBe(true)
      }
      expect(registry.resolve('PORTAL' as any).name).toBe('portal-inbox')
    })

    it('a dispatched external message is recorded as simulated', async () => {
      const dispatcher = app.get(
        require('../src/messaging/message-dispatcher.service').MessageDispatcherService,
        { strict: false },
      )
      const id = await scheduleDue('סימולציה', [{ residentId: smsResidentId }])
      await reminders.scan()
      const [msg] = await messagesFor(smsResidentId, id)
      expect(msg).toBeTruthy()

      await dispatcher.processOne(msg.id)
      const after = await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })
      // Either this process dispatched it (dev-noop, simulated) or a sibling
      // worker did — in both cases it must never have reached a real provider.
      if (after.providerName === 'dev-noop') {
        expect(after.isSimulated).toBe(true)
        expect(after.status).toBe('SENT')
      }
      expect(after.providerName).not.toMatch(/^sms:(vonage|twilio|inforu)$/)
      expect(after.providerName).not.toBe('whatsapp:meta-cloud')
    })
  })
})
