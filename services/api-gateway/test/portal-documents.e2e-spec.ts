/**
 * Resident documents — Portal stage 3a.
 *
 * ── THE QUESTION THIS SUITE ANSWERS ─────────────────────────────────────────
 *
 * "Which documents may this resident see?" has exactly one wrong answer that
 * matters: too many. A project's document library holds other residents'
 * identity papers, the developer agreement and the lawyer's drafts, and a
 * resident is entitled to none of it by virtue of living there.
 *
 * So the tests are built around a second resident IN THE SAME PROJECT — not
 * just a second tenant — because project-level leakage is the mistake this
 * endpoint is most likely to make, and a tenant-only test would not catch it.
 *
 * The staff sharing endpoints are covered here too. They exist because
 * `ResidentDocument` had no writer anywhere in the product: the portal reads it
 * as the sharing decision, so without one the page is empty by construction.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const MARKER = `DOCS-${STAMP}`
const SLUG_A = `docs-${STAMP}-a`
const SLUG_B = `docs-${STAMP}-b`

/** Every string tenant B owns contains this, so one assertion sweeps a response. */
const B_SECRET = `BTENANT${STAMP}`

const PORTAL = '/api/v1/portal/documents'

interface Fixture {
  tenantId: string
  projectId: string
  residentId: string
  /** A second resident in the SAME project — the neighbour. */
  neighbourId: string
  managerId: string
}

describe('Resident portal documents (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let A: Fixture
  let B: Fixture
  let residentAToken: string
  let managerAToken: string
  let lawyerAToken: string       // may share — the agreements are theirs
  let developerRepAToken: string // may upload, must NOT share: the counterparty
  let managerBToken: string

  const api = () => request(app.getHttpServer())
  const asResidentA = () => ({ Authorization: `Bearer ${residentAToken}` })
  const asManagerA = () => ({ Authorization: `Bearer ${managerAToken}` })

  const residentToken = (residentId: string, tenantId: string, projectId: string) =>
    jwt.sign(
      { sub: residentId, role: 'RESIDENT', tenantId, projectId, residentId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const staffToken = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  /**
   * A document with a plausible storage key.
   *
   * The key is never uploaded: `getSignedUrl` signs locally and only checks the
   * tenant prefix, so a real object is not needed to prove the entitlement
   * rules — and not needing MinIO keeps this suite about access control.
   */
  const makeDocument = async (
    f: Fixture,
    title: string,
    extra: Record<string, unknown> = {},
  ) => {
    const doc = await prisma.document.create({
      data: {
        tenantId: f.tenantId, projectId: f.projectId,
        category: 'CONTRACT', title,
        fileName: `${title}.pdf`, fileSize: 2048, mimeType: 'application/pdf',
        s3Key: `${f.tenantId}/${MARKER}/${title}.pdf`, s3Bucket: 'test-bucket',
        createdById: f.managerId, isLatest: true,
        ...extra,
      },
      select: { id: true, s3Key: true },
    })
    return doc
  }

  const shareWith = async (documentId: string, residentId: string) =>
    prisma.residentDocument.create({ data: { documentId, residentId } })

  const makeTenant = async (slug: string, label: string, mark: string): Promise<Fixture> => {
    const tenant = await prisma.tenant.create({ data: { name: slug, slug } })
    const manager = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `${MARKER}-pm-${randomUUID().slice(0, 6)}@example.com`.toLowerCase(),
        firstName: `${mark}Manager`, lastName: 'Cohen',
        passwordHash: 'not-a-usable-credential', role: 'PROJECT_MANAGER' as never,
      },
      select: { id: true },
    })
    const project = await prisma.project.create({
      data: {
        tenantId: tenant.id, code: `${MARKER}-${label}`, name: `${mark} Project`,
        city: 'תל אביב', stage: 'SIGNATURES', projectManagerId: manager.id,
      },
    })
    const complex = await prisma.complex.create({
      data: { projectId: project.id, name: `${mark} complex` },
    })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: `${mark} street 1` },
    })

    const makeResident = async (flatNo: string, firstName: string) => {
      const apartment = await prisma.apartment.create({
        data: { buildingId: building.id, apartmentNumber: flatNo },
      })
      return (await prisma.resident.create({
        data: {
          tenantId: tenant.id, apartmentId: apartment.id,
          firstName, lastName: 'Levi', phone: `05099${flatNo.padStart(5, '0')}`, isActive: true,
        },
        select: { id: true },
      })).id
    }

    return {
      tenantId: tenant.id,
      projectId: project.id,
      residentId: await makeResident('1', `${mark}First`),
      neighbourId: await makeResident('2', `${mark}Neighbour`),
      managerId: manager.id,
    }
  }

  const purge = async () => {
    const stale = await prisma.tenant.findMany({
      where: { slug: { startsWith: 'docs-' } }, select: { id: true },
    })
    for (const t of stale) {
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.signatureRequest.deleteMany({ where: { tenantId: t.id } })
      await prisma.residentDocument.deleteMany({ where: { document: { tenantId: t.id } } })
      await prisma.document.deleteMany({ where: { tenantId: t.id } })
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
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService)
    jwt = app.get(JwtService, { strict: false })

    await purge()
    A = await makeTenant(SLUG_A, 'A', 'Alpha')
    B = await makeTenant(SLUG_B, 'B', B_SECRET)

    residentAToken = residentToken(A.residentId, A.tenantId, A.projectId)
    managerAToken = staffToken(A.managerId, A.tenantId, 'PROJECT_MANAGER')
    lawyerAToken = staffToken(A.managerId, A.tenantId, 'LAWYER')
    developerRepAToken = staffToken(A.managerId, A.tenantId, 'DEVELOPER_REP')
    managerBToken = staffToken(B.managerId, B.tenantId, 'PROJECT_MANAGER')
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  /** Each test starts from a clean sharing state so ordering never matters. */
  beforeEach(async () => {
    await prisma.signatureRequest.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
    await prisma.residentDocument.deleteMany({
      where: { document: { tenantId: { in: [A.tenantId, B.tenantId] } } },
    })
    await prisma.document.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  1. What a resident sees
  // ══════════════════════════════════════════════════════════════════════════

  describe('the list', () => {
    it('is empty, and says so honestly, when nothing has been shared', async () => {
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.categories).toEqual([])
      expect(res.body.counts).toEqual({ total: 0, awaitingSignature: 0, signed: 0 })
    })

    it('includes a document staff attached to them', async () => {
      const doc = await makeDocument(A, 'AlphaAttached')
      await shareWith(doc.id, A.residentId)

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.counts.total).toBe(1)
      const found = res.body.categories[0].documents[0]
      expect(found.title).toBe('AlphaAttached')
      expect(found.sources).toEqual(['SHARED'])
      expect(found.signature).toBeNull()
    })

    it('includes a document they were asked to sign, with its state', async () => {
      const doc = await makeDocument(A, 'AlphaToSign')
      await prisma.signatureRequest.create({
        data: {
          tenantId: A.tenantId, residentId: A.residentId, documentId: doc.id,
          status: 'SENT', sentAt: new Date(),
        },
      })

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      const found = res.body.categories[0].documents[0]
      expect(found.sources).toEqual(['SIGNATURE'])
      expect(found.signature.required).toBe(true)
      expect(found.signature.signed).toBe(false)
      expect(res.body.counts.awaitingSignature).toBe(1)
    })

    it('a signed request is no longer "awaiting", and carries its date', async () => {
      const doc = await makeDocument(A, 'AlphaSigned')
      await prisma.signatureRequest.create({
        data: {
          tenantId: A.tenantId, residentId: A.residentId, documentId: doc.id,
          status: 'SIGNED', signedAt: new Date('2026-04-01T09:00:00Z'),
        },
      })

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      const found = res.body.categories[0].documents[0]
      expect(found.signature.signed).toBe(true)
      expect(found.signature.required).toBe(false)
      expect(new Date(found.signature.signedAt).toISOString()).toBe('2026-04-01T09:00:00.000Z')
      expect(res.body.counts).toMatchObject({ awaitingSignature: 0, signed: 1 })
    })

    it('a document that arrived BOTH ways is one row carrying both reasons', async () => {
      const doc = await makeDocument(A, 'AlphaBoth')
      await shareWith(doc.id, A.residentId)
      await prisma.signatureRequest.create({
        data: { tenantId: A.tenantId, residentId: A.residentId, documentId: doc.id, status: 'SENT' },
      })

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.counts.total).toBe(1)
      const found = res.body.categories[0].documents[0]
      expect(found.sources.sort()).toEqual(['SHARED', 'SIGNATURE'])
      expect(found.signature.required).toBe(true)
    })

    it('groups by category, in a fixed order, with Hebrew labels', async () => {
      const contract = await makeDocument(A, 'AlphaContract', { category: 'CONTRACT' })
      const id = await makeDocument(A, 'AlphaId', { category: 'ID_DOCUMENT' })
      const minutes = await makeDocument(A, 'AlphaMinutes', { category: 'MEETING_MINUTES' })
      for (const d of [minutes, id, contract]) await shareWith(d.id, A.residentId)

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.categories.map((c: { category: string }) => c.category))
        .toEqual(['CONTRACT', 'ID_DOCUMENT', 'MEETING_MINUTES'])
      expect(res.body.categories[0].label).toBe('הסכמים')
    })

    it('never returns the storage key', async () => {
      const doc = await makeDocument(A, 'AlphaKeyed')
      await shareWith(doc.id, A.residentId)

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      // The key is a capability: it is all `getSignedUrl` needs, so it must not
      // leave the server even to the person entitled to the file.
      expect(JSON.stringify(res.body)).not.toContain(doc.s3Key)
      expect(JSON.stringify(res.body)).not.toContain('s3Key')
      expect(JSON.stringify(res.body)).not.toContain('s3Bucket')
    })

    it('excludes an archived document and a superseded version', async () => {
      const archived = await makeDocument(A, 'AlphaArchived', { status: 'ARCHIVED' })
      const old = await makeDocument(A, 'AlphaOldVersion', { isLatest: false })
      for (const d of [archived, old]) await shareWith(d.id, A.residentId)

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.counts.total).toBe(0)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  2. Isolation — the neighbour matters more than the other tenant
  // ══════════════════════════════════════════════════════════════════════════

  describe('isolation', () => {
    it("does NOT include a neighbour's document from the same project", async () => {
      // The likeliest mistake this endpoint could make: scoping by project
      // instead of by resident. Same tenant, same project, same building.
      const theirs = await makeDocument(A, 'AlphaNeighbourPrivatePapers')
      await shareWith(theirs.id, A.neighbourId)

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.counts.total).toBe(0)
      expect(JSON.stringify(res.body)).not.toContain('NeighbourPrivate')
    })

    it('does NOT include a project document nobody shared', async () => {
      // Living in the project is not a sharing decision.
      await makeDocument(A, 'AlphaDeveloperAgreement')
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.counts.total).toBe(0)
    })

    it('does NOT include another tenant\'s document, even when attached to this resident', async () => {
      const foreign = await makeDocument(B, `${B_SECRET}CrossTenant`)
      await shareWith(foreign.id, A.residentId)

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(JSON.stringify(res.body)).not.toContain(B_SECRET)
      expect(res.body.counts.total).toBe(0)
    })

    it('does NOT honour a signature request carrying another tenant id', async () => {
      const foreign = await makeDocument(B, `${B_SECRET}CrossTenantSign`)
      await prisma.signatureRequest.create({
        data: { tenantId: B.tenantId, residentId: A.residentId, documentId: foreign.id, status: 'SENT' },
      })

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(JSON.stringify(res.body)).not.toContain(B_SECRET)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  3. Download
  // ══════════════════════════════════════════════════════════════════════════

  describe('download', () => {
    it('mints a short-lived URL for their own document', async () => {
      const doc = await makeDocument(A, 'AlphaDownloadable')
      await shareWith(doc.id, A.residentId)

      const res = await api().get(`${PORTAL}/${doc.id}/download`).set(asResidentA()).expect(200)
      expect(res.body.url).toContain('http')
      expect(res.body.expiresIn).toBe(900)
      expect(res.body.fileName).toBe('AlphaDownloadable.pdf')
    })

    it("404s on a NEIGHBOUR's document id — not 403", async () => {
      /*
       * The IDOR. The id is real and the caller knows it; what they lack is
       * entitlement. 404 rather than 403 because 403 would confirm the id
       * exists, which is itself a fact they should not be able to establish.
       */
      const theirs = await makeDocument(A, 'AlphaNeighbourOnly')
      await shareWith(theirs.id, A.neighbourId)

      const res = await api().get(`${PORTAL}/${theirs.id}/download`).set(asResidentA())
      expect(res.status).toBe(404)
      expect(res.body.code).toBe('DOCUMENT_NOT_FOUND')
    })

    it("404s on another tenant's document id", async () => {
      const foreign = await makeDocument(B, `${B_SECRET}Secret`)
      const res = await api().get(`${PORTAL}/${foreign.id}/download`).set(asResidentA())
      expect(res.status).toBe(404)
    })

    it('404s on a document that exists but was never shared', async () => {
      const unshared = await makeDocument(A, 'AlphaUnshared')
      const res = await api().get(`${PORTAL}/${unshared.id}/download`).set(asResidentA())
      expect(res.status).toBe(404)
    })

    it('404s with a distinct code when the record has no file behind it', async () => {
      // A metadata-only record. Minting a URL to nothing would produce a broken
      // download rather than an honest error.
      const empty = await makeDocument(A, 'AlphaMetadataOnly', { s3Key: '' })
      await shareWith(empty.id, A.residentId)

      const res = await api().get(`${PORTAL}/${empty.id}/download`).set(asResidentA())
      expect(res.status).toBe(404)
      expect(res.body.code).toBe('DOCUMENT_HAS_NO_FILE')
    })

    it('refuses a storage key that points outside the tenant, even after entitlement passes', async () => {
      /*
       * Defence in depth, and the only test here where the first check passes.
       * The row is tenant A's and is properly shared, but its key names tenant
       * B's prefix — a state only bad data or a bug produces. `StorageService`
       * refuses it independently of anything this module decided.
       */
      const crooked = await makeDocument(A, 'AlphaCrookedKey', {
        s3Key: `${B.tenantId}/${MARKER}/stolen.pdf`,
      })
      await shareWith(crooked.id, A.residentId)

      const res = await api().get(`${PORTAL}/${crooked.id}/download`).set(asResidentA())
      expect(res.status).toBe(403)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  4. The staff side that makes any of this possible
  // ══════════════════════════════════════════════════════════════════════════

  describe('sharing, from the CRM', () => {
    const shareApi = (documentId: string) => `/api/v1/documents/${documentId}/residents`

    it('shares a document, and the resident can then see it', async () => {
      const doc = await makeDocument(A, 'AlphaSharedByStaff')

      const before = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(before.body.counts.total).toBe(0)

      const shared = await api().post(shareApi(doc.id)).set(asManagerA())
        .send({ residentId: A.residentId })
      expect(shared.status).toBe(201)
      expect(shared.body.alreadyShared).toBe(false)

      const after = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(after.body.counts.total).toBe(1)
    })

    it('is idempotent, and keeps the date the grant actually began', async () => {
      const doc = await makeDocument(A, 'AlphaSharedTwice')
      const first = await api().post(shareApi(doc.id)).set(asManagerA())
        .send({ residentId: A.residentId }).expect(201)

      const second = await api().post(shareApi(doc.id)).set(asManagerA())
        .send({ residentId: A.residentId })
      expect(second.status).toBe(201)
      expect(second.body.alreadyShared).toBe(true)
      expect(second.body.sharedAt).toBe(first.body.sharedAt)

      const list = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(list.body.counts.total).toBe(1)   // one grant, not two rows
    })

    it('records the grant in the audit log', async () => {
      const doc = await makeDocument(A, 'AlphaAudited')
      await api().post(shareApi(doc.id)).set(asManagerA())
        .send({ residentId: A.residentId }).expect(201)

      const entry = await prisma.auditLog.findFirst({
        where: { tenantId: A.tenantId, entity: 'ResidentDocument', entityId: doc.id, action: 'CREATE' },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true, userId: true },
      })
      // Handing a file to somebody outside the organisation is an access grant,
      // and an access grant nobody can reconstruct afterwards is not governed.
      expect(entry).not.toBeNull()
      expect((entry!.metadata as Record<string, unknown>).grant).toBe('DOCUMENT_SHARED_WITH_RESIDENT')
      expect(entry!.userId).toBe(A.managerId)
    })

    it('REFUSES to share another tenant\'s document', async () => {
      const foreign = await makeDocument(B, `${B_SECRET}NotYours`)
      const res = await api().post(shareApi(foreign.id)).set(asManagerA())
        .send({ residentId: A.residentId })
      expect(res.status).toBe(404)
    })

    it('REFUSES to share with a resident in another tenant', async () => {
      const doc = await makeDocument(A, 'AlphaMine')
      const res = await api().post(shareApi(doc.id)).set(asManagerA())
        .send({ residentId: B.residentId })
      expect(res.status).toBe(404)

      expect(await prisma.residentDocument.count({ where: { documentId: doc.id } })).toBe(0)
    })

    it('REFUSES to share with an archived resident', async () => {
      const doc = await makeDocument(A, 'AlphaForArchived')
      await prisma.resident.update({ where: { id: A.neighbourId }, data: { isActive: false } })

      const res = await api().post(shareApi(doc.id)).set(asManagerA())
        .send({ residentId: A.neighbourId })
      expect(res.status).toBe(400)

      await prisma.resident.update({ where: { id: A.neighbourId }, data: { isActive: true } })
    })

    it("REFUSES the DEVELOPER'S representative — the counterparty", async () => {
      /*
       * DEVELOPER_REP is in `DOCUMENT_WRITE_ROLES`: they may upload plans and
       * drafts into the project. Sharing is a different act. The developer is
       * the party these residents are negotiating against, and a private line
       * from them into the promoter's portal is not a permission that should
       * come bundled with "can upload a file".
       */
      const doc = await makeDocument(A, 'AlphaRbacDeveloper')
      const res = await api().post(shareApi(doc.id))
        .set({ Authorization: `Bearer ${developerRepAToken}` })
        .send({ residentId: A.residentId })
      expect(res.status).toBe(403)

      expect(await prisma.residentDocument.count({ where: { documentId: doc.id } })).toBe(0)
    })

    it('REFUSES the developer representative to REVOKE a share either', async () => {
      // If you may not grant, you may not decide to withdraw.
      const doc = await makeDocument(A, 'AlphaRbacRevoke')
      await api().post(shareApi(doc.id)).set(asManagerA())
        .send({ residentId: A.residentId }).expect(201)

      const res = await api().delete(`${shareApi(doc.id)}/${A.residentId}`)
        .set({ Authorization: `Bearer ${developerRepAToken}` })
      expect(res.status).toBe(403)

      const still = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(still.body.counts.total).toBe(1)
    })

    it('ALLOWS the lawyer — the agreements are theirs to send', async () => {
      const doc = await makeDocument(A, 'AlphaRbacLawyer', { category: 'POWER_OF_ATTORNEY' })
      const res = await api().post(shareApi(doc.id)).set({ Authorization: `Bearer ${lawyerAToken}` })
        .send({ residentId: A.residentId })
      expect(res.status).toBe(201)
    })

    it('REFUSES a manager from another tenant', async () => {
      const doc = await makeDocument(A, 'AlphaOther')
      const res = await api().post(shareApi(doc.id)).set({ Authorization: `Bearer ${managerBToken}` })
        .send({ residentId: A.residentId })
      expect(res.status).toBe(404)
    })

    it('unsharing removes the resident\'s access but keeps the document', async () => {
      const doc = await makeDocument(A, 'AlphaRevocable')
      await api().post(shareApi(doc.id)).set(asManagerA())
        .send({ residentId: A.residentId }).expect(201)

      await api().delete(`${shareApi(doc.id)}/${A.residentId}`).set(asManagerA()).expect(204)

      const list = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(list.body.counts.total).toBe(0)
      // Revoking one person's access is not a reason to destroy the file.
      expect(await prisma.document.count({ where: { id: doc.id } })).toBe(1)

      // And the download closes with it.
      const download = await api().get(`${PORTAL}/${doc.id}/download`).set(asResidentA())
      expect(download.status).toBe(404)
    })

    it('unsharing something that was never shared is a 404', async () => {
      const doc = await makeDocument(A, 'AlphaNeverShared')
      const res = await api().delete(`${shareApi(doc.id)}/${A.residentId}`).set(asManagerA())
      expect(res.status).toBe(404)
    })

    it('lists who a document is shared with', async () => {
      const doc = await makeDocument(A, 'AlphaAudience')
      await api().post(shareApi(doc.id)).set(asManagerA())
        .send({ residentId: A.residentId }).expect(201)

      const res = await api().get(shareApi(doc.id)).set(asManagerA()).expect(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].residentId).toBe(A.residentId)
      expect(res.body[0].apartmentNumber).toBe('1')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  5. Access
  // ══════════════════════════════════════════════════════════════════════════

  describe('access', () => {
    it('rejects an anonymous caller', async () => {
      await api().get(PORTAL).expect(401)
    })

    it('rejects a staff token — the portal is not a staff route', async () => {
      const res = await api().get(PORTAL).set(asManagerA())
      expect(res.status).toBe(403)
    })

    it('rejects a resident token with no project scope', async () => {
      const scopeless = jwt.sign(
        { sub: A.residentId, role: 'RESIDENT', tenantId: A.tenantId, sessionId: randomUUID() },
        { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
      )
      const res = await api().get(PORTAL).set({ Authorization: `Bearer ${scopeless}` })
      expect(res.status).toBe(401)
    })

    it('a resident of tenant B sees tenant B, never tenant A', async () => {
      const docA = await makeDocument(A, 'AlphaOnly')
      await shareWith(docA.id, A.residentId)
      const docB = await makeDocument(B, `${B_SECRET}Own`)
      await shareWith(docB.id, B.residentId)

      const tokenB = residentToken(B.residentId, B.tenantId, B.projectId)
      const res = await api().get(PORTAL).set({ Authorization: `Bearer ${tokenB}` }).expect(200)
      expect(res.body.counts.total).toBe(1)
      expect(JSON.stringify(res.body)).toContain(B_SECRET)
      expect(JSON.stringify(res.body)).not.toContain('AlphaOnly')
    })
  })
})
