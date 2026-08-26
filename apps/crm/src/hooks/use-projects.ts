import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// ── Types ────────────────────────────────────────────────────────────────────
export interface Project {
  id:            string
  code:          string
  name:          string
  address:       string
  city:          string
  neighborhood?: string | null
  stage:         string
  status:        string
  projectManagerId?: string | null
  lawyerId?:     string | null
  architectId?:  string | null
  /** Resolved by ProjectsService.attachTeam — null when unassigned. */
  projectManager?: TeamUser | null
  lawyer?:         TeamUser | null
  architect?:      TeamUser | null
  totalUnits:    number
  signedUnits:   number
  signatureGoal?: number
  createdAt:     string
  updatedAt:     string
}

export interface ProjectResidentSummary {
  id:              string
  firstName:       string
  lastName:        string
  signatureStatus: string
  phone:           string | null
}

export interface Apartment {
  id:              string
  buildingId:      string
  apartmentNumber: string
  floor:           number | null
  sizeSqm:         number | null
  rooms:           number | null
  status:          string
  residents:       ProjectResidentSummary[]
}

export interface Building {
  id:              string
  complexId:       string
  address:         string
  city:            string
  floors:          number | null
  totalApartments: number
  constructionYear: number | null
  status:          string
  apartments:      Apartment[]
}

export interface Complex {
  id:        string
  name:      string
  address:   string
  status:    string
  buildings: Building[]
}

/** Resolved team member (from Project.projectManagerId / lawyerId / architectId). */
export interface TeamUser {
  id:        string
  firstName: string
  lastName:  string
  role:      string
  email?:    string
}

/**
 * Shape returned by GET /projects/:id/members.
 *
 * `id` is the ProjectMember ROW id — that is what
 * `DELETE /projects/:id/members/:memberId` matches on. The user's own id is
 * `user.id`. There is no top-level `userId` in the response; sending one where
 * a member row id is expected produces a 404, not a silent no-op.
 */
export interface ProjectMember {
  id:      string
  role?:   string
  addedAt?: string
  user: { id: string; firstName: string; lastName: string; role: string; email?: string }
}

export interface ProjectStageHistory {
  id:        string
  stage:     string
  enteredAt: string
  exitedAt:  string | null
  notes:     string | null
}

/** Shape returned by GET /projects/:id (nested complexes → buildings → apartments). */
export interface ProjectDetail extends Project {
  description:    string | null
  startDate:      string | null
  targetEndDate:  string | null
  members:        ProjectMember[]
  stages:         ProjectStageHistory[]
  complexes:      Complex[]
}

export interface ProjectsResponse {
  data:  Project[]
  total: number
  page:  number
  limit: number
}

/** Mirrors CreateProjectDto in the API Gateway. */
export interface CreateProjectDto {
  name:              string
  city:              string
  address?:          string
  neighborhood?:     string
  description?:      string
  stage?:            string
  totalUnits?:       number
  signatureGoal?:    number
  startDate?:        string
  targetEndDate?:    string
  projectManagerId?: string
  lawyerId?:         string
}

// ── Query keys ───────────────────────────────────────────────────────────────
export const projectKeys = {
  all:    () => ['projects'] as const,
  lists:  () => [...projectKeys.all(), 'list'] as const,
  list:   (filters: Record<string, unknown>) => [...projectKeys.lists(), filters] as const,
  detail: (id: string) => [...projectKeys.all(), 'detail', id] as const,
}

// ── Hooks ────────────────────────────────────────────────────────────────────
/**
 * GET /projects.
 *
 * The API hides ARCHIVED projects from this list by DEFAULT. Pass
 * `status: 'ARCHIVED'` for the archive view, or `includeArchived: true` to see
 * everything at once. Both are opt-in — nothing here silently re-surfaces a
 * project the user retired.
 */
export function useProjects(params?: {
  page?: number
  limit?: number
  stage?: string
  city?: string
  status?: string
  includeArchived?: boolean
}) {
  const query = new URLSearchParams()
  if (params?.page)  query.set('page',  String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.stage) query.set('stage', params.stage)
  if (params?.city)  query.set('city',  params.city)
  if (params?.status) query.set('status', params.status)
  if (params?.includeArchived) query.set('includeArchived', 'true')

  return useQuery({
    queryKey: projectKeys.list(params ?? {}),
    queryFn:  () => api.get<ProjectsResponse>(`/projects?${query.toString()}`),
    staleTime: 30_000,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn:  () => api.get<ProjectDetail>(`/projects/${id}`),
    enabled:  Boolean(id),
    staleTime: 30_000,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateProjectDto) => api.post<Project>('/projects', dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.lists() }) },
  })
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    // ProjectsController exposes @Put(':id') — not PATCH.
    mutationFn: (dto: Partial<CreateProjectDto>) => api.put<Project>(`/projects/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() })
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) })
    },
  })
}

// ── Lifecycle / team / members ───────────────────────────────────────────────
// All MANAGER_ROLES-only. The UI hides these controls for other roles, but the
// endpoints themselves are the enforcement point and answer 403 regardless.

/** Mirrors PROJECT_STAGES in projects/dto/project-actions.dto.ts. */
export const PROJECT_STAGES: Record<string, string> = {
  DISCOVERY:             'גילוי',
  FEASIBILITY:           'היתכנות',
  RESIDENT_ORGANIZATION: 'התארגנות דיירים',
  SIGNATURES:            'חתימות',
  DEVELOPER_SELECTION:   'בחירת יזם',
  PLANNING:              'תכנון',
  MUNICIPAL_APPROVAL:    'אישור עירייה',
  PERMIT:                'היתר בנייה',
  EVACUATION:            'פינוי',
  CONSTRUCTION:          'בנייה',
  DELIVERY:              'מסירה',
  POST_DELIVERY:         'אחרי מסירה',
}

/** Mirrors PROJECT_STATUSES in projects/dto/project-actions.dto.ts. */
export const PROJECT_STATUSES: Record<string, string> = {
  ACTIVE:    'פעיל',
  ON_HOLD:   'בהמתנה',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
  ARCHIVED:  'בארכיון',
}

function invalidateProject(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: projectKeys.lists() })
  if (id) qc.invalidateQueries({ queryKey: projectKeys.detail(id) })
}

/** PATCH /projects/:id/stage — the stage history row is written server-side. */
export function useAdvanceProjectStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage, notes }: { id: string; stage: string; notes?: string }) =>
      api.patch<Project>(`/projects/${id}/stage`, { stage, ...(notes ? { notes } : {}) }),
    onSuccess: (_d, v) => invalidateProject(qc, v.id),
  })
}

/** PATCH /projects/:id/status */
export function useChangeProjectStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.patch<Project>(`/projects/${id}/status`, { status, ...(reason ? { reason } : {}) }),
    onSuccess: (_d, v) => invalidateProject(qc, v.id),
  })
}

/**
 * POST /projects/:id/archive — soft closure.
 *
 * Archiving is a status transition, never a destruction: a project is the root
 * of complexes → buildings → apartments → owners → signatures, and those
 * records are the evidence behind any reported signature threshold. An archived
 * project simply drops out of the default list and can be restored.
 */
export function useArchiveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<Project>(`/projects/${id}/archive`, reason ? { reason } : {}),
    onSuccess: (_d, v) => invalidateProject(qc, v.id),
  })
}

/**
 * POST /projects/:id/restore.
 *
 * Omitting `status` restores the project to whatever status it held before it
 * was archived (the server reads that from the audit trail), falling back to
 * ACTIVE. Answers 409 if the project is not archived.
 */
export function useRestoreProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status?: string; reason?: string }) =>
      api.post<Project>(`/projects/${id}/restore`, {
        ...(status ? { status } : {}),
        ...(reason ? { reason } : {}),
      }),
    onSuccess: (_d, v) => invalidateProject(qc, v.id),
  })
}

/**
 * PATCH /projects/:id/team — assign or clear the manager, lawyer and architect.
 * `null` clears a slot; a field left `undefined` is not touched.
 */
export function useAssignProjectTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...team }: {
      id: string
      projectManagerId?: string | null
      lawyerId?:         string | null
      architectId?:      string | null
    }) => api.patch<Project>(`/projects/${id}/team`, team),
    onSuccess: (_d, v) => invalidateProject(qc, v.id),
  })
}

export function useProjectMembers(id: string) {
  return useQuery({
    queryKey: [...projectKeys.detail(id), 'members'],
    queryFn:  () => api.get<ProjectMember[]>(`/projects/${id}/members`),
    enabled:  Boolean(id),
    staleTime: 30_000,
  })
}

export function useAddProjectMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId, role }: { id: string; userId: string; role?: string }) =>
      api.post<ProjectMember>(`/projects/${id}/members`, { userId, ...(role ? { role } : {}) }),
    onSuccess: (_d, v) => {
      invalidateProject(qc, v.id)
      qc.invalidateQueries({ queryKey: [...projectKeys.detail(v.id), 'members'] })
    },
  })
}

export function useRemoveProjectMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, memberId }: { id: string; memberId: string }) =>
      api.delete<unknown>(`/projects/${id}/members/${memberId}`),
    onSuccess: (_d, v) => {
      invalidateProject(qc, v.id)
      qc.invalidateQueries({ queryKey: [...projectKeys.detail(v.id), 'members'] })
    },
  })
}

/**
 * POST /projects/status — one status across several projects.
 *
 * The service applies the whole set in a single transaction, so a partial
 * result is not possible; the UI still confirms before any destructive value
 * (CANCELLED / ARCHIVED).
 */
export function useBulkProjectStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ids: string[]; status: string; reason?: string }) =>
      api.post<{ updated: number }>('/projects/bulk/status', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: projectKeys.all() }) },
  })
}
