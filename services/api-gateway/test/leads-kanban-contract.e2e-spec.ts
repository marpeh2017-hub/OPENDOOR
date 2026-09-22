/**
 * Leads kanban stage contract (e2e).
 *
 * Regression guard for a Pass 2 browser finding: the CRM kanban board offered a
 * column whose stage string was `WON`, but the Prisma `LeadStatus` enum spells
 * that member `SIGNED`. Nothing in the type system connected the two, so the
 * column silently became a dead drop target — every drag onto it produced a
 * 400 from `PATCH /leads/:id/status`, with no UI feedback.
 *
 * This suite pins the contract from the API side: every stage the kanban can
 * emit must be an accepted status transition. If someone edits the enum (or the
 * board) without updating the other, this fails loudly instead of degrading
 * into an unusable column.
 *
 * Keep KANBAN_STAGES in sync with `COLUMNS` in
 * apps/crm/src/components/leads/leads-kanban.tsx.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL    = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'

/** Mirrors COLUMNS[].stage in the CRM kanban board. */
const KANBAN_STAGES = [
  'NEW',
  'CONTACTED',
  'MEETING_SCHEDULED',
  'INTERESTED',
  'NEGOTIATION',
  'SIGNED',
  'LOST',
]

describe('Leads kanban stage contract (e2e)', () => {
  let app: INestApplication
  let token: string | undefined
  let leadId: string
  let originalStatus: string
  let prisma: PrismaService
  /** Watermark so teardown only removes rows this run created. */
  let startedAt: Date

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

    // Fail loudly rather than silently skipping the whole suite.
    expect(login.status).toBe(200)
    token = login.body.accessToken
    expect(typeof token).toBe('string')

    const list = await request(app.getHttpServer())
      .get('/api/v1/leads?limit=1')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.data.length).toBeGreaterThan(0)

    leadId         = list.body.data[0].id
    originalStatus = list.body.data[0].status

    prisma    = app.get(PrismaService, { strict: false })
    startedAt = new Date()
  })

  afterAll(async () => {
    // Leave the seed row exactly as we found it.
    if (app && token && leadId && originalStatus) {
      await request(app.getHttpServer())
        .patch(`/api/v1/leads/${leadId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: originalStatus })
    }

    // Each accepted transition writes a `status_change` activity row. Without
    // this the table grows by ~8 rows on every test run.
    if (prisma && leadId && startedAt) {
      await prisma.leadActivity.deleteMany({
        where: { leadId, type: 'status_change', createdAt: { gte: startedAt } },
      })
    }

    await app?.close()
  })

  const auth = () => ({ Authorization: `Bearer ${token}` })

  it.each(KANBAN_STAGES)(
    'PATCH /leads/:id/status accepts the kanban stage %s',
    async (stage) => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/leads/${leadId}/status`)
        .set(auth())
        .send({ status: stage })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe(stage)
    },
  )

  it('rejects a stage that is not a LeadStatus member', async () => {
    // 'WON' is precisely the bug that motivated this suite: plausible-looking,
    // but not a member of the enum.
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/leads/${leadId}/status`)
      .set(auth())
      .send({ status: 'WON' })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  it('requires authentication', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/leads/${leadId}/status`)
      .send({ status: 'NEW' })

    expect(res.status).toBe(401)
  })
})
