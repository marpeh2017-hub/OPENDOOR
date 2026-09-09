/**
 * Meetings E2E (Phase C).
 *
 * `Meeting` and `MeetingAttendee` were schema-only models — no controller, no
 * service, no reader, no writer. This suite pins the module that now backs
 * them, and specifically the four things most likely to be got wrong:
 *
 *   1. INVITATIONS ACTUALLY EMIT NOTIFICATIONS. The Phase C → Phase B
 *      dependency is asserted by reading the notification rows back, not by
 *      trusting that a service method was called.
 *   2. RSVP IS FIRST-PERSON. A user cannot answer another user's invitation,
 *      regardless of role — proved by attempting it and then re-reading the
 *      victim's row to show it is unchanged.
 *   3. RSVP AND ATTENDANCE ARE DIFFERENT COLUMNS. Accepted-then-absent is
 *      representable, which is the whole reason for tracking both.
 *   4. CROSS-TENANT REFERENCES ARE REFUSED. Not just the meeting id — the
 *      project, the invited user and the invited resident are each checked,
 *      and each answers 404 rather than 403.
 *
 * No password is used anywhere: tokens are minted through JwtService, always
 * WITH `sessionId` (JwtStrategy rejects a token without one, so omitting it
 * would make every assertion here vacuous).
 *
 * Every row created is removed in afterAll.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { MEETING_STATUSES, RSVP_STATUSES } from '../src/meetings/meeting-constants'
import { MEETING_WRITE_ROLES, STAFF_ROLES } from '../src/auth/roles.constants'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const A_SLUG = 'e2e-meet-tenant-a'
const B_SLUG = 'e2e-meet-tenant-b'

const HOUR = 3600e3
const soon = (offsetHours: number) =>
  new Date(Date.now() + offsetHours * HOUR).toISOString()

describe('Meetings (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  // Tenant A
  let tenantAId: string
  let organiserId: string   // schedules meetings
  let inviteeId: string     // gets invited, answers for themselves
  let observerId: string    // MUNICIPALITY_USER — reads, cannot schedule
  let projectAId: string
  let residentAId: string

  // Tenant B
  let tenantBId: string
  let strangerId: string
  let projectBId: string
  let residentBId: string

  const token = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      {
        sub: userId, email: `${userId}@example.com`, role, tenantId, sessionId: randomUUID(),
        // A RESIDENT token must ALSO carry its project and resident scope, for
        // the same reason it must carry a sessionId: `JwtStrategy` rejects a
        // resident token it cannot safely scope, so without these the 403 under
        // test here would never be reached — the request would 401 first. The
        // ids are probes: these routes are staff routes and run no
        // resident-scoped query.
        ...(role === 'RESIDENT' ? { projectId: 'prj_rbac_probe', residentId: 'res_rbac_probe' } : {}),
      },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  let organiserToken: string
  let inviteeToken: string
  let observerToken: string
  let strangerToken: string

  const asOrganiser = () => ({ Authorization: `Bearer ${organiserToken}` })
  const asInvitee   = () => ({ Authorization: `Bearer ${inviteeToken}` })
  const asObserver  = () => ({ Authorization: `Bearer ${observerToken}` })
  const asStranger  = () => ({ Authorization: `Bearer ${strangerToken}` })
  const api = () => request(app.getHttpServer())

  const makeUser = async (tenantId: string, email: string, role: string) => {
    const u = await prisma.user.create({
      data: {
        tenantId, email, firstName: 'E2E', lastName: email.split('@')[0],
        // Never used: this suite mints tokens directly and authenticates no one
        // by password.
        passwordHash: 'not-a-usable-credential',
        role: role as never,
      },
      select: { id: true },
    })
    return u.id
  }

  /** A project with the full Complex → Building → Apartment → Resident chain,
   *  because resident invitations are validated by traversing exactly that. */
  const makeProjectWithResident = async (tenantId: string, code: string) => {
    const project = await prisma.project.create({
      data: { tenantId, code, name: `Meetings ${code}`, city: 'תל אביב' },
      select: { id: true },
    })
    const complex = await prisma.complex.create({
      data: { projectId: project.id, name: `מתחם ${code}`, address: 'רחוב הבדיקה 1' },
      select: { id: true },
    })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: 'רחוב הבדיקה 1', city: 'תל אביב' },
      select: { id: true },
    })
    const apartment = await prisma.apartment.create({
      data: { buildingId: building.id, apartmentNumber: '1' },
      select: { id: true },
    })
    const resident = await prisma.resident.create({
      data: {
        tenantId, apartmentId: apartment.id,
        firstName: 'דייר', lastName: code,
      },
      select: { id: true },
    })
    return { projectId: project.id, residentId: resident.id }
  }

  const purge = async () => {
    for (const slug of [A_SLUG, B_SLUG]) {
      const t = await prisma.tenant.findUnique({ where: { slug } })
      if (!t) continue
      await prisma.meetingAccessToken.deleteMany({
        where: { attendee: { meeting: { tenantId: t.id } } },
      })
      await prisma.meetingReminderDispatch.deleteMany({ where: { meeting: { tenantId: t.id } } })
      await prisma.meetingAttendee.deleteMany({ where: { meeting: { tenantId: t.id } } })
      await prisma.meeting.deleteMany({ where: { tenantId: t.id } })
      await prisma.message.deleteMany({ where: { tenantId: t.id } })
      await prisma.notification.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.apartment.deleteMany({
        where: { building: { complex: { project: { tenantId: t.id } } } },
      })
      await prisma.building.deleteMany({
        where: { complex: { project: { tenantId: t.id } } },
      })
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
      // Same seam and reasoning as the documents and notifications suites: the
      // global ThrottlerGuard's 20 req/s would turn the RBAC and isolation
      // assertions into 429s. Replacing the STORAGE (not the guard, which
      // `useClass` reconstructs) removes only the rate limit. Every meetings
      // guard stays fully active.
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0,
        }),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    // Mirrors main.ts exactly. `forbidNonWhitelisted` is what gives the
    // mass-assignment assertions their meaning.
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, transform: true, forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })

    await purge()

    const a = await prisma.tenant.create({ data: { name: 'E2E Meet A', slug: A_SLUG } })
    const b = await prisma.tenant.create({ data: { name: 'E2E Meet B', slug: B_SLUG } })
    tenantAId = a.id
    tenantBId = b.id
    expect(tenantAId).not.toBe(tenantBId)

    organiserId = await makeUser(tenantAId, 'organiser@e2e-meet.test', 'PROJECT_MANAGER')
    inviteeId   = await makeUser(tenantAId, 'invitee@e2e-meet.test', 'FIELD_AGENT')
    observerId  = await makeUser(tenantAId, 'observer@e2e-meet.test', 'MUNICIPALITY_USER')
    strangerId  = await makeUser(tenantBId, 'stranger@e2e-meet.test', 'PROJECT_MANAGER')

    const aChain = await makeProjectWithResident(tenantAId, 'MEET-A')
    projectAId = aChain.projectId
    residentAId = aChain.residentId
    const bChain = await makeProjectWithResident(tenantBId, 'MEET-B')
    projectBId = bChain.projectId
    residentBId = bChain.residentId

    organiserToken = token(organiserId, tenantAId, 'PROJECT_MANAGER')
    inviteeToken   = token(inviteeId, tenantAId, 'FIELD_AGENT')
    observerToken  = token(observerId, tenantAId, 'MUNICIPALITY_USER')
    strangerToken  = token(strangerId, tenantBId, 'PROJECT_MANAGER')
  })

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  const clearMeetings = async () => {
    await prisma.meetingAttendee.deleteMany({
      where: { meeting: { tenantId: { in: [tenantAId, tenantBId] } } },
    })
    await prisma.meeting.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } })
    await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } })
  }

  /** Schedules a meeting as the organiser, inviting `inviteeId` by default. */
  const schedule = (overrides: Record<string, unknown> = {}) =>
    api().post('/api/v1/meetings').set(asOrganiser()).send({
      title: 'פגישת דיירים',
      description: 'דיון בהצעת היזם',
      location: 'מועדון הבניין',
      startTime: soon(24),
      endTime: soon(25),
      projectId: projectAId,
      attendees: [{ userId: inviteeId, role: 'attendee' }],
      ...overrides,
    })

  /* ── Scheduling ────────────────────────────────────────────────── */

  describe('POST /meetings — scheduling', () => {
    beforeEach(clearMeetings)

    it('creates a scheduled meeting with attendees and stamps the organiser', async () => {
      const res = await schedule()
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('scheduled')
      expect(res.body.tenantId).toBe(tenantAId)
      // createdById comes from req.user.userId — reading req.user.sub instead
      // yields undefined, which is a bug this codebase has had 11 times.
      expect(res.body.createdById).toBe(organiserId)
      expect(res.body.projectId).toBe(projectAId)
      expect(res.body.attendees).toHaveLength(1)
      expect(res.body.attendees[0].userId).toBe(inviteeId)
      expect(res.body.attendees[0].rsvpStatus).toBe('pending')
      expect(res.body.attendees[0].respondedAt).toBeNull()
      expect(res.body.attendees[0].attended).toBeNull()
    })

    it('EMITS a MEETING notification to each invited staff attendee', async () => {
      // The Phase C → Phase B dependency, asserted on the stored rows rather
      // than on a spy.
      const res = await schedule()
      const rows = await prisma.notification.findMany({
        where: { tenantId: tenantAId, entityType: 'Meeting', entityId: res.body.id },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].userId).toBe(inviteeId)
      expect(rows[0].type).toBe('MEETING')
      expect(rows[0].link).toBe(`/meetings/${res.body.id}`)
      expect(rows[0].isRead).toBe(false)
    })

    it('does NOT notify the organiser about their own meeting', async () => {
      const res = await schedule({
        attendees: [{ userId: inviteeId }, { userId: organiserId, role: 'organizer' }],
      })
      expect(res.status).toBe(201)
      const mine = await prisma.notification.count({
        where: { userId: organiserId, entityId: res.body.id },
      })
      expect(mine).toBe(0)
      // ...but the invitee still got theirs.
      expect(await prisma.notification.count({
        where: { userId: inviteeId, entityId: res.body.id },
      })).toBe(1)
    })

    /**
     * UPDATED FOR PHASE 3. This test previously pinned a limitation — "invites a
     * resident and records them, but sends no notification" — because
     * `Notification.userId` is an FK to `User` and a Resident is not one.
     *
     * That FK constraint has NOT changed and residents are still not Users. What
     * changed is that residents are no longer unreachable: they are contacted
     * through the communications dispatcher instead, on a channel they consented
     * to. So the assertion is now the SEPARATION rather than the silence — the
     * resident gets no `Notification` row (that path is still staff-only) and no
     * `User` row is minted for them.
     *
     * The delivery half is covered end to end in
     * `resident-communications.e2e-spec.ts`, which uses residents that have a
     * phone number on file. The residents in THIS suite deliberately have none,
     * so they route as unreachable and no message is queued — which is itself
     * the "reported, not silently dropped" behaviour.
     */
    it('invites a resident without making them a User or a notification recipient', async () => {
      const res = await schedule({
        attendees: [{ userId: inviteeId }, { residentId: residentAId }],
      })
      expect(res.status).toBe(201)
      expect(res.body.attendees).toHaveLength(2)
      const resident = res.body.attendees.find((a: any) => a.residentId === residentAId)
      expect(resident).toBeTruthy()
      expect(resident.userId).toBeNull()

      // Still staff-only: Notification.userId remains an FK to User.
      const notified = await prisma.notification.count({ where: { entityId: res.body.id } })
      expect(notified).toBe(1) // the staff invitee only

      // Resident identity was NOT promoted to a staff identity.
      const row = await prisma.resident.findUniqueOrThrow({
        where: { id: residentAId }, select: { portalUserId: true },
      })
      expect(row.portalUserId).toBeNull()

      // No contact details on file → routed as unreachable, nothing queued.
      expect(await prisma.message.count({
        where: { residentId: residentAId, idempotencyKey: { contains: `meeting:${res.body.id}:` } },
      })).toBe(0)
    })

    it('collapses a duplicated invitee instead of failing on the unique constraint', async () => {
      const res = await schedule({
        attendees: [{ userId: inviteeId }, { userId: inviteeId, role: 'guest' }],
      })
      expect(res.status).toBe(201)
      expect(res.body.attendees).toHaveLength(1)
      // And exactly one notification, not two.
      expect(await prisma.notification.count({
        where: { userId: inviteeId, entityId: res.body.id },
      })).toBe(1)
    })

    it('allows a meeting with no attendees at all', async () => {
      const res = await schedule({ attendees: undefined })
      expect(res.status).toBe(201)
      expect(res.body.attendees).toHaveLength(0)
    })

    it('rejects endTime at or before startTime → 400', async () => {
      const at = soon(10)
      for (const endTime of [at, soon(9)]) {
        const res = await schedule({ startTime: at, endTime })
        expect(res.status).toBe(400)
      }
    })

    it('rejects an attendee naming BOTH a user and a resident → 400', async () => {
      const res = await schedule({
        attendees: [{ userId: inviteeId, residentId: residentAId }],
      })
      expect(res.status).toBe(400)
    })

    it('rejects an attendee naming NEITHER → 400', async () => {
      const res = await schedule({ attendees: [{ role: 'guest' }] })
      expect(res.status).toBe(400)
    })

    it('rejects a non-http meetingUrl → 400 (it is a click target)', async () => {
      for (const meetingUrl of ['javascript:alert(1)', 'not-a-url', 'ftp://x.example/a']) {
        const res = await schedule({ isVirtual: true, meetingUrl })
        expect({ meetingUrl, status: res.status }).toEqual({ meetingUrl, status: 400 })
      }
    })

    it('accepts an https meetingUrl', async () => {
      const res = await schedule({ isVirtual: true, meetingUrl: 'https://meet.example/abc' })
      expect(res.status).toBe(201)
      expect(res.body.meetingUrl).toBe('https://meet.example/abc')
    })

    it('rejects mass assignment of tenantId / status / createdById / cancelledAt → 400', async () => {
      for (const extra of [
        { tenantId: tenantBId },
        { status: 'completed' },
        { createdById: strangerId },
        { cancelledAt: new Date().toISOString() },
        { id: 'chosen-by-caller' },
      ]) {
        const res = await schedule(extra)
        expect({ field: Object.keys(extra)[0], status: res.status })
          .toEqual({ field: Object.keys(extra)[0], status: 400 })
      }
      expect(await prisma.meeting.count({ where: { tenantId: tenantBId } })).toBe(0)
    })
  })

  /* ── Reading ───────────────────────────────────────────────────── */

  describe('GET /meetings', () => {
    let scheduledId: string
    let cancelledId: string

    beforeEach(async () => {
      await clearMeetings()
      scheduledId = (await schedule()).body.id
      cancelledId = (await schedule({ title: 'תבוטל', attendees: [] })).body.id
      await api().patch(`/api/v1/meetings/${cancelledId}/cancel`)
        .set(asOrganiser()).send({ reason: 'נדחה' })
    })

    it('lists the tenant’s meetings with attendee detail', async () => {
      const res = await api().get('/api/v1/meetings').set(asOrganiser())
      expect(res.status).toBe(200)
      expect(res.body.total).toBe(2)
      const found = res.body.items.find((m: any) => m.id === scheduledId)
      expect(found.attendees[0].userId).toBe(inviteeId)
    })

    it('?status= filters', async () => {
      const res = await api().get('/api/v1/meetings?status=cancelled').set(asOrganiser())
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].id).toBe(cancelledId)
    })

    it('?projectId= filters', async () => {
      const res = await api().get(`/api/v1/meetings?projectId=${projectAId}`)
        .set(asOrganiser())
      expect(res.body.items.every((m: any) => m.projectId === projectAId)).toBe(true)
    })

    it('?mineOnly=true returns only meetings the CALLER is invited to', async () => {
      // The organiser created both but is invited to neither.
      const organiser = await api().get('/api/v1/meetings?mineOnly=true').set(asOrganiser())
      expect(organiser.body.items).toHaveLength(0)

      const invitee = await api().get('/api/v1/meetings?mineOnly=true').set(asInvitee())
      expect(invitee.body.items).toHaveLength(1)
      expect(invitee.body.items[0].id).toBe(scheduledId)
    })

    it('?mineOnly=false means "all", not "mine"', async () => {
      // Pins the enableImplicitConversion trap: Boolean('false') is true, so a
      // naive @Type(() => Boolean) would make this behave like mineOnly=true.
      const res = await api().get('/api/v1/meetings?mineOnly=false').set(asOrganiser())
      expect(res.body.total).toBe(2)
    })

    it('?from / ?to bound startTime', async () => {
      const res = await api()
        .get(`/api/v1/meetings?from=${encodeURIComponent(soon(100))}`)
        .set(asOrganiser())
      expect(res.body.items).toHaveLength(0)
    })

    it('rejects an unknown query parameter → 400', async () => {
      const res = await api().get('/api/v1/meetings?tenantId=' + tenantBId).set(asOrganiser())
      expect(res.status).toBe(400)
    })

    it('GET /meetings/:id returns the meeting with attendees', async () => {
      const res = await api().get(`/api/v1/meetings/${scheduledId}`).set(asOrganiser())
      expect(res.status).toBe(200)
      expect(res.body.attendees).toHaveLength(1)
    })

    it('an unknown id → 404', async () => {
      const res = await api().get('/api/v1/meetings/clznope000000').set(asOrganiser())
      expect(res.status).toBe(404)
    })
  })

  /* ── Editing, cancelling, completing ───────────────────────────── */

  describe('editing lifecycle', () => {
    let meetingId: string

    beforeEach(async () => {
      await clearMeetings()
      meetingId = (await schedule()).body.id
      // Clear the invitation notification so the reschedule assertions below
      // count only what the edit produced.
      await prisma.notification.deleteMany({ where: { tenantId: tenantAId } })
    })

    it('edits title and description WITHOUT notifying anyone', async () => {
      const res = await api().patch(`/api/v1/meetings/${meetingId}`)
        .set(asOrganiser()).send({ title: 'כותרת חדשה', description: 'עודכן' })
      expect(res.status).toBe(200)
      expect(res.body.title).toBe('כותרת חדשה')
      // A module that notifies on every save trains people to ignore it.
      expect(await prisma.notification.count({ where: { tenantId: tenantAId } })).toBe(0)
    })

    it('notifies attendees when the meeting MOVES in time', async () => {
      const res = await api().patch(`/api/v1/meetings/${meetingId}`)
        .set(asOrganiser()).send({ startTime: soon(48), endTime: soon(49) })
      expect(res.status).toBe(200)
      const rows = await prisma.notification.findMany({ where: { userId: inviteeId } })
      expect(rows).toHaveLength(1)
      expect(rows[0].title).toContain('עודכנו')
    })

    it('notifies attendees when the LOCATION changes', async () => {
      await api().patch(`/api/v1/meetings/${meetingId}`)
        .set(asOrganiser()).send({ location: 'אולם אחר' })
      expect(await prisma.notification.count({ where: { userId: inviteeId } })).toBe(1)
    })

    it('rejects an edit that inverts the time order → 400', async () => {
      const res = await api().patch(`/api/v1/meetings/${meetingId}`)
        .set(asOrganiser()).send({ startTime: soon(60) }) // endTime is still soon(25)
      expect(res.status).toBe(400)
    })

    it('cancels: state change, reason recorded, attendees notified', async () => {
      const res = await api().patch(`/api/v1/meetings/${meetingId}/cancel`)
        .set(asOrganiser()).send({ reason: 'היזם ביטל' })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('cancelled')
      expect(res.body.cancelledAt).toBeTruthy()
      expect(res.body.cancelReason).toBe('היזם ביטל')

      // The row SURVIVES — that is what makes the cancellation meaningful.
      expect(await prisma.meeting.findUnique({ where: { id: meetingId } })).toBeTruthy()

      const rows = await prisma.notification.findMany({ where: { userId: inviteeId } })
      expect(rows).toHaveLength(1)
      expect(rows[0].title).toContain('בוטלה')
      expect(rows[0].body).toContain('היזם ביטל')
    })

    it('a SECOND cancel → 409, and does not fire another round of notifications', async () => {
      await api().patch(`/api/v1/meetings/${meetingId}/cancel`).set(asOrganiser()).send({})
      const countAfterFirst = await prisma.notification.count({ where: { userId: inviteeId } })

      const res = await api().patch(`/api/v1/meetings/${meetingId}/cancel`)
        .set(asOrganiser()).send({})
      expect(res.status).toBe(409)
      expect(await prisma.notification.count({ where: { userId: inviteeId } }))
        .toBe(countAfterFirst)
    })

    it('a cancelled meeting cannot be edited → 409', async () => {
      await api().patch(`/api/v1/meetings/${meetingId}/cancel`).set(asOrganiser()).send({})
      const res = await api().patch(`/api/v1/meetings/${meetingId}`)
        .set(asOrganiser()).send({ title: 'x' })
      expect(res.status).toBe(409)
    })

    it('completes the meeting and records notes, with no notification', async () => {
      const res = await api().patch(`/api/v1/meetings/${meetingId}/complete`)
        .set(asOrganiser()).send({ notes: 'סוכם על המשך בדיקה' })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('completed')
      expect(res.body.notes).toBe('סוכם על המשך בדיקה')
      expect(await prisma.notification.count({ where: { tenantId: tenantAId } })).toBe(0)
    })

    it('refuses to DELETE a meeting that has invitees → 409 (cancel instead)', async () => {
      const res = await api().delete(`/api/v1/meetings/${meetingId}`).set(asOrganiser())
      expect(res.status).toBe(409)
      expect(await prisma.meeting.findUnique({ where: { id: meetingId } })).toBeTruthy()
    })

    it('deletes an empty meeting outright', async () => {
      const empty = (await schedule({ title: 'ריקה', attendees: [] })).body
      const res = await api().delete(`/api/v1/meetings/${empty.id}`).set(asOrganiser())
      expect(res.status).toBe(200)
      expect(await prisma.meeting.findUnique({ where: { id: empty.id } })).toBeNull()
    })
  })

  /* ── Attendee management ───────────────────────────────────────── */

  describe('attendee management', () => {
    let meetingId: string

    beforeEach(async () => {
      await clearMeetings()
      meetingId = (await schedule({ attendees: [] })).body.id
    })

    it('adds attendees and notifies the new staff invitees', async () => {
      const res = await api().post(`/api/v1/meetings/${meetingId}/attendees`)
        .set(asOrganiser()).send({ attendees: [{ userId: inviteeId }, { residentId: residentAId }] })
      expect(res.status).toBe(201)
      expect(res.body.attendees).toHaveLength(2)
      expect(await prisma.notification.count({
        where: { userId: inviteeId, entityId: meetingId },
      })).toBe(1)
    })

    it('re-adding an existing attendee is a no-op, not a 500 or a duplicate notification', async () => {
      await api().post(`/api/v1/meetings/${meetingId}/attendees`)
        .set(asOrganiser()).send({ attendees: [{ userId: inviteeId }] })
      const res = await api().post(`/api/v1/meetings/${meetingId}/attendees`)
        .set(asOrganiser()).send({ attendees: [{ userId: inviteeId }] })

      expect(res.status).toBe(201)
      expect(res.body.attendees).toHaveLength(1)
      expect(await prisma.notification.count({
        where: { userId: inviteeId, entityId: meetingId },
      })).toBe(1)
    })

    it('removes an attendee', async () => {
      const added = await api().post(`/api/v1/meetings/${meetingId}/attendees`)
        .set(asOrganiser()).send({ attendees: [{ userId: inviteeId }] })
      const attendeeId = added.body.attendees[0].id

      const res = await api().delete(`/api/v1/meetings/${meetingId}/attendees/${attendeeId}`)
        .set(asOrganiser())
      expect(res.status).toBe(200)
      expect(res.body.attendees).toHaveLength(0)
    })

    it('an unknown attendee id → 404', async () => {
      const res = await api()
        .delete(`/api/v1/meetings/${meetingId}/attendees/clznope000000`).set(asOrganiser())
      expect(res.status).toBe(404)
    })

    it('cannot add attendees to a cancelled meeting → 409', async () => {
      await api().patch(`/api/v1/meetings/${meetingId}/cancel`).set(asOrganiser()).send({})
      const res = await api().post(`/api/v1/meetings/${meetingId}/attendees`)
        .set(asOrganiser()).send({ attendees: [{ userId: inviteeId }] })
      expect(res.status).toBe(409)
    })

    it('rejects a bare array body (whitelist would not apply) → 400', async () => {
      const res = await api().post(`/api/v1/meetings/${meetingId}/attendees`)
        .set(asOrganiser()).send([{ userId: inviteeId }] as any)
      expect(res.status).toBe(400)
    })
  })

  /* ── RSVP ──────────────────────────────────────────────────────── */

  describe('RSVP', () => {
    let meetingId: string

    beforeEach(async () => {
      await clearMeetings()
      meetingId = (await schedule()).body.id
      await prisma.notification.deleteMany({ where: { tenantId: tenantAId } })
    })

    it('the invitee answers for themselves and respondedAt is stamped', async () => {
      const res = await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
        .set(asInvitee()).send({ rsvpStatus: 'accepted' })
      expect(res.status).toBe(200)
      const me = res.body.attendees.find((a: any) => a.userId === inviteeId)
      expect(me.rsvpStatus).toBe('accepted')
      expect(me.respondedAt).toBeTruthy()
    })

    it('notifies the ORGANISER of the answer', async () => {
      await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
        .set(asInvitee()).send({ rsvpStatus: 'declined' })
      const rows = await prisma.notification.findMany({ where: { userId: organiserId } })
      expect(rows).toHaveLength(1)
      expect(rows[0].entityId).toBe(meetingId)
      expect(rows[0].body).toContain('declined')
    })

    it('every RSVP status in the registry is accepted', async () => {
      for (const status of RSVP_STATUSES) {
        const res = await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
          .set(asInvitee()).send({ rsvpStatus: status })
        expect({ status, code: res.status }).toEqual({ status, code: 200 })
      }
    })

    it('rejects an unknown RSVP status → 400', async () => {
      const res = await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
        .set(asInvitee()).send({ rsvpStatus: 'maybe-later' })
      expect(res.status).toBe(400)
    })

    it('a user who is NOT invited gets 404, even as the meeting’s organiser', async () => {
      // The organiser scheduled it but did not invite themselves. There is no
      // attendee row for them, so there is nothing to answer.
      const res = await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
        .set(asOrganiser()).send({ rsvpStatus: 'accepted' })
      expect(res.status).toBe(404)
    })

    it("CANNOT answer on another user's behalf — the victim's row is untouched", async () => {
      // The core first-person assertion. The organiser has write-role on this
      // meeting and could edit it freely; RSVP is still not theirs to give.
      await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
        .set(asInvitee()).send({ rsvpStatus: 'tentative' })

      const attempt = await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
        .set(asOrganiser()).send({ rsvpStatus: 'accepted' })
      expect(attempt.status).toBe(404)

      const row = await prisma.meetingAttendee.findFirst({
        where: { meetingId, userId: inviteeId },
      })
      expect(row!.rsvpStatus).toBe('tentative')
    })

    it('cannot RSVP to a cancelled meeting → 409', async () => {
      await api().patch(`/api/v1/meetings/${meetingId}/cancel`).set(asOrganiser()).send({})
      const res = await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
        .set(asInvitee()).send({ rsvpStatus: 'accepted' })
      expect(res.status).toBe(409)
    })
  })

  /* ── Attendance (distinct from RSVP) ───────────────────────────── */

  describe('attendance tracking', () => {
    let meetingId: string
    let attendeeRowId: string

    beforeEach(async () => {
      await clearMeetings()
      const created = await schedule()
      meetingId = created.body.id
      attendeeRowId = created.body.attendees[0].id
    })

    it('records attendance without disturbing the RSVP', async () => {
      await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
        .set(asInvitee()).send({ rsvpStatus: 'accepted' })

      const res = await api()
        .patch(`/api/v1/meetings/${meetingId}/attendees/${attendeeRowId}/attendance`)
        .set(asOrganiser()).send({ attended: false })
      expect(res.status).toBe(200)

      const row = res.body.attendees[0]
      // Accepted-but-absent: the whole reason RSVP and attendance are separate
      // columns. If one overwrote the other this pair would be impossible.
      expect(row.rsvpStatus).toBe('accepted')
      expect(row.attended).toBe(false)
    })

    it('an observer cannot record attendance → 403', async () => {
      const res = await api()
        .patch(`/api/v1/meetings/${meetingId}/attendees/${attendeeRowId}/attendance`)
        .set(asObserver()).send({ attended: true })
      expect(res.status).toBe(403)
    })

    it('an unknown attendee id → 404', async () => {
      const res = await api()
        .patch(`/api/v1/meetings/${meetingId}/attendees/clznope000000/attendance`)
        .set(asOrganiser()).send({ attended: true })
      expect(res.status).toBe(404)
    })
  })

  /* ── RBAC ──────────────────────────────────────────────────────── */

  describe('RBAC', () => {
    let meetingId: string

    beforeAll(async () => {
      await clearMeetings()
      meetingId = (await schedule()).body.id
    })

    it('no token → 401', async () => {
      expect((await api().get('/api/v1/meetings')).status).toBe(401)
    })

    it('a token WITHOUT sessionId → 401', async () => {
      const forged = jwt.sign(
        { sub: organiserId, email: 'a@b.c', role: 'PROJECT_MANAGER', tenantId: tenantAId },
        { secret: process.env.JWT_SECRET as string, expiresIn: '5m' },
      )
      const res = await api().get('/api/v1/meetings')
        .set({ Authorization: `Bearer ${forged}` })
      expect(res.status).toBe(401)
    })

    it('a RESIDENT → 403 on read and on write', async () => {
      const h = { Authorization: `Bearer ${token(organiserId, tenantAId, 'RESIDENT')}` }
      expect((await api().get('/api/v1/meetings').set(h)).status).toBe(403)
      expect((await api().post('/api/v1/meetings').set(h)
        .send({ title: 'x', startTime: soon(2) })).status).toBe(403)
    })

    it('an observer (MUNICIPALITY_USER) CAN read the calendar', async () => {
      const res = await api().get('/api/v1/meetings').set(asObserver())
      expect(res.status).toBe(200)
    })

    it('an observer CANNOT schedule, edit, cancel or manage the roster → 403', async () => {
      expect((await api().post('/api/v1/meetings').set(asObserver())
        .send({ title: 'x', startTime: soon(2) })).status).toBe(403)
      expect((await api().patch(`/api/v1/meetings/${meetingId}`).set(asObserver())
        .send({ title: 'x' })).status).toBe(403)
      expect((await api().patch(`/api/v1/meetings/${meetingId}/cancel`).set(asObserver())
        .send({})).status).toBe(403)
      expect((await api().post(`/api/v1/meetings/${meetingId}/attendees`).set(asObserver())
        .send({ attendees: [{ userId: inviteeId }] })).status).toBe(403)
      expect((await api().delete(`/api/v1/meetings/${meetingId}`).set(asObserver())).status)
        .toBe(403)
    })

    it('an observer CAN answer their own invitation (RSVP is first-person, not write-role)', async () => {
      await api().post(`/api/v1/meetings/${meetingId}/attendees`)
        .set(asOrganiser()).send({ attendees: [{ userId: observerId }] })
      const res = await api().patch(`/api/v1/meetings/${meetingId}/rsvp`)
        .set(asObserver()).send({ rsvpStatus: 'accepted' })
      expect(res.status).toBe(200)
    })

    it('MEETING_WRITE_ROLES excludes the read-only observers', () => {
      expect(MEETING_WRITE_ROLES).not.toContain('MUNICIPALITY_USER')
      expect(MEETING_WRITE_ROLES).not.toContain('EXTERNAL_CONSULTANT')
      expect(MEETING_WRITE_ROLES.length).toBeLessThan(STAFF_ROLES.length)
    })
  })

  /* ── Tenant isolation ──────────────────────────────────────────── */

  describe('tenant isolation', () => {
    let meetingId: string

    beforeEach(async () => {
      await clearMeetings()
      meetingId = (await schedule()).body.id
    })

    it("another tenant's meeting → 404 on read, never 403", async () => {
      const res = await api().get(`/api/v1/meetings/${meetingId}`).set(asStranger())
      expect(res.status).toBe(404)
    })

    it("another tenant's meeting → 404 on edit, and the row is UNCHANGED", async () => {
      const res = await api().patch(`/api/v1/meetings/${meetingId}`)
        .set(asStranger()).send({ title: 'נחטף' })
      expect(res.status).toBe(404)
      const row = await prisma.meeting.findUnique({ where: { id: meetingId } })
      expect(row!.title).toBe('פגישת דיירים')
    })

    it("another tenant's meeting → 404 on cancel and on delete", async () => {
      expect((await api().patch(`/api/v1/meetings/${meetingId}/cancel`)
        .set(asStranger()).send({})).status).toBe(404)
      expect((await api().delete(`/api/v1/meetings/${meetingId}`).set(asStranger())).status)
        .toBe(404)
      expect(await prisma.meeting.findUnique({ where: { id: meetingId } })).toBeTruthy()
    })

    it('the list never crosses the boundary', async () => {
      const res = await api().get('/api/v1/meetings').set(asStranger())
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(0)
    })

    it("scheduling against ANOTHER tenant's project → 404", async () => {
      const res = await schedule({ projectId: projectBId, attendees: [] })
      expect(res.status).toBe(404)
      expect(await prisma.meeting.count({ where: { projectId: projectBId } })).toBe(0)
    })

    it("inviting a user from ANOTHER tenant → 404, and no meeting is left behind", async () => {
      const before = await prisma.meeting.count({ where: { tenantId: tenantAId } })
      const res = await schedule({ attendees: [{ userId: strangerId }] })
      expect(res.status).toBe(404)
      // Attendees are resolved BEFORE the meeting is created, so a rejected
      // invitee must not leave a half-invited meeting behind.
      expect(await prisma.meeting.count({ where: { tenantId: tenantAId } })).toBe(before)
    })

    it("inviting a resident from ANOTHER tenant → 404", async () => {
      const res = await schedule({ attendees: [{ residentId: residentBId }] })
      expect(res.status).toBe(404)
    })

    it("adding a cross-tenant invitee to an existing meeting → 404", async () => {
      const res = await api().post(`/api/v1/meetings/${meetingId}/attendees`)
        .set(asOrganiser()).send({ attendees: [{ userId: strangerId }] })
      expect(res.status).toBe(404)
      const row = await prisma.meetingAttendee.findFirst({
        where: { meetingId, userId: strangerId },
      })
      expect(row).toBeNull()
    })

    it("an attendee id from another tenant's meeting → 404", async () => {
      const mine = await prisma.meetingAttendee.findFirst({ where: { meetingId } })
      const res = await api()
        .delete(`/api/v1/meetings/${meetingId}/attendees/${mine!.id}`).set(asStranger())
      expect(res.status).toBe(404)
      expect(await prisma.meetingAttendee.findUnique({ where: { id: mine!.id } })).toBeTruthy()
    })
  })

  /* ── Audit ─────────────────────────────────────────────────────── */

  describe('audit', () => {
    it('records the creator and the cancellation against the meeting', async () => {
      await clearMeetings()
      await prisma.auditLog.deleteMany({ where: { tenantId: tenantAId } })

      const created = await schedule()
      await api().patch(`/api/v1/meetings/${created.body.id}/cancel`)
        .set(asOrganiser()).send({ reason: 'סיבה' })

      const rows = await prisma.auditLog.findMany({
        where: { tenantId: tenantAId, entity: 'Meeting', entityId: created.body.id },
        orderBy: { createdAt: 'asc' },
      })
      expect(rows.length).toBeGreaterThanOrEqual(2)
      expect(rows.every((r) => r.userId === organiserId)).toBe(true)
      expect(rows.map((r) => r.action)).toContain('CREATE')
    })
  })

  /* ── Vocabulary ────────────────────────────────────────────────── */

  describe('vocabulary', () => {
    it('statuses match the schema default casing', () => {
      expect(MEETING_STATUSES).toEqual(['scheduled', 'completed', 'cancelled'])
    })

    it('RSVP has a distinct pending state, so "no answer" is not "declined"', () => {
      expect(RSVP_STATUSES).toContain('pending')
      expect(RSVP_STATUSES).toContain('tentative')
    })
  })
})
