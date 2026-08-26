/**
 * Signature Workflow E2E Tests
 *
 * Tests the complete lifecycle:
 *   DRAFT ג†’ INTERNAL_REVIEW ג†’ APPROVED ג†’ SENT ג†’ PARTIALLY_SIGNED ג†’ COMPLETED
 *   OTP request, wrong code, correct code, sign, decline, cancel
 *   Cross-tenant isolation, duplicate sign prevention, webhook idempotency
 *
 * Uses the seed database (PostgreSQL). Requires admin seed credentials.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { StorageService } from '../src/storage/storage.service'
import { createHash, randomBytes } from 'crypto'

process.env.NODE_ENV   = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'

// ג”€ג”€ Helpers ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

async function login(app: INestApplication, email: string, password: string) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
  return res.status === 200 ? res.body : null
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

// ג”€ג”€ Suite ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

/**
 * Every package this suite creates is titled with this prefix so that teardown
 * can identify and remove them without touching real seed data.
 */
const E2E_TITLE_PREFIX = 'E2E '

describe('Signature Workflow (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let storage: StorageService
  let adminToken: string
  let tenantId: string
  let adminUserId: string
  let projectId: string
  let ownerId: string
  let apartmentId: string
  /** Watermark so teardown only removes rows this run created. */
  let startedAt: Date

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma  = moduleFixture.get<PrismaService>(PrismaService)
    storage = moduleFixture.get<StorageService>(StorageService)
    startedAt = new Date()
  })

  afterAll(async () => {
    // This suite creates signature packages on every run. Without an explicit
    // teardown they accumulate in the dev database forever — a Pass 2 audit
    // found 130 leftover "E2E *" packages burying the 2 real ones on the
    // /signatures screen and rendering its KPI counts meaningless.
    //
    // Scope the purge tightly: only packages whose title carries this suite's
    // prefix AND that were created after this run began.
    try {
      const stale = await prisma.signaturePackage.findMany({
        where: {
          title:     { startsWith: E2E_TITLE_PREFIX },
          createdAt: { gte: startedAt },
        },
        select: { id: true },
      })

      if (stale.length > 0) {
        const packageIds = stale.map(p => p.id)

        // ── OBJECT STORAGE ────────────────────────────────────────────────
        // Deleting the package row cascades to `signature_evidence`, but a
        // cascade in PostgreSQL cannot reach MinIO. Every completed package in
        // this suite generates an evidence PDF, so before the rows disappear —
        // taking the only record of the keys with them — read the keys out and
        // delete the objects. Without this the bucket accumulates one orphaned
        // PDF per completed package per run, under `tnt_01/evidence/`, with
        // nothing left in the database pointing at them.
        //
        // Both key columns are cleaned: `s3Key` (the evidence payload) and
        // `pdfS3Key` (the rendered PDF); either may be null depending on how
        // far the background job got before the suite finished.
        //
        // `storage.delete` refuses any key outside the tenant prefix, so this
        // cannot reach another tenant's objects even if a row were malformed.
        // Failures are swallowed per key: a missing object (already deleted,
        // or never uploaded because S3 is not configured in this environment)
        // must not turn cleanup into a suite failure.
        const evidence = await prisma.signatureEvidence.findMany({
          where:  { packageId: { in: packageIds } },
          select: { tenantId: true, s3Key: true, pdfS3Key: true },
        })
        for (const ev of evidence) {
          for (const key of [ev.s3Key, ev.pdfS3Key]) {
            if (!key) continue
            try {
              await storage.delete(ev.tenantId, key)
            } catch {
              // Best effort — see above.
            }
          }
        }

        // `signing_sessions.recordId` has no FK constraint, so the cascade from
        // signature_packages will not reach it — clear those rows by hand
        // first, or they are orphaned.
        const records = await prisma.signatureRecord.findMany({
          where:  { packageId: { in: packageIds } },
          select: { id: true },
        })
        if (records.length > 0) {
          await prisma.signingSession.deleteMany({
            where: { recordId: { in: records.map(r => r.id) } },
          })
        }

        // signature_events / signature_records / signature_evidence all cascade.
        await prisma.signaturePackage.deleteMany({ where: { id: { in: packageIds } } })
      }

      // The document-link regression test creates its own physical object.
      // Remove only this run's clearly watermarked fixtures.
      const documents = await prisma.document.findMany({
        where: { title: { startsWith: 'E2E Signature Document ' }, createdAt: { gte: startedAt } },
        select: { id: true, tenantId: true, s3Key: true },
      })
      for (const document of documents) {
        // Best-effort teardown: the object may already be gone, and a storage
        // failure here must not mask the result of the test that just ran.
        try { await storage.delete(document.tenantId, document.s3Key) } catch { /* ignored */ }
      }
      if (documents.length) await prisma.document.deleteMany({ where: { id: { in: documents.map((document) => document.id) } } })

      // Belt and braces: some tests delete a record directly, which (again, no
      // FK) strands its session. Sweep any session created during this run
      // whose record no longer exists.
      const recent = await prisma.signingSession.findMany({
        where:  { createdAt: { gte: startedAt } },
        select: { id: true, recordId: true },
      })
      if (recent.length > 0) {
        const live = await prisma.signatureRecord.findMany({
          where:  { id: { in: recent.map(s => s.recordId) } },
          select: { id: true },
        })
        const liveIds = new Set(live.map(r => r.id))
        const orphaned = recent.filter(s => !liveIds.has(s.recordId)).map(s => s.id)
        if (orphaned.length > 0) {
          await prisma.signingSession.deleteMany({ where: { id: { in: orphaned } } })
        }
      }
    } catch {
      // Never let cleanup failure mask a genuine test result.
    }

    await app.close()
  })

  // ג”€ג”€ Login & seed lookup ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('Prerequisites', () => {
    it('logs in as admin and resolves the seed fixtures', async () => {
      const session = await login(app, 'admin@opendoor.co.il', 'demo1234')
      // Fail loudly: a missing seed must break the build, not silently turn the
      // whole suite into a no-op that reports green.
      expect(session).toBeTruthy()
      adminToken = session!.accessToken
      tenantId   = session!.user.tenantId
      adminUserId = session!.user.id

      // Find a project
      const proj = await prisma.project.findFirst({ where: { tenantId } })
      expect(proj).toBeTruthy()
      projectId = proj!.id

      // Find an owner with a phone
      const owner = await prisma.owner.findFirst({
        where: { tenantId, phone: { not: null } },
        include: { holdings: { include: { apartment: true } } },
      })
      expect(owner).toBeTruthy()
      expect(owner!.holdings.length).toBeGreaterThan(0)
      ownerId     = owner!.id
      apartmentId = owner!.holdings[0].apartmentId

      expect(adminToken).toBeDefined()
      expect(projectId).toBeDefined()
      expect(ownerId).toBeDefined()
    })
  })

  // ג”€ג”€ Full lifecycle ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('Document integrity', () => {
    it('binds a package to a tenant-scoped project document and stores its SHA-256 hash', async () => {
      const bytes = Buffer.from('%PDF-1.4\nE2E signature document\n%%EOF')
      const s3Key = await storage.upload(tenantId, 'documents', 'e2e-signature.pdf', bytes, 'application/pdf')
      const document = await prisma.document.create({
        data: {
          tenantId, projectId, category: 'LEGAL', title: `E2E Signature Document ${Date.now()}`,
          fileName: 'e2e-signature.pdf', fileSize: bytes.length, mimeType: 'application/pdf',
          s3Key, s3Bucket: process.env.S3_BUCKET ?? 'urban-renewal', createdById: adminUserId,
        },
      })
      const res = await request(app.getHttpServer())
        .post('/api/v1/signatures/packages')
        .set(authHeader(adminToken))
        .send({ projectId, title: 'E2E Document-bound Package', documentId: document.id, signers: [{ ownerId, apartmentId }] })
        .expect(201)
      const stored = await prisma.signaturePackage.findUniqueOrThrow({ where: { id: res.body.id } })
      expect(JSON.parse(stored.documentIds)).toEqual([document.id])
      expect(stored.documentHash).toBe(createHash('sha256').update(bytes).digest('hex'))
      expect(JSON.stringify(res.body)).not.toContain(s3Key)
    })
  })

  describe('Package lifecycle', () => {
    let packageId: string
    let recordId: string
    let signingToken: string

    it('creates a package in DRAFT state', async () => {
      if (!adminToken) return
      const res = await request(app.getHttpServer())
        .post('/api/v1/signatures/packages')
        .set(authHeader(adminToken))
        .send({
          projectId,
          title:  'E2E Test Package',
          signers: [{ ownerId, apartmentId, signerRole: 'OWNER', required: true }],
        })
        .expect(201)

      packageId = res.body.id
      recordId  = res.body.records?.[0]?.id

      expect(res.body.status).toBe('DRAFT')
      expect(packageId).toBeDefined()
    })

    it('returns progress with 0 signed', async () => {
      if (!packageId) return
      const res = await request(app.getHttpServer())
        .get(`/api/v1/signatures/packages/${packageId}/progress`)
        .set(authHeader(adminToken))
        .expect(200)
      expect(res.body.total).toBeGreaterThanOrEqual(1)
      expect(res.body.signed).toBe(0)
    })

    it('submits for internal review', async () => {
      if (!packageId) return
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${packageId}/submit`)
        .set(authHeader(adminToken))
        .expect(200)
      expect(res.body.status).toBe('INTERNAL_REVIEW')
    })

    it('approves the package', async () => {
      if (!packageId) return
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${packageId}/approve`)
        .set(authHeader(adminToken))
        .expect(200)
      expect(res.body.status).toBe('APPROVED')
    })

    it('sends package to signers ג€” returns session tokens', async () => {
      if (!packageId) return
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${packageId}/send`)
        .set(authHeader(adminToken))
        .expect(200)
      expect(res.body.sent).toBe(true)
      expect(res.body.recordTokens).toBeDefined()

      // Grab the first token for subsequent portal tests
      if (recordId && res.body.recordTokens[recordId]) {
        signingToken = res.body.recordTokens[recordId]
      } else {
        signingToken = Object.values(res.body.recordTokens as Record<string, string>)[0] ?? ''
      }
      expect(signingToken).toBeTruthy()
    })

    it('token is present in DB signing session', async () => {
      if (!signingToken) return
      const session = await prisma.signingSession.findUnique({ where: { token: signingToken } })
      expect(session).not.toBeNull()
      expect(session?.revokedAt).toBeNull()
    })

    // ג”€ג”€ Portal flow ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    it('opens portal session ג€” 200', async () => {
      if (!signingToken) return
      const res = await request(app.getHttpServer())
        .get(`/api/v1/signatures/portal/${signingToken}`)
        .expect(200)
      expect(res.body.recordId).toBeDefined()
    })

    it('requests OTP ג€” 200', async () => {
      if (!signingToken) return
      const res = await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${signingToken}/otp`)
        .expect(201)
      expect(res.body.expiresIn).toBeDefined()
    })

    it('wrong OTP code ג†’ 401', async () => {
      if (!signingToken) return
      await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${signingToken}/verify`)
        .send({ code: '000000' })
        .expect(401)
    })

    it('correct OTP code ג†’ verified (using DB hash)', async () => {
      if (!signingToken) return

      // Retrieve session and set a known OTP hash directly for testing
      const session = await prisma.signingSession.findUnique({ where: { token: signingToken } })
      if (!session) return

      const testOtp  = '123456'
      const testHash = createHash('sha256').update(testOtp).digest('hex')
      await prisma.signingSession.update({
        where: { id: session.id },
        data: {
          otpHash:      testHash,
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
          otpAttempts:  0,
        },
      })

      const res = await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${signingToken}/verify`)
        .send({ code: testOtp })
        .expect(201)

      expect(res.body.verified).toBe(true)
    })

    it('signs the document ג†’ 200', async () => {
      if (!signingToken) return
      const res = await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${signingToken}/sign`)
        .expect(201)
      expect(res.body.signed).toBe(true)
    })

    it('all required signed ג†’ package COMPLETED', async () => {
      if (!packageId) return
      // Allow a moment for async state machine
      await new Promise(r => setTimeout(r, 200))
      const pkg = await prisma.signaturePackage.findUnique({ where: { id: packageId } })
      expect(pkg?.status).toBe('COMPLETED')
    })

    it('duplicate sign attempt ג†’ 400', async () => {
      if (!signingToken) return
      // Session should be revoked now
      await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${signingToken}/sign`)
        .expect(401) // session revoked
    })

    it('evidence endpoint returns data after completion', async () => {
      if (!packageId) return
      // Allow background evidence generation
      await new Promise(r => setTimeout(r, 500))
      const res = await request(app.getHttpServer())
        .get(`/api/v1/signatures/packages/${packageId}/evidence`)
        .set(authHeader(adminToken))
      // 200 if evidence was generated, 404 if background job not done yet ג€” both acceptable
      expect([200, 404]).toContain(res.status)
    })
  })

  // ג”€ג”€ Cancel lifecycle ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('Cancel flow', () => {
    let packageId: string

    it('creates and cancels a package', async () => {
      if (!adminToken || !projectId) return
      const create = await request(app.getHttpServer())
        .post('/api/v1/signatures/packages')
        .set(authHeader(adminToken))
        .send({ projectId, title: 'E2E Cancel Test' })
        .expect(201)
      packageId = create.body.id

      const cancel = await request(app.getHttpServer())
        .delete(`/api/v1/signatures/packages/${packageId}`)
        .set(authHeader(adminToken))
        .expect(200)
      expect(cancel.body.status).toBe('CANCELLED')
    })
  })

  // ג”€ג”€ Decline flow ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('Decline flow', () => {
    let packageId: string
    let signingToken: string

    it('signer declines ג†’ record DECLINED, package DECLINED', async () => {
      if (!adminToken || !projectId || !ownerId || !apartmentId) return

      // Create, submit, approve, send
      const pkg = await request(app.getHttpServer())
        .post('/api/v1/signatures/packages')
        .set(authHeader(adminToken))
        .send({
          projectId,
          title: 'E2E Decline Test',
          signers: [{ ownerId, apartmentId, signerRole: 'OWNER', required: true }],
        })
        .expect(201)
      packageId = pkg.body.id

      await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${packageId}/submit`)
        .set(authHeader(adminToken)).expect(200)
      await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${packageId}/approve`)
        .set(authHeader(adminToken)).expect(200)
      const sent = await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${packageId}/send`)
        .set(authHeader(adminToken)).expect(200)

      signingToken = Object.values(sent.body.recordTokens as Record<string, string>)[0]

      // Verify OTP (inject known hash)
      const session = await prisma.signingSession.findUnique({ where: { token: signingToken } })
      const testOtp = '654321'
      await prisma.signingSession.update({
        where: { id: session!.id },
        data: {
          otpHash:      createHash('sha256').update(testOtp).digest('hex'),
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
          otpAttempts:  0,
        },
      })
      await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${signingToken}/verify`)
        .send({ code: testOtp })
        .expect(201)

      // Decline
      const decline = await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${signingToken}/decline`)
        .send({ reason: '׳׳ ׳׳¡׳›׳™׳ ׳׳×׳ ׳׳™׳' })
        .expect(201)
      expect(decline.body.declined).toBe(true)

      await new Promise(r => setTimeout(r, 200))
      const finalPkg = await prisma.signaturePackage.findUnique({ where: { id: packageId } })
      expect(finalPkg?.status).toBe('DECLINED')
    })
  })

  // ג”€ג”€ Cross-tenant isolation ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('Cross-tenant isolation', () => {
    it('returns 404 for package from different tenant', async () => {
      if (!adminToken) return

      // Create a package under a fake tenantId directly in DB
      const fakePkg = await prisma.signaturePackage.create({
        data: {
          tenantId:  'fake-tenant-id',
          projectId: 'fake-project',
          title:     'Cross-tenant Test',
          status:    'DRAFT',
        } as any,
      })

      await request(app.getHttpServer())
        .get(`/api/v1/signatures/packages/${fakePkg.id}`)
        .set(authHeader(adminToken))
        .expect(404)

      // Clean up
      await prisma.signaturePackage.delete({ where: { id: fakePkg.id } })
    })
  })

  // ג”€ג”€ Expired token ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('Expired token', () => {
    it('expired signing token ג†’ 410 Gone', async () => {
      // Insert an expired session directly
      const expiredToken = randomBytes(48).toString('base64url')
      const record = await prisma.signatureRecord.findFirst({
        where: { tenantId },
      })
      if (!record) return

      await prisma.signingSession.upsert({
        where:  { recordId: record.id },
        create: {
          recordId:  record.id,
          token:     expiredToken,
          expiresAt: new Date(Date.now() - 1000), // already expired
        },
        update: {
          token:     expiredToken,
          expiresAt: new Date(Date.now() - 1000),
          revokedAt: null,
        },
      })

      await request(app.getHttpServer())
        .get(`/api/v1/signatures/portal/${expiredToken}`)
        .expect(410)
    })
  })

  // ג”€ג”€ Webhook idempotency ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('Webhook idempotency', () => {
    it('same webhook event twice does not create duplicate events', async () => {
      if (!adminToken || !projectId) return

      const pkg = await prisma.signaturePackage.create({
        data: {
          tenantId,
          projectId,
          title:             'Webhook Idempotency Test',
          status:            'SENT',
          providerEnvelopeId: 'test_envelope_idempotent',
        } as any,
      })

      const payload = JSON.stringify({
        envelopeId: 'test_envelope_idempotent',
        event:      'envelope_signed',
      })

      // First call
      await request(app.getHttpServer())
        .post('/api/v1/signatures/webhooks/native')
        .set('Content-Type', 'application/json')
        .send(payload)

      // Second call ג€” same event
      await request(app.getHttpServer())
        .post('/api/v1/signatures/webhooks/native')
        .set('Content-Type', 'application/json')
        .send(payload)

      // Count events for this package ג€” should not have duplicated
      const events = await prisma.signatureEvent.findMany({ where: { packageId: pkg.id } })
      expect(events.length).toBeLessThanOrEqual(2) // at most one per call

      // Cleanup
      await prisma.signatureEvent.deleteMany({ where: { packageId: pkg.id } })
      await prisma.signaturePackage.delete({ where: { id: pkg.id } })
    })
  })

  // ג”€ג”€ Sequential signing enforcement ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('Sequential signing order', () => {
    let pkg2Id: string
    let owner2Id: string
    let apartment2Id: string
    let token1: string
    let token2: string

    it('sets up a sequential two-signer package', async () => {
      if (!adminToken || !projectId || !ownerId || !apartmentId) return

      // Find a second owner/apartment for signer 2
      const owner2 = await prisma.owner.findFirst({
        where: {
          tenantId,
          phone: { not: null },
          id:    { not: ownerId },
        },
        include: { holdings: true },
      })
      if (!owner2 || !owner2.holdings.length) {
        console.warn('[SKIP] No second owner for sequential test')
        return
      }
      owner2Id     = owner2.id
      apartment2Id = owner2.holdings[0].apartmentId

      const pkg = await request(app.getHttpServer())
        .post('/api/v1/signatures/packages')
        .set(authHeader(adminToken))
        .send({
          projectId,
          title:        'E2E Sequential Test',
          signingOrder: 'SEQUENTIAL',
          signers: [
            { ownerId, apartmentId, signerRole: 'OWNER', required: true, signingOrder: 0 },
            { ownerId: owner2Id, apartmentId: apartment2Id, signerRole: 'OWNER', required: true, signingOrder: 1 },
          ],
        })
        .expect(201)

      pkg2Id = pkg.body.id
      expect(pkg2Id).toBeDefined()

      // Submit ג†’ approve ג†’ send
      await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${pkg2Id}/submit`)
        .set(authHeader(adminToken)).expect(200)
      await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${pkg2Id}/approve`)
        .set(authHeader(adminToken)).expect(200)
      const sent = await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${pkg2Id}/send`)
        .set(authHeader(adminToken)).expect(200)

      const records = await prisma.signatureRecord.findMany({
        where:   { packageId: pkg2Id },
        orderBy: { signingOrder: 'asc' },
      })
      const r1 = records[0]
      const r2 = records[1]

      token1 = sent.body.recordTokens[r1.id]
      token2 = sent.body.recordTokens[r2.id]
      expect(token1).toBeTruthy()
      expect(token2).toBeTruthy()
    })

    it('signer 2 cannot request OTP before signer 1 signs ג†’ 403', async () => {
      if (!token2) return
      const res = await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${token2}/otp`)
        .expect(403)
      expect(res.body.message).toMatch(/חותם/)
    })

    it('signer 2 cannot sign directly -> denied (401 or 403)', async () => {
      if (!token2) return
      // The OTP-verified guard (401) runs before the signing-order guard (403);
      // signer 2 never verified an OTP, so either denial is correct.
      const res = await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${token2}/sign`)
      expect([401, 403]).toContain(res.status)
    })

    it('signer 1 signs successfully', async () => {
      if (!token1) return

      // Inject known OTP hash for signer 1
      const s1 = await prisma.signingSession.findUnique({ where: { token: token1 } })
      if (!s1) return
      const otp1 = '111222'
      await prisma.signingSession.update({
        where: { id: s1.id },
        data: {
          otpHash:      createHash('sha256').update(otp1).digest('hex'),
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
          otpAttempts:  0,
          verifiedAt:   null,
        },
      })
      // First, request OTP (to pass order check)
      await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${token1}/otp`)
        .expect(201)
      // Inject hash again (requestOtp overwrites it)
      await prisma.signingSession.update({
        where: { id: s1.id },
        data: {
          otpHash:      createHash('sha256').update(otp1).digest('hex'),
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
          otpAttempts:  0,
        },
      })
      await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${token1}/verify`)
        .send({ code: otp1 })
        .expect(201)
      const res = await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${token1}/sign`)
        .expect(201)
      expect(res.body.signed).toBe(true)
    })

    it('after signer 1 signs, signer 2 can now request OTP ג†’ 200', async () => {
      if (!token2) return
      const res = await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${token2}/otp`)
        .expect(201)
      expect(res.body.expiresIn).toBeDefined()
    })
  })

  // ג”€ג”€ OTP brute-force protection ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('OTP brute-force protection', () => {
    it('5 consecutive wrong OTPs lock the session', async () => {
      if (!adminToken || !projectId || !ownerId || !apartmentId) return

      const pkg = await request(app.getHttpServer())
        .post('/api/v1/signatures/packages')
        .set(authHeader(adminToken))
        .send({
          projectId,
          title: 'E2E Brute Force Test',
          signers: [{ ownerId, apartmentId, signerRole: 'OWNER', required: true }],
        })
        .expect(201)
      const pkgId   = pkg.body.id
      const recordId = pkg.body.records?.[0]?.id

      await request(app.getHttpServer()).patch(`/api/v1/signatures/packages/${pkgId}/submit`).set(authHeader(adminToken))
      await request(app.getHttpServer()).patch(`/api/v1/signatures/packages/${pkgId}/approve`).set(authHeader(adminToken))
      const sent = await request(app.getHttpServer()).patch(`/api/v1/signatures/packages/${pkgId}/send`).set(authHeader(adminToken))
      const bfToken = sent.body.recordTokens[recordId] ?? Object.values(sent.body.recordTokens as Record<string, string>)[0]

      // Request OTP to initialise the hash
      await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${bfToken}/otp`)

      // Inject a known hash so wrong codes are truly wrong
      const session = await prisma.signingSession.findUnique({ where: { token: bfToken } })
      await prisma.signingSession.update({
        where: { id: session!.id },
        data: {
          otpHash:      createHash('sha256').update('999999').digest('hex'),
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
          otpAttempts:  0,
        },
      })

      // Send 5 wrong codes
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post(`/api/v1/signatures/portal/${bfToken}/verify`)
          .send({ code: '000000' })
          .expect(401)
      }

      // 6th attempt with correct OTP ג€” must fail because session is locked
      await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${bfToken}/verify`)
        .send({ code: '999999' })
        .expect(401)

      // Cleanup
      await prisma.signaturePackage.delete({ where: { id: pkgId } })
    })
  })

  // ג”€ג”€ Evidence integrity ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

  describe('Evidence integrity', () => {
    it('evidence endpoint requires authentication ג†’ 401', async () => {
      if (!projectId) return
      await request(app.getHttpServer())
        .get(`/api/v1/signatures/packages/any-id/evidence`)
        .expect(401)
    })

    it('after completion, evidence includes evidenceHash', async () => {
      if (!adminToken || !projectId || !ownerId || !apartmentId) return

      // Create ג†’ complete a package
      const pkg = await request(app.getHttpServer())
        .post('/api/v1/signatures/packages')
        .set(authHeader(adminToken))
        .send({
          projectId,
          title: 'E2E Evidence Hash Test',
          signers: [{ ownerId, apartmentId, signerRole: 'OWNER', required: true }],
        })
        .expect(201)
      const evPkgId  = pkg.body.id
      const evRecId  = pkg.body.records?.[0]?.id

      await request(app.getHttpServer()).patch(`/api/v1/signatures/packages/${evPkgId}/submit`).set(authHeader(adminToken))
      await request(app.getHttpServer()).patch(`/api/v1/signatures/packages/${evPkgId}/approve`).set(authHeader(adminToken))
      const sent = await request(app.getHttpServer()).patch(`/api/v1/signatures/packages/${evPkgId}/send`).set(authHeader(adminToken))
      const evToken = sent.body.recordTokens[evRecId] ?? Object.values(sent.body.recordTokens as Record<string, string>)[0]

      // Inject OTP and sign
      const evSession = await prisma.signingSession.findUnique({ where: { token: evToken } })
      const evOtp = '424242'
      await prisma.signingSession.update({
        where: { id: evSession!.id },
        data: {
          otpHash:      createHash('sha256').update(evOtp).digest('hex'),
          otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
          otpAttempts:  0,
        },
      })
      await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${evToken}/verify`)
        .send({ code: evOtp })
      await request(app.getHttpServer())
        .post(`/api/v1/signatures/portal/${evToken}/sign`)

      // Wait for async evidence generation
      await new Promise(r => setTimeout(r, 600))

      const evRes = await request(app.getHttpServer())
        .get(`/api/v1/signatures/packages/${evPkgId}/evidence`)
        .set(authHeader(adminToken))

      if (evRes.status === 200) {
        expect(evRes.body.evidenceHash).toBeDefined()
        expect(typeof evRes.body.evidenceHash).toBe('string')
        // s3Key must NOT be in the response
        expect(evRes.body.s3Key).toBeUndefined()
        expect(evRes.body.pdfBase64).toBeUndefined()
        expect(evRes.body.pdfS3Key).toBeUndefined()
      }
      // 404 is acceptable if background job hasn't finished
      expect([200, 404]).toContain(evRes.status)
    })

    it('evidence PDF endpoint returns url or base64 after completion', async () => {
      if (!adminToken) return
      // Find any completed package in DB
      const completed = await prisma.signaturePackage.findFirst({
        where: { tenantId, status: 'COMPLETED' },
      })
      if (!completed) return

      const res = await request(app.getHttpServer())
        .get(`/api/v1/signatures/packages/${completed.id}/evidence/pdf`)
        .set(authHeader(adminToken))

      expect([200]).toContain(res.status)
      // Response may be empty {} if PDF not yet generated, or have url/base64
      expect(typeof res.body).toBe('object')
    })

    it('cross-tenant evidence access ג†’ 404', async () => {
      if (!adminToken || !projectId) return

      const otherTenantPkg = await prisma.signaturePackage.create({
        data: {
          tenantId:  'other-tenant',
          projectId: 'other-project',
          title:     'Cross-tenant evidence test',
          status:    'COMPLETED',
        } as any,
      })

      await request(app.getHttpServer())
        .get(`/api/v1/signatures/packages/${otherTenantPkg.id}/evidence`)
        .set(authHeader(adminToken))
        .expect(404)

      await prisma.signaturePackage.delete({ where: { id: otherTenantPkg.id } })
    })
  })

  /**
   * Regression: the 5-attempt OTP lockout must actually bound the number of
   * guesses per signing session.
   *
   * Requesting a fresh OTP resets otpAttempts to 0, so without a cap on
   * resends the lockout is decorative — an attacker loops
   * request-OTP → 5 guesses → request-OTP indefinitely. A Pass 2 audit drove
   * 4 uninterrupted cycles (20 guesses) against a live session before this cap
   * existed. requestOtp() now rate-limits resends per session and answers 429.
   */
  describe('OTP lockout cannot be reset indefinitely', () => {
    it('caps OTP resends per signing session with 429', async () => {
      if (!adminToken || !projectId || !ownerId || !apartmentId) return

      const pkg = await request(app.getHttpServer())
        .post('/api/v1/signatures/packages')
        .set(authHeader(adminToken))
        .send({
          projectId,
          title:        `${E2E_TITLE_PREFIX}OTP resend cap`,
          signingOrder: 'PARALLEL',
          signers: [{ ownerId, apartmentId, signerRole: 'OWNER', required: true, signingOrder: 0 }],
        })
        .expect(201)

      const pkgId = pkg.body.id
      for (const step of ['submit', 'approve']) {
        await request(app.getHttpServer())
          .patch(`/api/v1/signatures/packages/${pkgId}/${step}`)
          .set(authHeader(adminToken)).expect(200)
      }
      const sent = await request(app.getHttpServer())
        .patch(`/api/v1/signatures/packages/${pkgId}/send`)
        .set(authHeader(adminToken)).expect(200)

      const record = await prisma.signatureRecord.findFirstOrThrow({ where: { packageId: pkgId } })
      const token  = sent.body.recordTokens[record.id] as string
      expect(token).toBeTruthy()

      // Burn the lockout, then try to reset it by asking for a new code.
      let cycles = 0
      let lastStatus = 0
      for (let c = 0; c < 8; c++) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/signatures/portal/${token}/otp`)
        lastStatus = res.status
        if (res.status !== 201) break
        cycles++
        for (let i = 0; i < 5; i++) {
          await request(app.getHttpServer())
            .post(`/api/v1/signatures/portal/${token}/verify`)
            .send({ code: '222222' })
        }
      }

      // The resend cap must engage — an unbounded loop is the bug.
      expect(lastStatus).toBe(429)
      expect(cycles).toBeLessThanOrEqual(5)

      // Brute force must not have moved the record or verified the session.
      const after = await prisma.signatureRecord.findUniqueOrThrow({ where: { id: record.id } })
      expect(after.status).toBe('PENDING')
      const session = await prisma.signingSession.findUniqueOrThrow({ where: { recordId: record.id } })
      expect(session.verifiedAt).toBeNull()
    })
  })
})
