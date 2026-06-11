import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// ── Types ────────────────────────────────────────────────────────────────────
export interface Project {
  id:            string
  code:          string
  name:          string
  address:       string
  city:          string
  neighborhood?: string
  stage:         string
  totalUnits:    number
  signedUnits:   number
  createdAt:     string
  updatedAt:     string
}

export interface ProjectsResponse {
  data:  Project[]
  total: number
  page:  number
  limit: number
}

export interface CreateProjectDto {
  name:         string
  address:      string
  city:         string
  neighborhood?: string
  totalUnits:   number
  stage:        string
  startDate?:   string
  targetDate?:  string
}

// ── Query keys ───────────────────────────────────────────────────────────────
export const projectKeys = {
  all:    () => ['projects'] as const,
  lists:  () => [...projectKeys.all(), 'list'] as const,
  list:   (filters: Record<string, unknown>) => [...projectKeys.lists(), filters] as const,
  detail: (id: string) => [...projectKeys.all(), 'detail', id] as const,
}

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useProjects(params?: { page?: number; limit?: number; stage?: string; city?: string }) {
  const query = new URLSearchParams()
  if (params?.page)  query.set('page',  String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.stage) query.set('stage', params.stage)
  if (params?.city)  query.set('city',  params.city)

  return useQuery({
    queryKey: projectKeys.list(params ?? {}),
    queryFn:  () => api.get<ProjectsResponse>(`/projects?${query.toString()}`),
    staleTime: 30_000,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn:  () => api.get<Project>(`/projects/${id}`),
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
    mutationFn: (dto: Partial<CreateProjectDto>) => api.patch<Project>(`/projects/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() })
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) })
    },
  })
}
