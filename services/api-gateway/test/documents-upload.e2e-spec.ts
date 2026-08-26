/**
 * Document upload E2E tests — POST /api/v1/documents/upload (multipart) and the
 * hardened POST /api/v1/documents.
 *
 * Why this suite exists: before this change there was no multipart handling in
 * the service at all, and POST /documents spread `...body` straight into
 * `prisma.document.create` while never setting the required `createdById` FK.
 * These tests pin both the new flow and the two fixed bugs.
 *
 * The app under test is configured EXACTLY like `main.ts` (same ValidationPipe
 * options) — a laxer pipe would make the mass-assignment assertions vacuous.
 *
 * Real MinIO is used. Every object and row created here is removed in afterAll.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import {
  MAX_DOCUMENT_BYTES, UPLOAD_ERRORS, DOCUMENT_FILE_TYPES,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from '../src/documents/document-upload.constants'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'
const B_SLUG = 'e2e-upload-tenant-b'

/** A tiny but structurally valid PDF, so the MIME allow-list sees a real type. */
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'utf8',
)

describe('Document upload (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let adminToken: string
  let tenantId: string
  let userId: string
  let projectId: string

  let tenantBId: string
  let bProjectId: string

  const createdDocumentIds: string[] = []

  const tokenFor = (role: string) =>
    jwt.sign(
      // sessionId is mandatory; a fresh random one is never revoked, so this
      // isolates the RBAC check without weakening authentication.
      { sub: userId, email: SEED_EMAIL, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '5m' },
    )

  const purgeTenantB = async () => {
    const t = await prisma.tenant.findUnique({ where: { slug: B_SLUG } })
    if (!t) return
    await prisma.document.deleteMany({ where: { tenantId: t.id } })
    await prisma.project.deleteMany({ where: { tenantId: t.id } })
    await prisma.user.deleteMany({ where: { tenantId: t.id } })
    await prisma.tenant.delete({ where: { id: t.id } })
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      /**
       * The global ThrottlerGuard allows 20 requests/second. Since the
       * signature-validation and versioning blocks were added this suite fires
       * well past that in a burst, producing 429s in place of the 401/403/404
       * the RBAC and tenant-isolation tests are actually asserting.
       *
       * We replace the throttler's STORAGE, not the guard — `overrideGuard`
       * does not work, because the guard is registered as `{ provide: APP_GUARD,
       * useClass: ThrottlerGuard }` and `useClass` constructs a fresh instance
       * rather than resolving the overridden token. Its injected
       * `ThrottlerStorage` IS resolved from the container, so a counter that
       * never accumulates is the reliable seam. Same approach, and same
       * reasoning, as excel-import.e2e-spec.ts.
       *
       * This is a harness artefact only: it softens no assertion in this file.
       * Every upload-specific guard (RBAC, tenant scoping, MIME allow-list,
       * signature validation, size limit) remains fully active.
       */
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
    // Mirrors main.ts exactly — `forbidNonWhitelisted` is what turns a
    // mass-assignment attempt into a 400 instead of a silent strip.
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

    // Fail loudly rather than silently skipping the suite.
    expect(login.status).toBe(200)
    adminToken = login.body.accessToken
    expect(typeof adminToken).toBe('string')

    const decoded = jwt.decode(adminToken) as any
    tenantId = decoded.tenantId
    userId = decoded.sub

    const project = await prisma.project.findFirst({
      where: { tenantId },
      select: { id: true },
    })
    expect(project).toBeTruthy()
    projectId = project!.id

    // A second tenant, for the cross-tenant parent-scoping assertion.
    await purgeTenantB()
    const tenantB = await prisma.tenant.create({
      data: { name: 'E2E Upload Tenant B', slug: B_SLUG },
    })
    tenantBId = tenantB.id
    expect(tenantBId).not.toBe(tenantId)

    const bProject = await prisma.project.create({
      data: { tenantId: tenantBId, code: 'UPB-001', name: 'Upload Tenant B', city: 'חיפה' },
    })
    bProjectId = bProject.id
  })

  afterAll(async () => {
    // Remove every object this suite put in the bucket, then the rows.
    if (prisma && createdDocumentIds.length) {
      const docs = await prisma.document.findMany({
        where: { id: { in: createdDocumentIds } },
        select: { id: true, s3Key: true },
      })
      const storage = app.get(
        require('../src/storage/storage.service').StorageService,
        { strict: false },
      )
      for (const d of docs) {
        if (d.s3Key) await storage.delete(tenantId, d.s3Key).catch(() => {})
      }
      await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } })
    }
    await purgeTenantB()
    await app?.close()
  })

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` })

  const postUpload = (headers: Record<string, string>) =>
    request(app.getHttpServer()).post('/api/v1/documents/upload').set(headers)

  /* ── Happy path ──────────────────────────────────────────────── */

  describe('successful upload', () => {
    let body: any

    beforeAll(async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'E2E uploaded contract')
        .field('category', 'CONTRACT')
        .field('projectId', projectId)
        .field('description', 'created by documents-upload.e2e-spec')
        .attach('file', PDF_BYTES, { filename: 'e2e-upload.pdf', contentType: 'application/pdf' })

      expect(res.status).toBe(201)
      body = res.body
      createdDocumentIds.push(body.id)
    })

    it('returns the created document', () => {
      expect(body.id).toEqual(expect.any(String))
      expect(body.title).toBe('E2E uploaded contract')
      expect(body.category).toBe('CONTRACT')
      expect(body.projectId).toBe(projectId)
      expect(body.mimeType).toBe('application/pdf')
      expect(body.fileSize).toBe(PDF_BYTES.length)
    })

    it('never returns the storage key or bucket', () => {
      expect(body).not.toHaveProperty('s3Key')
      expect(body).not.toHaveProperty('s3Bucket')
      expect(JSON.stringify(body)).not.toContain('urban-renewal')
    })

    it('sets createdById from the JWT (the bug: it was never set at all)', async () => {
      const row = await prisma.document.findUnique({ where: { id: body.id } })
      expect(row?.createdById).toBe(userId)
    })

    it('stores the object under the tenant key prefix', async () => {
      const row = await prisma.document.findUnique({ where: { id: body.id } })
      expect(row?.s3Key.startsWith(`${tenantId}/`)).toBe(true)
      expect(row?.s3Key).toContain('/documents/')
    })

    it('the file is retrievable through the signed-URL endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${body.id}/download`)
        .set(asAdmin())
      expect(res.status).toBe(200)
      expect(res.body.expiresIn).toBe(900)
      expect(typeof res.body.url).toBe('string')
    })

    it('appears in GET /documents without a storage key', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents?projectId=${projectId}`)
        .set(asAdmin())
      expect(res.status).toBe(200)
      const found = res.body.find((d: any) => d.id === body.id)
      expect(found).toBeTruthy()
      expect(found).not.toHaveProperty('s3Key')
    })
  })

  /* ── File validation ─────────────────────────────────────────── */

  describe('file validation', () => {
    it('rejects a disallowed MIME type → 400', async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'evil').field('category', 'OTHER').field('projectId', projectId)
        .attach('file', Buffer.from('<script>alert(1)</script>'), {
          filename: 'x.html', contentType: 'text/html',
        })
      expect(res.status).toBe(400)
      expect(String(res.body.message)).toContain('סוג הקובץ אינו נתמך')
    })

    it('rejects an oversize file → 413', async () => {
      const tooBig = Buffer.alloc(MAX_DOCUMENT_BYTES + 1024, 0x41)
      const res = await postUpload(asAdmin())
        .field('title', 'huge').field('category', 'OTHER').field('projectId', projectId)
        .attach('file', tooBig, { filename: 'huge.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(413)
    }, 60_000)

    it('rejects a request with no file part → 400', async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'no file').field('category', 'OTHER').field('projectId', projectId)
      expect(res.status).toBe(400)
    })

    it('rejects an empty file → 400', async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'empty').field('category', 'OTHER').field('projectId', projectId)
        .attach('file', Buffer.alloc(0), { filename: 'empty.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(400)
    })
  })

  /* ── Metadata validation ─────────────────────────────────────── */

  describe('metadata validation', () => {
    it('rejects a missing projectId → 400 (uploads are always project-scoped)', async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'unscoped').field('category', 'OTHER')
        .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(400)
    })

    it('rejects an invalid category → 400', async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'bad cat').field('category', 'NOT_A_CATEGORY').field('projectId', projectId)
        .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(400)
    })

    it('rejects a client-supplied s3Key (mass assignment) → 400', async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'hijack').field('category', 'OTHER').field('projectId', projectId)
        .field('s3Key', 'some-other-tenant/secrets/payroll.pdf')
        .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(400)
    })
  })

  /* ── RBAC ────────────────────────────────────────────────────── */

  /* ── Magic-byte / signature validation (B2) ──────────────────── */

  /**
   * The allow-list used to trust `file.mimetype`, which is a client-supplied
   * header — so a renamed executable posted as `application/pdf` passed. These
   * tests send bytes that contradict the declared type and require a 400.
   */
  describe('file signature validation', () => {
    /** DOS/PE header — the first bytes of every Windows .exe. */
    const EXE_BYTES = Buffer.concat([
      Buffer.from('MZ', 'ascii'),
      Buffer.alloc(64, 0x00),
      Buffer.from('PE\0\0', 'ascii'),
      Buffer.from('This program cannot be run in DOS mode.', 'ascii'),
    ])
    /** ELF header — a Linux binary. */
    const ELF_BYTES = Buffer.concat([
      Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]),
      Buffer.alloc(64, 0x00),
    ])
    const PNG_BYTES = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('IHDRfake', 'ascii'),
    ])

    /**
     * Titled 'signature probe' so the final assertion in this block can prove
     * that NONE of the rejected uploads created a row. Accepted files below use
     * their own titles for exactly that reason.
     */
    const attempt = (buf: Buffer, filename: string, contentType: string) =>
      postUpload(asAdmin())
        .field('title', 'signature probe')
        .field('category', 'OTHER')
        .field('projectId', projectId)
        .attach('file', buf, { filename, contentType })

    it('rejects a Windows executable disguised as a PDF → 400', async () => {
      const res = await attempt(EXE_BYTES, 'invoice.pdf', 'application/pdf')
      expect(res.status).toBe(400)
      // Not the generic allow-list message — the CONTENT check is what fired.
      expect(String(res.body.message)).toContain('תוכן הקובץ')
    })

    it('rejects a Linux executable disguised as a PDF → 400', async () => {
      const res = await attempt(ELF_BYTES, 'report.pdf', 'application/pdf')
      expect(res.status).toBe(400)
    })

    it('rejects an executable disguised as plain text → 400', async () => {
      // The signature-less formats are covered by the text heuristic: a NUL
      // byte is the tell no genuine text file has.
      const res = await attempt(EXE_BYTES, 'notes.txt', 'text/plain')
      expect(res.status).toBe(400)
      expect(String(res.body.message)).toContain('טקסט')
    })

    it('rejects an executable disguised as a CSV → 400', async () => {
      const res = await attempt(EXE_BYTES, 'owners.csv', 'text/csv')
      expect(res.status).toBe(400)
    })

    it('rejects HTML disguised as a PDF → 400 (stored-XSS vector)', async () => {
      const html = Buffer.from('<html><script>alert(1)</script></html>', 'utf8')
      const res = await attempt(html, 'x.pdf', 'application/pdf')
      expect(res.status).toBe(400)
    })

    it('rejects a PNG posted as application/pdf → 400', async () => {
      const res = await attempt(PNG_BYTES, 'chart.pdf', 'application/pdf')
      expect(res.status).toBe(400)
    })

    it('rejects an extension that contradicts the declared type → 400', async () => {
      const res = await attempt(PDF_BYTES, 'payload.exe', 'application/pdf')
      expect(res.status).toBe(400)
      expect(String(res.body.message)).toContain('סיומת')
    })

    it('still accepts a genuine PDF', async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'genuine pdf')
        .field('category', 'OTHER')
        .field('projectId', projectId)
        .attach('file', PDF_BYTES, { filename: 'genuine.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(201)
      createdDocumentIds.push(res.body.id)
    })

    it('still accepts a genuine PNG', async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'genuine png')
        .field('category', 'OTHER')
        .field('projectId', projectId)
        .attach('file', PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' })
      expect(res.status).toBe(201)
      createdDocumentIds.push(res.body.id)
    })

    it('still accepts genuine Hebrew text and CSV', async () => {
      for (const [name, type, content] of [
        ['notes.txt', 'text/plain', 'הערות לפרויקט\nשורה שנייה'],
        ['owners.csv', 'text/csv', 'שם,טלפון\nישראל ישראלי,0501234567'],
      ] as const) {
        const res = await postUpload(asAdmin())
          .field('title', `genuine ${name}`)
          .field('category', 'OTHER')
          .field('projectId', projectId)
          .attach('file', Buffer.from(content, 'utf8'), { filename: name, contentType: type })
        expect({ name, status: res.status }).toEqual({ name, status: 201 })
        createdDocumentIds.push(res.body.id)
      }
    })

    it('the rejected files left NO object in the bucket and no row', async () => {
      // Every upload titled 'signature probe' in this block was expected to be
      // rejected. Validation runs before storage is touched, so a refused
      // upload cannot orphan an object OR a row.
      const rows = await prisma.document.findMany({
        where: { tenantId, title: 'signature probe' },
        select: { id: true },
      })
      expect(rows).toHaveLength(0)
    })
  })

  /* ── CAD formats: DWG / DXF (Phase A) ────────────────────────── */

  describe('CAD upload (DWG / DXF)', () => {
    /** A real DWG opens with its version tag; AC1027 is AutoCAD 2013. */
    const DWG_BYTES = Buffer.concat([
      Buffer.from('AC1027', 'ascii'),
      Buffer.alloc(16, 0x00),
      Buffer.from('drawing body', 'ascii'),
    ])

    /**
     * Line endings are built with fromCharCode rather than written as escapes,
     * so the fixture bytes are unambiguous in the source and cannot be mangled
     * by an editor normalising CRLF to LF — DXF is line-oriented, and the whole
     * point of these fixtures is the exact byte sequence.
     */
    const CR = String.fromCharCode(13)
    const LF = String.fromCharCode(10)
    const CRLF = CR + LF

    /** Binary DXF — has a genuine magic string, unlike the ASCII flavour. */
    const DXF_BINARY_BYTES = Buffer.concat([
      Buffer.from('AutoCAD Binary DXF' + CRLF + String.fromCharCode(26, 0), 'latin1'),
      Buffer.alloc(32, 0x00),
    ])

    /** ASCII DXF — group-code/value pairs, opening with 0 / SECTION. */
    const DXF_ASCII =
      ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1027',
       '0', 'ENDSEC', '0', 'EOF', ''].join(CRLF)

    /** Same, preceded by the 999 comment banner some exporters emit. */
    const DXF_ASCII_WITH_COMMENT =
      ['999', 'Exported by a third-party tool', '999', 'second comment', ''].join(LF)
      + DXF_ASCII

    const attemptCad = (buf: Buffer, filename: string, contentType: string, title: string) =>
      postUpload(asAdmin())
        .field('title', title)
        .field('category', 'OTHER')
        .field('projectId', projectId)
        .attach('file', buf, { filename, contentType })

    it('accepts a genuine DWG', async () => {
      const res = await attemptCad(DWG_BYTES, 'building-a.dwg', 'image/vnd.dwg', 'genuine dwg')
      expect(res.status).toBe(201)
      createdDocumentIds.push(res.body.id)
    })

    it('accepts a DWG posted under the legacy application/acad alias', async () => {
      const res = await attemptCad(DWG_BYTES, 'site.dwg', 'application/acad', 'genuine dwg alias')
      expect(res.status).toBe(201)
      createdDocumentIds.push(res.body.id)
    })

    it('accepts a binary DXF', async () => {
      const res = await attemptCad(DXF_BINARY_BYTES, 'plan.dxf', 'image/vnd.dxf', 'genuine dxf bin')
      expect(res.status).toBe(201)
      createdDocumentIds.push(res.body.id)
    })

    it('accepts an ASCII DXF via the structural probe', async () => {
      const res = await attemptCad(
        Buffer.from(DXF_ASCII, 'ascii'), 'plan.dxf', 'application/dxf', 'genuine dxf ascii',
      )
      expect(res.status).toBe(201)
      createdDocumentIds.push(res.body.id)
    })

    it('accepts an ASCII DXF that opens with 999 comment records', async () => {
      const res = await attemptCad(
        Buffer.from(DXF_ASCII_WITH_COMMENT, 'ascii'), 'c.dxf', 'image/vnd.dxf', 'genuine dxf 999',
      )
      expect(res.status).toBe(201)
      createdDocumentIds.push(res.body.id)
    })

    /*
     * The point of the probe: .dxf must NOT become a second text/plain slot.
     * If these passed, enabling CAD would have widened the allow-list to "any
     * text file with a .dxf name", which is the failure mode the probe exists
     * to prevent.
     */
    it('rejects an arbitrary text file renamed to .dxf → 400', async () => {
      const res = await attemptCad(
        Buffer.from(['just some notes', 'nothing to do with CAD', ''].join(LF), 'utf8'),
        'notes.dxf', 'image/vnd.dxf', 'cad probe',
      )
      expect(res.status).toBe(400)
    })

    it('rejects a text file that merely CONTAINS the word SECTION → 400', async () => {
      const res = await attemptCad(
        Buffer.from(['preamble line', 'more text', '0', 'SECTION', ''].join(LF), 'utf8'),
        'late.dxf', 'image/vnd.dxf', 'cad probe',
      )
      // The header must be the FIRST record, not merely present somewhere.
      expect(res.status).toBe(400)
    })

    it('rejects a Windows executable renamed to .dwg → 400', async () => {
      const exe = Buffer.concat([Buffer.from('MZ', 'ascii'), Buffer.alloc(64, 0x00)])
      const res = await attemptCad(exe, 'payload.dwg', 'image/vnd.dwg', 'cad probe')
      expect(res.status).toBe(400)
    })

    it('rejects a Windows executable renamed to .dxf → 400', async () => {
      const exe = Buffer.concat([Buffer.from('MZ', 'ascii'), Buffer.alloc(64, 0x00)])
      const res = await attemptCad(exe, 'payload.dxf', 'image/vnd.dxf', 'cad probe')
      expect(res.status).toBe(400)
    })

    it('rejects a PDF posted as a DWG → 400', async () => {
      const res = await attemptCad(PDF_BYTES, 'x.dwg', 'image/vnd.dwg', 'cad probe')
      expect(res.status).toBe(400)
    })

    it('rejects a .dwg extension declared as image/vnd.dxf → 400', async () => {
      const res = await attemptCad(DWG_BYTES, 'x.dwg', 'image/vnd.dxf', 'cad probe')
      expect(res.status).toBe(400)
    })

    it('a RESIDENT cannot upload CAD → 403', async () => {
      const res = await postUpload({ Authorization: `Bearer ${tokenFor('RESIDENT')}` })
        .field('title', 'cad probe').field('category', 'OTHER').field('projectId', projectId)
        .attach('file', DWG_BYTES, { filename: 'a.dwg', contentType: 'image/vnd.dwg' })
      expect(res.status).toBe(403)
    })

    it("uploading CAD into another tenant's project → 404", async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'cad probe').field('category', 'OTHER').field('projectId', bProjectId)
        .attach('file', DWG_BYTES, { filename: 'a.dwg', contentType: 'image/vnd.dwg' })
      expect(res.status).toBe(404)
    })

    it('every rejected CAD attempt left no row behind', async () => {
      const rows = await prisma.document.findMany({
        where: { title: 'cad probe' },
        select: { id: true },
      })
      expect(rows).toHaveLength(0)
    })
  })

  /* ── Configurable limits (B2) ─────────────────────────────────── */

  describe('configurable limits', () => {
    it('MAX_DOCUMENT_BYTES comes from the environment, defaulting to 100 MB', () => {
      // Raised from 25 MB to 100 MB when CAD was enabled: a multi-building
      // pinuy-binuy DWG set with xrefs reaches the high tens of MB, which the
      // old ceiling refused. The env override is still the deployment knob.
      const expected = Number(process.env.MAX_DOCUMENT_BYTES ?? 100 * 1024 * 1024)
      expect(MAX_DOCUMENT_BYTES).toBe(expected)
    })

    it('the default is exactly 100 MB when the environment does not override it', () => {
      if (process.env.MAX_DOCUMENT_BYTES) return // deployment override in effect
      expect(MAX_DOCUMENT_BYTES).toBe(100 * 1024 * 1024)
    })

    it('the oversize error message reports the configured limit, not a literal 25', () => {
      expect(UPLOAD_ERRORS.tooLarge).toContain(
        String(Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))),
      )
    })
  })

  /* ── Extensible MIME registry (B2) ────────────────────────────── */

  describe('MIME registry', () => {
    it('derives the allow-list from the registry, so the two cannot drift', () => {
      for (const spec of DOCUMENT_FILE_TYPES) {
        expect(ALLOWED_DOCUMENT_MIME_TYPES).toContain(spec.mime)
        for (const alias of spec.aliases ?? []) {
          expect(ALLOWED_DOCUMENT_MIME_TYPES).toContain(alias)
        }
      }
    })

    it('every registry entry declares at least one extension and a label', () => {
      for (const spec of DOCUMENT_FILE_TYPES) {
        expect(spec.extensions.length).toBeGreaterThan(0)
        expect(spec.label).toBeTruthy()
        for (const ext of spec.extensions) expect(ext.startsWith('.')).toBe(true)
      }
    })

    it('only the two genuinely signature-less text formats have no signature', () => {
      // DXF is text-shaped too, but it is NOT in this list: it carries the
      // binary-DXF signature plus a structural `probe`, precisely so that
      // enabling CAD did not open a second "any text file" hole.
      const noSignature = DOCUMENT_FILE_TYPES
        .filter((t) => t.signatures.length === 0)
        .map((t) => t.mime)
        .sort()
      expect(noSignature).toEqual(['text/csv', 'text/plain'])
    })

    it('CAD formats are present in the registry', () => {
      const mimes = DOCUMENT_FILE_TYPES.map((t) => t.mime)
      expect(mimes).toContain('image/vnd.dwg')
      expect(mimes).toContain('image/vnd.dxf')
    })

    it('the only format with a content probe is DXF', () => {
      const probed = DOCUMENT_FILE_TYPES.filter((t) => t.probe).map((t) => t.mime)
      expect(probed).toEqual(['image/vnd.dxf'])
    })
  })

  /* ── Document versioning (B1) ─────────────────────────────────── */

  describe('document versioning', () => {
    const PDF_V2 = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Rev 2>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
      'utf8',
    )
    const PDF_V3 = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Rev 3>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
      'utf8',
    )

    let rootId: string
    let v2Id: string

    const uploadVersion = (id: string, buf: Buffer, filename = 'tabu-v2.pdf') =>
      request(app.getHttpServer())
        .post(`/api/v1/documents/${id}/versions`)
        .set(asAdmin())
        .attach('file', buf, { filename, contentType: 'application/pdf' })

    beforeAll(async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'נסח טאבו לגרסאות')
        .field('category', 'LAND_REGISTRY')
        .field('projectId', projectId)
        .attach('file', PDF_BYTES, { filename: 'tabu.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(201)
      rootId = res.body.id
      createdDocumentIds.push(rootId)
    })

    it('the first upload is version 1, is the chain root, and is the latest', async () => {
      const row = await prisma.document.findUnique({ where: { id: rootId } })
      expect(row!.version).toBe(1)
      expect(row!.parentId).toBeNull()
      expect(row!.isLatest).toBe(true)
    })

    it('uploading a replacement creates version 2 and demotes version 1', async () => {
      const res = await uploadVersion(rootId, PDF_V2)
      expect(res.status).toBe(201)
      v2Id = res.body.id
      createdDocumentIds.push(v2Id)

      expect(res.body.version).toBe(2)
      expect(res.body.parentId).toBe(rootId)
      expect(res.body.isLatest).toBe(true)
      // Exactly one row in the chain is current.
      expect((await prisma.document.findUnique({ where: { id: rootId } }))!.isLatest).toBe(false)
    })

    it('NEVER overwrites the previous object — each version has its own key', async () => {
      const v1 = await prisma.document.findUnique({ where: { id: rootId } })
      const v2 = await prisma.document.findUnique({ where: { id: v2Id } })
      expect(v1!.s3Key).not.toBe(v2!.s3Key)

      // Both objects still exist AND still hold their own distinct bytes.
      const storage = app.get(
         
        require('../src/storage/storage.service').StorageService,
        { strict: false },
      )
      expect((await storage.download(tenantId, v1!.s3Key)).equals(PDF_BYTES)).toBe(true)
      expect((await storage.download(tenantId, v2!.s3Key)).equals(PDF_V2)).toBe(true)
    })

    it('inherits project and category — a version cannot relocate a document', async () => {
      const v2 = await prisma.document.findUnique({ where: { id: v2Id } })
      expect(v2!.projectId).toBe(projectId)
      expect(v2!.category).toBe('LAND_REGISTRY')
      expect(v2!.title).toBe('נסח טאבו לגרסאות')
    })

    it('refuses a client-supplied projectId or category on a version → 400', async () => {
      for (const field of [['projectId', bProjectId], ['category', 'CONTRACT']] as const) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/documents/${rootId}/versions`)
          .set(asAdmin())
          .field(field[0], field[1])
          .attach('file', PDF_V3, { filename: 'x.pdf', contentType: 'application/pdf' })
        expect({ field: field[0], status: res.status }).toEqual({ field: field[0], status: 400 })
      }
    })

    it('records who uploaded each version and when', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${rootId}/versions`)
        .set(asAdmin())
      expect(res.status).toBe(200)
      expect(res.body.count).toBe(2)
      expect(res.body.latestVersion).toBe(2)
      // Newest first.
      expect(res.body.versions.map((v: any) => v.version)).toEqual([2, 1])
      for (const v of res.body.versions) {
        expect(v.createdBy.id).toBe(userId)
        expect(typeof v.createdAt).toBe('string')
      }
    })

    it('audits the version upload without leaking the storage key', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { tenantId, entity: 'Document', entityId: v2Id },
      })
      expect(logs.length).toBeGreaterThan(0)
      const blob = JSON.stringify(logs)
      expect(blob).toContain('"version":2')
      const v2 = await prisma.document.findUnique({ where: { id: v2Id } })
      expect(blob).not.toContain(v2!.s3Key)
    })

    it('the version history is reachable from ANY version id, not just the root', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${v2Id}/versions`)
        .set(asAdmin())
      expect(res.status).toBe(200)
      expect(res.body.documentId).toBe(rootId)
      expect(res.body.count).toBe(2)
    })

    it('an EARLIER version stays downloadable through the ordinary route', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${rootId}/download`)
        .set(asAdmin())
      expect(res.status).toBe(200)
      expect(typeof res.body.url).toBe('string')
    })

    it('no version response ever carries a storage key', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${rootId}/versions`)
        .set(asAdmin())
      const blob = JSON.stringify(res.body)
      expect(blob).not.toContain('s3Key')
      expect(blob).not.toContain('urban-renewal')
    })

    it('GET /documents lists the chain ONCE, showing the current version', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents?projectId=${projectId}`)
        .set(asAdmin())
      expect(res.status).toBe(200)
      const mine = res.body.filter((d: any) => d.title === 'נסח טאבו לגרסאות')
      expect(mine).toHaveLength(1)
      expect(mine[0].id).toBe(v2Id)
      expect(mine[0].version).toBe(2)
    })

    it('?includeVersions=true reveals the superseded rows', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents?projectId=${projectId}&includeVersions=true`)
        .set(asAdmin())
      const mine = res.body.filter((d: any) => d.title === 'נסח טאבו לגרסאות')
      expect(mine).toHaveLength(2)
    })

    it('a version upload is subject to the SAME signature validation', async () => {
      const exe = Buffer.concat([Buffer.from('MZ', 'ascii'), Buffer.alloc(64, 0)])
      const res = await uploadVersion(rootId, exe, 'v3.pdf')
      expect(res.status).toBe(400)
    })

    it("returns 404 for another tenant's document — never 403", async () => {
      const foreign = await prisma.document.create({
        data: {
          tenantId: tenantBId, createdById: userId, projectId: bProjectId,
          category: 'OTHER', title: 'tenant B doc', fileName: 'b.pdf',
          fileSize: 10, mimeType: 'application/pdf', s3Key: '', s3Bucket: '',
        },
      })
      const get = await request(app.getHttpServer())
        .get(`/api/v1/documents/${foreign.id}/versions`).set(asAdmin())
      expect(get.status).toBe(404)
      const post = await uploadVersion(foreign.id, PDF_V3)
      expect(post.status).toBe(404)
      await prisma.document.delete({ where: { id: foreign.id } })
    })

    it('a read-only observer role cannot add a version → 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/documents/${rootId}/versions`)
        .set({ Authorization: `Bearer ${tokenFor('MUNICIPALITY_USER')}` })
        .attach('file', PDF_V3, { filename: 'v3.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(403)
    })

    it('an observer CAN read the version history (403 is about writing)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${rootId}/versions`)
        .set({ Authorization: `Bearer ${tokenFor('MUNICIPALITY_USER')}` })
      expect(res.status).toBe(200)
    })

    it('refuses to DELETE a superseded version — history is preserved', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/documents/${rootId}`)
        .set(asAdmin())
      expect(res.status).toBe(400)
      expect(String(res.body.message)).toContain('היסטוריית הגרסאות')
      // Still there.
      expect(await prisma.document.findUnique({ where: { id: rootId } })).toBeTruthy()
    })

    it('deleting the CURRENT version rolls back and promotes the previous one', async () => {
      const v1Before = await prisma.document.findUnique({ where: { id: rootId } })
      const v2Row = await prisma.document.findUnique({ where: { id: v2Id } })

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/documents/${v2Id}`)
        .set(asAdmin())
      expect(res.status).toBe(200)
      expect(res.body.promotedToLatest).toBe(rootId)

      expect(await prisma.document.findUnique({ where: { id: v2Id } })).toBeNull()
      const v1After = await prisma.document.findUnique({ where: { id: rootId } })
      expect(v1After!.isLatest).toBe(true)

      // Version 1's own object was NOT touched by the rollback.
      const storage = app.get(
         
        require('../src/storage/storage.service').StorageService,
        { strict: false },
      )
      expect((await storage.download(tenantId, v1Before!.s3Key)).equals(PDF_BYTES)).toBe(true)
      // The deleted version's object is gone.
      await expect(storage.download(tenantId, v2Row!.s3Key)).rejects.toThrow()
    })

    it('a single-version document still deletes outright', async () => {
      const up = await postUpload(asAdmin())
        .field('title', 'one version only')
        .field('category', 'OTHER')
        .field('projectId', projectId)
        .attach('file', PDF_BYTES, { filename: 'solo.pdf', contentType: 'application/pdf' })
      expect(up.status).toBe(201)
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/documents/${up.body.id}`)
        .set(asAdmin())
      expect(res.status).toBe(200)
      expect(await prisma.document.findUnique({ where: { id: up.body.id } })).toBeNull()
    })
  })

  describe('RBAC', () => {
    it('no token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents/upload')
        .field('title', 'x').field('category', 'OTHER').field('projectId', projectId)
        .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(401)
    })

    it('valid token, RESIDENT role → 403 (not 401, not 201)', async () => {
      const res = await postUpload({ Authorization: `Bearer ${tokenFor('RESIDENT')}` })
        .field('title', 'x').field('category', 'OTHER').field('projectId', projectId)
        .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(403)
    })

    it('valid token, MUNICIPALITY_USER (read-only observer) → 403', async () => {
      const res = await postUpload({ Authorization: `Bearer ${tokenFor('MUNICIPALITY_USER')}` })
        .field('title', 'x').field('category', 'OTHER').field('projectId', projectId)
        .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(403)
    })

    it('MUNICIPALITY_USER can still READ the library (403 is write-only)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set({ Authorization: `Bearer ${tokenFor('MUNICIPALITY_USER')}` })
      expect(res.status).toBe(200)
    })
  })

  /* ── Tenant isolation ────────────────────────────────────────── */

  describe('tenant isolation', () => {
    it('uploading into another tenant’s project → 404', async () => {
      const res = await postUpload(asAdmin())
        .field('title', 'cross tenant').field('category', 'OTHER').field('projectId', bProjectId)
        .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(404)
    })

    it('no document row was created for the other tenant', async () => {
      const count = await prisma.document.count({ where: { tenantId: tenantBId } })
      expect(count).toBe(0)
    })
  })

  /* ── The hardened metadata-only endpoint ─────────────────────── */

  describe('POST /documents (metadata only)', () => {
    it('creates a record and sets createdById', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(asAdmin())
        .send({
          title: 'E2E metadata record',
          category: 'OTHER',
          projectId,
          fileName: 'pending.pdf',
          fileSize: 0,
          mimeType: 'application/pdf',
        })
      expect(res.status).toBe(201)
      createdDocumentIds.push(res.body.id)
      expect(res.body.createdById).toBe(userId)
      expect(res.body).not.toHaveProperty('s3Key')
    })

    it('rejects mass assignment of s3Key / isPublic / version → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(asAdmin())
        .send({
          title: 'hijack', category: 'OTHER',
          fileName: 'a.pdf', fileSize: 1, mimeType: 'application/pdf',
          s3Key: 'other-tenant/secret.pdf', s3Bucket: 'urban-renewal',
          isPublic: true, version: 99, ocrText: 'x',
        })
      expect(res.status).toBe(400)
    })

    it('rejects a tenantId override → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(asAdmin())
        .send({
          title: 'hijack', category: 'OTHER',
          fileName: 'a.pdf', fileSize: 1, mimeType: 'application/pdf',
          tenantId: tenantBId,
        })
      expect(res.status).toBe(400)
    })

    it('a metadata-only record has no downloadable file → 404', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(asAdmin())
        .send({
          title: 'E2E no-file record', category: 'OTHER',
          fileName: 'none.pdf', fileSize: 0, mimeType: 'application/pdf',
        })
      expect(create.status).toBe(201)
      createdDocumentIds.push(create.body.id)

      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${create.body.id}/download`)
        .set(asAdmin())
      expect(res.status).toBe(404)
    })
  })
})
