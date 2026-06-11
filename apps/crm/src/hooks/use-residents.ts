import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface Resident {
  id:          string
  firstName:   string
  lastName:    string
  phone:       string
  email?:      string
  status:      string
  aptNumber:   string
  floor?:      number
  projectId:   string
  project?:    { name: string; city: string }
  riskLevel?:  string
  createdAt:   string
}

export interface ResidentsResponse {
  data:  Resident[]
  total: number
}

export const residentKeys = {
  all:    ()           => ['residents'] as const,
  lists:  ()           => [...residentKeys.all(), 'list'] as const,
  list:   (f: object)  => [...residentKeys.lists(), f] as const,
  detail: (id: string) => [...residentKeys.all(), 'detail', id] as const,
}

export function useResidents(params?: { projectId?: string; status?: string; page?: number }) {
  const q = new URLSearchParams()
  if (params?.projectId) q.set('projectId', params.projectId)
  if (params?.status)    q.set('status',    params.status)
  if (params?.page)      q.set('page',      String(params.page))

  return useQuery({
    queryKey: residentKeys.list(params ?? {}),
    queryFn:  () => api.get<ResidentsResponse>(`/residents?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useResident(id: string) {
  return useQuery({
    queryKey: residentKeys.detail(id),
    queryFn:  () => api.get<Resident>(`/residents/${id}`),
    enabled:  Boolean(id),
  })
}

export function useUpdateResidentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<Resident>(`/residents/${id}`, { status }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: residentKeys.lists() })
      qc.invalidateQueries({ queryKey: residentKeys.detail(id) })
    },
  })
}
