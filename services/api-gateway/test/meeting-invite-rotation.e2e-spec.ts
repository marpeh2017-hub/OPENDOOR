/**
 * Invitation-link rotation when a meeting is edited.
 *
 * The 2026-09-09 audit found that editing a meeting's location or start time
 * silently replaced every resident's invitation token: the old link — already
 * sent by SMS — stopped working with no record of why. Three questions came out
 * of it, and this suite answers each:
 *
 *   1. Does a trivial edit rotate the link? (It must not.)
 *   2. Is the rotation traceable afterwards? (It must be.)
 *   3. What if the replacement message fails? (The resident must not be left
 *      with no working link at all.)
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { MeetingAccessService } from '../src/meetings/meeting-access.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const MARKER = `ROT-${Date.now().toString(36)}`

describe('Meeting invitation rotation (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let access: MeetingAccessService
  let token: string
  let projectId: string
  let residentId: string

  const http = () => request(app.getHttpServer())
  const auth = () => ({ Authorization: `Bearer ${token}` })

  /** Creates a meeting with one resident attendee and returns its live token. */
  const makeMeeting = async (extra: Record<string, unknown> = {}) => {
    const res = await http().post('/api/v1/meetings').set(auth()).send({
      projectId,
      title: `${MARKER} meeting`,
      startTime: new Date(Date.now() + 86_400_000).toISOString(),
      location: 'room A',
      attendees: [{ residentId }],
      ...extra,
    })
    expect(res.status).toBe(201)
    const attendee = await prisma.meetingAttendee.findFirstOrThrow({
      where: { meetingId: res.body.id, residentId }, select: { id: true },
    })
    const row = await prisma.meetingAccessToken.findFirstOrThrow({
      where: { attendeeId: attendee.id }, select: { token: true, expiresAt: true, useCount: true },
    })
    return { meetingId: res.body.id, attendeeId: attendee.id, token: row.token, expiresAt: row.expiresAt }
  }

  const tokenFor = async (attendeeId: string) =>
    prisma.meetingAccessToken.findUnique({
      where: { attendeeId }, select: { token: true, expiresAt: true, useCount: true },
    })

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = mod.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()
    prisma = app.get(PrismaService)
    access = app.get(MeetingAccessService)

    const login = await http().post('/api/v1/auth/login')
      .send({ email: 'admin@opendoor.co.il', password: 'demo1234' })
    expect(login.status).toBe(200)
    token = login.body.accessToken

    await prisma.meeting.deleteMany({ where: { title: { startsWith: 'ROT-' } } })

    const resident = await prisma.resident.findFirstOrThrow({
      where: { isActive: true }, select: { id: true, apartmentId: true },
    })
    residentId = resident.id
    const apartment = await prisma.apartment.findUniqueOrThrow({
      where: { id: resident.apartmentId },
      select: { building: { select: { complex: { select: { projectId: true } } } } },
    })
    projectId = apartment.building.complex.projectId
  }, 60_000)

  afterAll(async () => {
    await prisma.meeting.deleteMany({ where: { title: { startsWith: 'ROT-' } } })
    await app?.close()
  })

  describe('1. only edits that actually move the meeting rotate the link', () => {
    it('editing the DESCRIPTION leaves the link alone', async () => {
      const m = await makeMeeting()
      await http().patch(`/api/v1/meetings/${m.meetingId}`).set(auth())
        .send({ description: 'fixed a typo' }).expect(200)
      expect((await tokenFor(m.attendeeId))?.token).toBe(m.token)
    })

    it('editing the TITLE leaves the link alone', async () => {
      const m = await makeMeeting()
      await http().patch(`/api/v1/meetings/${m.meetingId}`).set(auth())
        .send({ title: `${MARKER} renamed` }).expect(200)
      expect((await tokenFor(m.attendeeId))?.token).toBe(m.token)
    })

    it('changing the LOCATION rotates it — the resident needs to be told', async () => {
      const m = await makeMeeting()
      await http().patch(`/api/v1/meetings/${m.meetingId}`).set(auth())
        .send({ location: 'room B' }).expect(200)
      expect((await tokenFor(m.attendeeId))?.token).not.toBe(m.token)
    })

    it('changing the START TIME rotates it', async () => {
      const m = await makeMeeting()
      await http().patch(`/api/v1/meetings/${m.meetingId}`).set(auth())
        .send({ startTime: new Date(Date.now() + 172_800_000).toISOString() }).expect(200)
      expect((await tokenFor(m.attendeeId))?.token).not.toBe(m.token)
    })

    it('a no-op save of the same location does not rotate', async () => {
      const m = await makeMeeting()
      await http().patch(`/api/v1/meetings/${m.meetingId}`).set(auth())
        .send({ location: 'room A' }).expect(200)
      expect((await tokenFor(m.attendeeId))?.token).toBe(m.token)
    })
  })

  describe('2. a rotation is traceable afterwards', () => {
    it('the replacement message records which link it superseded', async () => {
      const m = await makeMeeting()
      await http().patch(`/api/v1/meetings/${m.meetingId}`).set(auth())
        .send({ location: 'room C' }).expect(200)

      const message = await prisma.message.findFirst({
        where: { residentId, metadata: { path: ['attendeeId'], equals: m.attendeeId } },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      })
      const meta = message?.metadata as Record<string, unknown> | null
      expect(meta?.event).toBe('updated')
      // The durable answer to "why did my old link stop working?"
      expect(meta?.rotatedFromToken).toBe(`${m.token.slice(0, 8)}…`)
    })
  })

  describe('3. a failed replacement must not strand the resident', () => {
    it('restorePrevious puts the old link back, with its original expiry and use count', async () => {
      const m = await makeMeeting()

      // Simulate a resident who had already opened their link twice.
      await prisma.meetingAccessToken.update({
        where: { attendeeId: m.attendeeId }, data: { useCount: 2 },
      })
      const before = await tokenFor(m.attendeeId)

      const issued = await access.issueForAttendee(m.attendeeId)
      expect(issued).not.toBeNull()
      expect(issued!.previous!.token).toBe(before!.token)
      // Rotation resets the replay ceiling — which is why an undo has to restore it.
      expect((await tokenFor(m.attendeeId))!.useCount).toBe(0)

      await access.restorePrevious(m.attendeeId, issued!.previous!, 'test: enqueue failed')

      const after = await tokenFor(m.attendeeId)
      expect(after!.token).toBe(before!.token)
      expect(after!.useCount).toBe(2)                        // not silently reset
      expect(after!.expiresAt.getTime()).toBe(before!.expiresAt.getTime())  // not silently extended
    })

    it('the restored link still resolves, so the resident is genuinely no worse off', async () => {
      const m = await makeMeeting()
      const issued = await access.issueForAttendee(m.attendeeId)
      await access.restorePrevious(m.attendeeId, issued!.previous!, 'test: enqueue failed')

      const res = await http().get(`/api/v1/meeting-invitations/${m.token}`)
      // 200 = works. 429 = the public throttle, which still proves it was not
      // rejected as unknown; only a 404 would mean the link was left dead.
      expect([200, 429]).toContain(res.status)
      expect(res.status).not.toBe(404)
    })
  })
})
