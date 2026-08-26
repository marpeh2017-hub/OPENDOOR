import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test, TestingModule } from '@nestjs/testing'
import { randomUUID } from 'crypto'
import Decimal from 'decimal.js'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { annualizeMonthlyRate, irr, monthlyRateFromAnnual, npv } from '../src/feasibility/financial-math'
import { PrismaService } from '../src/prisma.service'
import { DataQualityEngine } from '../src/data-quality/data-quality.engine'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const MARKER = `FEAS-${Date.now().toString(36)}`
const deletedFixtureIds: string[] = []

describe('Feasibility foundation (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let dataQuality: DataQualityEngine
  let jwt: JwtService
  let tenantId: string
  let userId: string
  let token: string
  let projectId: string
  let ownerId: string
  let ownerApartmentId: string

  const http = () => request(app.getHttpServer())
  const auth = (value = token) => ({ Authorization: `Bearer ${value}` })
  const tokenFor = (role: string, scopeTenant = tenantId) => jwt.sign({
    sub: userId, userId, tenantId: scopeTenant, role, sessionId: randomUUID(),
  }, { secret: process.env.JWT_SECRET, expiresIn: '10m' })

  it('uses Decimal-only NPV and IRR math with no floating point decision path', () => {
    const monthly = irr(['-1000', '550', '550'])
    expect(monthly).not.toBeNull()
    expect(npv(['-1000', '550', '550'], monthly!).abs().lte('0.00000001')).toBe(true)
    const annual = annualizeMonthlyRate(monthly!)
    expect(monthlyRateFromAnnual(annual).minus(monthly!).abs().lte('0.00000001')).toBe(true)
    expect(irr(['100', '200'])).toBeNull()
    expect(new Decimal('0.1').plus('0.2').toString()).toBe('0.3')
  })

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    prisma = app.get(PrismaService)
    dataQuality = app.get(DataQualityEngine)

    const login = await http().post('/api/v1/auth/login').send({ email: 'admin@opendoor.co.il', password: 'demo1234' })
    expect(login.status).toBe(200)
    token = login.body.accessToken
    jwt = app.get(JwtService, { strict: false })
    const payload = jwt.decode(token) as { tenantId: string; sub: string }
    tenantId = payload.tenantId
    userId = payload.sub
    const project = await prisma.project.create({
      data: { tenantId, code: MARKER, name: MARKER, city: 'ירושלים', stage: 'FEASIBILITY' },
    })
    projectId = project.id
    const complex = await prisma.complex.create({ data: { projectId, name: MARKER } })
    const building = await prisma.building.create({ data: { complexId: complex.id, address: 'כתובת בדיקה' } })
    const apartment = await prisma.apartment.create({ data: { buildingId: building.id, apartmentNumber: '1' } })
    const owner = await prisma.owner.create({ data: { tenantId, fullName: MARKER } })
    ownerId = owner.id
    const holding = await prisma.ownerApartment.create({ data: { ownerId, apartmentId: apartment.id } })
    ownerApartmentId = holding.id
  })

  afterAll(async () => {
    if (prisma && projectId) {
      const profile = await prisma.feasibilityProfile.findFirst({ where: { projectId } })
      if (profile) {
        const [parcels, sources, assumptions, areas, rights, scenarios] = await Promise.all([
          prisma.gushChelkaRecord.findMany({ where: { feasibilityProfileId: profile.id }, select: { id: true } }),
          prisma.feasibilitySource.findMany({ where: { feasibilityProfileId: profile.id }, select: { id: true } }),
          prisma.feasibilityAssumption.findMany({ where: { feasibilityProfileId: profile.id }, select: { id: true } }),
          prisma.feasibilityAreaLine.findMany({ where: { feasibilityProfileId: profile.id }, select: { id: true } }),
          prisma.planningRight.findMany({ where: { feasibilityProfileId: profile.id }, select: { id: true } }),
          prisma.feasibilityScenario.findMany({ where: { feasibilityProfileId: profile.id }, select: { id: true } }),
        ])
        const unitMix = scenarios.length
          ? await prisma.feasibilityUnitMixLine.findMany({ where: { scenarioId: { in: scenarios.map((row) => row.id) } }, select: { id: true } })
          : []
        const scenarioIds = scenarios.map((row) => row.id)
        const [revenue, costs, timeline, financing, allocations, compensations, snapshots, reportVersions] = scenarioIds.length ? await Promise.all([
          prisma.feasibilityRevenueLine.findMany({ where: { scenarioId: { in: scenarioIds } }, select: { id: true } }),
          prisma.feasibilityCostLine.findMany({ where: { scenarioId: { in: scenarioIds } }, select: { id: true } }),
          prisma.feasibilityTimelinePhase.findMany({ where: { scenarioId: { in: scenarioIds } }, select: { id: true } }),
          prisma.feasibilityFinancingAssumption.findMany({ where: { scenarioId: { in: scenarioIds } }, select: { id: true } }),
          prisma.feasibilityCashFlowAllocation.findMany({ where: { scenarioId: { in: scenarioIds } }, select: { id: true } }),
          prisma.feasibilityCompensationLine.findMany({ where: { scenarioId: { in: scenarioIds } }, select: { id: true } }),
          prisma.feasibilityCalculationSnapshot.findMany({ where: { scenarioId: { in: scenarioIds } }, select: { id: true } }),
          prisma.feasibilityReportVersion.findMany({ where: { feasibilityProfileId: profile.id }, select: { id: true } }),
        ]) : [[], [], [], [], [], [], [], []]
        await prisma.auditLog.deleteMany({
          where: {
            tenantId,
            entityId: { in: [profile.id, ...parcels, ...sources, ...assumptions, ...areas, ...rights, ...scenarios, ...unitMix, ...revenue, ...costs, ...timeline, ...financing, ...allocations, ...compensations, ...snapshots, ...reportVersions, ...deletedFixtureIds].map((row) => typeof row === 'string' ? row : row.id) },
          },
        })
        await prisma.feasibilityReportVersion.deleteMany({ where: { feasibilityProfileId: profile.id } })
        await prisma.feasibilityProfile.delete({ where: { id: profile.id } })
      }
      await prisma.project.delete({ where: { id: projectId } })
      await prisma.owner.delete({ where: { id: ownerId } })
    }
    await app?.close()
  })

  it('creates a tenant-scoped source profile and writes an audit row', async () => {
    const res = await http().post(`/api/v1/projects/${projectId}/feasibility`).set(auth()).send({
      projectType: 'TAMA_38_1', purpose: 'בדיקת כדאיות ראשונית', valuationDate: '2026-08-25', reportDate: '2026-08-25',
    })
    expect(res.status).toBe(201)
    expect(res.body.projectId).toBe(projectId)
    const profile = await prisma.feasibilityProfile.findUniqueOrThrow({ where: { projectId } })
    expect(profile.tenantId).toBe(tenantId)
    expect(await prisma.auditLog.count({ where: { tenantId, entity: 'FeasibilityProfile', entityId: profile.id, action: 'CREATE' } })).toBe(1)
    const readiness = await dataQuality.detect(tenantId, projectId)
    expect(readiness.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ issueType: 'FEASIBILITY_BASE_SCENARIO_MISSING', entityId: projectId }),
    ]))
  })

  it('accepts sources, exact decimal areas and planning-right inputs', async () => {
    const source = await http().post(`/api/v1/projects/${projectId}/feasibility/sources`).set(auth()).send({ type: 'PLANNING', title: 'תכנית תקפה', reliability: 'HIGH' })
    expect(source.status).toBe(201)
    const parcel = await http().post(`/api/v1/projects/${projectId}/feasibility/parcels`).set(auth()).send({ gush: '12345', chelka: '67', landAreaSqm: '500.0000', sourceId: source.body.id, classification: 'SOURCE_DATA' })
    expect(parcel.status).toBe(201)
    const parcelUpdate = await http().patch(`/api/v1/projects/${projectId}/feasibility/parcels/${parcel.body.id}`).set(auth()).send({ address: 'כתובת מעודכנת' })
    expect(parcelUpdate.status).toBe(200)
    expect(parcelUpdate.body.address).toBe('כתובת מעודכנת')
    const foreignParcelUpdate = await http().patch(`/api/v1/projects/${projectId}/feasibility/parcels/${parcel.body.id}`).set(auth(tokenFor('PROJECT_MANAGER', `foreign-${tenantId}`))).send({ address: 'שגוי' })
    expect(foreignParcelUpdate.status).toBe(404)
    const sourceInUseDelete = await http().delete(`/api/v1/projects/${projectId}/feasibility/sources/${source.body.id}`).set(auth())
    expect(sourceInUseDelete.status).toBe(409)
    const disposableSource = await http().post(`/api/v1/projects/${projectId}/feasibility/sources`).set(auth()).send({ type: 'USER', title: 'מקור למחיקה' })
    expect(disposableSource.status).toBe(201)
    const sourceUpdate = await http().patch(`/api/v1/projects/${projectId}/feasibility/sources/${disposableSource.body.id}`).set(auth()).send({ title: 'מקור מעודכן' })
    expect(sourceUpdate.status).toBe(200)
    expect(sourceUpdate.body.title).toBe('מקור מעודכן')
    const deletedSource = await http().delete(`/api/v1/projects/${projectId}/feasibility/sources/${disposableSource.body.id}`).set(auth())
    expect(deletedSource.status).toBe(200)
    deletedFixtureIds.push(disposableSource.body.id)
    const area = await http().post(`/api/v1/projects/${projectId}/feasibility/areas`).set(auth()).send({ areaType: 'GROSS', valueSqm: '1234.5678', sourceId: source.body.id, classification: 'SOURCE_DATA' })
    expect(area.status).toBe(201)
    const right = await http().post(`/api/v1/projects/${projectId}/feasibility/planning-rights`).set(auth()).send({ category: 'מגורים', status: 'APPROVED', areaSqm: '1200.0000', unitCount: 24, sourceId: source.body.id })
    expect(right.status).toBe(201)
    const comparable = await http().post(`/api/v1/projects/${projectId}/feasibility/comparables`).set(auth()).send({ address: 'רחוב בדיקה 1', transactionDate: '2026-01-15', transactionPrice: '3000000', saleableAreaSqm: '100', sourceId: source.body.id, reliability: 'HIGH' })
    expect(comparable.status).toBe(201)
    const adjustment = await http().post(`/api/v1/projects/${projectId}/feasibility/comparables/${comparable.body.id}/adjustments`).set(auth()).send({ category: 'LOCATION', factor: '1.05000000', sourceId: source.body.id, confidence: 'HIGH' })
    expect(adjustment.status).toBe(201)
    const invalidAdjustment = await http().post(`/api/v1/projects/${projectId}/feasibility/comparables/${comparable.body.id}/adjustments`).set(auth()).send({ category: 'TIME', factor: '0' })
    expect(invalidAdjustment.status).toBe(400)
    const invalidComparable = await http().post(`/api/v1/projects/${projectId}/feasibility/comparables`).set(auth()).send({ address: 'רחוב שגוי', transactionDate: '2026-01-15', transactionPrice: '0', saleableAreaSqm: '100' })
    expect(invalidComparable.status).toBe(400)
    const updatedComparable = await http().patch(`/api/v1/projects/${projectId}/feasibility/comparables/${comparable.body.id}`).set(auth()).send({ transactionPrice: '3100000' })
    expect(updatedComparable.status).toBe(200)
    const updatedAdjustment = await http().patch(`/api/v1/projects/${projectId}/feasibility/comparables/${comparable.body.id}/adjustments/${adjustment.body.id}`).set(auth()).send({ factor: '1.04000000' })
    expect(updatedAdjustment.status).toBe(200)
    const foreignComparableUpdate = await http().patch(`/api/v1/projects/${projectId}/feasibility/comparables/${comparable.body.id}`).set(auth(tokenFor('PROJECT_MANAGER', `foreign-${tenantId}`))).send({ transactionPrice: '1' })
    expect(foreignComparableUpdate.status).toBe(404)
    const profile = await http().get(`/api/v1/projects/${projectId}/feasibility`).set(auth())
    expect(profile.status).toBe(200)
    expect(profile.body.areas[0].valueSqm).toBe('1234.5678')
    expect(profile.body.planningRights[0].status).toBe('APPROVED')
    expect(profile.body.comparableTransactions).toEqual(expect.arrayContaining([expect.objectContaining({ id: comparable.body.id, transactionPrice: '3100000', adjustments: [expect.objectContaining({ category: 'LOCATION', factor: '1.04' })] })]))
  })

  it('rejects negative financial inputs and foreign source ids', async () => {
    const negative = await http().post(`/api/v1/projects/${projectId}/feasibility/areas`).set(auth()).send({ areaType: 'GROSS', valueSqm: '-1' })
    expect(negative.status).toBe(400)
    const foreign = await http().post(`/api/v1/projects/${projectId}/feasibility/assumptions`).set(auth()).send({ key: 'sale-price', label: 'מחיר מכירה', value: '1', sourceId: 'src_foreign' })
    expect(foreign.status).toBe(404)
  })

  it('keeps scenarios independent, clones their unit mix, and chooses unique copy names', async () => {
    const sourceProfile = await http().get(`/api/v1/projects/${projectId}/feasibility`).set(auth())
    const sourceId = sourceProfile.body.sources[0].id
    const base = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios`).set(auth()).send({
      name: 'בסיס', kind: 'BASE', probability: '0.500000',
    })
    expect(base.status).toBe(201)
    expect(base.body.isBaseline).toBe(true)

    const unitMix = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${base.body.id}/unit-mix`).set(auth()).send({
      label: '4 חדרים', unitCount: 12, saleableAreaSqm: '100.1250', pricePerSqm: '30000.0000', adjustmentFactor: '1.00000000', sourceId,
    })
    expect(unitMix.status).toBe(201)
    // Decimal values retain their exact numeric value; PostgreSQL may omit
    // non-significant trailing zeroes when serialising them.
    expect(unitMix.body.saleableAreaSqm).toBe('100.125')
    const updatedUnitMix = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${base.body.id}/unit-mix/${unitMix.body.id}`).set(auth()).send({ saleableAreaSqm: '101.1250' })
    expect(updatedUnitMix.status).toBe(200)
    expect(updatedUnitMix.body.saleableAreaSqm).toBe('101.125')
    const foreignUnitMixUpdate = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${base.body.id}/unit-mix/${unitMix.body.id}`).set(auth(tokenFor('PROJECT_MANAGER', `foreign-${tenantId}`))).send({ saleableAreaSqm: '1' })
    expect(foreignUnitMixUpdate.status).toBe(404)
    const disposableUnitMix = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${base.body.id}/unit-mix`).set(auth()).send({ label: 'שורה למחיקה', unitCount: 1 })
    expect(disposableUnitMix.status).toBe(201)
    const deletedUnitMix = await http().delete(`/api/v1/projects/${projectId}/feasibility/scenarios/${base.body.id}/unit-mix/${disposableUnitMix.body.id}`).set(auth())
    expect(deletedUnitMix.status).toBe(200)
    expect(deletedUnitMix.body).toEqual({ id: disposableUnitMix.body.id, deleted: true })
    deletedFixtureIds.push(disposableUnitMix.body.id)

    const firstCopy = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${base.body.id}/duplicate`).set(auth()).send()
    const secondCopy = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${base.body.id}/duplicate`).set(auth()).send()
    expect(firstCopy.status).toBe(201)
    expect(secondCopy.status).toBe(201)
    expect(firstCopy.body.name).toBe('בסיס — עותק')
    expect(secondCopy.body.name).toBe('בסיס — עותק 2')
    // Keep the edited value in both copies, then restore the base fixture so
    // later calculation assertions remain independent of this CRUD test.
    const restoredUnitMix = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${base.body.id}/unit-mix/${unitMix.body.id}`).set(auth()).send({ saleableAreaSqm: '100.1250' })
    expect(restoredUnitMix.status).toBe(200)

    const profile = await http().get(`/api/v1/projects/${projectId}/feasibility`).set(auth())
    expect(profile.status).toBe(200)
    expect(profile.body.scenarios).toHaveLength(3)
    const copied = profile.body.scenarios.find((scenario: { id: string }) => scenario.id === firstCopy.body.id)
    expect(copied.unitMix).toHaveLength(1)
    expect(copied.unitMix[0].saleableAreaSqm).toBe('101.125')
    expect(profile.body.scenarios.filter((scenario: { isBaseline: boolean }) => scenario.isBaseline)).toHaveLength(1)
  })

  it('stores one validated revenue/cost basis plus financing and timeline inputs', async () => {
    const profile = await http().get(`/api/v1/projects/${projectId}/feasibility`).set(auth())
    const scenarioId = profile.body.scenarios.find((scenario: { isBaseline: boolean }) => scenario.isBaseline).id
    const sourceId = profile.body.sources[0].id
    // The fixture has a residential programme plus a commercial component;
    // add the second building's gross area so the reconciliation represents a
    // physically possible complex before testing report approval.
    const secondBuildingGrossArea = await http().post(`/api/v1/projects/${projectId}/feasibility/areas`).set(auth()).send({ areaType: 'GROSS', label: 'מבנה נוסף', valueSqm: '1000.0000', sourceId, classification: 'SOURCE_DATA' })
    expect(secondBuildingGrossArea.status).toBe(201)

    const missingRevenueBasis = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines`).set(auth()).send({ category: 'COMMERCIAL', label: 'מסחר' })
    expect(missingRevenueBasis.status).toBe(400)
    const invalidCapitalizationRate = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines`).set(auth()).send({ category: 'COMMERCIAL', label: 'NOI שגוי', annualNoi: '120000', capitalizationRate: '0' })
    expect(invalidCapitalizationRate.status).toBe(400)
    const vatIncludedRevenue = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines`).set(auth()).send({ category: 'COMMERCIAL', label: 'מסחר כולל מע״מ', saleableAreaSqm: '1', pricePerSqm: '1', vatTreatment: 'VAT_INCLUDED' })
    expect(vatIncludedRevenue.status).toBe(400)
    const revenue = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines`).set(auth()).send({ category: 'COMMERCIAL', label: 'מסחר', saleableAreaSqm: '250.5000', pricePerSqm: '24000.0000', sourceId, vatTreatment: 'VAT_EXCLUDED' })
    expect(revenue.status).toBe(201)
    expect(revenue.body.saleableAreaSqm).toBe('250.5')

    const conflictingCostBasis = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cost-lines`).set(auth()).send({ category: 'CONSTRUCTION', label: 'שלד', quantity: '100', unitCost: '5000', fixedAmount: '1' })
    expect(conflictingCostBasis.status).toBe(400)
    const cost = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cost-lines`).set(auth()).send({ category: 'CONSTRUCTION', label: 'שלד', quantity: '100.0000', unit: 'sqm', unitCost: '5000.0000', sourceId, vatTreatment: 'VAT_EXCLUDED' })
    expect(cost.status).toBe(201)
    const revenueEdit = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines/${revenue.body.id}`).set(auth()).send({ pricePerSqm: '25000.0000' })
    expect(revenueEdit.status).toBe(200)
    expect(revenueEdit.body.pricePerSqm).toBe('25000')
    const costEdit = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cost-lines/${cost.body.id}`).set(auth()).send({ unitCost: '5100.0000' })
    expect(costEdit.status).toBe(200)
    expect(costEdit.body.unitCost).toBe('5100')
    const crossTenantEdit = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cost-lines/${cost.body.id}`).set(auth(tokenFor('PROJECT_MANAGER', `foreign-${tenantId}`))).send({ unitCost: '1' })
    expect(crossTenantEdit.status).toBe(404)
    await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines/${revenue.body.id}`).set(auth()).send({ pricePerSqm: '24000' })
    await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cost-lines/${cost.body.id}`).set(auth()).send({ unitCost: '5000' })
    const disposableRevenue = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines`).set(auth()).send({ category: 'OTHER', label: 'שורת בדיקה למחיקה', quantity: '1', fixedUnitPrice: '1', vatTreatment: 'VAT_EXCLUDED' })
    expect(disposableRevenue.status).toBe(201)
    const deletedRevenue = await http().delete(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines/${disposableRevenue.body.id}`).set(auth())
    expect(deletedRevenue.status).toBe(200)
    expect(deletedRevenue.body).toEqual({ id: disposableRevenue.body.id, deleted: true })
    deletedFixtureIds.push(disposableRevenue.body.id)
    const financing = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/financing`).set(auth()).send({ debtAmount: '1000000', annualInterestRate: '0.050000', financingMonths: 36 })
    expect(financing.status).toBe(200)
    const discountRate = await http().post(`/api/v1/projects/${projectId}/feasibility/assumptions`).set(auth()).send({ key: 'annual-discount-rate', label: 'שיעור היוון שנתי', value: '0.080000', unit: 'fraction' })
    expect(discountRate.status).toBe(201)
    const comparisonArea = await http().post(`/api/v1/projects/${projectId}/feasibility/assumptions`).set(auth()).send({ key: 'comparison-subject-area-sqm', label: 'שטח נושא השומה להשוואה', value: '120', unit: 'sqm', sourceId })
    expect(comparisonArea.status).toBe(201)
    const areaTolerance = await http().post(`/api/v1/projects/${projectId}/feasibility/assumptions`).set(auth()).send({ key: 'area-reconciliation-tolerance-sqm', label: 'סף סטיית שטחים', value: '1', unit: 'sqm', sourceId })
    expect(areaTolerance.status).toBe(201)
    const profitTarget = await http().post(`/api/v1/projects/${projectId}/feasibility/assumptions`).set(auth()).send({ key: 'minimum-profit-margin', label: 'יעד רווחיות מינימלי', value: '0.99', unit: 'fraction', sourceId })
    expect(profitTarget.status).toBe(201)
    const mainArea = await http().post(`/api/v1/projects/${projectId}/feasibility/areas`).set(auth()).send({ areaType: 'MAIN', label: 'שטח עיקרי', valueSqm: '100', sourceId, classification: 'SOURCE_DATA' })
    const serviceArea = await http().post(`/api/v1/projects/${projectId}/feasibility/areas`).set(auth()).send({ areaType: 'SERVICE', label: 'שטח שירות', valueSqm: '100', sourceId, classification: 'SOURCE_DATA' })
    expect(mainArea.status).toBe(201)
    expect(serviceArea.status).toBe(201)
    const invalidTimeline = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/timeline-phases`).set(auth()).send({ kind: 'CONSTRUCTION', label: 'ביצוע', startDate: '2028-01-01', endDate: '2027-01-01' })
    expect(invalidTimeline.status).toBe(400)
    const timeline = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/timeline-phases`).set(auth()).send({ kind: 'CONSTRUCTION', label: 'ביצוע', startDate: '2027-01-01', endDate: '2028-01-01' })
    expect(timeline.status).toBe(201)
    const dependentTimeline = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/timeline-phases`).set(auth()).send({ kind: 'MARKETING', label: 'שיווק', dependencyPhaseId: timeline.body.id })
    expect(dependentTimeline.status).toBe(201)
    const blockedTimelineDelete = await http().delete(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/timeline-phases/${timeline.body.id}`).set(auth())
    expect(blockedTimelineDelete.status).toBe(409)
    const dependentTimelineDelete = await http().delete(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/timeline-phases/${dependentTimeline.body.id}`).set(auth())
    expect(dependentTimelineDelete.status).toBe(200)

    const read = await http().get(`/api/v1/projects/${projectId}/feasibility`).set(auth())
    const scenario = read.body.scenarios.find((row: { id: string }) => row.id === scenarioId)
    expect(scenario.revenueLines).toHaveLength(1)
    expect(scenario.costLines).toHaveLength(1)
    expect(scenario.financing.annualInterestRate).toBe('0.05')
    expect(scenario.timelinePhases).toHaveLength(1)

    const calculation = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/calculate`).set(auth()).send()
    expect(calculation.status).toBe(201)
    expect(calculation.body.engineVersion).toBe('1.0.0')
    expect(calculation.body.revenue.total).toBe('42057000.00')
    expect(calculation.body.costs.total).toBe('500000.00')
    expect(calculation.body.profitability.profitBeforeFinancing).toBe('41557000.00')
    expect(calculation.body.profitability.profit).toBe('41557000.00')
    expect(calculation.body.dataQuality.confidenceScore).toBe(100)
    expect(calculation.body.traceability.profit).toMatchObject({ formula: 'סך הכנסות − סך עלויות כולל מימון', amount: '41557000.00' })
    expect(calculation.body.traceability.revenue.inputs).toEqual(expect.arrayContaining([expect.objectContaining({ id: revenue.body.id, formula: 'שטח מכירה × מחיר למ״ר' })]))
    expect(calculation.body.profitability.isFinal).toBe(false)
    expect(calculation.body.returns.discountRateAnnual).toBe('0.08')
    expect(calculation.body.returns.projectNpv).not.toBeNull()
    expect(calculation.body.valuation.comparison).toMatchObject({ comparableCount: 1, averageAdjustedPricePerSqm: '32240.00', subjectAreaSqm: '120', value: '3868800.00' })
    expect(calculation.body.validation).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PARCEL_EVIDENCE_MISSING' }),
      expect.objectContaining({ code: 'AREA_EVIDENCE_MISSING' }),
      expect.objectContaining({ code: 'PLANNING_RIGHT_EVIDENCE_MISSING' }),
    ]))
    expect(calculation.body.validation).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'COMPARABLE_SAMPLE_THIN', severity: 'WARNING' })]))
    expect(calculation.body.validation).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'AREA_RECONCILIATION_MISMATCH', severity: 'WARNING' })]))
    expect(calculation.body.validation).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PROFIT_MARGIN_BELOW_TARGET', severity: 'WARNING' })]))

    const sensitivity = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/sensitivity`).set(auth()).send({ primaryVariable: 'SALE_PRICE', primaryChanges: ['-10', '0', '10'], secondaryVariable: 'CONSTRUCTION_COST', secondaryChanges: ['0', '10'] })
    expect(sensitivity.status).toBe(201)
    expect(sensitivity.body.rows).toHaveLength(3)
    expect(sensitivity.body.rows[1].values[0].profit).toBe('41557000.00')
    const oneVariableSensitivity = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/sensitivity`).set(auth()).send({ primaryVariable: 'CONSTRUCTION_COST', primaryChanges: ['-10', '0', '10'] })
    expect(oneVariableSensitivity.status).toBe(201)
    expect(oneVariableSensitivity.body.secondaryVariable).toBeNull()
    expect(oneVariableSensitivity.body.rows).toEqual(expect.arrayContaining([expect.objectContaining({ primaryChangePercent: '-10', profit: '41607000.00' })]))
    // Keep cash-flow fixture setup before export assertions. A failed export
    // must not leave subsequent tests with a partially prepared scenario.
    const invalidMonth = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations`).set(auth()).send({ periodStart: '2027-01-02', direction: 'INFLOW', sourceKind: 'REVENUE', sourceLineId: revenue.body.id, label: 'מכירות מסחר', amount: '6012000' })
    expect(invalidMonth.status).toBe(400)
    const disposableAllocation = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations`).set(auth()).send({ periodStart: '2027-01-01', direction: 'OUTFLOW', sourceKind: 'OTHER', label: 'הקצאה למחיקה', amount: '1' })
    expect(disposableAllocation.status).toBe(201)
    const editableAllocation = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations/${disposableAllocation.body.id}`).set(auth()).send({ periodStart: '2027-02-01', label: 'הקצאה מעודכנת', amount: '2' })
    expect(editableAllocation.status).toBe(200)
    expect(editableAllocation.body).toMatchObject({ label: 'הקצאה מעודכנת', amount: '2' })
    const immutableAllocation = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations/${disposableAllocation.body.id}`).set(auth()).send({ direction: 'INFLOW' })
    expect(immutableAllocation.status).toBe(400)
    const disposableAllocationDelete = await http().delete(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations/${disposableAllocation.body.id}`).set(auth())
    expect(disposableAllocationDelete.status).toBe(200)
    deletedFixtureIds.push(disposableAllocation.body.id, dependentTimeline.body.id)
    const revenueAllocation = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations`).set(auth()).send({ periodStart: '2027-01-01', direction: 'INFLOW', sourceKind: 'REVENUE', sourceLineId: revenue.body.id, label: 'מכירות מסחר', amount: '6012000' })
    const costAllocation = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations`).set(auth()).send({ periodStart: '2027-01-01', direction: 'OUTFLOW', sourceKind: 'COST', sourceLineId: cost.body.id, label: 'שלד', amount: '500000' })
    expect(revenueAllocation.status).toBe(201)
    expect(costAllocation.status).toBe(201)
    const linkedCostDelete = await http().delete(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cost-lines/${cost.body.id}`).set(auth())
    expect(linkedCostDelete.status).toBe(409)
    const cashFlowCalculation = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/calculate`).set(auth()).send()
    expect(cashFlowCalculation.status).toBe(201)
    expect(cashFlowCalculation.body.cashFlow.periods).toEqual([{ periodStart: '2027-01-01', inflows: '6012000.00', outflows: '500000.00', net: '5512000.00', cumulative: '5512000.00' }])
    expect(cashFlowCalculation.body.cashFlow.reconciliationComplete).toBe(false)
    const snapshot = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/snapshots`).set(auth()).send({
      sensitivity: { primaryVariable: 'SALE_PRICE', primaryChanges: ['-10', '0', '10'], secondaryVariable: 'CONSTRUCTION_COST', secondaryChanges: ['0', '10'] },
    })
    expect(snapshot.status).toBe(201)
    const snapshots = await http().get(`/api/v1/projects/${projectId}/feasibility/snapshots`).set(auth())
    expect(snapshots.status).toBe(200)
    expect(snapshots.body[0]).toMatchObject({ id: snapshot.body.id, scenarioId, engineVersion: '1.0.0' })

    const report = await http().post(`/api/v1/projects/${projectId}/feasibility/reports`).set(auth()).send({ snapshotId: snapshot.body.id, title: 'דוח אפס — טיוטה' })
    expect(report.status).toBe(201)
    expect(report.body).toMatchObject({ version: 1, status: 'DRAFT', snapshotId: snapshot.body.id })
    const reports = await http().get(`/api/v1/projects/${projectId}/feasibility/reports`).set(auth())
    expect(reports.status).toBe(200)
    expect(reports.body).toHaveLength(1)
    const frozenReport = await http().get(`/api/v1/projects/${projectId}/feasibility/reports/${report.body.id}`).set(auth())
    expect(frozenReport.status).toBe(200)
    expect(frozenReport.body.snapshot.outputSnapshot).toMatchObject({ engineVersion: '1.0.0', profitability: { profit: '41557000.00' } })
    expect(frozenReport.body.comparisonSnapshot).toMatchObject({
      scenarios: expect.arrayContaining([
        expect.objectContaining({ scenarioId, snapshotId: snapshot.body.id, engineVersion: '1.0.0', output: expect.objectContaining({ profitability: expect.objectContaining({ profit: '41557000.00' }) }) }),
      ]),
    })
    expect(frozenReport.body.snapshot.sensitivitySnapshot).toMatchObject({ primaryVariable: 'SALE_PRICE', secondaryVariable: 'CONSTRUCTION_COST' })
    for (const status of ['REVIEW', 'APPROVED', 'LOCKED']) {
      const transition = await http().patch(`/api/v1/projects/${projectId}/feasibility/reports/${report.body.id}/status`).set(auth()).send({ status })
      expect(transition.status).toBe(200)
      expect(transition.body.status).toBe(status)
    }
    const invalidTransition = await http().patch(`/api/v1/projects/${projectId}/feasibility/reports/${report.body.id}/status`).set(auth()).send({ status: 'REVIEW' })
    expect(invalidTransition.status).toBe(409)
    const excel = await http().post(`/api/v1/projects/${projectId}/feasibility/reports/${report.body.id}/export/excel`).set(auth()).buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => callback(null, Buffer.concat(chunks)))
    })
    expect(excel.status).toBe(201)
    expect(excel.headers['content-type']).toContain('spreadsheetml.sheet')
    expect(Buffer.isBuffer(excel.body)).toBe(true)
    expect(excel.body.subarray(0, 2).toString()).toBe('PK')
    // Export stays report-version based: it contains the frozen comparison,
    // not an ad-hoc query of mutable scenario inputs.
    const ExcelJS = require('exceljs') as any
    const exportedWorkbook = new ExcelJS.Workbook()
    await exportedWorkbook.xlsx.load(excel.body)
    expect(exportedWorkbook.worksheets.map((sheet: { name: string }) => sheet.name)).toEqual(expect.arrayContaining([
      '01_Summary', '02_Project', '03_Existing', '04_Planning_Rights', '05_Area_Schedule', '06_Unit_Mix',
      '07_Sales', '08_Comps', '09_Costs', '10_Owner_Consideration', '11_Taxes', '12_Financing', '13_Cash_Flow',
      '14_Profitability', '15_Valuation', '16_Scenarios', '17_Sensitivity', '18_Assumptions', '19_Sources',
      '20_Data_Quality', '21_Audit',
    ]))
    expect(exportedWorkbook.getWorksheet('01_Summary')?.getCell('B4').value).toMatchObject({ formula: "=SUM('07_Sales'!D2:D1000)" })
    expect(exportedWorkbook.getWorksheet('01_Summary')?.getCell('B6').value).toMatchObject({ formula: '=B4-B5' })
    expect(exportedWorkbook.getWorksheet('01_Summary')?.getCell('B7').value).toMatchObject({ formula: '=IFERROR(B6/B4,0)' })
    expect(exportedWorkbook.getWorksheet('14_Profitability')?.getCell('B8').numFmt).toBe('0.00x')
    expect(exportedWorkbook.getWorksheet('15_Valuation')?.getCell('B4').numFmt).toBe('0.0%;[Red](0.0%);-')
    expect(exportedWorkbook.getWorksheet('15_Valuation')?.getCell('B6').numFmt).toBe('0.00')
    expect(exportedWorkbook.getWorksheet('16_Scenarios')?.getCell('A2').value).toBe('בסיס')
    expect(exportedWorkbook.getWorksheet('17_Sensitivity')?.getCell('A2').value).toBe(-0.1)
    expect(exportedWorkbook.getWorksheet('17_Sensitivity')?.getCell('A2').numFmt).toBe('0.0%;[Red](0.0%);-')
    expect(exportedWorkbook.getWorksheet('08_Comps')?.getCell('A2').value).toBe('רחוב בדיקה 1')
    expect(exportedWorkbook.getWorksheet('21_Audit')?.getCell('A1').value).toBe('מועד')
    expect(exportedWorkbook.getWorksheet('21_Audit')?.rowCount).toBeGreaterThan(3)
    const pdf = await http().post(`/api/v1/projects/${projectId}/feasibility/reports/${report.body.id}/export/pdf`).set(auth()).buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => callback(null, Buffer.concat(chunks)))
    })
    expect(pdf.status).toBe(201)
    expect(pdf.headers['content-type']).toContain('application/pdf')
    expect(Buffer.isBuffer(pdf.body)).toBe(true)
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF')
    expect(await prisma.auditLog.count({ where: { tenantId, entity: 'FeasibilityReportVersion', entityId: report.body.id, action: 'EXPORT' } })).toBe(2)

  })

  it('calculates IRR, NPV and equity requirement from a fully reconciled sensitivity cash flow', async () => {
    const profile = await http().get(`/api/v1/projects/${projectId}/feasibility`).set(auth())
    const sourceId = profile.body.sources[0].id
    const scenario = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios`).set(auth()).send({
      name: 'רגישות תזרימית', kind: 'CUSTOM', probability: '0.05',
    })
    expect(scenario.status).toBe(201)
    const requiredProfit = await http().post(`/api/v1/projects/${projectId}/feasibility/assumptions`).set(auth()).send({
      key: 'required-developer-profit-margin', label: 'יעד רווח יזמי', value: '0.20', unit: 'fraction', sourceId,
    })
    expect(requiredProfit.status).toBe(201)
    const revenue = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenario.body.id}/revenue-lines`).set(auth()).send({
      category: 'COMMERCIAL', label: 'מכירה לבדיקת רגישות', saleableAreaSqm: '1', pricePerSqm: '1000', sourceId, vatTreatment: 'VAT_EXCLUDED',
    })
    const cost = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenario.body.id}/cost-lines`).set(auth()).send({
      category: 'CONSTRUCTION', label: 'עלות לבדיקת רגישות', fixedAmount: '500', sourceId, vatTreatment: 'VAT_EXCLUDED',
    })
    const land = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenario.body.id}/cost-lines`).set(auth()).send({
      category: 'LAND', label: 'קרקע לבדיקת רגישות', fixedAmount: '100', sourceId, vatTreatment: 'VAT_EXCLUDED',
    })
    expect(revenue.status).toBe(201)
    expect(cost.status).toBe(201)
    expect(land.status).toBe(201)
    await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenario.body.id}/cash-flow-allocations`).set(auth()).send({
      periodStart: '2027-01-01', direction: 'OUTFLOW', sourceKind: 'COST', sourceLineId: cost.body.id, label: 'עלות', amount: '500',
    })
    await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenario.body.id}/cash-flow-allocations`).set(auth()).send({
      periodStart: '2027-01-01', direction: 'OUTFLOW', sourceKind: 'COST', sourceLineId: land.body.id, label: 'קרקע', amount: '100',
    })
    await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenario.body.id}/cash-flow-allocations`).set(auth()).send({
      periodStart: '2027-02-01', direction: 'INFLOW', sourceKind: 'REVENUE', sourceLineId: revenue.body.id, label: 'מכירה', amount: '1000',
    })
    const result = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenario.body.id}/sensitivity`).set(auth()).send({
      primaryVariable: 'SALE_PRICE', primaryChanges: ['-10', '0', '10'], secondaryVariable: 'CONSTRUCTION_COST', secondaryChanges: ['0', '10'],
    })
    expect(result.status).toBe(201)
    const baseCase = result.body.rows.find((row: { primaryChangePercent: string }) => row.primaryChangePercent === '0').values.find((value: { secondaryChangePercent: string }) => value.secondaryChangePercent === '0')
    expect(baseCase).toMatchObject({ revenue: '1000.00', costs: '600.00', profit: '400.00', equityRequirement: '600.00' })
    expect(baseCase.projectIrrAnnual).not.toBeNull()
    expect(baseCase.projectNpv).not.toBeNull()
    expect(baseCase.residualLandValue).not.toBeNull()
    const landSensitivity = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenario.body.id}/sensitivity`).set(auth()).send({
      primaryVariable: 'LAND_COST', primaryChanges: ['0', '10'],
    })
    expect(landSensitivity.status).toBe(201)
    expect(landSensitivity.body.rows[1]).toMatchObject({ costs: '610.00', profit: '390.00', equityRequirement: '610.00' })
  })

  it('links compensation to the existing ownership registry and reconciles its direct cash cost', async () => {
    const profile = await http().get(`/api/v1/projects/${projectId}/feasibility`).set(auth())
    const scenarioId = profile.body.scenarios.find((scenario: { isBaseline: boolean }) => scenario.isBaseline).id
    const candidates = await http().get(`/api/v1/projects/${projectId}/feasibility/compensation-candidates`).set(auth())
    expect(candidates.status).toBe(200)
    expect(candidates.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: ownerApartmentId, owner: expect.objectContaining({ id: ownerId }) })]))
    expect(JSON.stringify(candidates.body)).not.toContain('nationalId')
    const compensation = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/compensations`).set(auth()).send({
      ownerApartmentId, status: 'PROPOSED', replacementValue: '900000', cashCompensation: '100000', monthlyRelocationRent: '5000', relocationMonths: 24, movingCost: '5000',
    })
    expect(compensation.status).toBe(201)
    const updatedCompensation = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/compensations/${compensation.body.id}`).set(auth()).send({
      additionalAreaSqm: '12.5', parkingSpaces: 1, sourceDate: '2026-08-26', notes: 'עודכן לאחר בדיקת שמאות', isVerified: true,
    })
    expect(updatedCompensation.status).toBe(200)
    expect(updatedCompensation.body).toMatchObject({ additionalAreaSqm: '12.5', parkingSpaces: 1, isVerified: true, notes: 'עודכן לאחר בדיקת שמאות' })
    const movedCompensation = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/compensations/${compensation.body.id}`).set(auth()).send({ ownerApartmentId: 'foreign-owner-apartment' })
    expect(movedCompensation.status).toBe(400)
    const allocation = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations`).set(auth()).send({
      periodStart: '2027-01-01', direction: 'OUTFLOW', sourceKind: 'COMPENSATION', sourceLineId: compensation.body.id, label: 'תמורה ופינוי', amount: '225000',
    })
    expect(allocation.status).toBe(201)
    const calculation = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/calculate`).set(auth()).send()
    expect(calculation.status).toBe(201)
    expect(calculation.body.compensation.directCashCost).toBe('225000.00')
    expect(calculation.body.costs.total).toBe('725000.00')
    expect(calculation.body.profitability.profitBeforeFinancing).toBe('41332000.00')
    expect(calculation.body.cashFlow.periods[0].outflows).toBe('725000.00')
    expect(calculation.body.validation.some((issue: { code: string }) => issue.code === 'COMPENSATION_BENEFIT_VALUE_NOT_COSTED')).toBe(true)

    const debtDrawdown = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations`).set(auth()).send({
      periodStart: '2027-01-01', direction: 'INFLOW', sourceKind: 'DEBT', label: 'משיכת אשראי', amount: '1000000',
    })
    expect(debtDrawdown.status).toBe(201)
    const financed = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/calculate`).set(auth()).send()
    expect(financed.status).toBe(201)
    expect(financed.body.financing.accumulatedInterest).toBe('2123.29')
    expect(financed.body.financing.peakDebt).toBe('1000000.00')
    expect(financed.body.cashFlow.periods[0].outflows).toBe('727123.29')
    expect(financed.body.profitability.profitBeforeFinancing).toBe('41332000.00')
    expect(financed.body.profitability.profit).toBe('41329876.71')

    const financingFees = await http().patch(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/financing`).set(auth()).send({ debtAmount: '1000000', annualInterestRate: '0.05', arrangementFeeRate: '0.01', guaranteeFeeRate: '0.0025', financingMonths: 36 })
    expect(financingFees.status).toBe(200)
    const withFees = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${scenarioId}/calculate`).set(auth()).send()
    expect(withFees.status).toBe(201)
    expect(withFees.body.financing.financingFees).toBe('12500.00')
    expect(withFees.body.cashFlow.periods[0].outflows).toBe('739623.29')
    expect(withFees.body.costs.total).toBe('739623.29')
  })

  it('never approves a report version whose frozen validation contains a critical issue', async () => {
    const incomplete = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios`).set(auth()).send({
      name: 'תרחיש חסר', kind: 'CUSTOM', probability: '0.100000',
    })
    expect(incomplete.status).toBe(201)
    const snapshot = await http().post(`/api/v1/projects/${projectId}/feasibility/scenarios/${incomplete.body.id}/snapshots`).set(auth()).send()
    expect(snapshot.status).toBe(201)
    const report = await http().post(`/api/v1/projects/${projectId}/feasibility/reports`).set(auth()).send({ snapshotId: snapshot.body.id, title: 'דוח עם נתונים חסרים' })
    expect(report.status).toBe(201)
    const review = await http().patch(`/api/v1/projects/${projectId}/feasibility/reports/${report.body.id}/status`).set(auth()).send({ status: 'REVIEW' })
    expect(review.status).toBe(200)
    const approval = await http().patch(`/api/v1/projects/${projectId}/feasibility/reports/${report.body.id}/status`).set(auth()).send({ status: 'APPROVED' })
    expect(approval.status).toBe(409)
  })

  it('enforces role-based edit access and tenant isolation server-side', async () => {
    const observer = tokenFor('MUNICIPALITY_USER')
    const write = await http().post(`/api/v1/projects/${projectId}/feasibility/assumptions`).set(auth(observer)).send({ key: 'sale-price', label: 'מחיר מכירה', value: '10000' })
    expect(write.status).toBe(403)
    const foreignTenant = tokenFor('PROJECT_MANAGER', `foreign-${tenantId}`)
    const read = await http().get(`/api/v1/projects/${projectId}/feasibility`).set(auth(foreignTenant))
    expect(read.status).toBe(404)
    const candidateRead = await http().get(`/api/v1/projects/${projectId}/feasibility/compensation-candidates`).set(auth(foreignTenant))
    expect(candidateRead.status).toBe(404)
  })
})
