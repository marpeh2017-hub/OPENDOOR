/**
 * The Site Manager, end to end.
 *
 * Covers the editing loop the CMS exists for (edit → preview → publish →
 * restore), and the two properties that make it safe to hand to a person:
 * TENANT ISOLATION and PERMISSIONS.
 *
 * ── ISOLATION IS TESTED AGAINST A REAL SECOND TENANT ───────────────────────
 *
 * Following `tenant-isolation.e2e-spec.ts`: a 404 for an id that exists in no
 * tenant proves nothing. Tenant B here owns real, populated CMS rows, and the
 * assertions are that tenant A cannot read, edit, publish, preview or restore
 * any of them — and that the answer is always 404, never 403, because 403
 * would confirm the id is real somewhere else.
 *
 * ── PERMISSIONS ARE TESTED AT THE ENDPOINT ─────────────────────────────────
 *
 * The CRM hides what a user may not do. Hiding is not enforcement, so every
 * refusal below is driven straight at the HTTP surface with a token that the
 * UI would never have rendered the button for.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const A_SLUG = 'e2e-cms-tenant-a'
const B_SLUG = 'e2e-cms-tenant-b'
const BASE = '/api/v1/cms/content'

/** A draft that deliberately mixes public prose, internal notes and claims. */
const DRAFT = {
  title: { he: 'שקיפות ואמון' },
  blocks: [
    { type: 'paragraph', text: { he: 'פסקה ציבורית' } },
    { type: 'note', exposure: 'INTERNAL', text: 'לעיניים פנימיות בלבד' },
  ],
  unitCount: { value: 120, status: 'VERIFIED', verifiedAt: '2026-02-01', verifiedByName: 'OpenDoor Group', source: 'USER_VERIFIED' },
  plannedUnits: { value: 337.18, status: 'UNVERIFIED' },
}

describe('CMS persistence (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let tenantAId: string
  let tenantBId: string
  let adminAId: string
  let editorAId: string
  let viewerAId: string
  let adminBId: string

  let adminA: string
  let editorA: string
  let viewerA: string
  let outsiderA: string

  let contentAId: string
  let contentBId: string
  let revisionBId: string

  const token = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const api = () => request(app.getHttpServer())
  const as = (t: string) => ({ Authorization: `Bearer ${t}` })

  const purge = async () => {
    for (const slug of [A_SLUG, B_SLUG]) {
      const t = await prisma.tenant.findUnique({ where: { slug } })
      if (!t) continue
      // Unlink first: cms_content points at revisions and publications, and
      // those point back, so the cycle has to be broken before deleting.
      await prisma.cmsContent.updateMany({
        where: { tenantId: t.id },
        data: { currentRevisionId: null, livePublicationId: null },
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

  const seedContent = async (tenantId: string, userId: string, slug: string) => {
    const c = await prisma.cmsContent.create({
      data: {
        tenantId, kind: 'PAGE', slug, state: 'DRAFT', exposure: 'PUBLIC',
        draft: DRAFT as never, createdById: userId, updatedById: userId,
      },
    })
    const r = await prisma.cmsRevision.create({
      data: {
        tenantId, contentId: c.id, sequence: 1, reason: 'SAVE',
        snapshot: DRAFT as never, stateAtRevision: 'DRAFT', authorId: userId,
      },
    })
    await prisma.cmsContent.update({ where: { id: c.id }, data: { currentRevisionId: r.id } })
    return { contentId: c.id, revisionId: r.id }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })

    await purge()

    const tA = await prisma.tenant.create({ data: { name: 'E2E CMS A', slug: A_SLUG } })
    const tB = await prisma.tenant.create({ data: { name: 'E2E CMS B', slug: B_SLUG } })
    tenantAId = tA.id
    tenantBId = tB.id
    expect(tenantAId).not.toBe(tenantBId)

    const mk = async (tenantId: string, role: string, email: string) =>
      (await prisma.user.create({
        data: { tenantId, email, firstName: 'E2E', lastName: role, role: role as never },
      })).id

    adminAId = await mk(tenantAId, 'COMPANY_ADMIN', 'admin@cms-a.e2e.local')
    editorAId = await mk(tenantAId, 'RESIDENT_RELATIONS_MANAGER', 'editor@cms-a.e2e.local')
    viewerAId = await mk(tenantAId, 'CEO', 'viewer@cms-a.e2e.local')
    const outsiderAId = await mk(tenantAId, 'FIELD_AGENT', 'outsider@cms-a.e2e.local')
    adminBId = await mk(tenantBId, 'COMPANY_ADMIN', 'admin@cms-b.e2e.local')

    adminA = token(adminAId, tenantAId, 'COMPANY_ADMIN')
    editorA = token(editorAId, tenantAId, 'RESIDENT_RELATIONS_MANAGER')
    viewerA = token(viewerAId, tenantAId, 'CEO')
    outsiderA = token(outsiderAId, tenantAId, 'FIELD_AGENT')

    contentAId = (await seedContent(tenantAId, adminAId, 'transparency')).contentId
    const b = await seedContent(tenantBId, adminBId, 'transparency')
    contentBId = b.contentId
    revisionBId = b.revisionId
  })

  afterAll(async () => {
    await purge()
    await app.close()
  })

  // ══════════════════════════════════════════════════════════════════════
  //  TENANT ISOLATION
  // ══════════════════════════════════════════════════════════════════════

  describe('tenant isolation', () => {
    it('both tenants own a page at the SAME slug, which is the point of tenant-scoped uniqueness', async () => {
      const a = await prisma.cmsContent.findFirst({ where: { tenantId: tenantAId, slug: 'transparency' } })
      const b = await prisma.cmsContent.findFirst({ where: { tenantId: tenantBId, slug: 'transparency' } })
      expect(a).toBeTruthy()
      expect(b).toBeTruthy()
      expect(a!.id).not.toBe(b!.id)
    })

    it('the list never includes the other tenant rows', async () => {
      const res = await api().get(BASE).set(as(adminA)).expect(200)
      const ids = res.body.map((r: any) => r.id)
      expect(ids).toContain(contentAId)
      expect(ids).not.toContain(contentBId)
    })

    it.each([
      ['GET  item',            'get',   (id: string) => `${BASE}/${id}`],
      ['GET  revisions',       'get',   (id: string) => `${BASE}/${id}/revisions`],
      ['GET  publication-check','get',  (id: string) => `${BASE}/${id}/publication-check`],
    ])('%s across tenants answers 404, never 403', async (_label, method, url) => {
      const res = await (api() as any)[method](url(contentBId)).set(as(adminA))
      expect(res.status).toBe(404)
    })

    it('PATCH across tenants answers 404 and does not touch the row', async () => {
      const before = await prisma.cmsContent.findUnique({ where: { id: contentBId } })
      await api().patch(`${BASE}/${contentBId}`).set(as(adminA))
        .send({ draft: { title: { he: 'נחטף' } } }).expect(404)
      const after = await prisma.cmsContent.findUnique({ where: { id: contentBId } })
      expect(after!.draft).toEqual(before!.draft)
      expect(after!.updatedById).toBe(adminBId)
    })

    it('publish across tenants answers 404 and publishes nothing', async () => {
      await api().post(`${BASE}/${contentBId}/publish`).set(as(adminA)).expect(404)
      const after = await prisma.cmsContent.findUnique({ where: { id: contentBId } })
      expect(after!.state).toBe('DRAFT')
      expect(after!.livePublicationId).toBeNull()
    })

    it('restore across tenants answers 404 and appends no revision', async () => {
      const before = await prisma.cmsRevision.count({ where: { contentId: contentBId } })
      await api().post(`${BASE}/${contentBId}/revisions/${revisionBId}/restore`)
        .set(as(adminA)).expect(404)
      expect(await prisma.cmsRevision.count({ where: { contentId: contentBId } })).toBe(before)
    })

    it('minting a preview token for another tenant item answers 404, so no signature is issued', async () => {
      const res = await api().post(`${BASE}/${contentBId}/preview-token`).set(as(adminA))
      expect(res.status).toBe(404)
      expect(res.body.token).toBeUndefined()
    })

    it("a preview token signed for tenant B cannot be redeemed by naming tenant A's item", async () => {
      // Mint B's own token legitimately, then confirm it resolves ONLY B's item:
      // the tenant is inside the signature, not alongside it.
      const minted = await api().post(`${BASE}/${contentBId}/preview-token`)
        .set(as(token(adminBId, tenantBId, 'COMPANY_ADMIN'))).expect(201)
      const res = await api().get(`/api/v1/public/cms/preview/${minted.body.token}`).expect(200)
      expect(res.body.id).toBe(contentBId)
      expect(res.body.id).not.toBe(contentAId)
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  PERMISSIONS
  // ══════════════════════════════════════════════════════════════════════

  describe('permissions are enforced at the endpoint, not by hiding buttons', () => {
    it('a role outside the CMS entirely cannot even read it', async () => {
      await api().get(BASE).set(as(outsiderA)).expect(403)
      await api().get(`${BASE}/${contentAId}`).set(as(outsiderA)).expect(403)
    })

    it('a viewer reads but cannot edit', async () => {
      await api().get(`${BASE}/${contentAId}`).set(as(viewerA)).expect(200)
      await api().patch(`${BASE}/${contentAId}`).set(as(viewerA))
        .send({ draft: { title: { he: 'לא' } } }).expect(403)
    })

    it('an editor edits but cannot publish, unpublish or restore', async () => {
      await api().patch(`${BASE}/${contentAId}`).set(as(editorA))
        .send({ draft: DRAFT }).expect(200)
      await api().post(`${BASE}/${contentAId}/publish`).set(as(editorA)).expect(403)
      await api().post(`${BASE}/${contentAId}/unpublish`).set(as(editorA)).expect(403)
      const rev = await prisma.cmsRevision.findFirst({ where: { contentId: contentAId } })
      await api().post(`${BASE}/${contentAId}/revisions/${rev!.id}/restore`)
        .set(as(editorA)).expect(403)
    })

    it('an editor may mint a preview link, because showing a colleague a draft is drafting', async () => {
      await api().post(`${BASE}/${contentAId}/preview-token`).set(as(editorA)).expect(201)
    })

    it('no token at all is 401, not 404', async () => {
      await api().get(BASE).expect(401)
    })

    it('the DTO refuses a browser-supplied tenantId instead of honouring it', async () => {
      await api().patch(`${BASE}/${contentAId}`).set(as(adminA))
        .send({ draft: { a: 1 }, tenantId: tenantBId }).expect(200)
      // whitelist:true strips the field; the row stays in tenant A.
      const row = await prisma.cmsContent.findUnique({ where: { id: contentAId } })
      expect(row!.tenantId).toBe(tenantAId)
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  THE EDITING LOOP
  // ══════════════════════════════════════════════════════════════════════

  describe('edit, publish, restore', () => {
    it('a save appends a revision and moves the draft, in one step', async () => {
      const before = await prisma.cmsRevision.count({ where: { contentId: contentAId } })
      const edited = { ...DRAFT, title: { he: 'שקיפות ואמון, מעודכן' } }

      await api().patch(`${BASE}/${contentAId}`).set(as(adminA))
        .send({ draft: edited, summary: 'עדכון כותרת' }).expect(200)

      expect(await prisma.cmsRevision.count({ where: { contentId: contentAId } })).toBe(before + 1)
      const row = await prisma.cmsContent.findUnique({ where: { id: contentAId } })
      expect((row!.draft as any).title.he).toBe('שקיפות ואמון, מעודכן')
      // The pointer moved with it: a saved state with no history entry cannot exist.
      const current = await prisma.cmsRevision.findUnique({ where: { id: row!.currentRevisionId! } })
      expect((current!.snapshot as any).title.he).toBe('שקיפות ואמון, מעודכן')
      expect(current!.summary).toBe('עדכון כותרת')
    })

    it('revision sequences are monotonic and gapless', async () => {
      const revs = await prisma.cmsRevision.findMany({
        where: { contentId: contentAId }, orderBy: { sequence: 'asc' }, select: { sequence: true },
      })
      expect(revs.map((r) => r.sequence)).toEqual(revs.map((_, i) => i + 1))
    })

    it('a stale expectedRevisionId is refused with 409 rather than overwriting', async () => {
      const row = await prisma.cmsContent.findUnique({ where: { id: contentAId } })
      const stale = await prisma.cmsRevision.findFirst({
        where: { contentId: contentAId, id: { not: row!.currentRevisionId! } },
      })
      await api().patch(`${BASE}/${contentAId}`).set(as(adminA))
        .send({ draft: { title: { he: 'התנגשות' } }, expectedRevisionId: stale!.id })
        .expect(409)
    })

    it('editing does NOT change what the website serves', async () => {
      // Nothing is published yet, so the public route must still 404 even
      // though a draft plainly exists.
      await api().get(`/api/v1/public/cms/${A_SLUG}/page/transparency`).expect(404)
    })

    it('publishing freezes a projection that carries no private field', async () => {
      const check = await api().get(`${BASE}/${contentAId}/publication-check`)
        .set(as(adminA)).expect(200)
      expect(check.body.canPublish).toBe(true)

      await api().post(`${BASE}/${contentAId}/publish`).set(as(adminA)).expect(200)

      const row = await prisma.cmsContent.findUnique({
        where: { id: contentAId }, include: { livePublication: true },
      })
      expect(row!.state).toBe('PUBLISHED')
      expect(row!.livePublicationId).toBeTruthy()
      expect(row!.firstPublishedAt).toBeTruthy()

      const snap = row!.livePublication!.snapshot as any
      // The internal block is gone; the public paragraph survived.
      expect(JSON.stringify(snap)).not.toContain('לעיניים פנימיות בלבד')
      expect(JSON.stringify(snap)).toContain('פסקה ציבורית')
      // The verified claim travels; the unverified one does not.
      expect(snap.unitCount.value).toBe(120)
      expect(snap.unitCount.verifiedByName).toBeUndefined()
      expect(snap.plannedUnits).toBeUndefined()
    })

    it('the website now serves the published projection, and only that', async () => {
      const res = await api().get(`/api/v1/public/cms/${A_SLUG}/page/transparency`).expect(200)
      expect(res.body.content.unitCount.value).toBe(120)
      const body = JSON.stringify(res.body)
      expect(body).not.toContain('USER_VERIFIED')
      expect(body).not.toContain('OpenDoor Group')
      expect(body).not.toContain('לעיניים פנימיות בלבד')
      expect(body).not.toContain('337.18')
    })

    it('a later unpublished edit does not reach the public', async () => {
      await api().patch(`${BASE}/${contentAId}`).set(as(adminA))
        .send({ draft: { ...DRAFT, title: { he: 'טיוטה שלא פורסמה' } } }).expect(200)

      const res = await api().get(`/api/v1/public/cms/${A_SLUG}/page/transparency`).expect(200)
      expect(JSON.stringify(res.body)).not.toContain('טיוטה שלא פורסמה')
    })

    it('restoring appends a NEW revision and never rewinds history', async () => {
      const revs = await prisma.cmsRevision.findMany({
        where: { contentId: contentAId }, orderBy: { sequence: 'asc' },
      })
      const target = revs[0]!
      const countBefore = revs.length

      await api().post(`${BASE}/${contentAId}/revisions/${target.id}/restore`)
        .set(as(adminA)).expect(200)

      const after = await prisma.cmsRevision.findMany({
        where: { contentId: contentAId }, orderBy: { sequence: 'asc' },
      })
      expect(after.length).toBe(countBefore + 1)
      // The old revision is untouched, and the new one records its origin.
      expect(after[0]!.id).toBe(target.id)
      const newest = after[after.length - 1]!
      expect(newest.reason).toBe('RESTORE')
      expect(newest.restoredFromRevisionId).toBe(target.id)
      expect(newest.snapshot).toEqual(target.snapshot)

      const row = await prisma.cmsContent.findUnique({ where: { id: contentAId } })
      expect(row!.draft).toEqual(target.snapshot)
    })

    it('withdrawing keeps the publication row for the record', async () => {
      const before = await prisma.cmsContent.findUnique({ where: { id: contentAId } })
      const pubId = before!.livePublicationId!

      await api().post(`${BASE}/${contentAId}/unpublish`).set(as(adminA)).expect(200)

      const pub = await prisma.cmsPublication.findUnique({ where: { id: pubId } })
      expect(pub).toBeTruthy()
      expect(pub!.unpublishedAt).toBeTruthy()

      const after = await prisma.cmsContent.findUnique({ where: { id: contentAId } })
      expect(after!.livePublicationId).toBeNull()
      await api().get(`/api/v1/public/cms/${A_SLUG}/page/transparency`).expect(404)
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  PREVIEW TOKENS
  // ══════════════════════════════════════════════════════════════════════

  describe('preview links', () => {
    it('a valid token shows the projection of an UNPUBLISHED draft', async () => {
      const minted = await api().post(`${BASE}/${contentAId}/preview-token`)
        .set(as(adminA)).expect(201)
      const res = await api().get(`/api/v1/public/cms/preview/${minted.body.token}`).expect(200)
      expect(res.body.id).toBe(contentAId)
      expect(res.body.projection).toBeDefined()
      // Even in preview the projection rules hold: a preview that showed
      // internal fields would be the leak, just with fewer viewers.
      expect(JSON.stringify(res.body.projection)).not.toContain('לעיניים פנימיות בלבד')
    })

    it('is served noindex, so an indexed URL cannot outlive the token', async () => {
      const minted = await api().post(`${BASE}/${contentAId}/preview-token`)
        .set(as(adminA)).expect(201)
      const res = await api().get(`/api/v1/public/cms/preview/${minted.body.token}`).expect(200)
      expect(res.headers['x-robots-tag']).toContain('noindex')
      expect(res.headers['cache-control']).toContain('no-store')
    })

    it('a tampered signature is refused', async () => {
      const minted = await api().post(`${BASE}/${contentAId}/preview-token`)
        .set(as(adminA)).expect(201)
      const raw = Buffer.from(minted.body.token, 'base64url').toString('utf8')
      const [cid, tid, exp] = raw.split('.')
      const forged = Buffer.from(`${cid}.${tid}.${exp}.${'0'.repeat(64)}`).toString('base64url')
      await api().get(`/api/v1/public/cms/preview/${forged}`).expect(404)
    })

    it('an extended expiry is refused, because the expiry is inside the signature', async () => {
      const minted = await api().post(`${BASE}/${contentAId}/preview-token`)
        .set(as(adminA)).expect(201)
      const raw = Buffer.from(minted.body.token, 'base64url').toString('utf8')
      const [cid, tid, , sig] = raw.split('.')
      const far = Date.now() + 10 * 365 * 24 * 3600 * 1000
      const forged = Buffer.from(`${cid}.${tid}.${far}.${sig}`).toString('base64url')
      await api().get(`/api/v1/public/cms/preview/${forged}`).expect(404)
    })

    it('garbage is refused without revealing why', async () => {
      await api().get('/api/v1/public/cms/preview/not-a-token').expect(404)
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  THE PUBLIC ROUTE HAS NO DOOR TO A DRAFT
  // ══════════════════════════════════════════════════════════════════════

  describe('the public route cannot be argued into serving a draft', () => {
    it('an unknown tenant slug reveals nothing', async () => {
      await api().get('/api/v1/public/cms/no-such-tenant/page/transparency').expect(404)
    })

    it('a DRAFT item is 404 for the public even by its exact slug', async () => {
      await prisma.cmsContent.create({
        data: {
          tenantId: tenantAId, kind: 'PAGE', slug: 'never-published', state: 'DRAFT',
          draft: { title: { he: 'סוד' } } as never,
          createdById: adminAId, updatedById: adminAId,
        },
      })
      await api().get(`/api/v1/public/cms/${A_SLUG}/page/never-published`).expect(404)
      const list = await api().get(`/api/v1/public/cms/${A_SLUG}/page`).expect(200)
      expect(JSON.stringify(list.body)).not.toContain('סוד')
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  PASS 4G · CREATE (Knowledge Center needs new content rows, not only
  //  edits to existing ones)
  // ══════════════════════════════════════════════════════════════════════

  describe('creating a content item', () => {
    it('an editor creates a new item, DRAFT and unpublished, with one revision', async () => {
      const res = await api().post(BASE).set(as(editorA)).send({
        kind: 'ARTICLE', slug: `e2e-new-article-${Date.now()}`,
        draft: { title: { he: 'כתבה חדשה' } },
      }).expect(201)
      expect(res.body.state).toBe('DRAFT')
      expect(res.body.livePublicationId).toBeNull()

      const revs = await api().get(`${BASE}/${res.body.id}/revisions`).set(as(adminA)).expect(200)
      expect(revs.body).toHaveLength(1)
      expect(revs.body[0].reason).toBe('SAVE')

      await api().get(`/api/v1/public/cms/${A_SLUG}/article/${res.body.slug}`).expect(404)
    })

    it('a viewer cannot create — VIEW is not EDIT', async () => {
      await api().post(BASE).set(as(viewerA)).send({
        kind: 'ARTICLE', slug: `e2e-viewer-article-${Date.now()}`,
      }).expect(403)
    })

    it('refuses a duplicate slug within the same tenant and kind, as a domain conflict not a raw DB error', async () => {
      const slug = `e2e-dup-${Date.now()}`
      await api().post(BASE).set(as(editorA)).send({ kind: 'ARTICLE', slug }).expect(201)
      const dup = await api().post(BASE).set(as(editorA)).send({ kind: 'ARTICLE', slug })
      expect(dup.status).toBe(409)
      expect(JSON.stringify(dup.body)).not.toMatch(/PrismaClientKnownRequestError|P2002/)
    })

    it('the same slug is free again for a DIFFERENT kind, and for a different tenant', async () => {
      const slug = `e2e-reuse-${Date.now()}`
      const adminB = token(adminBId, tenantBId, 'COMPANY_ADMIN')
      await api().post(BASE).set(as(editorA)).send({ kind: 'ARTICLE', slug }).expect(201)
      await api().post(BASE).set(as(editorA)).send({ kind: 'FAQ_ITEM', slug }).expect(201)
      await api().post(BASE).set(as(adminB)).send({ kind: 'ARTICLE', slug }).expect(201)
    })

    it('cannot be used to smuggle a tenant, an id, or a live state past the server', async () => {
      const res = await api().post(BASE).set(as(editorA)).send({
        kind: 'ARTICLE', slug: `e2e-smuggle-${Date.now()}`,
        tenantId: tenantBId, id: 'attacker-chosen-id', state: 'PUBLISHED',
      } as any).expect(201)
      expect(res.body.id).not.toBe('attacker-chosen-id')
      expect(res.body.state).toBe('DRAFT')
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: res.body.id } })
      expect(row.tenantId).toBe(tenantAId)
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  PASS 4G · PUBLIC MEDIA URL (Knowledge featured images, image slots)
  // ══════════════════════════════════════════════════════════════════════

  describe('public media URL', () => {
    /**
     * `publicMediaUrl` signs a key ONLY if some published snapshot of this
     * tenant references it. That is deliberate: without the check the route
     * would be an open signing oracle for any object in the bucket whose key
     * a stranger could guess.
     *
     * These two tests used to ask for a key that nothing referenced
     * (`deadbeef-photo.jpg`) and expect 200 and 403 — so they were asserting
     * against the security control rather than through it, and both got the
     * 404 the control is supposed to give. The fixture now publishes the key
     * first, which is what a real featured image does.
     */
    const publishKeyInSnapshot = async (key: string) => {
      const publication = await prisma.cmsPublication.findFirst({
        where: { contentId: contentAId }, orderBy: { publishedAt: 'desc' },
      })
      if (!publication) throw new Error('fixture: content A has never been published')
      await prisma.cmsPublication.update({
        where: { id: publication.id },
        data: { unpublishedAt: null, snapshot: { ...(publication.snapshot as object), heroImage: { storageKey: key } } },
      })
      await prisma.cmsContent.update({
        where: { id: contentAId },
        data: { state: 'PUBLISHED', livePublicationId: publication.id },
      })
    }

    it('mints a signed URL for a key a published snapshot actually references', async () => {
      const key = `${tenantAId}/cms/some-content/hero-photo.jpg`
      await publishKeyInSnapshot(key)
      const res = await api().get(`/api/v1/public/cms/${A_SLUG}/media`).query({ key }).expect(200)
      expect(typeof res.body.url).toBe('string')
      expect(res.body.url.length).toBeGreaterThan(0)
    })

    it('refuses a key of a DIFFERENT tenant even when a published snapshot references it', async () => {
      // Defence in depth: the reference check is satisfied on purpose here, so
      // what refuses is the storage layer's own tenant-prefix guard. Without
      // this setup the request 404s at the reference check and the guard is
      // never reached — which is what the previous version of this test did.
      const key = `${tenantBId}/cms/some-content/hero-photo.jpg`
      await publishKeyInSnapshot(key)
      await api().get(`/api/v1/public/cms/${A_SLUG}/media`).query({ key }).expect(403)
    })

    it('refuses a key that no published snapshot references, so the route is not a signing oracle', async () => {
      const key = `${tenantAId}/cms/some-content/never-referenced.jpg`
      await api().get(`/api/v1/public/cms/${A_SLUG}/media`).query({ key }).expect(404)
    })

    it('answers 404 with no key at all, never a server error', async () => {
      await api().get(`/api/v1/public/cms/${A_SLUG}/media`).expect(404)
    })

    it('an unknown tenant slug reveals nothing', async () => {
      await api().get('/api/v1/public/cms/not-a-real-tenant/media').query({ key: 'x' }).expect(404)
    })

    it('does not collide with the kind-list route — "media" is not treated as a content kind', async () => {
      // If :kind swallowed the literal "media" this would 200 with an empty
      // array instead of needing a `key`.
      const res = await api().get(`/api/v1/public/cms/${A_SLUG}/media`)
      expect(res.status).not.toBe(200)
    })
  })
})
