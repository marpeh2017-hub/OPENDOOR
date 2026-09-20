/**
 * Session attribution on the token paths — Portal stage 4.
 *
 * ── THE DECISION THIS TESTS ─────────────────────────────────────────────────
 *
 * Signing a document and answering a meeting invitation stay tokenised. Anyone
 * holding the link can act, exactly as before — that was the decision, and
 * requiring a portal session would break the flow for every resident who simply
 * taps the link in their SMS.
 *
 * What changes is the RECORD. When the person acting is also signed in to the
 * portal, the action is attributed to that authenticated identity as well as to
 * the bearer of the link, and — because `Owner.residentId` links the two — the
 * record states whether the authenticated resident IS the one the signature or
 * the invitation belongs to.
 *
 * ── THREE CASES, ONE OUTCOME ────────────────────────────────────────────────
 *
 * Every test below asserts the same thing about the ACTION and a different
 * thing about the RECORD:
 *
 *   1. matching session  → succeeds, recorded as an identity match
 *   2. mismatched session → succeeds, recorded as a MISMATCH
 *   3. no session at all → succeeds, recorded exactly as it always was
 *
 * A mismatch is a household sharing a handset, which is ordinary. Blocking it
 * would trade a working signature for a tidier log.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { SigningSessionService } from '../src/signatures/signing-session.service'
import { MeetingAccessService } from '../src/meetings/meeting-access.service'
import { hashOtp } from '../src/common/otp/otp'
import { authenticationOf } from '../src/signatures/evidence-package.service'
import { authenticationLine } from '../src/signatures/evidence-pdf.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const MARKER = `ATTR-${STAMP}`
const SLUG = `attr-${STAMP}`

describe('Portal session attribution on token paths (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let sessions: SigningSessionService
  let access: MeetingAccessService

  let tenantId: string
  let projectId: string
  let apartmentId: string
  /** The resident the owner is linked to. */
  let residentId: string
  /** A second resident in the SAME apartment — the spouse on the shared handset. */
  let coResidentId: string
  let ownerId: string
  let managerId: string

  const api = () => request(app.getHttpServer())

  const residentToken = (id: string) =>
    jwt.sign(
      { sub: id, role: 'RESIDENT', tenantId, projectId, residentId: id, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  /** A package with one owner-signer, taken to the point where signing is allowed. */
  const makeSignable = async () => {
    const pkg = await prisma.signaturePackage.create({
      data: {
        tenantId, projectId, title: `${MARKER} package`, status: 'SENT',
        documentHash: 'a'.repeat(64), createdById: managerId,
      },
      select: { id: true },
    })
    const record = await prisma.signatureRecord.create({
      data: {
        tenantId, packageId: pkg.id, ownerId, apartmentId,
        status: 'PENDING', signerRole: 'OWNER', required: true, signingOrder: 0,
      },
      select: { id: true },
    })
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
    await prisma.signingSession.create({
      data: {
        recordId: record.id, token,
        // Already OTP-verified: this suite is about what gets recorded at the
        // moment of signing, not about the OTP, which has its own suite.
        otpHash: hashOtp('123456'), verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    })
    return { packageId: pkg.id, recordId: record.id, token }
  }

  const signedEventMetadata = async (packageId: string) => {
    const event = await prisma.signatureEvent.findFirst({
      where: { packageId, type: 'SIGNED' },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, actorType: true, actorId: true },
    })
    return {
      actorType: event?.actorType,
      actorId: event?.actorId,
      meta: event?.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : null,
    }
  }

  /** A meeting with one attendee, and the live token for it. */
  const makeInvitation = async (attendeeResidentId: string) => {
    const meeting = await prisma.meeting.create({
      data: {
        tenantId, projectId, title: `${MARKER} meeting`,
        startTime: new Date(Date.now() + 86_400_000), location: 'לובי',
      },
      select: { id: true },
    })
    const attendee = await prisma.meetingAttendee.create({
      data: { meetingId: meeting.id, residentId: attendeeResidentId, rsvpStatus: 'pending' },
      select: { id: true },
    })
    const issued = await access.issueForAttendee(attendee.id)
    return { meetingId: meeting.id, attendeeId: attendee.id, token: issued!.token }
  }

  const rsvpAudit = async (attendeeId: string) => {
    const entry = await prisma.auditLog.findFirst({
      where: { tenantId, entity: 'MeetingAttendee', entityId: attendeeId },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, metadata: true },
    })
    return {
      userId: entry?.userId,
      meta: entry?.metadata as Record<string, unknown> | null,
    }
  }

  const purge = async () => {
    const stale = await prisma.tenant.findMany({
      where: { slug: { startsWith: 'attr-' } }, select: { id: true },
    })
    for (const t of stale) {
      await prisma.signatureEvent.deleteMany({ where: { package: { tenantId: t.id } } })
      await prisma.signingSession.deleteMany({
        where: { recordId: { in: (await prisma.signatureRecord.findMany({
          where: { tenantId: t.id }, select: { id: true },
        })).map((r) => r.id) } },
      })
      await prisma.signatureRecord.deleteMany({ where: { tenantId: t.id } })
      await prisma.signaturePackage.deleteMany({ where: { tenantId: t.id } })
      await prisma.meeting.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.owner.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } }).catch(() => undefined)
    }
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({ totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }),
      })
      .compile()

    app = mod.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()

    prisma = app.get(PrismaService)
    jwt = app.get(JwtService, { strict: false })
    sessions = app.get(SigningSessionService)
    access = app.get(MeetingAccessService)

    await purge()

    const tenant = await prisma.tenant.create({ data: { name: SLUG, slug: SLUG } })
    tenantId = tenant.id
    const manager = await prisma.user.create({
      data: {
        tenantId, email: `${MARKER}-pm@example.com`.toLowerCase(),
        firstName: 'Attr', lastName: 'Manager',
        passwordHash: 'not-a-usable-credential', role: 'PROJECT_MANAGER' as never,
      },
      select: { id: true },
    })
    managerId = manager.id

    const project = await prisma.project.create({
      data: {
        tenantId, code: MARKER, name: `${MARKER} project`, city: 'תל אביב',
        projectManagerId: managerId,
      },
    })
    projectId = project.id
    const complex = await prisma.complex.create({ data: { projectId, name: MARKER } })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: 'רחוב הבדיקה 1' },
    })
    const apartment = await prisma.apartment.create({
      data: { buildingId: building.id, apartmentNumber: '5' },
    })
    apartmentId = apartment.id

    residentId = (await prisma.resident.create({
      data: {
        tenantId, apartmentId, firstName: 'אבי', lastName: 'הבעלים',
        phone: '0509912001', ownershipPercentage: 50, isActive: true,
      },
      select: { id: true },
    })).id
    coResidentId = (await prisma.resident.create({
      data: {
        tenantId, apartmentId, firstName: 'בת', lastName: 'הזוג',
        phone: '0509912002', ownershipPercentage: 50, isActive: true,
      },
      select: { id: true },
    })).id

    // The link that makes the check possible: this owner IS this resident.
    ownerId = (await prisma.owner.create({
      data: { tenantId, fullName: 'אבי הבעלים', residentId },
      select: { id: true },
    })).id
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  1. Signing
  // ══════════════════════════════════════════════════════════════════════════

  describe('signing', () => {
    it('CASE 1 — a matching session: signs, and records the identity match', async () => {
      const { packageId, recordId, token } = await makeSignable()

      const res = await api().post(`/api/v1/signatures/portal/${token}/sign`)
        .set({ Authorization: `Bearer ${residentToken(residentId)}` })
      expect(res.status).toBe(201)

      const record = await prisma.signatureRecord.findUniqueOrThrow({
        where: { id: recordId }, select: { status: true, signedAt: true },
      })
      expect(record.status).toBe('SIGNED')

      const { actorType, actorId, meta } = await signedEventMetadata(packageId)
      // The owner is still the actor: whose signature this is has not changed.
      expect(actorType).toBe('OWNER')
      expect(actorId).toBe(ownerId)
      // What is new is who was authenticated while making it.
      expect(meta!.viaPortalSession).toBe(true)
      expect(meta!.sessionResidentId).toBe(residentId)
      expect(meta!.sessionMatchesOwner).toBe(true)
    })

    it('CASE 2 — a MISMATCHED session: still signs, and records the mismatch', async () => {
      /*
       * The spouse is signed in on the shared handset while the owner signs.
       * Ordinary, and not a reason to refuse a signature — the token and the
       * OTP are the control. The evidence must say plainly that the session
       * belonged to somebody else rather than imply a match.
       */
      const { packageId, recordId, token } = await makeSignable()

      const res = await api().post(`/api/v1/signatures/portal/${token}/sign`)
        .set({ Authorization: `Bearer ${residentToken(coResidentId)}` })
      expect(res.status).toBe(201)

      const record = await prisma.signatureRecord.findUniqueOrThrow({
        where: { id: recordId }, select: { status: true },
      })
      expect(record.status).toBe('SIGNED')   // NOT blocked

      const { meta } = await signedEventMetadata(packageId)
      expect(meta!.viaPortalSession).toBe(true)
      expect(meta!.sessionResidentId).toBe(coResidentId)
      expect(meta!.sessionMatchesOwner).toBe(false)
      // And the record says who it SHOULD have been, so the gap is legible.
      expect(meta!.ownerLinkedResidentId).toBe(residentId)
    })

    it('CASE 3 — no session: signs, and the event is what it always was', async () => {
      const { packageId, recordId, token } = await makeSignable()

      const res = await api().post(`/api/v1/signatures/portal/${token}/sign`)
      expect(res.status).toBe(201)

      expect((await prisma.signatureRecord.findUniqueOrThrow({
        where: { id: recordId }, select: { status: true },
      })).status).toBe('SIGNED')

      const { actorType, actorId, meta } = await signedEventMetadata(packageId)
      expect(actorType).toBe('OWNER')
      expect(actorId).toBe(ownerId)
      // Absent, not present-and-false: nothing is asserted about a session that
      // was never there.
      expect(meta).toBeNull()
    })

    it('a rubbish Authorization header changes nothing', async () => {
      // The probe must never break the token path. This is the case that says
      // so: a malformed header on a public route is not an error.
      const { packageId, token } = await makeSignable()

      const res = await api().post(`/api/v1/signatures/portal/${token}/sign`)
        .set({ Authorization: 'Bearer not-a-real-token' })
      expect(res.status).toBe(201)
      expect((await signedEventMetadata(packageId)).meta).toBeNull()
    })

    it('a STAFF token attributes nothing', async () => {
      const staff = jwt.sign(
        { sub: managerId, email: 'pm@example.com', role: 'PROJECT_MANAGER', tenantId, sessionId: randomUUID() },
        { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
      )
      const { packageId, token } = await makeSignable()

      const res = await api().post(`/api/v1/signatures/portal/${token}/sign`)
        .set({ Authorization: `Bearer ${staff}` })
      expect(res.status).toBe(201)
      // A staff member is not the signer, and recording them as the
      // authenticated identity behind an owner's signature would be false.
      expect((await signedEventMetadata(packageId)).meta).toBeNull()
    })

    it('a REVOKED session attributes nothing', async () => {
      const token = residentToken(residentId)
      const claims = jwt.decode(token) as { sessionId: string }
      const redis = app.get<{ setex: (k: string, t: number, v: string) => Promise<unknown> }>('REDIS')
      await redis.setex(`jwt:revoked:${claims.sessionId}`, 60, '1')

      const signable = await makeSignable()
      const res = await api().post(`/api/v1/signatures/portal/${signable.token}/sign`)
        .set({ Authorization: `Bearer ${token}` })
      expect(res.status).toBe(201)
      // Signed out is signed out: a revoked session is not evidence of anything.
      expect((await signedEventMetadata(signable.packageId)).meta).toBeNull()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  2. The evidence package
  // ══════════════════════════════════════════════════════════════════════════

  describe('what the evidence package says', () => {
    it('calls a session-less signature TOKEN_AND_OTP, not "unknown"', () => {
      // The absence of a portal session is not missing information — it is the
      // method that was actually used, and is what every signature made before
      // this feature existed used.
      expect(authenticationOf(undefined)).toEqual({ method: 'TOKEN_AND_OTP' })
      expect(authenticationLine([], 'rec_1')).toBeUndefined()
      expect(authenticationLine(
        [{ type: 'SIGNED', recordId: 'rec_1', metadata: null }], 'rec_1',
      )).toBe('Token + SMS OTP')
    })

    it('states the match, and states a mismatch just as plainly', () => {
      const matched = authenticationOf({
        viaPortalSession: true, sessionResidentId: 'res_a', sessionMatchesOwner: true,
      })
      expect(matched).toMatchObject({
        method: 'PORTAL_SESSION_AND_TOKEN',
        sessionResidentId: 'res_a',
        residentMatchesOwner: true,
      })

      const mismatched = authenticationOf({
        viaPortalSession: true, sessionResidentId: 'res_b', sessionMatchesOwner: false,
      })
      expect(mismatched).toMatchObject({
        method: 'PORTAL_SESSION_AND_TOKEN',
        residentMatchesOwner: false,
      })
    })

    it('the PDF line distinguishes the two in words a reader can act on', () => {
      const line = (matches: boolean) => authenticationLine([{
        type: 'SIGNED', recordId: 'rec_1',
        metadata: JSON.stringify({ viaPortalSession: true, sessionMatchesOwner: matches }),
      }], 'rec_1')

      expect(line(true)).toContain('for the linked resident')
      // Capitalised in the PDF on purpose: somebody reading an evidence bundle
      // in a dispute should not have to notice a missing word.
      expect(line(false)).toContain('DIFFERENT resident')
    })

    it('end to end: a real signature with a matching session reports the match', async () => {
      const { packageId, token } = await makeSignable()
      await api().post(`/api/v1/signatures/portal/${token}/sign`)
        .set({ Authorization: `Bearer ${residentToken(residentId)}` }).expect(201)

      const { meta } = await signedEventMetadata(packageId)
      expect(authenticationOf(meta ?? undefined)).toMatchObject({
        method: 'PORTAL_SESSION_AND_TOKEN',
        residentMatchesOwner: true,
      })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  3. RSVP
  // ══════════════════════════════════════════════════════════════════════════

  describe('answering a meeting invitation', () => {
    it('CASE 1 — a matching session: answers, and records the match', async () => {
      const { attendeeId, token } = await makeInvitation(residentId)

      const res = await api().post(`/api/v1/meeting-invitations/${token}/rsvp`)
        .set({ Authorization: `Bearer ${residentToken(residentId)}` })
        .send({ rsvpStatus: 'accepted' })
      expect(res.status).toBe(201)

      const attendee = await prisma.meetingAttendee.findUniqueOrThrow({
        where: { id: attendeeId }, select: { rsvpStatus: true, respondedVia: true },
      })
      expect(attendee.rsvpStatus).toBe('accepted')
      // The column has existed all along, hard-coded to 'token'. It now says
      // how the answer actually arrived.
      expect(attendee.respondedVia).toBe('portal')

      const { userId, meta } = await rsvpAudit(attendeeId)
      expect(userId).toBeNull()          // still no `User` behind a resident
      expect(meta!.viaPortalSession).toBe(true)
      expect(meta!.sessionResidentId).toBe(residentId)
      expect(meta!.sessionMatchesAttendee).toBe(true)
    })

    it('CASE 2 — a MISMATCHED session: still answers, and records the mismatch', async () => {
      const { attendeeId, token } = await makeInvitation(residentId)

      const res = await api().post(`/api/v1/meeting-invitations/${token}/rsvp`)
        .set({ Authorization: `Bearer ${residentToken(coResidentId)}` })
        .send({ rsvpStatus: 'declined' })
      expect(res.status).toBe(201)

      const attendee = await prisma.meetingAttendee.findUniqueOrThrow({
        where: { id: attendeeId }, select: { rsvpStatus: true, respondedVia: true },
      })
      expect(attendee.rsvpStatus).toBe('declined')   // NOT blocked
      expect(attendee.respondedVia).toBe('portal')

      const { meta } = await rsvpAudit(attendeeId)
      expect(meta!.sessionResidentId).toBe(coResidentId)
      expect(meta!.sessionMatchesAttendee).toBe(false)
      expect(meta!.attendeeResidentId).toBe(residentId)
    })

    it('CASE 3 — no session: answers, and the record is what it always was', async () => {
      const { attendeeId, token } = await makeInvitation(residentId)

      const res = await api().post(`/api/v1/meeting-invitations/${token}/rsvp`)
        .send({ rsvpStatus: 'accepted' })
      expect(res.status).toBe(201)

      const attendee = await prisma.meetingAttendee.findUniqueOrThrow({
        where: { id: attendeeId }, select: { rsvpStatus: true, respondedVia: true },
      })
      expect(attendee.rsvpStatus).toBe('accepted')
      expect(attendee.respondedVia).toBe('token')

      const { meta } = await rsvpAudit(attendeeId)
      expect(meta!.respondedVia).toBe('token')
      expect(meta!.viaPortalSession).toBeUndefined()
      expect(meta!.sessionResidentId).toBeUndefined()
    })

    it('a rubbish Authorization header leaves the token path untouched', async () => {
      const { attendeeId, token } = await makeInvitation(residentId)

      const res = await api().post(`/api/v1/meeting-invitations/${token}/rsvp`)
        .set({ Authorization: 'Bearer garbage' })
        .send({ rsvpStatus: 'accepted' })
      expect(res.status).toBe(201)

      expect((await prisma.meetingAttendee.findUniqueOrThrow({
        where: { id: attendeeId }, select: { respondedVia: true },
      })).respondedVia).toBe('token')
    })

    it('the token is still what authorises the answer, session or not', async () => {
      // A live session does NOT stand in for a valid token: the link is still
      // the thing that says which invitation is being answered.
      const res = await api().post('/api/v1/meeting-invitations/not-a-real-token/rsvp')
        .set({ Authorization: `Bearer ${residentToken(residentId)}` })
        .send({ rsvpStatus: 'accepted' })
      expect(res.status).toBe(404)
    })
  })
})
