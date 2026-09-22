/**
 * Entity CRUD E2E — Projects, Buildings, Apartments, Owners, Residents, Users.
 *
 * Per entity this pins: create, update, archive/deactivate, a validation
 * failure, RBAC (insufficient role → 403), tenant isolation (foreign id → 404)
 * and that an AuditLog row was actually written.
 *
 * Tokens are minted with the app's own JwtService (the rbac.e2e-spec approach)
 * so 403 can be distinguished from 401 — a garbage token can only ever produce
 * 401 and would prove nothing about roles.
 *
 * EVERY row created here is removed in `afterAll`. Prior runs left 130 stray
 * `E2E *` projects and 156 orphaned `signing_sessions` rows behind; the cleanup
 * below is deliberately explicit about ordering and about the tables that have
 * no FK to cascade from.
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

const SEED_EMAIL = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'

/** Marker on every row this suite creates, so cleanup can find them all. */
const TAG = `CRUDSPEC-${Date.now().toString(36)}`

/** Ids that belong to no tenant — stand-ins for another tenant's rows. */
const FOREIGN = {
  project: 'prj_not_in_this_tenant',
  building: 'bldg_not_in_this_tenant',
  apartment: 'apt_not_in_this_tenant',
  owner: 'own_not_in_this_tenant',
  resident: 'res_not_in_this_tenant',
  user: 'usr_not_in_this_tenant',
}

describe('Entity CRUD (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let tenantId: string
  let adminUserId: string
  let adminToken: string

  /** A valid token carrying a role that is NOT allowed to write. */
  let observerToken: string

  const created = {
    projectIds: [] as string[],
    complexIds: [] as string[],
    buildingIds: [] as string[],
    apartmentIds: [] as string[],
    ownerIds: [] as string[],
    residentIds: [] as string[],
    userIds: [] as string[],
  }

  const auth = (t = adminToken) => ({ Authorization: `Bearer ${t}` })
  const http = () => request(app.getHttpServer())

  const tokenFor = (role: string) =>
    jwt.sign(
      { sub: adminUserId, email: SEED_EMAIL, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  /** Was an audit row written for this entity/id? */
  const auditCount = async (entity: string, entityId: string, action?: string) =>
    prisma.auditLog.count({
      where: { tenantId, entity, entityId, ...(action ? { action: action as never } : {}) },
    })

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    // Mirrors main.ts, including forbidNonWhitelisted — the mass-assignment
    // guard these DTOs rely on.
    app.useGlobalPipes(
      new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
    )
    await app.init()

    prisma = app.get(PrismaService)

    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
    // Fail loudly rather than silently skipping the suite — a wrong seed
    // password has silently disabled these suites before.
    expect(login.status).toBe(200)
    adminToken = login.body.accessToken
    expect(typeof adminToken).toBe('string')

    jwt = app.get(JwtService, { strict: false })
    const decoded = jwt.decode(adminToken) as any
    tenantId = decoded.tenantId
    adminUserId = decoded.sub
    expect(tenantId).toBeTruthy()

    // MUNICIPALITY_USER is staff (can read) but holds no write role anywhere.
    observerToken = tokenFor('MUNICIPALITY_USER')
  })

  afterAll(async () => {
    if (prisma) {
      // Order matters: children first, and `signing_sessions.recordId` has NO
      // foreign key, so nothing cascades into it.
      const recordIds = created.apartmentIds.length
        ? (await prisma.signatureRecord.findMany({
            where: { apartmentId: { in: created.apartmentIds } },
            select: { id: true },
          })).map((r) => r.id)
        : []
      if (recordIds.length) {
        await prisma.signingSession.deleteMany({ where: { recordId: { in: recordIds } } })
      }

      await prisma.auditLog.deleteMany({
        where: {
          tenantId,
          entityId: {
            in: [
              ...created.projectIds, ...created.buildingIds, ...created.apartmentIds,
              ...created.ownerIds, ...created.residentIds, ...created.userIds,
            ],
          },
        },
      })
      await prisma.residentActivity.deleteMany({
        where: { residentId: { in: created.residentIds } },
      })
      await prisma.resident.deleteMany({ where: { id: { in: created.residentIds } } })
      await prisma.ownerApartment.deleteMany({
        where: { apartmentId: { in: created.apartmentIds } },
      })
      await prisma.owner.deleteMany({ where: { id: { in: created.ownerIds } } })
      await prisma.apartment.deleteMany({ where: { id: { in: created.apartmentIds } } })
      await prisma.building.deleteMany({ where: { id: { in: created.buildingIds } } })
      await prisma.complex.deleteMany({ where: { id: { in: created.complexIds } } })
      await prisma.projectStageHistory.deleteMany({
        where: { projectId: { in: created.projectIds } },
      })
      await prisma.projectMember.deleteMany({ where: { projectId: { in: created.projectIds } } })
      await prisma.project.deleteMany({ where: { id: { in: created.projectIds } } })
      await prisma.session.deleteMany({ where: { userId: { in: created.userIds } } })
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } })

      // Belt and braces: anything tagged that escaped the id lists.
      await prisma.project.deleteMany({ where: { tenantId, name: { contains: TAG } } })
    }
    await app?.close()
  })

  // ── Projects ─────────────────────────────────────────────────────────────

  describe('Projects', () => {
    let projectId: string

    it('creates a project and writes an audit row', async () => {
      const res = await http()
        .post('/api/v1/projects')
        .set(auth())
        .send({ name: `${TAG} פרויקט`, city: 'תל אביב', totalUnits: 12 })
      expect(res.status).toBe(201)
      projectId = res.body.id
      created.projectIds.push(projectId)

      expect(res.body.tenantId).toBe(tenantId)
      expect(res.body.stage).toBe('DISCOVERY')
      expect(await auditCount('Project', projectId, 'CREATE')).toBe(1)
      // The opening stage-history row exists.
      expect(
        await prisma.projectStageHistory.count({ where: { projectId, exitedAt: null } }),
      ).toBe(1)
    })

    it('rejects an invalid payload (400) and an unknown field (400)', async () => {
      const missing = await http().post('/api/v1/projects').set(auth()).send({ city: 'חיפה' })
      expect(missing.status).toBe(400)

      // forbidNonWhitelisted blocks mass assignment: tenantId is not a DTO field.
      const injected = await http()
        .post('/api/v1/projects')
        .set(auth())
        .send({ name: `${TAG} bad`, city: 'חיפה', tenantId: 'some-other-tenant' })
      expect(injected.status).toBe(400)
    })

    it('updates a project', async () => {
      const res = await http()
        .put(`/api/v1/projects/${projectId}`)
        .set(auth())
        .send({ name: `${TAG} פרויקט מעודכן`, city: 'תל אביב' })
      expect(res.status).toBe(200)
      expect(res.body.name).toContain('מעודכן')
      expect(await auditCount('Project', projectId, 'UPDATE')).toBeGreaterThanOrEqual(1)
    })

    it('advances the stage through a validated DTO and rejects a bogus stage', async () => {
      const ok = await http()
        .patch(`/api/v1/projects/${projectId}/stage`)
        .set(auth())
        .send({ stage: 'FEASIBILITY', notes: 'E2E' })
      expect(ok.status).toBe(200)
      expect(ok.body.stage).toBe('FEASIBILITY')

      const bad = await http()
        .patch(`/api/v1/projects/${projectId}/stage`)
        .set(auth())
        .send({ stage: 'NOT_A_REAL_STAGE' })
      expect(bad.status).toBe(400)
    })

    it('assigns a team member and refuses a foreign user id', async () => {
      const ok = await http()
        .patch(`/api/v1/projects/${projectId}/team`)
        .set(auth())
        .send({ projectManagerId: adminUserId })
      expect(ok.status).toBe(200)
      expect(ok.body.projectManager?.id).toBe(adminUserId)

      const foreign = await http()
        .patch(`/api/v1/projects/${projectId}/team`)
        .set(auth())
        .send({ lawyerId: FOREIGN.user })
      expect(foreign.status).toBe(404)
    })

    it('adds and removes a project member', async () => {
      const added = await http()
        .post(`/api/v1/projects/${projectId}/members`)
        .set(auth())
        .send({ userId: adminUserId })
      expect(added.status).toBe(201)
      const memberId = added.body.id
      expect(await auditCount('ProjectMember', memberId, 'CREATE')).toBe(1)

      const dup = await http()
        .post(`/api/v1/projects/${projectId}/members`)
        .set(auth())
        .send({ userId: adminUserId })
      expect(dup.status).toBe(409)

      const removed = await http()
        .delete(`/api/v1/projects/${projectId}/members/${memberId}`)
        .set(auth())
      expect(removed.status).toBe(200)
      await prisma.auditLog.deleteMany({ where: { tenantId, entityId: memberId } })
    })

    it('archives a project (soft — the row survives)', async () => {
      const res = await http()
        .patch(`/api/v1/projects/${projectId}/status`)
        .set(auth())
        .send({ status: 'ARCHIVED', reason: 'E2E' })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ARCHIVED')

      const still = await prisma.project.findUnique({ where: { id: projectId } })
      expect(still).not.toBeNull()
      expect(await auditCount('Project', projectId, 'DELETE')).toBe(1)
    })

    it('refuses a write from a valid token without a write role (403)', async () => {
      const res = await http()
        .post('/api/v1/projects')
        .set(auth(observerToken))
        .send({ name: `${TAG} denied`, city: 'חיפה' })
      // Enforcement is on the endpoint, not on whether the CRM hides a button.
      expect(res.status).toBe(403)
    })

    it('returns 404 for a project in another tenant', async () => {
      expect((await http().get(`/api/v1/projects/${FOREIGN.project}`).set(auth())).status).toBe(404)
      expect(
        (await http().patch(`/api/v1/projects/${FOREIGN.project}/status`).set(auth())
          .send({ status: 'ON_HOLD' })).status,
      ).toBe(404)
    })
  })

  // ── Buildings ────────────────────────────────────────────────────────────

  describe('Buildings', () => {
    let complexId: string
    let buildingId: string

    beforeAll(async () => {
      // A complex of our own, so nothing in the seed data is disturbed.
      const project = await prisma.project.create({
        data: {
          tenantId, code: `${TAG}-B`, name: `${TAG} מבנים`, city: 'תל אביב', address: '',
        },
      })
      created.projectIds.push(project.id)
      const complex = await prisma.complex.create({
        data: { projectId: project.id, name: `${TAG} מתחם` },
      })
      created.complexIds.push(complex.id)
      complexId = complex.id
    })

    it('creates a building and audits it', async () => {
      const res = await http()
        .post('/api/v1/buildings')
        .set(auth())
        .send({
          complexId, address: 'הרצל', streetNumber: '45',
          city: 'תל אביב', floors: 4, constructionYear: 1972,
        })
      expect(res.status).toBe(201)
      buildingId = res.body.id
      created.buildingIds.push(buildingId)
      // Street name and number are separate fields — the list view must not
      // render them concatenated twice.
      expect(res.body.address).toBe('הרצל')
      expect(res.body.streetNumber).toBe('45')
      expect(await auditCount('Building', buildingId, 'CREATE')).toBe(1)
    })

    it('rejects invalid input (400)', async () => {
      const noComplex = await http().post('/api/v1/buildings').set(auth()).send({ address: 'x' })
      expect(noComplex.status).toBe(400)

      const badYear = await http()
        .post('/api/v1/buildings')
        .set(auth())
        .send({ complexId, address: 'x', constructionYear: 99 })
      expect(badYear.status).toBe(400)
    })

    it('updates a building but will NOT re-parent it via update', async () => {
      const ok = await http()
        .patch(`/api/v1/buildings/${buildingId}`)
        .set(auth())
        .send({ floors: 7 })
      expect(ok.status).toBe(200)
      expect(ok.body.floors).toBe(7)

      // `complexId` is not on UpdateBuildingDto — forbidNonWhitelisted rejects it
      // rather than silently moving the building to another project.
      const reparent = await http()
        .patch(`/api/v1/buildings/${buildingId}`)
        .set(auth())
        .send({ complexId: 'some-other-complex' })
      expect(reparent.status).toBe(400)
    })

    it('archives a building and cascades to its apartments', async () => {
      const apt = await prisma.apartment.create({
        data: { buildingId, apartmentNumber: `${TAG}-9` },
      })
      created.apartmentIds.push(apt.id)

      const res = await http().delete(`/api/v1/buildings/${buildingId}`).set(auth())
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('archived')

      const cascaded = await prisma.apartment.findUnique({ where: { id: apt.id } })
      expect(cascaded?.status).toBe('archived')
      expect(await auditCount('Building', buildingId, 'DELETE')).toBe(1)

      // Restore so later assertions run against an active building.
      const restored = await http()
        .patch(`/api/v1/buildings/${buildingId}/status`)
        .set(auth())
        .send({ status: 'active' })
      expect(restored.status).toBe(200)
    })

    it('refuses a write without a manager role (403)', async () => {
      const res = await http()
        .post('/api/v1/buildings')
        .set(auth(observerToken))
        .send({ complexId, address: 'denied' })
      expect(res.status).toBe(403)
    })

    it('returns 404 for a building in another tenant', async () => {
      expect((await http().get(`/api/v1/buildings/${FOREIGN.building}`).set(auth())).status).toBe(404)
      expect(
        (await http().patch(`/api/v1/buildings/${FOREIGN.building}`).set(auth()).send({ floors: 3 }))
          .status,
      ).toBe(404)
    })

    it('bulk archive is transactional and rejects a foreign id without writing', async () => {
      const res = await http()
        .post('/api/v1/buildings/bulk/status')
        .set(auth())
        .send({ ids: [buildingId, FOREIGN.building], status: 'archived' })
      expect(res.status).toBe(404)

      // Nothing was written — the whole batch aborted before the transaction.
      const untouched = await prisma.building.findUnique({ where: { id: buildingId } })
      expect(untouched?.status).toBe('active')
    })
  })

  // ── Apartments + ownership fractions ─────────────────────────────────────

  describe('Apartments and ownership', () => {
    let buildingId: string
    let apartmentId: string
    const ownerIds: string[] = []

    beforeAll(async () => {
      const project = await prisma.project.create({
        data: { tenantId, code: `${TAG}-A`, name: `${TAG} דירות`, city: 'חיפה', address: '' },
      })
      created.projectIds.push(project.id)
      const complex = await prisma.complex.create({
        data: { projectId: project.id, name: `${TAG} מתחם דירות` },
      })
      created.complexIds.push(complex.id)
      const building = await prisma.building.create({
        data: { complexId: complex.id, address: `${TAG} רחוב`, city: 'חיפה' },
      })
      created.buildingIds.push(building.id)
      buildingId = building.id

      for (const n of [1, 2, 3]) {
        const owner = await prisma.owner.create({
          data: { tenantId, fullName: `${TAG} בעלים ${n}` },
        })
        created.ownerIds.push(owner.id)
        ownerIds.push(owner.id)
      }
    })

    it('creates an apartment with thirds — 1/3 + 1/3 + 1/3 is EXACTLY complete', async () => {
      const res = await http()
        .post('/api/v1/apartments')
        .set(auth())
        .send({
          buildingId,
          apartmentNumber: `${TAG}-1`,
          floor: 2,
          rooms: 3.5,
          owners: ownerIds.map((ownerId) => ({
            ownerId, shareNumerator: 1, shareDenominator: 3,
          })),
        })
      expect(res.status).toBe(201)
      apartmentId = res.body.id
      created.apartmentIds.push(apartmentId)
      expect(await auditCount('Apartment', apartmentId, 'CREATE')).toBe(1)

      const read = await http().get(`/api/v1/apartments/${apartmentId}`).set(auth())
      expect(read.status).toBe(200)
      // Exact rational arithmetic — no float, no epsilon.
      expect(read.body.ownershipSum).toEqual({ num: 1, den: 1 })
      expect(read.body.ownershipComplete).toBe(true)
      expect(read.body.owners).toHaveLength(3)
    })

    it('rejects a share set summing above 1 (400) and leaves ownership untouched', async () => {
      const res = await http()
        .put(`/api/v1/apartments/${apartmentId}/owners`)
        .set(auth())
        .send({
          owners: [
            { ownerId: ownerIds[0], shareNumerator: 2, shareDenominator: 3 },
            { ownerId: ownerIds[1], shareNumerator: 2, shareDenominator: 3 },
          ],
        })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('OWNERSHIP_SHARE_SUM_EXCEEDS_ONE')

      const still = await http().get(`/api/v1/apartments/${apartmentId}/owners`).set(auth())
      expect(still.body.owners).toHaveLength(3)
      expect(still.body.sum).toEqual({ num: 1, den: 1 })
    })

    it('rejects the same owner twice on one apartment (400)', async () => {
      const res = await http()
        .put(`/api/v1/apartments/${apartmentId}/owners`)
        .set(auth())
        .send({
          owners: [
            { ownerId: ownerIds[0], shareNumerator: 1, shareDenominator: 2 },
            { ownerId: ownerIds[0], shareNumerator: 1, shareDenominator: 2 },
          ],
        })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('OWNERSHIP_DUPLICATE_OWNER')
    })

    it('999/1000 is incomplete — the missing 1/1000 owner is not rounded away', async () => {
      const res = await http()
        .put(`/api/v1/apartments/${apartmentId}/owners`)
        .set(auth())
        .send({ owners: [{ ownerId: ownerIds[0], shareNumerator: 999, shareDenominator: 1000 }] })
      expect(res.status).toBe(200)
      expect(res.body.sum).toEqual({ num: 999, den: 1000 })
      expect(res.body.isComplete).toBe(false)

      // …and requiring completeness rejects it outright.
      const strict = await http()
        .put(`/api/v1/apartments/${apartmentId}/owners`)
        .set(auth())
        .send({
          owners: [{ ownerId: ownerIds[0], shareNumerator: 999, shareDenominator: 1000 }],
          requireCompleteShares: true,
        })
      expect(strict.status).toBe(400)
      expect(strict.body.code).toBe('OWNERSHIP_SHARE_SUM_INCOMPLETE')
    })

    it('records an ownership audit row for the apartment', async () => {
      expect(await auditCount('ApartmentOwnership', apartmentId)).toBeGreaterThanOrEqual(1)
    })

    it('refuses an ownership write to an apartment in another tenant (404)', async () => {
      const res = await http()
        .put(`/api/v1/apartments/${FOREIGN.apartment}/owners`)
        .set(auth())
        .send({ owners: [] })
      expect(res.status).toBe(404)
    })

    it('refuses an ownership write without a manager role (403)', async () => {
      const res = await http()
        .put(`/api/v1/apartments/${apartmentId}/owners`)
        .set(auth(observerToken))
        .send({ owners: [] })
      expect(res.status).toBe(403)
    })

    it('rejects a duplicate apartment number in the same building (409)', async () => {
      const res = await http()
        .post('/api/v1/apartments')
        .set(auth())
        .send({ buildingId, apartmentNumber: `${TAG}-1` })
      expect(res.status).toBe(409)
    })

    it('updates and then archives an apartment (soft)', async () => {
      const updated = await http()
        .patch(`/api/v1/apartments/${apartmentId}`)
        .set(auth())
        .send({ rooms: 4 })
      expect(updated.status).toBe(200)
      expect(updated.body.rooms).toBe(4)

      const archived = await http().delete(`/api/v1/apartments/${apartmentId}`).set(auth())
      expect(archived.status).toBe(200)
      expect(archived.body.status).toBe('archived')
      expect(await prisma.apartment.findUnique({ where: { id: apartmentId } })).not.toBeNull()
    })
  })

  // ── Owners ───────────────────────────────────────────────────────────────

  describe('Owners', () => {
    let ownerId: string
    // Valid Israeli ID check digits.
    const VALID_ID = '000000018'

    it('creates an owner and never returns the national ID', async () => {
      const res = await http()
        .post('/api/v1/owners')
        .set(auth())
        .send({ fullName: `${TAG} בעלים ראשי`, nationalId: VALID_ID, phone: '0501234567' })
      expect(res.status).toBe(201)
      ownerId = res.body.id
      created.ownerIds.push(ownerId)

      const body = JSON.stringify(res.body)
      expect(body).not.toContain(VALID_ID)
      expect(res.body.nationalId).toBeUndefined()
      expect(await auditCount('Owner', ownerId, 'CREATE')).toBe(1)

      // Stored encrypted, never plaintext.
      const row = await prisma.owner.findUnique({ where: { id: ownerId } })
      expect(row?.nationalId).toBeTruthy()
      expect(row?.nationalId).not.toBe(VALID_ID)
      expect(row?.nationalId?.startsWith('enc:v1:')).toBe(true)

      // The audit row must not carry it either.
      const audits = await prisma.auditLog.findMany({ where: { tenantId, entityId: ownerId } })
      expect(JSON.stringify(audits)).not.toContain(VALID_ID)
    })

    it('detail and list responses expose only a mask', async () => {
      const detail = await http().get(`/api/v1/owners/${ownerId}`).set(auth())
      expect(detail.status).toBe(200)
      expect(detail.body.hasNationalId).toBe(true)
      expect(detail.body.nationalIdMasked).toBe('***-***-****')
      expect(JSON.stringify(detail.body)).not.toContain(VALID_ID)
    })

    it('rejects an invalid national ID (400) without echoing the digits', async () => {
      const res = await http()
        .post('/api/v1/owners')
        .set(auth())
        .send({ fullName: `${TAG} פסול`, nationalId: '123456789' })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('NATIONAL_ID_INVALID')
      expect(JSON.stringify(res.body)).not.toContain('123456789')
    })

    it('detects a duplicate national ID despite differing ciphertexts (409)', async () => {
      const res = await http()
        .post('/api/v1/owners')
        .set(auth())
        .send({ fullName: `${TAG} כפול`, nationalId: VALID_ID })
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('OWNER_NATIONAL_ID_DUPLICATE')
    })

    it('updates an owner', async () => {
      const res = await http()
        .patch(`/api/v1/owners/${ownerId}`)
        .set(auth())
        .send({ fullName: `${TAG} בעלים מעודכן`, isEstate: true })
      expect(res.status).toBe(200)
      expect(res.body.isEstate).toBe(true)
      expect(await auditCount('Owner', ownerId, 'UPDATE')).toBeGreaterThanOrEqual(1)
    })

    it('archives an owner (soft — holdings and signatures survive)', async () => {
      const res = await http().delete(`/api/v1/owners/${ownerId}`).set(auth())
      expect(res.status).toBe(200)
      expect(res.body.isActive).toBe(false)
      expect(await prisma.owner.findUnique({ where: { id: ownerId } })).not.toBeNull()
      expect(await auditCount('Owner', ownerId, 'DELETE')).toBe(1)
    })

    it('refuses a write without a manager role (403)', async () => {
      const res = await http()
        .post('/api/v1/owners')
        .set(auth(observerToken))
        .send({ fullName: `${TAG} denied` })
      expect(res.status).toBe(403)
    })

    it('returns 404 for an owner in another tenant', async () => {
      expect((await http().get(`/api/v1/owners/${FOREIGN.owner}`).set(auth())).status).toBe(404)
      expect(
        (await http().patch(`/api/v1/owners/${FOREIGN.owner}`).set(auth()).send({ fullName: 'x' }))
          .status,
      ).toBe(404)
    })
  })

  // ── Residents (a SEPARATE model from Owner) ──────────────────────────────

  describe('Residents', () => {
    let apartmentId: string
    let residentId: string

    beforeAll(async () => {
      const project = await prisma.project.create({
        data: { tenantId, code: `${TAG}-R`, name: `${TAG} דיירים`, city: 'רמת גן', address: '' },
      })
      created.projectIds.push(project.id)
      const complex = await prisma.complex.create({
        data: { projectId: project.id, name: `${TAG} מתחם דיירים` },
      })
      created.complexIds.push(complex.id)
      const building = await prisma.building.create({
        data: { complexId: complex.id, address: `${TAG} דיירים`, city: 'רמת גן' },
      })
      created.buildingIds.push(building.id)
      const apt = await prisma.apartment.create({
        data: { buildingId: building.id, apartmentNumber: `${TAG}-R1` },
      })
      created.apartmentIds.push(apt.id)
      apartmentId = apt.id
    })

    it('creates a resident, encrypting the national ID and never returning it', async () => {
      const res = await http()
        .post('/api/v1/residents')
        .set(auth())
        .send({
          apartmentId, firstName: `${TAG}`, lastName: 'דייר',
          nationalId: '000000018', phone: '0521234567',
        })
      expect(res.status).toBe(201)
      residentId = res.body.id
      created.residentIds.push(residentId)

      expect(res.body.nationalId).toBeUndefined()
      const row = await prisma.resident.findUnique({ where: { id: residentId } })
      expect(row?.nationalId?.startsWith('enc:v1:')).toBe(true)
      expect(await auditCount('Resident', residentId, 'CREATE')).toBe(1)
    })

    it('updates a resident but cannot move them via update', async () => {
      const ok = await http()
        .patch(`/api/v1/residents/${residentId}`)
        .set(auth())
        .send({ phone: '0529999999' })
      expect(ok.status).toBe(200)

      // apartmentId is omitted from UpdateResidentDto on purpose.
      const move = await http()
        .patch(`/api/v1/residents/${residentId}`)
        .set(auth())
        .send({ apartmentId: 'somewhere-else' })
      expect(move.status).toBe(400)
    })

    it('validates the signature status through a DTO, not @Body(\'status\')', async () => {
      const bad = await http()
        .patch(`/api/v1/residents/${residentId}/signature-status`)
        .set(auth())
        .send({ status: 'NOT_A_STATUS' })
      expect(bad.status).toBe(400)

      const ok = await http()
        .patch(`/api/v1/residents/${residentId}/signature-status`)
        .set(auth())
        .send({ status: 'INTERESTED' })
      expect(ok.status).toBe(200)
      expect(ok.body.signatureStatus).toBe('INTERESTED')
      expect(await auditCount('Resident', residentId, 'UPDATE')).toBeGreaterThanOrEqual(1)
    })

    it('archives a resident (soft — message history survives)', async () => {
      const res = await http().delete(`/api/v1/residents/${residentId}`).set(auth())
      expect(res.status).toBe(200)
      expect(res.body.isActive).toBe(false)
      expect(await prisma.resident.findUnique({ where: { id: residentId } })).not.toBeNull()
    })

    it('refuses a write without a write role (403)', async () => {
      const res = await http()
        .post('/api/v1/residents')
        .set(auth(observerToken))
        .send({ apartmentId, firstName: 'a', lastName: 'b' })
      expect(res.status).toBe(403)
    })

    it('returns 404 for a resident in another tenant', async () => {
      expect(
        (await http().patch(`/api/v1/residents/${FOREIGN.resident}`).set(auth())
          .send({ phone: '0500000000' })).status,
      ).toBe(404)
    })
  })

  // ── Users ────────────────────────────────────────────────────────────────

  describe('Users', () => {
    let userId: string
    const email = `${TAG}@example.test`.toLowerCase()

    it('creates a user without ever returning the password hash', async () => {
      const res = await http()
        .post('/api/v1/users')
        .set(auth())
        .send({
          firstName: 'E2E', lastName: TAG, role: 'FIELD_AGENT',
          email, password: 'a-strong-password-1',
        })
      expect(res.status).toBe(201)
      userId = res.body.id
      created.userIds.push(userId)

      const body = JSON.stringify(res.body)
      expect(res.body.passwordHash).toBeUndefined()
      expect(body).not.toContain('a-strong-password-1')
      expect(body).not.toContain('passwordHash')
      expect(await auditCount('User', userId, 'CREATE')).toBe(1)

      // Hashed with the existing scrypt hasher, never stored raw.
      const row = await prisma.user.findUnique({ where: { id: userId } })
      expect(row?.passwordHash).toBeTruthy()
      expect(row?.passwordHash).not.toBe('a-strong-password-1')
      expect(row?.tenantId).toBe(tenantId)

      const audits = await prisma.auditLog.findMany({ where: { tenantId, entityId: userId } })
      expect(JSON.stringify(audits)).not.toContain('a-strong-password-1')
    })

    it('refuses mass assignment of tenantId / passwordHash (400)', async () => {
      for (const payload of [
        { firstName: 'x', lastName: 'y', role: 'FIELD_AGENT', email: `a-${TAG}@x.test`, tenantId: 'other' },
        { firstName: 'x', lastName: 'y', role: 'FIELD_AGENT', email: `b-${TAG}@x.test`, passwordHash: 'pre-computed' },
        { firstName: 'x', lastName: 'y', role: 'FIELD_AGENT', email: `c-${TAG}@x.test`, isVerified: true },
      ]) {
        const res = await http().post('/api/v1/users').set(auth()).send(payload)
        expect(res.status).toBe(400)
      }
    })

    it('rejects an unknown role and a too-short password (400)', async () => {
      const badRole = await http()
        .post('/api/v1/users')
        .set(auth())
        .send({ firstName: 'x', lastName: 'y', role: 'GOD_MODE', email: `d-${TAG}@x.test` })
      expect(badRole.status).toBe(400)

      const shortPw = await http()
        .post('/api/v1/users')
        .set(auth())
        .send({ firstName: 'x', lastName: 'y', role: 'FIELD_AGENT', email: `e-${TAG}@x.test`, password: 'short' })
      expect(shortPw.status).toBe(400)
    })

    it('rejects a duplicate email in the same tenant (409)', async () => {
      const res = await http()
        .post('/api/v1/users')
        .set(auth())
        .send({ firstName: 'dup', lastName: TAG, role: 'FIELD_AGENT', email })
      expect(res.status).toBe(409)
    })

    it('updates a user and changes their role', async () => {
      const updated = await http()
        .patch(`/api/v1/users/${userId}`)
        .set(auth())
        .send({ firstName: 'E2E-renamed' })
      expect(updated.status).toBe(200)
      expect(updated.body.firstName).toBe('E2E-renamed')
      expect(updated.body.passwordHash).toBeUndefined()

      const role = await http()
        .patch(`/api/v1/users/${userId}/role`)
        .set(auth())
        .send({ role: 'LAWYER' })
      expect(role.status).toBe(200)
      expect(role.body.role).toBe('LAWYER')
    })

    it('lets only a SUPER_ADMIN grant SUPER_ADMIN (403 for COMPANY_ADMIN)', async () => {
      const companyAdmin = tokenFor('COMPANY_ADMIN')
      const res = await http()
        .patch(`/api/v1/users/${userId}/role`)
        .set(auth(companyAdmin))
        .send({ role: 'SUPER_ADMIN' })
      // A COMPANY_ADMIN passes the RolesGuard on this endpoint, so this 403 can
      // only come from the escalation check inside the service.
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('ROLE_ESCALATION_DENIED')
    })

    it('deactivates a user and revokes their sessions', async () => {
      // Created with the real Session columns, and NOT swallowed: if this throws
      // the test must fail loudly. Swallowing it would make the `count === 0`
      // assertion below pass vacuously without ever proving revocation.
      await prisma.session.create({
        data: {
          userId,
          token:        `e2e-access-${Date.now()}`,
          refreshToken: `e2e-refresh-${Date.now()}`,
          expiresAt:    new Date(Date.now() + 60_000),
        },
      })
      expect(await prisma.session.count({ where: { userId } })).toBe(1)

      const res = await http()
        .patch(`/api/v1/users/${userId}/active`)
        .set(auth())
        .send({ isActive: false })
      expect(res.status).toBe(200)
      expect(res.body.isActive).toBe(false)
      expect(await prisma.session.count({ where: { userId } })).toBe(0)
      expect(await auditCount('User', userId, 'DELETE')).toBe(1)

      // Soft: the row survives so the audit trail keeps its author.
      expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull()
    })

    it('refuses self-deactivation', async () => {
      const res = await http()
        .patch(`/api/v1/users/${adminUserId}/active`)
        .set(auth())
        .send({ isActive: false })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('DEACTIVATE_SELF_DENIED')
    })

    it('refuses user management from a non-admin role (403)', async () => {
      const pm = tokenFor('PROJECT_MANAGER')
      expect((await http().get('/api/v1/users').set(auth(pm))).status).toBe(403)
      expect(
        (await http().post('/api/v1/users').set(auth(pm))
          .send({ firstName: 'x', lastName: 'y', role: 'FIELD_AGENT', email: `f-${TAG}@x.test` }))
          .status,
      ).toBe(403)
    })

    it('returns 404 for a user in another tenant', async () => {
      expect((await http().get(`/api/v1/users/${FOREIGN.user}`).set(auth())).status).toBe(404)
      expect(
        (await http().patch(`/api/v1/users/${FOREIGN.user}/active`).set(auth())
          .send({ isActive: false })).status,
      ).toBe(404)
    })
  })
})
