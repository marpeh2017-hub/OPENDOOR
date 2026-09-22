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
      // `profit` is here so the derived `cost` formula has both its inputs and
      // the recalculation assertions have something real to recompute.
      economics: { sales: { value: SECRETS.economics }, profit: { value: 135_900_000 } },
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
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
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

  // ══════════════════════════════════════════════════════════════════════
  //  PASS 4D · PROJECT MEDIA UPLOAD
  // ══════════════════════════════════════════════════════════════════════

  describe('project media upload', () => {
    // A genuine PNG signature, so file-signature validation actually passes
    // rather than being incidentally skipped.
    const PNG_BYTES = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('IHDRfake', 'ascii'),
    ])

    it('an editor can upload an image and gets back a tenant-scoped storage key', async () => {
      const res = await api().post(`${BASE}/${projectA}/media/upload`).set(as(editorA))
        .attach('file', PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' })
        .expect(201)
      expect(res.body.storageKey).toContain(`${tenantA}/`)
      expect(res.body.mimeType).toBe('image/png')
    })

    it('a viewer cannot upload — VIEW is not EDIT', async () => {
      await api().post(`${BASE}/${projectA}/media/upload`).set(as(viewerA))
        .attach('file', PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' })
        .expect(403)
    })

    it('uploading to another tenant project answers 404 before touching storage', async () => {
      await api().post(`${BASE}/${projectB}/media/upload`).set(as(adminA))
        .attach('file', PNG_BYTES, { filename: 'photo.png', contentType: 'image/png' })
        .expect(404)
    })

    it('rejects a disguised file whose bytes do not match the declared image type', async () => {
      const res = await api().post(`${BASE}/${projectA}/media/upload`).set(as(editorA))
        .attach('file', Buffer.from('#!/bin/sh; echo pwned'), { filename: 'a.png', contentType: 'image/png' })
      expect(res.status).toBe(400)
    })

    it('rejects a non-image MIME type outright', async () => {
      const res = await api().post(`${BASE}/${projectA}/media/upload`).set(as(editorA))
        .attach('file', Buffer.from('%PDF-1.4'), { filename: 'a.pdf', contentType: 'application/pdf' })
      expect(res.status).toBe(400)
    })

    it('a signed preview URL is scoped to a media entry that actually exists on the project', async () => {
      // The entry must be a real member of doc.media, looked up by id — not a
      // bare storage key the caller could otherwise supply directly.
      await api().get(`${BASE}/${projectA}/media/does-not-exist/url`).set(as(adminA)).expect(404)
    })

    it('a preview URL for another tenant project answers 404', async () => {
      await api().get(`${BASE}/${projectB}/media/anything/url`).set(as(adminA)).expect(404)
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  PASS 4E · FEASIBILITY
  // ══════════════════════════════════════════════════════════════════════

  describe('feasibility permissions', () => {
    it('an admin reads the workspace, migrated from the stored flat shape', async () => {
      const res = await api().get(`${BASE}/${projectA}/feasibility`).set(as(adminA)).expect(200)
      expect(res.body.workspace.version).toBe(2)
      expect(res.body.workspace.scenarios).toHaveLength(1)
      // Migrated in memory. The stored row is untouched until somebody edits.
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectA } })
      expect((row.draft as any).feasibility.version).toBeUndefined()
    })

    it('a project manager may edit it', async () => {
      await api().patch(`${BASE}/${projectA}/feasibility`).set(as(verifierA)).send({
        op: 'setValue', scenarioId: 'baseline', key: 'sales', value: '825600000',
      }).expect(200)
    })

    /**
     * The §17 property, and the reason feasibility has its own tier.
     *
     * `editorA` is a RESIDENT_RELATIONS_MANAGER: they hold CMS_EDIT_ROLES and
     * edit public project copy for a living. They must not thereby hold the
     * project's economics.
     */
    it('somebody who can edit public copy CANNOT read or write the economics', async () => {
      await api().get(`${BASE}/${projectA}/feasibility`).set(as(editorA)).expect(403)
      await api().patch(`${BASE}/${projectA}/feasibility`).set(as(editorA)).send({
        op: 'setValue', scenarioId: 'baseline', key: 'sales', value: '1',
      }).expect(403)
    })

    it('a viewer and an outsider get nothing', async () => {
      await api().get(`${BASE}/${projectA}/feasibility`).set(as(viewerA)).expect(403)
      await api().get(`${BASE}/${projectA}/feasibility`).set(as(outsiderA)).expect(403)
    })

    /**
     * The structural half of the same property.
     *
     * The ordinary project save carries the WHOLE draft, so without the
     * subtree lock in `CmsService.save` an editor could change what the
     * project is worth by posting a document — no feasibility capability
     * required. A permission boundary that depends on the client sending the
     * right shape is not a boundary.
     */
    it('the ordinary project save cannot reach feasibility, even carrying it', async () => {
      const before = await api().get(`${BASE}/${projectA}/feasibility`).set(as(adminA)).expect(200)
      const beforeSales = before.body.workspace.scenarios[0].fields.sales.value

      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectA } })
      await api().patch(`${BASE}/${projectA}`).set(as(editorA)).send({
        draft: {
          ...(row.draft as any),
          public: { ...(row.draft as any).public, summary: { he: 'תקציר מעודכן' } },
          feasibility: { economics: { sales: { value: 1 } }, outputs: {} },
        },
      }).expect(200)

      const after = await api().get(`${BASE}/${projectA}/feasibility`).set(as(adminA)).expect(200)
      expect(after.body.workspace.scenarios[0].fields.sales.value).toBe(beforeSales)

      // The public edit in the same request DID land — this is a targeted
      // lock, not a rejected save.
      const updated = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectA } })
      expect((updated.draft as any).public.summary.he).toBe('תקציר מעודכן')
    })
  })

  describe('feasibility tenant isolation', () => {
    it('reading another tenant workspace answers 404, never 403', async () => {
      await api().get(`${BASE}/${projectB}/feasibility`).set(as(adminA)).expect(404)
    })

    it('editing another tenant workspace answers 404 and changes nothing', async () => {
      const before = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectB } })
      await api().patch(`${BASE}/${projectB}/feasibility`).set(as(adminA)).send({
        op: 'setValue', scenarioId: 'baseline', key: 'sales', value: '1',
      }).expect(404)
      const after = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectB } })
      expect(after.draft).toEqual(before.draft)
    })

    it('restoring across tenants answers 404', async () => {
      const mine = await api().get(`${BASE}/${projectA}/revisions`).set(as(adminA)).expect(200)
      const revisionId = mine.body[0].id
      // A revision id that is real, but belongs to the other tenant's project.
      await api().post(`${BASE}/${projectB}/revisions/${revisionId}/restore`)
        .set(as(adminA)).expect(404)
    })

    it('tenant B can do it on its OWN project, so the 404s are isolation not breakage', async () => {
      await api().get(`${BASE}/${projectB}/feasibility`).set(as(adminB)).expect(200)
    })
  })

  describe('feasibility persistence and revisions', () => {
    it('an edit persists to Postgres, recomputes dependents and appends a revision', async () => {
      const revsBefore = await prisma.cmsRevision.count({ where: { contentId: projectA } })

      const res = await api().patch(`${BASE}/${projectA}/feasibility`).set(as(adminA)).send({
        op: 'setValue', scenarioId: 'baseline', key: 'profit', value: '100000000',
      }).expect(200)

      const fields = res.body.workspace.scenarios[0].fields
      expect(fields.profit.value).toBe('100000000')
      // cost = sales - profit, recomputed by the server
      expect(fields.cost.calculatedValue).toBe('725600000')

      // Actually in the database, not only in the response.
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectA } })
      const stored = (row.draft as any).feasibility
      expect(stored.version).toBe(2)
      expect(stored.scenarios[0].fields.cost.calculatedValue).toBe('725600000')

      const revsAfter = await prisma.cmsRevision.count({ where: { contentId: projectA } })
      expect(revsAfter).toBe(revsBefore + 1)
    })

    it('preserves exact precision through the database round trip', async () => {
      await api().patch(`${BASE}/${projectA}/feasibility`).set(as(adminA)).send({
        op: 'setValue', scenarioId: 'baseline', key: 'totalScenarioUnits', value: '337.18',
      }).expect(200)
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectA } })
      const stored = (row.draft as any).feasibility.scenarios[0].fields.totalScenarioUnits
      // The characters, not the nearest double to them.
      expect(stored.value).toBe('337.18')
      expect(typeof stored.value).toBe('string')
      expect(JSON.stringify(row.draft)).toContain('"337.18"')
    })

    it('records an override with its reason, keeping the calculated value', async () => {
      const res = await api().patch(`${BASE}/${projectA}/feasibility`).set(as(adminA)).send({
        op: 'setOverride', scenarioId: 'baseline', key: 'cost',
        value: '700000000', reason: 'תקציב מעודכן שהתקבל מהיזם',
      }).expect(200)
      const cost = res.body.workspace.scenarios[0].fields.cost
      expect(cost.override.value).toBe('700000000')
      expect(cost.override.reason).toContain('יזם')
      expect(cost.override.userId).toBe(adminAId)
      expect(cost.calculatedValue).toBe('725600000')   // survives
    })

    it('refuses an override with no reason', async () => {
      await api().patch(`${BASE}/${projectA}/feasibility`).set(as(adminA)).send({
        op: 'setOverride', scenarioId: 'baseline', key: 'returnOnCost', value: '20', reason: '   ',
      }).expect(400)
    })

    it('refuses a direct write to a calculated field', async () => {
      await api().patch(`${BASE}/${projectA}/feasibility`).set(as(adminA)).send({
        op: 'setValue', scenarioId: 'baseline', key: 'cost', value: '1',
      }).expect(400)
    })

    it('a DTO cannot smuggle a calculated value past the server', async () => {
      // `calculatedValue` is not a DTO field, so `whitelist: true` strips it.
      await api().patch(`${BASE}/${projectA}/feasibility`).set(as(adminA)).send({
        op: 'setValue', scenarioId: 'baseline', key: 'profit', value: '90000000',
        calculatedValue: '999', calcStatus: 'OK',
      } as any).expect(200)
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: projectA } })
      const f = (row.draft as any).feasibility.scenarios[0].fields
      expect(JSON.stringify(f)).not.toContain('999')
      expect(f.cost.calculatedValue).toBe('735600000')  // 825.6M - 90M
    })

    it('a revision snapshot carries the whole feasibility workspace', async () => {
      const revs = await prisma.cmsRevision.findMany({
        where: { contentId: projectA }, orderBy: { sequence: 'desc' }, take: 1,
      })
      const snap = revs[0]!.snapshot as any
      expect(snap.feasibility.version).toBe(2)
      expect(snap.feasibility.scenarios[0].fields.sales).toBeTruthy()
    })

    it('restoring appends a NEW revision and never rewrites history', async () => {
      const all = await prisma.cmsRevision.findMany({
        where: { contentId: projectA }, orderBy: { sequence: 'asc' },
      })
      const target = all[all.length - 2]!
      const before = all.length

      await api().post(`${BASE}/${projectA}/revisions/${target.id}/restore`)
        .set(as(adminA)).expect(200)

      const after = await prisma.cmsRevision.findMany({
        where: { contentId: projectA }, orderBy: { sequence: 'asc' },
      })
      expect(after).toHaveLength(before + 1)
      expect(after[after.length - 1]!.reason).toBe('RESTORE')
      // The revision restored FROM is byte-identical to what it was.
      const untouched = after.find((r) => r.id === target.id)!
      expect(untouched.snapshot).toEqual(target.snapshot)
      expect(untouched.sequence).toBe(target.sequence)
    })
  })

  describe('feasibility never reaches the public, by shape', () => {
    /** Every key the feasibility workspace can possibly contribute. */
    const FEASIBILITY_KEYS = [
      'feasibility', 'scenarios', 'activeScenarioId', 'sourceWarnings',
      'calculatedValue', 'calculatedAt', 'calcStatus', 'missingInputs',
      'override', 'formulaId', 'importedFrom', 'reviewState',
      'economics', 'assumptions', 'outputs', 'sourceData',
    ]

    function allKeys(node: unknown, into = new Set<string>()): Set<string> {
      if (node === null || typeof node !== 'object') return into
      if (Array.isArray(node)) { node.forEach((v) => allKeys(v, into)); return into }
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        into.add(k)
        allKeys(v, into)
      }
      return into
    }

    let publicBody: any

    beforeAll(async () => {
      // Publish, so the strongest possible version of the question is asked:
      // not "is a draft hidden" but "does a LIVE project leak its scenario".
      await prisma.cmsContent.update({
        where: { id: projectA },
        data: { state: 'DRAFT' },
      })
      await api().post(`${BASE}/${projectA}/publish`).set(as(adminA))
      const res = await api().get(`/api/v1/public/cms/${A_SLUG}/project/secure-project`)
      publicBody = res.body
    })

    it('the published public payload carries no feasibility-shaped key at any depth', () => {
      const keys = allKeys(publicBody)
      for (const forbidden of FEASIBILITY_KEYS) {
        expect(keys.has(forbidden)).toBe(false)
      }
    })

    it('carries none of the values either', () => {
      const s = JSON.stringify(publicBody)
      for (const secret of ['825600000', '337.18', '725600000', '700000000', 'תקציב מעודכן']) {
        expect(s).not.toContain(secret)
      }
    })

    it('the public LIST carries nothing either', async () => {
      const res = await api().get(`/api/v1/public/cms/${A_SLUG}/project`).expect(200)
      const keys = allKeys(res.body)
      for (const forbidden of FEASIBILITY_KEYS) expect(keys.has(forbidden)).toBe(false)
      expect(JSON.stringify(res.body)).not.toContain('825600000')
    })

    it('the stored publication snapshot carries nothing either', async () => {
      const pub = await prisma.cmsPublication.findFirst({
        where: { contentId: projectA }, orderBy: { publishedAt: 'desc' },
      })
      const keys = allKeys(pub!.snapshot)
      for (const forbidden of FEASIBILITY_KEYS) expect(keys.has(forbidden)).toBe(false)
    })

    it('the signed preview carries nothing either', async () => {
      const minted = await api().post(`${BASE}/${projectA}/preview-token`).set(as(adminA)).expect(201)
      const res = await api().get(`/api/v1/public/cms/preview/${minted.body.token}`).expect(200)
      const keys = allKeys(res.body.projection)
      for (const forbidden of FEASIBILITY_KEYS) expect(keys.has(forbidden)).toBe(false)
      expect(JSON.stringify(res.body.projection)).not.toContain('825600000')
    })

    it('editing feasibility on a PUBLISHED project changes nothing the public sees', async () => {
      const before = await api()
        .get(`/api/v1/public/cms/${A_SLUG}/project/secure-project`).expect(200)

      await api().patch(`${BASE}/${projectA}/feasibility`).set(as(adminA)).send({
        op: 'setValue', scenarioId: 'baseline', key: 'sales', value: '999999999',
      }).expect(200)

      const after = await api()
        .get(`/api/v1/public/cms/${A_SLUG}/project/secure-project`).expect(200)

      // Byte-identical: a feasibility edit is not a publication, so the live
      // snapshot does not move at all.
      expect(after.body).toEqual(before.body)
      expect(JSON.stringify(after.body)).not.toContain('999999999')
    })

    it('a feasibility edit creates no publication', async () => {
      const before = await prisma.cmsPublication.count({ where: { contentId: projectA } })
      await api().patch(`${BASE}/${projectA}/feasibility`).set(as(adminA)).send({
        op: 'setValue', scenarioId: 'baseline', key: 'profit', value: '111111111',
      }).expect(200)
      const after = await prisma.cmsPublication.count({ where: { contentId: projectA } })
      expect(after).toBe(before)
    })

    it('offers no publish route on the feasibility surface', async () => {
      // Not "the button is hidden" — there is no such endpoint.
      await api().post(`${BASE}/${projectA}/feasibility/publish`).set(as(adminA)).expect(404)
    })
  })
})
