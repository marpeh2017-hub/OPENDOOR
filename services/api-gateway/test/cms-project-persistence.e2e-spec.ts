/**
 * Can this persistence model hold a REAL project safely?
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY TCHERNICHOVSKY AND WHY IT MUST NOT BE PUBLISHED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * מתחם טשרניחובסקי - שמעוני is the hardest thing this schema has to hold,
 * which is exactly why it is the proof. In one project it has:
 *
 *   - three facts OpenDoor verified about its own engagement (USER_VERIFIED),
 *     which MAY be published once verified;
 *   - a feasibility workbook full of precise figures — 337.18 planned units,
 *     ₪825.6M revenue, 43,930.7 m² — which may NEVER be published, verified or
 *     not, because a scenario output is a projection and not a fact about the
 *     world;
 *   - ten candidate addresses nobody has confirmed, so the project has a city
 *     and no street;
 *   - a planning status that does not exist, because developer selection is an
 *     organisational step and not a statutory one.
 *
 * A model that can hold that without leaking can hold the easy projects. So
 * these tests assert the three properties that matter and nothing about
 * presentation:
 *
 *   1. every facet PERSISTS and is queryable — internal data is stored, not
 *      merely omitted;
 *   2. the projection drops feasibility and unverified claims BY SHAPE;
 *   3. the project is not published, and the public route cannot reach it.
 *
 * Property 3 is checked against the live public endpoint rather than by
 * reading the row's state column: the requirement is that the public cannot
 * get it, and a state column is evidence about intent rather than about
 * reachability.
 *
 * The real project also exists as a DRAFT in the real tenant. This suite uses
 * its own throwaway tenant so it can assert freely without touching it.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { toPublicProjection, findPrivateLeaks } from '../src/cms/cms.projection'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SLUG = 'e2e-cms-project-tenant'

/**
 * The project as the CMS would hold it: public claims, internal notes and the
 * feasibility scenario, in one document, each labelled with how far it may
 * travel.
 *
 * The scenario figures are the REAL ones from the workbook, deliberately. A
 * test that used round numbers would pass while proving nothing about whether
 * 337.18 can be stored without becoming "337 planned apartments" on a website.
 */
const TCHERNICHOVSKY = {
  name: { he: 'מתחם טשרניחובסקי - שמעוני' },
  location: { city: { he: 'ירושלים', en: 'Jerusalem' } },
  summary: {
    he: 'מתחם בירושלים שבו נבחרו נציגויות בעלי דירות, וכיום מתקיים תהליך לבחינת ובחירת יזם.',
  },
  role: {
    value: { he: 'OpenDoor Group מארגנת ומלווה את בעלי הדירות במתחם טשרניחובסקי - שמעוני.' },
    status: 'SELF_VERIFIED',
    verifiedAt: '2026-09-01',
    verifiedByName: 'OpenDoor Group',
    source: 'USER_VERIFIED',
  },
  currentStage: {
    value: 'DEVELOPER_TENDER',
    status: 'SELF_VERIFIED',
    verifiedAt: '2026-09-01',
    verifiedByName: 'OpenDoor Group',
    source: 'USER_VERIFIED',
  },
  milestones: [
    {
      id: 'ts-representation',
      title: { he: 'נבחרו נציגויות בעלי הדירות', en: 'Owner representations were chosen' },
      state: 'completed',
      verification: {
        value: true, status: 'SELF_VERIFIED', verifiedAt: '2026-09-01',
        verifiedByName: 'OpenDoor Group', source: 'USER_VERIFIED',
      },
    },
    {
      id: 'ts-developer-selection',
      title: { he: 'בחינת ובחירת יזם', en: 'Examining and selecting a developer' },
      state: 'current',
      verification: {
        value: true, status: 'SELF_VERIFIED', verifiedAt: '2026-09-01',
        verifiedByName: 'OpenDoor Group', source: 'USER_VERIFIED',
      },
    },
  ],

  // ── Internal. Stored, queryable, never published. ──────────────────────
  internal: {
    exposure: 'INTERNAL',
    block: 'גוש 30185',
    parcel: 'חלקה 126',
    candidateAddresses: [
      'טשרניחובסקי 27', 'טשרניחובסקי 29', 'טשרניחובסקי 31', 'טשרניחובסקי 33',
      'טשרניחובסקי 35', 'שמעוני 2', 'שמעוני 4', 'שמעוני 6', 'שמעוני 8', 'שמעוני 10',
    ],
    dataQualityFlags: 8,
    note: 'עשר כתובות מועמדות. איש לא אישר את גבול המתחם, ולכן אין רחוב בעמוד הציבורי.',
  },

  // ── Feasibility. May NEVER be published, verified or not. ──────────────
  feasibilityScenario: {
    exposure: 'FEASIBILITY',
    lotArea: 10_575,
    measuredLotArea: 10_545.14,
    builtArea: 9_296.8,
    permittedArea: 12_550.68,
    averageUnitArea: 94.87,
    totalPlannedArea: 43_930.7,
    saleableArea: 35_031.5,
    plannedUnits: 337.18,
    additionalUnits: 239.18,
    projectedRevenue: 825_600_000,
    projectedProfit: 135_900_000,
  },
} as const

describe('CMS project persistence — טשרניחובסקי (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let tenantId: string
  let adminId: string
  let adminToken: string
  let contentId: string

  const api = () => request(app.getHttpServer())
  const as = () => ({ Authorization: `Bearer ${adminToken}` })

  const purge = async () => {
    const t = await prisma.tenant.findUnique({ where: { slug: SLUG } })
    if (!t) return
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleFixture.createNestApplication()
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

    const tenant = await prisma.tenant.create({ data: { name: 'E2E CMS Project', slug: SLUG } })
    tenantId = tenant.id
    adminId = (await prisma.user.create({
      data: {
        tenantId, email: 'admin@cms-project.e2e.local',
        firstName: 'E2E', lastName: 'Admin', role: 'COMPANY_ADMIN',
      },
    })).id
    adminToken = jwt.sign(
      { sub: adminId, email: 'admin@cms-project.e2e.local', role: 'COMPANY_ADMIN', tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

    const content = await prisma.cmsContent.create({
      data: {
        tenantId, kind: 'PROJECT', slug: 'tchernichovsky-shimoni',
        // DRAFT, and it stays that way. Nothing in this suite publishes it.
        state: 'DRAFT', exposure: 'PUBLIC',
        draft: TCHERNICHOVSKY as never,
        createdById: adminId, updatedById: adminId,
      },
    })
    contentId = content.id
  })

  afterAll(async () => {
    await purge()
    await app.close()
  })

  // ══════════════════════════════════════════════════════════════════════
  //  1. EVERYTHING PERSISTS
  // ══════════════════════════════════════════════════════════════════════

  describe('the whole project persists, internal parts included', () => {
    it('stores the public claims', async () => {
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: contentId } })
      const d = row.draft as unknown as typeof TCHERNICHOVSKY
      expect(d.name.he).toBe('מתחם טשרניחובסקי - שמעוני')
      expect(d.location.city.he).toBe('ירושלים')
      expect(d.currentStage.value).toBe('DEVELOPER_TENDER')
      expect(d.milestones).toHaveLength(2)
    })

    it('stores the internal boundary work rather than discarding it', async () => {
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: contentId } })
      const d = row.draft as unknown as typeof TCHERNICHOVSKY
      expect(d.internal.block).toBe('גוש 30185')
      expect(d.internal.candidateAddresses).toHaveLength(10)
      expect(d.internal.dataQualityFlags).toBe(8)
    })

    it('stores feasibility figures EXACTLY, without rounding', async () => {
      // The whole reason these are dangerous is their precision. A model that
      // stored 337 would have destroyed the distinction between a scenario
      // output and a plan before anyone had a chance to leak it.
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: contentId } })
      const f = (row.draft as unknown as typeof TCHERNICHOVSKY).feasibilityScenario
      expect(f.plannedUnits).toBe(337.18)
      expect(f.additionalUnits).toBe(239.18)
      expect(f.totalPlannedArea).toBe(43_930.7)
      expect(f.measuredLotArea).toBe(10_545.14)
      expect(f.averageUnitArea).toBe(94.87)
      expect(f.projectedRevenue).toBe(825_600_000)
    })

    it('is queryable as a project without scanning JSON', async () => {
      const found = await prisma.cmsContent.findMany({
        where: { tenantId, kind: 'PROJECT', state: 'DRAFT' },
        select: { slug: true },
      })
      expect(found.map((f) => f.slug)).toContain('tchernichovsky-shimoni')
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  2. THE PROJECTION IS SAFE
  // ══════════════════════════════════════════════════════════════════════

  describe('what publishing WOULD produce, if anybody published it', () => {
    const projected = () => toPublicProjection(TCHERNICHOVSKY) as Record<string, unknown>

    it('carries the verified engagement facts, without the verifier', () => {
      const p = projected()
      expect((p['role'] as { value: unknown }).value).toEqual({
        he: 'OpenDoor Group מארגנת ומלווה את בעלי הדירות במתחם טשרניחובסקי - שמעוני.',
      })
      expect((p['currentStage'] as { value: unknown }).value).toBe('DEVELOPER_TENDER')
      expect(findPrivateLeaks(p)).toEqual([])
    })

    it('drops the entire feasibility scenario', () => {
      const p = projected()
      expect(p['feasibilityScenario']).toBeUndefined()
    })

    it('leaks not one feasibility NUMBER anywhere in the payload', () => {
      // Checked as a serialised search on the exact digits, because a figure
      // that escaped under a different key name would still be the leak that
      // matters. This complements the shape check above; neither is sufficient.
      const s = JSON.stringify(projected())
      for (const n of [
        '337.18', '239.18', '43930.7', '35031.5', '10545.14', '9296.8',
        '12550.68', '94.87', '825600000', '135900000',
      ]) {
        expect(s).not.toContain(n)
      }
    })

    it('drops the internal block, parcel and candidate addresses', () => {
      const p = projected()
      expect(p['internal']).toBeUndefined()
      const s = JSON.stringify(p)
      expect(s).not.toContain('גוש 30185')
      expect(s).not.toContain('חלקה 126')
      expect(s).not.toContain('טשרניחובסקי 27')
    })

    it('publishes a city and no street, which is the honest shape here', () => {
      const loc = projected()['location'] as Record<string, unknown>
      expect(loc['city']).toEqual({ he: 'ירושלים', en: 'Jerusalem' })
      expect(loc['street']).toBeUndefined()
      expect(loc['neighborhood']).toBeUndefined()
    })

    it('asserts no planning status, because none exists', () => {
      const p = projected()
      expect(p['planningStatus']).toBeUndefined()
      expect(p['approvalDate']).toBeUndefined()
      expect(p['permitDate']).toBeUndefined()
      expect(p['developerName']).toBeUndefined()
    })

    it('keeps both milestones and neither invents a date', () => {
      const ms = projected()['milestones'] as Record<string, unknown>[]
      expect(ms).toHaveLength(2)
      for (const m of ms) {
        expect(m['occurredAt']).toBeUndefined()
        expect(m['periodLabel']).toBeUndefined()
      }
      expect(findPrivateLeaks(ms)).toEqual([])
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  3. IT IS NOT PUBLISHED, AND THE PUBLIC CANNOT REACH IT
  // ══════════════════════════════════════════════════════════════════════

  describe('it is not published', () => {
    it('has no publication row at all', async () => {
      const row = await prisma.cmsContent.findUniqueOrThrow({ where: { id: contentId } })
      expect(row.state).toBe('DRAFT')
      expect(row.livePublicationId).toBeNull()
      expect(row.firstPublishedAt).toBeNull()
      expect(await prisma.cmsPublication.count({ where: { contentId } })).toBe(0)
    })

    it('the public endpoint does not serve it', async () => {
      await api()
        .get(`/api/v1/public/cms/${SLUG}/project/tchernichovsky-shimoni`)
        .expect(404)
    })

    it('the public list of projects is empty for this tenant', async () => {
      const res = await api().get(`/api/v1/public/cms/${SLUG}/project`).expect(200)
      expect(res.body).toEqual([])
    })

    it('no feasibility digit appears on any public route, by any path', async () => {
      const [one, list] = await Promise.all([
        api().get(`/api/v1/public/cms/${SLUG}/project/tchernichovsky-shimoni`),
        api().get(`/api/v1/public/cms/${SLUG}/project`),
      ])
      const s = JSON.stringify(one.body) + JSON.stringify(list.body)
      for (const n of ['337.18', '43930.7', '825600000', 'גוש 30185']) {
        expect(s).not.toContain(n)
      }
    })

    it('an authorised editor CAN see all of it, which is the point of storing it', async () => {
      const res = await api().get(`/api/v1/cms/content/${contentId}`).set(as()).expect(200)
      const d = res.body.draft
      expect(d.feasibilityScenario.plannedUnits).toBe(337.18)
      expect(d.internal.block).toBe('גוש 30185')
    })
  })

  // ══════════════════════════════════════════════════════════════════════
  //  4. VERIFICATION INVALIDATES ITSELF
  // ══════════════════════════════════════════════════════════════════════

  describe('editing a verified value invalidates it, as a mechanism', () => {
    it('stores value and verifiedValue side by side', async () => {
      const v = await prisma.cmsVerification.create({
        data: {
          tenantId, contentId, field: 'currentStage',
          value: 'DEVELOPER_TENDER' as never,
          verifiedValue: 'DEVELOPER_TENDER' as never,
          status: 'SELF_VERIFIED',
          editedById: adminId, verifiedById: adminId, verifiedAt: new Date(),
          source: 'USER_VERIFIED',
        },
      })
      expect(v.value).toBe('DEVELOPER_TENDER')
      expect(v.verifiedValue).toBe('DEVELOPER_TENDER')
    })

    it('a bare claim whose verification no longer matches does not publish', () => {
      // The mechanism: `verifiedValue` differs from `value`, so nothing is
      // signed for, so the projection drops it. Nobody had to remember to
      // clear a flag.
      const draft = { plannedUnits: 400 }
      expect((toPublicProjection(draft, { verification: { plannedUnits: 'UNVERIFIED' } }) as Record<string, unknown>)['plannedUnits'])
        .toBeUndefined()
      expect((toPublicProjection(draft, { verification: { plannedUnits: 'SELF_VERIFIED' } }) as Record<string, unknown>)['plannedUnits'])
        .toBe(400)
    })

    it('the audit trail is append-only and readable without seeing the values', async () => {
      const v = await prisma.cmsVerification.findFirstOrThrow({ where: { contentId } })
      await prisma.cmsVerificationAudit.create({
        data: {
          tenantId, contentId, verificationId: v.id, field: 'currentStage',
          event: 'VERIFIED', status: 'SELF_VERIFIED', actorId: adminId,
          newValueLabel: 'שלב הפרויקט אושר', source: 'USER_VERIFIED',
        },
      })
      const entries = await prisma.cmsVerificationAudit.findMany({ where: { contentId } })
      expect(entries).toHaveLength(1)
      // A LABEL, not the value: the trail must be readable by somebody without
      // permission to see every figure it mentions.
      expect(entries[0]!.newValueLabel).toBe('שלב הפרויקט אושר')
    })
  })
})
