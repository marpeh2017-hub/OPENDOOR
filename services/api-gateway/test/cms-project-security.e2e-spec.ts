/**
 * The project editor's security boundary, driven at the HTTP surface.
 *
 * Every refusal here is tested with a token the UI would never have rendered
 * the button for, because hiding a control is not enforcement. The suite
 * covers the thirteen properties Pass 4C names:
 *
 *   cross-tenant read / write / verification / publication
 *   unauthorised editor / verifier / publisher
 *   draft vs public · internal vs public · feasibility vs public
 *   verifier redaction · source-audit redaction · revision immutability
 *
 * Tenant B is REAL and populated, following `tenant-isolation.e2e-spec.ts`:
 * a 404 for an id that exists in no tenant proves nothing about isolation.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import type { ProjectDocument } from '../src/cms/project-document'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const A_SLUG = 'e2e-cmsproj-a'
const B_SLUG = 'e2e-cmsproj-b'
const BASE = '/api/v1/cms/content'

const SECRETS = {
  economics: 825_600_000,
  output: 337.18,
  block: 'גוש 30185',
  candidate: 'טשרניחובסקי 38',
  internalNote: 'הערות פנימיות בלבד',
}

function doc(userId: string): ProjectDocument {
  return {
    public: {
      name: { he: 'פרויקט בדיקה' },
      location: { city: { he: 'ירושלים' }, street: { he: 'רחוב סודי 1' } },
      summary: { he: 'תקציר ציבורי' },
      currentStage: {
        value: 'DEVELOPER_TENDER', verifiedValue: 'DEVELOPER_TENDER',
        status: 'SELF_VERIFIED', verifiedAt: '2026-09-01',
        verifiedByUserId: userId, editedByUserId: userId, sourceId: 'src-user',
      },
      facts: {
        address: { value: 'רחוב סודי 1', status: 'UNVERIFIED' },
        unitCount: { value: 120, status: 'UNVERIFIED', sourceId: 'src-workbook' },
      },
    },
    internal: {
      notes: SECRETS.internalNote,
      blocks: [{ block: SECRETS.block, parcel: 'חלקה 126' }],
      candidateAddresses: [{ address: SECRETS.candidate, inWorkbook: true }],
      dataQualityFlags: [
        { id: 'dq-1', label: 'בעיה חוסמת', detail: 'פרטים', severity: 'BLOCKING',
          blocks: ['public.facts.unitCount'] },
      ],
    },
    feasibility: {
      outputs: { totalScenarioUnits: { value: SECRETS.output } },
      economics: { sales: { value: SECRETS.economics } },
    },
    milestones: [],
    media: [],
    seo: { he: { title: 'כותרת' } },
    sources: [
      { id: 'src-workbook', type: 'FEASIBILITY_WORKBOOK', label: 'קובץ', quality: 'LOW', reviewState: 'IN_REVIEW' },
      { id: 'src-user', type: 'USER_VERIFIED', label: 'לקוח', quality: 'HIGH', reviewState: 'ACCEPTED' },
    ],
  }
}

describe('CMS project security (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let tenantA: string, tenantB: string
  let adminAId: string, editorAId: string, verifierAId: string, viewerAId: string, adminBId: string
  let adminA: string, editorA: string, verifierA: string, viewerA: string, outsiderA: string, adminB: string
  let projectA: string, projectB: string

  const api = () => request(app.getHttpServer())
  const as = (t: string) => ({ Authorization: `Bearer ${t}` })
  const token = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${userId}@e2e.local`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const purge = async () => {
    for (const slug of [A_SLUG, B_SLUG]) {
      const t = await prisma.tenant.findUnique({ where: { slug } })
      if (!t) continue
      await prisma.cmsContent.updateMany({
        where: { tenantId: t.id }, data: { currentRevisionId: null, livePublicationId: null },
      })
      await prisma.cmsPublication.deleteMany({ where: { tenantId: t.id } })
      await prisma.cmsRevision.deleteMany({ where: { tenantId: t.id } })
      await prisma.cmsVerificationAudit.deleteMany({ where: { tenantId: t.id } })
      await prisma.cmsVerification.deleteMany({ where: { tenantId: t.id } })
      await prisma.cmsMediaReference.deleteMany({ where: { tenantId: t.id } })
      await prisma.cmsContent.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } })
    }
  }

  const seedProject = async (tenantId: string, userId: string) => {
    const c = await prisma.cmsContent.create({
      data: {
        tenantId, kind: 'PROJECT', slug: 'secure-project', state: 'DRAFT', exposure: 'PUBLIC',
        draft: doc(userId) as never, createdById: userId, updatedById: userId,
      },
    })
    const r = await prisma.cmsRevision.create({
      data: {
        tenantId, contentId: c.id, sequence: 1, reason: 'SAVE',
        snapshot: doc(userId) as never, stateAtRevision: 'DRAFT', authorId: userId,
      },
    })
    await prisma.cmsContent.update({ where: { id: c.id }, data: { currentRevisionId: r.id } })
    return c.id
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = mod.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })
    await purge()

    tenantA = (await prisma.tenant.create({ data: { name: 'CMSProj A', slug: A_SLUG } })).id
    tenantB = (await prisma.tenant.create({ data: { name: 'CMSProj B', slug: B_SLUG } })).id

    const mk = async (tenantId: string, role: string, email: string) =>
      (await prisma.user.create({
        data: { tenantId, email, firstName: 'E2E', lastName: role, role: role as never },
      })).id

    adminAId = await mk(tenantA, 'COMPANY_ADMIN', 'admin@a.e2e.local')
    // RRM: EDIT but not VERIFY and not PUBLISH.
    editorAId = await mk(tenantA, 'RESIDENT_RELATIONS_MANAGER', 'editor@a.e2e.local')
    // PROJECT_MANAGER: EDIT and VERIFY, but not PUBLISH.
    verifierAId = await mk(tenantA, 'PROJECT_MANAGER', 'verifier@a.e2e.local')
    // CEO: VIEW only.
    viewerAId = await mk(tenantA, 'CEO', 'viewer@a.e2e.local')
    const outsiderAId = await mk(tenantA, 'FIELD_AGENT', 'outsider@a.e2e.local')
    adminBId = await mk(tenantB, 'COMPANY_ADMIN', 'admin@b.e2e.local')

    adminA = token(adminAId, tenantA, 'COMPANY_ADMIN')
    editorA = token(editorAId, tenantA, 'RESIDENT_RELATIONS_MANAGER')
    verifierA = token(verifierAId, tenantA, 'PROJECT_MANAGER')
    viewerA = token(viewerAId, tenantA, 'CEO')
    outsiderA = token(outsiderAId, tenantA, 'FIELD_AGENT')
    adminB = token(adminBId, tenantB, 'COMPANY_ADMIN')

    projectA = await seedProject(tenantA, adminAId)
    projectB = await seedProject(tenantB, adminBId)
  })

  afterAll(async () => { await purge(); await app.close() })

  // ══════════════════════════════════════════════════════════════════════
  //  CROSS-TENANT
  // ══════════════════════════════════════════════════════════════════════

  describe('cross-tenant', () => {
    it('both tenants own a project at the same slug', async () => {
      expect(projectA).not.toBe(projectB)
    })

    it('reading another tenant project answers 404, never 403', async () => {
      const res = await api().get(`${BASE}/${projectB}`).set(as(adminA))
      expect(res.status).toBe(404)
    })

    it('the list never leaks the other tenant project', async () => {
      const res = await api().get(`${BASE}?kind=PROJECT`).set(as(adminA)).expect(200)
      expect(res.body.map((r: { id: string }) => r.id)).not.toContain(projectB)
    })

    it('writing to another tenant project answers 404 and changes nothing', async () => {
      const before = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectB } })
      await api().patch(`${BASE}/${projectB}`).set(as(adminA))
        .send({ draft: { public: { name: { he: 'נחטף' }, location: { city: { he: 'x' } } } } })
        .expect(404)
      const after = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectB } })
      expect(after.draft).toEqual(before.draft)
    })

    it('setting a fact on another tenant project answers 404', async () => {
      await api().patch(`${BASE}/${projectB}/facts/public.facts.unitCount`).set(as(adminA))
        .send({ value: 999 }).expect(404)
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectB } })
      expect((row.draft as unknown as ProjectDocument).public.facts?.['unitCount']?.value).toBe(120)
    })

    it('verifying a fact on another tenant project answers 404', async () => {
      await api().post(`${BASE}/${projectB}/facts/public.currentStage/verify`).set(as(adminA))
        .send({}).expect(404)
    })

    it('reading another tenant verification history answers 404', async () => {
      await api().get(`${BASE}/${projectB}/facts/history`).set(as(adminA)).expect(404)
    })

    it('publishing another tenant project answers 404 and publishes nothing', async () => {
      await api().post(`${BASE}/${projectB}/publish`).set(as(adminA)).expect(404)
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectB } })
      expect(row.state).toBe('DRAFT')
      expect(row.livePublicationId).toBeNull()
    })

    it('tenant B can do all of it on its OWN project, so the 404s are isolation and not breakage', async () => {
      await api().get(`${BASE}/${projectB}`).set(as(adminB)).expect(200)
      await api().patch(`${BASE}/${projectB}/facts/public.facts.address`).set(as(adminB))
        .send({ value: 'רחוב חדש 2' }).expect(200)
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  PERMISSIONS
  // ══════════════════════════════════════════════════════════════════════

  describe('permissions', () => {
    it('a role outside the CMS cannot read a project at all', async () => {
      await api().get(`${BASE}/${projectA}`).set(as(outsiderA)).expect(403)
    })

    it('a viewer reads but cannot edit a fact', async () => {
      await api().get(`${BASE}/${projectA}`).set(as(viewerA)).expect(200)
      await api().patch(`${BASE}/${projectA}/facts/public.facts.address`).set(as(viewerA))
        .send({ value: 'x' }).expect(403)
    })

    it('an editor edits a fact but cannot VERIFY it', async () => {
      await api().patch(`${BASE}/${projectA}/facts/public.facts.address`).set(as(editorA))
        .send({ value: 'רחוב סודי 1' }).expect(200)
      await api().post(`${BASE}/${projectA}/facts/public.facts.address/verify`).set(as(editorA))
        .send({}).expect(403)
    })

    it('a verifier verifies but cannot PUBLISH', async () => {
      await api().post(`${BASE}/${projectA}/facts/public.facts.address/verify`)
        .set(as(verifierA)).send({}).expect(200)
      await api().post(`${BASE}/${projectA}/publish`).set(as(verifierA)).expect(403)
    })

    it('a verifier cannot restore either, because restoring a live item republishes it', async () => {
      const rev = await prisma.cmsRevision.findFirstOrThrow({ where: { contentId: projectA } })
      await api().post(`${BASE}/${projectA}/revisions/${rev.id}/restore`)
        .set(as(verifierA)).expect(403)
    })

    it('signing your own edit records SELF_VERIFIED, not VERIFIED', async () => {
      // The verifier just edited nothing — the editor did — so this one is
      // independent and must read VERIFIED.
      const row = await prisma.cmsVerification.findFirstOrThrow({
        where: { contentId: projectA, field: 'public.facts.address' },
      })
      expect(row.status).toBe('VERIFIED')

      // Now the same person edits AND verifies.
      await api().patch(`${BASE}/${projectA}/facts/public.facts.address`)
        .set(as(verifierA)).send({ value: 'רחוב סודי 3' }).expect(200)
      await api().post(`${BASE}/${projectA}/facts/public.facts.address/verify`)
        .set(as(verifierA)).send({}).expect(200)
      const after = await prisma.cmsVerification.findFirstOrThrow({
        where: { contentId: projectA, field: 'public.facts.address' },
      })
      expect(after.status).toBe('SELF_VERIFIED')
    })

    it('a blocking data-quality flag refuses verification with 409', async () => {
      const res = await api().post(`${BASE}/${projectA}/facts/public.facts.unitCount/verify`)
        .set(as(verifierA)).send({})
      expect(res.status).toBe(409)
      const row = await prisma.cmsVerification.findFirst({
        where: { contentId: projectA, field: 'public.facts.unitCount' },
      })
      expect(row?.status ?? 'UNVERIFIED').toBe('UNVERIFIED')
    })

    it('a DTO cannot smuggle a verification status past the server', async () => {
      await api().patch(`${BASE}/${projectA}/facts/public.facts.unitCount`).set(as(editorA))
        .send({ value: 130, status: 'VERIFIED', verifiedByUserId: editorAId }).expect(200)
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectA } })
      const fact = (row.draft as unknown as ProjectDocument).public.facts?.['unitCount']
      expect(fact?.status).toBe('UNVERIFIED')
      expect(fact?.verifiedByUserId).toBeUndefined()
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  INVALIDATION AND IMMUTABILITY
  // ══════════════════════════════════════════════════════════════════════

  describe('editing a verified value invalidates it, and history survives', () => {
    it('invalidates on edit and records INVALIDATED in the audit', async () => {
      await api().post(`${BASE}/${projectA}/facts/public.currentStage/verify`)
        .set(as(verifierA)).send({}).expect(200)
      const before = await prisma.cmsVerification.findFirstOrThrow({
        where: { contentId: projectA, field: 'public.currentStage' },
      })
      expect(['VERIFIED', 'SELF_VERIFIED']).toContain(before.status)

      await api().patch(`${BASE}/${projectA}/facts/public.currentStage`)
        .set(as(editorA)).send({ value: 'DEVELOPER_SELECTED' }).expect(200)

      const after = await prisma.cmsVerification.findFirstOrThrow({
        where: { contentId: projectA, field: 'public.currentStage' },
      })
      expect(after.status).toBe('UNVERIFIED')

      const audit = await prisma.cmsVerificationAudit.findMany({
        where: { contentId: projectA, field: 'public.currentStage' },
        orderBy: { occurredAt: 'asc' },
      })
      expect(audit.map((a) => a.event)).toContain('INVALIDATED')
      // The old signature is still described in the trail, not erased.
      expect(audit.some((a) => a.event === 'VERIFIED')).toBe(true)
    })

    it('re-saving the SAME value does not invalidate, because the signature still covers it', async () => {
      // Self-contained: set a known value, sign it, then write the identical
      // value back. Relying on a previous test's leftover state made this
      // assert something different depending on run order.
      await api().patch(`${BASE}/${projectA}/facts/public.currentStage`)
        .set(as(editorA)).send({ value: 'AGREEMENTS' }).expect(200)
      await api().post(`${BASE}/${projectA}/facts/public.currentStage/verify`)
        .set(as(verifierA)).send({}).expect(200)

      const signed = await prisma.cmsVerification.findFirstOrThrow({
        where: { contentId: projectA, field: 'public.currentStage' },
      })
      expect(['VERIFIED', 'SELF_VERIFIED']).toContain(signed.status)

      await api().patch(`${BASE}/${projectA}/facts/public.currentStage`)
        .set(as(editorA)).send({ value: 'AGREEMENTS' }).expect(200)

      const after = await prisma.cmsVerification.findFirstOrThrow({
        where: { contentId: projectA, field: 'public.currentStage' },
      })
      expect(['VERIFIED', 'SELF_VERIFIED']).toContain(after.status)
    })

    it('restoring appends a revision and never deletes verification history', async () => {
      const auditBefore = await prisma.cmsVerificationAudit.count({ where: { contentId: projectA } })
      const revs = await prisma.cmsRevision.findMany({
        where: { contentId: projectA }, orderBy: { sequence: 'asc' },
      })
      const target = revs[0]!

      await api().post(`${BASE}/${projectA}/revisions/${target.id}/restore`)
        .set(as(adminA)).expect(200)

      const after = await prisma.cmsRevision.findMany({
        where: { contentId: projectA }, orderBy: { sequence: 'asc' },
      })
      expect(after.length).toBe(revs.length + 1)
      expect(after[0]!.id).toBe(target.id)
      expect(after[after.length - 1]!.reason).toBe('RESTORE')
      expect(after[after.length - 1]!.restoredFromRevisionId).toBe(target.id)

      // The audit trail is untouched by a restore.
      expect(await prisma.cmsVerificationAudit.count({ where: { contentId: projectA } }))
        .toBeGreaterThanOrEqual(auditBefore)
    })

    it('a revision snapshot preserves the WHOLE project, internal and feasibility included', async () => {
      // A history entry that dropped the private half would make "what was
      // true then" unanswerable for exactly the data that matters most.
      const rev = await prisma.cmsRevision.findFirstOrThrow({
        where: { contentId: projectA }, orderBy: { sequence: 'asc' },
      })
      const snap = rev.snapshot as unknown as ProjectDocument
      expect(snap.internal?.notes).toBe(SECRETS.internalNote)
      expect(snap.feasibility?.economics?.['sales']?.value).toBe(SECRETS.economics)
    })

    it('an old revision row is never mutated by later activity', async () => {
      const first = await prisma.cmsRevision.findFirstOrThrow({
        where: { contentId: projectA }, orderBy: { sequence: 'asc' },
      })
      await api().patch(`${BASE}/${projectA}/facts/public.facts.address`)
        .set(as(editorA)).send({ value: 'משהו אחר' }).expect(200)
      const again = await prisma.cmsRevision.findFirstOrThrow({
        where: { contentId: projectA }, orderBy: { sequence: 'asc' },
      })
      expect(again.snapshot).toEqual(first.snapshot)
      expect(again.createdAt).toEqual(first.createdAt)
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  DRAFT / INTERNAL / FEASIBILITY vs PUBLIC
  // ══════════════════════════════════════════════════════════════════════

  describe('separation from the public surface', () => {
    it('a DRAFT project is unreachable publicly', async () => {
      await api().get(`/api/v1/public/cms/${A_SLUG}/project/secure-project`).expect(404)
      const list = await api().get(`/api/v1/public/cms/${A_SLUG}/project`).expect(200)
      expect(list.body).toEqual([])
    })

    it('publishing exposes the public half and NOTHING else', async () => {
      await api().post(`${BASE}/${projectA}/publish`).set(as(adminA)).expect(200)
      const res = await api().get(`/api/v1/public/cms/${A_SLUG}/project/secure-project`).expect(200)
      const body = JSON.stringify(res.body)

      expect(res.body.content.name).toEqual({ he: 'פרויקט בדיקה' })

      // internal
      expect(body).not.toContain(SECRETS.internalNote)
      expect(body).not.toContain(SECRETS.block)
      expect(body).not.toContain(SECRETS.candidate)
      expect(body).not.toContain('חלקה 126')
      // feasibility + economics
      expect(body).not.toContain(String(SECRETS.output))
      expect(body).not.toContain(String(SECRETS.economics))
      // source audit vocabulary
      expect(body).not.toContain('FEASIBILITY_WORKBOOK')
      expect(body).not.toContain('USER_VERIFIED')
      expect(body).not.toContain('src-workbook')
      // verifier identity
      expect(body).not.toContain(verifierAId)
      expect(body).not.toContain(editorAId)
      expect(body).not.toContain(adminAId)
      // verification audit
      expect(body).not.toContain('INVALIDATED')
      expect(body).not.toContain('verifiedValue')
    })

    it('the stored publication snapshot itself carries nothing private', async () => {
      // Checked on the ROW, not the response, because the row is what will be
      // served for as long as this publication stands.
      const row = await prisma.cmsContent.findUniqueOrThrow({
        where: { id: projectA }, include: { livePublication: true },
      })
      const snap = JSON.stringify(row.livePublication!.snapshot)
      for (const secret of Object.values(SECRETS)) {
        expect(snap).not.toContain(String(secret))
      }
    })

    it('the unverified unitCount does not travel even though it is in the draft', async () => {
      const res = await api().get(`/api/v1/public/cms/${A_SLUG}/project/secure-project`).expect(200)
      expect(res.body.content.facts?.unitCount).toBeUndefined()
      expect(JSON.stringify(res.body)).not.toContain('130')
    })

    it('editing internal data afterwards NEVER changes what the public sees', async () => {
      const before = await api().get(`/api/v1/public/cms/${A_SLUG}/project/secure-project`).expect(200)

      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectA } })
      const d = row.draft as unknown as ProjectDocument
      await api().patch(`${BASE}/${projectA}`).set(as(adminA)).send({
        draft: {
          ...d,
          internal: { ...d.internal, notes: 'סוד חדש לגמרי' },
          feasibility: { economics: { sales: { value: 999_999_999 } } },
        },
      }).expect(200)

      const after = await api().get(`/api/v1/public/cms/${A_SLUG}/project/secure-project`).expect(200)
      expect(after.body.content).toEqual(before.body.content)
      expect(JSON.stringify(after.body)).not.toContain('999999999')
      expect(JSON.stringify(after.body)).not.toContain('סוד חדש לגמרי')
    })

    it('a preview shows the projection, so it cannot leak what publishing would not', async () => {
      const minted = await api().post(`${BASE}/${projectA}/preview-token`)
        .set(as(adminA)).expect(201)
      const res = await api().get(`/api/v1/public/cms/preview/${minted.body.token}`).expect(200)
      const proj = JSON.stringify(res.body.projection)
      for (const secret of Object.values(SECRETS)) {
        expect(proj).not.toContain(String(secret))
      }
      expect(proj).not.toContain('999999999')
    })
  })
})
