import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export type FeasibilityProfile = {
  id: string
  projectId: string
  projectType: string
  reportType: string
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'LOCKED'
  purpose: string
  valuationDate: string
  reportDate: string
  clientName: string | null
  developerName: string | null
  appraiserName: string | null
  neighborhood: string | null
  parcels: FeasibilityParcel[]
  sources: FeasibilitySource[]
  assumptions: FeasibilityAssumption[]
  areas: FeasibilityArea[]
  planningRights: PlanningRight[]
  comparableTransactions: ComparableTransaction[]
  scenarios: FeasibilityScenario[]
}

export type FeasibilityParcel = { id: string; gush: string; chelka: string; subChelka: string | null; landAreaSqm: string | null; address: string | null; confidence: string; isVerified: boolean }
export type FeasibilitySource = { id: string; type: string; title: string; issuer: string | null; sourceDate: string | null; reliability: string; documentId: string | null; sourceUrl: string | null; pageReference: string | null; extractedValue: string | null; notes: string | null }
export type FeasibilityAssumption = { id: string; key: string; label: string; value: string | null; textValue: string | null; unit: string | null; confidence: string; isVerified: boolean; impact: string | null }
export type FeasibilityArea = { id: string; areaType: string; label: string | null; valueSqm: string; confidence: string; isVerified: boolean }
export type PlanningRight = { id: string; category: string; status: string; areaSqm: string | null; unitCount: number | null; floorLimit: number | null; planNumber: string | null; landUse: string | null; confidence: string; isVerified: boolean }
export type ComparableAdjustment = { id: string; category: string; factor: string; description: string | null; confidence: string; sourceId: string | null }
export type ComparableTransaction = { id: string; address: string; transactionDate: string; transactionPrice: string; saleableAreaSqm: string; observedPricePerSqm: string; adjustmentFactor: string; adjustedPricePerSqm: string; rooms: string | null; floor: number | null; buildingAgeYears: number | null; condition: string | null; hasParking: boolean; balconyAreaSqm: string | null; storageAreaSqm: string | null; sourceId: string | null; sourceUrl: string | null; reliability: string; notes: string | null; adjustments: ComparableAdjustment[] }
export type FeasibilityRevenueLine = { id: string; category: string; label: string; quantity: string | null; unit: string | null; saleableAreaSqm: string | null; pricePerSqm: string | null; fixedUnitPrice: string | null; annualNoi: string | null; capitalizationRate: string | null; vatTreatment: string; classification: string; confidence: string; isVerified: boolean; sourceId: string | null }
export type FeasibilityCostLine = { id: string; category: string; label: string; quantity: string | null; unit: string | null; unitCost: string | null; fixedAmount: string | null; percentage: string | null; percentageBase: string | null; vatTreatment: string; classification: string; confidence: string; isVerified: boolean; sourceId: string | null }
export type FeasibilityFinancing = { id: string; debtAmount: string | null; equityAmount: string | null; ltc: string | null; ltv: string | null; annualInterestRate: string | null; arrangementFeeRate: string | null; guaranteeFeeRate: string | null; graceMonths: number | null; financingMonths: number | null } | null
export type FeasibilityTimelinePhase = { id: string; kind: string; label: string; startDate: string | null; endDate: string | null; durationMonths: number | null }
export type FeasibilityCashFlowAllocation = { id: string; periodStart: string; direction: 'INFLOW' | 'OUTFLOW'; sourceKind: 'REVENUE' | 'COST' | 'COMPENSATION' | 'EQUITY' | 'DEBT' | 'OTHER'; sourceLineId: string | null; label: string; amount: string }
export type FeasibilityCompensationLine = { id: string; ownerApartmentId: string; status: string; replacementAreaSqm: string | null; additionalAreaSqm: string | null; balconyAreaSqm: string | null; parkingSpaces: number; storageAreaSqm: string | null; newFloor: number | null; replacementValue: string | null; parkingValue: string | null; storageValue: string | null; balconyValue: string | null; cashCompensation: string | null; monthlyRelocationRent: string | null; relocationMonths: number | null; movingCost: string | null; temporaryHousingCost: string | null; legalCost: string | null; inspectionCost: string | null; otherCost: string | null; sourceId: string | null; isVerified: boolean }
export type FeasibilityCompensationCandidate = { id: string; shareNumerator: number; shareDenominator: number; owner: { id: string; fullName: string }; apartment: { id: string; apartmentNumber: string; floor: number | null; building: { id: string; address: string } } }
export type FeasibilityScenario = { id: string; name: string; kind: 'BASE' | 'CONSERVATIVE' | 'OPTIMISTIC' | 'CUSTOM'; description: string | null; probability: string | null; isBaseline: boolean; unitMix: FeasibilityUnitMixLine[]; revenueLines: FeasibilityRevenueLine[]; costLines: FeasibilityCostLine[]; financing: FeasibilityFinancing; timelinePhases: FeasibilityTimelinePhase[]; cashFlowAllocations: FeasibilityCashFlowAllocation[]; compensations: FeasibilityCompensationLine[] }
export type FeasibilityUnitMixLine = { id: string; label: string; unitCount: number; rooms: string | null; netAreaSqm: string | null; grossAreaSqm: string | null; saleableAreaSqm: string | null; pricePerSqm: string | null; fixedUnitPrice: string | null; classification: string; confidence: string; isVerified: boolean; sourceId: string | null }

export type ProfileInput = {
  projectType: string; reportType?: string; purpose: string; valuationDate: string; reportDate: string
  clientName?: string; developerName?: string; appraiserName?: string; neighborhood?: string
}

const key = (projectId: string) => ['projects', projectId, 'feasibility'] as const

export function useFeasibility(projectId: string) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: async () => {
      try {
        return await api.get<FeasibilityProfile>(`/projects/${projectId}/feasibility`)
      } catch (error: any) {
        // A project without a profile is an expected first-run state, not an
        // error screen. All other failures stay visible and retryable.
        if (error?.status === 404) return null
        throw error
      }
    },
    enabled: Boolean(projectId),
    retry: 2,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, projectId: string) {
  return qc.invalidateQueries({ queryKey: key(projectId) })
}

export function useCreateFeasibility(projectId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: ProfileInput) => api.post<FeasibilityProfile>(`/projects/${projectId}/feasibility`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useUpdateFeasibility(projectId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Partial<ProfileInput>) => api.patch<FeasibilityProfile>(`/projects/${projectId}/feasibility`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useAddFeasibilityItem(projectId: string, path: 'parcels' | 'sources' | 'assumptions' | 'areas' | 'planning-rights') {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/${path}`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useUpdateFeasibilityItem(projectId: string, path: 'parcels' | 'sources' | 'assumptions' | 'areas' | 'planning-rights', itemId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.patch(`/projects/${projectId}/feasibility/${path}/${itemId}`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useDeleteFeasibilityItem(projectId: string, path: 'parcels' | 'sources' | 'assumptions' | 'areas' | 'planning-rights') {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (itemId: string) => api.delete(`/projects/${projectId}/feasibility/${path}/${itemId}`), onSuccess: () => invalidate(qc, projectId) })
}
export function useAddComparableTransaction(projectId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/comparables`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useAddComparableAdjustment(projectId: string, comparableId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/comparables/${comparableId}/adjustments`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useUpdateComparableTransaction(projectId: string, comparableId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.patch(`/projects/${projectId}/feasibility/comparables/${comparableId}`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useUpdateComparableAdjustment(projectId: string, comparableId: string, adjustmentId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.patch(`/projects/${projectId}/feasibility/comparables/${comparableId}/adjustments/${adjustmentId}`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useCreateFeasibilityScenario(projectId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/scenarios`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useDuplicateFeasibilityScenario(projectId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (scenarioId: string) => api.post(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/duplicate`), onSuccess: () => invalidate(qc, projectId) })
}

export function useAddUnitMixLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/unit-mix`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useUpdateUnitMixLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ lineId, dto }: { lineId: string; dto: Record<string, unknown> }) => api.patch(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/unit-mix/${lineId}`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useDeleteUnitMixLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (lineId: string) => api.delete(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/unit-mix/${lineId}`), onSuccess: () => invalidate(qc, projectId) })
}

export function useAddRevenueLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useUpdateRevenueLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ lineId, dto }: { lineId: string; dto: Record<string, unknown> }) => api.patch(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines/${lineId}`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useDeleteRevenueLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (lineId: string) => api.delete(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/revenue-lines/${lineId}`), onSuccess: () => invalidate(qc, projectId) })
}

export function useAddCostLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/cost-lines`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useUpdateCostLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ lineId, dto }: { lineId: string; dto: Record<string, unknown> }) => api.patch(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/cost-lines/${lineId}`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useDeleteCostLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (lineId: string) => api.delete(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/cost-lines/${lineId}`), onSuccess: () => invalidate(qc, projectId) })
}

export function useUpsertFeasibilityFinancing(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.patch(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/financing`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useAddTimelinePhase(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/timeline-phases`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useDeleteTimelinePhase(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (phaseId: string) => api.delete(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/timeline-phases/${phaseId}`), onSuccess: () => invalidate(qc, projectId) })
}

export function useAddCashFlowAllocation(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useDeleteCashFlowAllocation(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (allocationId: string) => api.delete(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations/${allocationId}`), onSuccess: () => invalidate(qc, projectId) })
}
export function useUpdateCashFlowAllocation(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ allocationId, dto }: { allocationId: string; dto: Record<string, unknown> }) => api.patch(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/cash-flow-allocations/${allocationId}`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export function useCompensationCandidates(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'feasibility', 'compensation-candidates'],
    queryFn: () => api.get<FeasibilityCompensationCandidate[]>(`/projects/${projectId}/feasibility/compensation-candidates`),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })
}

export function useAddCompensationLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: Record<string, unknown>) => api.post(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/compensations`, dto), onSuccess: () => invalidate(qc, projectId) })
}
export function useDeleteCompensationLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (lineId: string) => api.delete(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/compensations/${lineId}`), onSuccess: () => invalidate(qc, projectId) })
}
export function useUpdateCompensationLine(projectId: string, scenarioId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ lineId, dto }: { lineId: string; dto: Record<string, unknown> }) => api.patch(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/compensations/${lineId}`, dto), onSuccess: () => invalidate(qc, projectId) })
}

export type FeasibilityCalculation = {
  engineVersion: string
  currency: string
  vatBasis: string
  revenue: { total: string; lines: Array<{ id: string; label: string; category: string; amount: string; formula: string }> }
  costs: { total: string; lines: Array<{ id: string; label: string; category: string; amount: string; formula: string }> }
  profitability: { profit: string; profitBeforeFinancing: string; profitOnCost: string | null; profitMargin: string | null; isFinal: boolean }
  financing: { accumulatedInterest: string; financingFees: string; peakDebt: string; debtBalance: string }
  cashFlow: { periods: Array<{ periodStart: string; inflows: string; outflows: string; net: string; cumulative: string }>; peakFundingRequirement: string; reconciliationComplete: boolean }
  dataQuality: { criticalCount: number; warningCount: number; confidenceScore: number }
  valuation: {
    requiredDeveloperProfitMargin: string | null
    requiredDeveloperProfit: string | null
    residualLandValue: string | null
    comparison: {
      comparableCount: number
      averageAdjustedPricePerSqm: string | null
      subjectAreaSqm: string | null
      value: string | null
      method: string
      comparables: Array<{ id: string; address: string; observedPricePerSqm: string; adjustmentFactor: string; adjustedPricePerSqm: string }>
    }
  }
  feasibility: { status: 'DATA_INCOMPLETE' | 'FEASIBLE' | 'CONDITIONAL' | 'NOT_FEASIBLE'; isFinal: boolean }
  traceability: {
    revenue: { formula: string; amount: string; inputs: Array<{ id: string; label: string; category: string; amount: string; formula: string }> }
    costs: { formula: string; amount: string; inputs: Array<{ id: string; label: string; category: string; amount: string; formula: string }> }
    profit: { formula: string; amount: string }
    residualLandValue: { formula: string; amount: string; requiredDeveloperProfit: string } | null
    comparison: { formula: string; amount: string; comparableCount: number; subjectAreaSqm: string } | null
  }
  returns: { projectIrrMonthly: string | null; projectIrrAnnual: string | null; equityIrrMonthly: string | null; equityIrrAnnual: string | null; discountRateAnnual: string | null; projectNpv: string | null; equityNpv: string | null; equityInvested: string; equityDistributed: string; equityMultiple: string | null }
  breakEven: { revenueRequired: string; salePricePerSqm: string | null; constructionCostPerUnit: string | null; saleableAreaSqm: string | null }
  validation: Array<{ code: string; severity: 'CRITICAL' | 'WARNING' | 'INFO'; message: string }>
}

export type FeasibilitySensitivity = {
  scenarioId: string
  primaryVariable: FeasibilitySensitivityVariable
  secondaryVariable: FeasibilitySensitivityVariable | null
  rows: Array<{ primaryChangePercent: string; values?: Array<SensitivityResult>; revenue?: string; costs?: string; profit?: string; profitMargin?: string | null; projectIrrAnnual?: string | null; projectNpv?: string | null; equityRequirement?: string; residualLandValue?: string | null }>
  notes: string[]
}
export type FeasibilitySensitivityVariable = 'SALE_PRICE' | 'CONSTRUCTION_COST' | 'LAND_COST' | 'INTEREST_RATE' | 'DISCOUNT_RATE'
export type SensitivityResult = { secondaryChangePercent: string; revenue: string; costs: string; profit: string; profitMargin: string | null; projectIrrAnnual: string | null; projectNpv: string | null; equityRequirement: string; residualLandValue: string | null }
export type FeasibilitySensitivityInput = {
  primaryVariable: FeasibilitySensitivityVariable
  primaryChanges: string[]
  secondaryVariable?: FeasibilitySensitivityVariable
  secondaryChanges?: string[]
}

export type FeasibilitySnapshot = { id: string; scenarioId: string; engineVersion: string; createdById: string; createdAt: string }
export type FeasibilityReportVersion = { id: string; snapshotId: string; version: number; status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'LOCKED'; title: string; createdById: string; createdAt: string; approvedById: string | null; approvedAt: string | null; lockedById: string | null; lockedAt: string | null; snapshot: { id: string; scenarioId: string; engineVersion: string; createdAt: string } }
export type FeasibilityReportComparisonSnapshot = {
  capturedAt: string
  scenarios: Array<{ scenarioId: string; scenarioName: string; snapshotId: string; engineVersion: string; calculatedAt: string; output: FeasibilityCalculation; validation: FeasibilityCalculation['validation']; sensitivity?: FeasibilitySensitivity | null }>
}
export type FeasibilityReportVersionDetail = FeasibilityReportVersion & {
  comparisonSnapshot: FeasibilityReportComparisonSnapshot | null
  snapshot: FeasibilityReportVersion['snapshot'] & { inputSnapshot: unknown; outputSnapshot: FeasibilityCalculation; validationSnapshot: FeasibilityCalculation['validation']; sensitivitySnapshot: FeasibilitySensitivity | null }
}

export function useCalculateFeasibility(projectId: string) {
  return useMutation({ mutationFn: (scenarioId: string) => api.post<FeasibilityCalculation>(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/calculate`) })
}

export function useRunFeasibilitySensitivity(projectId: string) {
  return useMutation({
    mutationFn: ({ scenarioId, dto }: { scenarioId: string; dto: FeasibilitySensitivityInput }) => api.post<FeasibilitySensitivity>(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/sensitivity`, dto),
  })
}

const snapshotKey = (projectId: string) => ['projects', projectId, 'feasibility', 'snapshots'] as const
const reportKey = (projectId: string) => ['projects', projectId, 'feasibility', 'reports'] as const

export function useFeasibilitySnapshots(projectId: string) {
  return useQuery({ queryKey: snapshotKey(projectId), queryFn: () => api.get<FeasibilitySnapshot[]>(`/projects/${projectId}/feasibility/snapshots`), enabled: Boolean(projectId) })
}

export function useCreateFeasibilitySnapshot(projectId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ scenarioId, sensitivity }: { scenarioId: string; sensitivity?: FeasibilitySensitivityInput }) => api.post<FeasibilitySnapshot>(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/snapshots`, sensitivity ? { sensitivity } : {}), onSuccess: () => qc.invalidateQueries({ queryKey: snapshotKey(projectId) }) })
}

export function useFeasibilityReportVersions(projectId: string) {
  return useQuery({ queryKey: reportKey(projectId), queryFn: () => api.get<FeasibilityReportVersion[]>(`/projects/${projectId}/feasibility/reports`), enabled: Boolean(projectId) })
}
export function useFeasibilityReportVersion(projectId: string, reportId: string | null) {
  return useQuery({ queryKey: [...reportKey(projectId), reportId], queryFn: () => api.get<FeasibilityReportVersionDetail>(`/projects/${projectId}/feasibility/reports/${reportId}`), enabled: Boolean(projectId && reportId) })
}

export function useCreateFeasibilityReportVersion(projectId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (dto: { snapshotId: string; title: string }) => api.post<FeasibilityReportVersion>(`/projects/${projectId}/feasibility/reports`, dto), onSuccess: () => qc.invalidateQueries({ queryKey: reportKey(projectId) }) })
}

export function useTransitionFeasibilityReportVersion(projectId: string) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ reportId, status }: { reportId: string; status: 'REVIEW' | 'APPROVED' | 'LOCKED' }) => api.patch<FeasibilityReportVersion>(`/projects/${projectId}/feasibility/reports/${reportId}/status`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: reportKey(projectId) }) })
}

// ── Regulatory rules registry ──────────────────────────────────────────────

export type FeasibilityRuleDeviation = {
  code: string
  ruleName: string
  ruleValue: string | null
  ruleUnit: string | null
  assumptionValue: string | null
  sourceReference: string
  ruleId: string
  status: 'MATCHES' | 'OVERRIDES' | 'UNSET'
}

export type FeasibilityDeviations = {
  valuationDate: string
  jurisdiction: string | null
  deviations: FeasibilityRuleDeviation[]
}

/**
 * How this study stands against the tenant's rules registry on its determining
 * date. Read-only by construction — the endpoint applies nothing, it reports
 * (see FeasibilityRulesService.deviationsForProfile).
 */
export function useFeasibilityDeviations(profileId: string | null) {
  return useQuery({
    queryKey: ['feasibility', 'deviations', profileId],
    queryFn: () => api.get<FeasibilityDeviations>(`/feasibility/rules/deviations/${profileId}`),
    enabled: Boolean(profileId),
    staleTime: 60_000,
  })
}

// ── Goal Seek ──────────────────────────────────────────────────────────────

export type FeasibilityGoalSeekMetric =
  'profit' | 'profitOnCost' | 'profitMargin' | 'projectNpv' | 'projectIrrAnnual' | 'residualLandValue'

export type FeasibilityGoalSeekVariable =
  'pricePerSqm' | 'salePrice' | 'constructionCost' | 'landCost' | 'interestRate' | 'discountRate'

export type FeasibilityGoalSeekInput = {
  solveFor: FeasibilityGoalSeekVariable
  targetMetric: FeasibilityGoalSeekMetric
  targetValue: string
  maxChangePercent?: string
}

export type FeasibilityGoalSeek = {
  solveFor: FeasibilityGoalSeekVariable
  targetMetric: FeasibilityGoalSeekMetric
  targetValue: string
  converged: boolean
  status: 'CONVERGED' | 'ALREADY_AT_TARGET' | 'UNREACHABLE_WITHIN_RANGE'
  searchedRangePercent: string
  evaluations: number
  requiredChangePercent: string
  requiredFactor: string
  /** The absolute input behind the factor — null when there is no single base to scale. */
  solvedInput: {
    unit: string
    basis: string
    baseValue: string | null
    solvedValue: string | null
    perLine: Array<{ lineId: string; label: string; baseValue: string; solvedValue: string }>
  }
  baseValue: string
  achievedValue: string
  remainingGap: string
  resulting: {
    revenue: string; costs: string; profit: string
    profitOnCost: string | null; profitMargin: string | null
    projectNpv: string | null; projectIrrAnnual: string | null
    peakDebt: string; feasibilityStatus: string
  }
  triggeredIssues: Array<{ code: string; severity: string; message: string }>
}

export function useRunFeasibilityGoalSeek(projectId: string) {
  return useMutation({
    mutationFn: ({ scenarioId, dto }: { scenarioId: string; dto: FeasibilityGoalSeekInput }) =>
      api.post<FeasibilityGoalSeek>(`/projects/${projectId}/feasibility/scenarios/${scenarioId}/goal-seek`, dto),
  })
}
