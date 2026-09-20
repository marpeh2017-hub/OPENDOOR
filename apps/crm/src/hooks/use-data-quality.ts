import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// ─── Types (mirror the API Gateway contracts) ───────────────────────────────

export type DqSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
export type DqStatus   = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED'
export type DqCategory =
  | 'COMPLETENESS' | 'ACCURACY' | 'CONSISTENCY'
  | 'INTEGRITY' | 'DUPLICATION' | 'TIMELINESS' | 'COMPLIANCE'

export interface DqIssue {
  id:             string
  tenantId:       string
  projectId:      string | null
  projectName?:   string | null
  entityType:     string
  entityId:       string
  entityLabel:    string
  issueType:      string
  category:       DqCategory
  severity:       DqSeverity
  status:         DqStatus
  title:          string
  description:    string
  impact:         string | null
  recommendation: string | null
  deepLink:       string | null
  metadata:       Record<string, unknown> | null
  detectedAt:     string
  lastSeenAt:     string
  resolvedAt:     string | null
  resolvedById:   string | null
  resolutionNote: string | null
  resolutionType: string | null
}

export interface DqIssueDetail extends DqIssue {
  resolvedBy: { id: string; firstName: string; lastName: string } | null
  history: {
    id: string
    action: string
    changes: { before?: { status?: string }; after?: { status?: string } } | null
    metadata: Record<string, unknown> | null
    createdAt: string
    user: { id: string; firstName: string; lastName: string } | null
  }[]
}

export interface DqScan {
  id: string
  scope: 'PROJECT' | 'TENANT' | 'GLOBAL'
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  projectId: string | null
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  ruleCount: number
  entitiesScanned: number
  issuesFound: number
  issuesNew: number
  issuesResolved: number
}

export interface DqTenantSummary {
  score: number
  recordCount: number
  openIssues: number
  resolvedIssues: number
  ignoredIssues: number
  bySeverity: Record<DqSeverity, number>
  byCategory: Record<string, number>
  byStatus: Record<DqStatus, number>
  byProject: { projectId: string | null; projectName: string | null; count: number }[]
  topIssueTypes: { issueType: string; count: number }[]
  projectCount: number
  lastScan: DqScan | null
  trend: {
    id: string; startedAt: string; issuesFound: number
    issuesNew: number; issuesResolved: number; durationMs: number | null
  }[]
}

export interface DqProjectSummary {
  project: { id: string; name: string; code: string; stage: string; status: string }
  score: number
  recordCount: number
  openIssues: number
  resolvedIssues: number
  ignoredIssues: number
  bySeverity: Record<DqSeverity, number>
  byCategory: Record<string, number>
  byStatus: Record<DqStatus, number>
  topIssueTypes: { issueType: string; count: number }[]
  headline: {
    ownersMissingPhone: number
    apartmentsWithoutOwners: number
    ownershipInconsistencies: number
    overdueTasks: number
    totalApartments: number
  }
  lastScan: DqScan | null
}

export interface DqRule {
  id: string
  title: string
  category: DqCategory
  severity: DqSeverity
  tenantWide: boolean
  issueTypes: string[]
}

export interface DqIssueFilters {
  projectId?:  string
  category?:   string
  severity?:   string
  status?:     string
  entityType?: string
  issueType?:  string
  search?:     string
  sort?:       string
  order?:      string
  skip?:       number
  take?:       number
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const dqKeys = {
  all:      ()                     => ['data-quality'] as const,
  summary:  ()                     => [...dqKeys.all(), 'summary'] as const,
  project:  (id: string)           => [...dqKeys.all(), 'project', id] as const,
  issues:   (f: DqIssueFilters)    => [...dqKeys.all(), 'issues', f] as const,
  issue:    (id: string)           => [...dqKeys.all(), 'issue', id] as const,
  rules:    ()                     => [...dqKeys.all(), 'rules'] as const,
  scans:    ()                     => [...dqKeys.all(), 'scans'] as const,
}

function toQuery(f: DqIssueFilters): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== '' && v !== 'all') q.set(k, String(v))
  }
  return q.toString()
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useDqSummary() {
  return useQuery({
    queryKey: dqKeys.summary(),
    queryFn:  () => api.get<DqTenantSummary>('/data-quality/summary'),
    staleTime: 30_000,
  })
}

export function useDqProjectSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: dqKeys.project(projectId ?? ''),
    queryFn:  () => api.get<DqProjectSummary>(`/data-quality/projects/${projectId}/summary`),
    enabled:  Boolean(projectId),
    staleTime: 30_000,
  })
}

export function useDqIssues(filters: DqIssueFilters) {
  return useQuery({
    queryKey: dqKeys.issues(filters),
    queryFn:  () =>
      api.get<{ items: DqIssue[]; total: number; skip: number; take: number }>(
        `/data-quality/issues?${toQuery(filters)}`,
      ),
    staleTime: 15_000,
  })
}

export function useDqIssue(id: string | undefined) {
  return useQuery({
    queryKey: dqKeys.issue(id ?? ''),
    queryFn:  () => api.get<DqIssueDetail>(`/data-quality/issues/${id}`),
    enabled:  Boolean(id),
  })
}

export function useDqRules() {
  return useQuery({
    queryKey: dqKeys.rules(),
    queryFn:  () => api.get<DqRule[]>('/data-quality/rules'),
    staleTime: 5 * 60_000,
  })
}

export function useDqScans(projectId?: string) {
  return useQuery({
    queryKey: [...dqKeys.scans(), projectId ?? 'all'],
    queryFn:  () =>
      api.get<DqScan[]>(`/data-quality/scans${projectId ? `?projectId=${projectId}` : ''}`),
    staleTime: 15_000,
  })
}

// ─── Mutations ──────────────────────────────────────────────────────────────

function useInvalidateDq() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: dqKeys.all() })
}

export function useRunDqScan() {
  const invalidate = useInvalidateDq()
  return useMutation({
    mutationFn: (projectId?: string) =>
      api.post<DqScan>(
        projectId ? `/data-quality/scan/project/${projectId}` : '/data-quality/scan/tenant',
        {},
      ),
    onSuccess: invalidate,
  })
}

type TransitionArgs = { id: string; note?: string }

export function useDqTransition(action: 'resolve' | 'ignore' | 'reopen' | 'start') {
  const invalidate = useInvalidateDq()
  return useMutation({
    mutationFn: ({ id, note }: TransitionArgs) =>
      api.patch<DqIssue>(`/data-quality/issues/${id}/${action}`, { note }),
    onSuccess: invalidate,
  })
}

// ─── Current user (for RBAC-aware UI) ───────────────────────────────────────

// `useCurrentUser` lives in use-auth.ts (it is not DQ-specific). Re-exported
// here so existing DQ imports keep working.
export { useCurrentUser, type CurrentUser } from './use-auth'
import { useCurrentUser as useCurrentUserForDq } from './use-auth'

const MANAGER_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER']

/** Mirrors MANAGER_ROLES on the API — scan and status changes are manager-only. */
export function useCanManageDq(): boolean {
  const { data } = useCurrentUserForDq()
  return Boolean(data?.role && MANAGER_ROLES.includes(data.role))
}
