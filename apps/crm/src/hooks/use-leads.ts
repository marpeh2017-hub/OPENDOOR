import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface Lead {
  id:          string
  title:       string
  address:     string
  city:        string
  totalUnits:  number
  status:      string
  priority?:   string
  source?:     string
  assignedTo?: string
  estimatedValue?: number
  createdAt:   string
}

export interface LeadsResponse {
  data:  Lead[]
  total: number
}

export const leadKeys = {
  all:    ()           => ['leads'] as const,
  lists:  ()           => [...leadKeys.all(), 'list'] as const,
  list:   (f: object)  => [...leadKeys.lists(), f] as const,
  detail: (id: string) => [...leadKeys.all(), 'detail', id] as const,
}

export function useLeads(params?: { status?: string; assignedTo?: string }) {
  const q = new URLSearchParams()
  if (params?.status)     q.set('status',     params.status)
  if (params?.assignedTo) q.set('assignedTo', params.assignedTo)

  return useQuery({
    queryKey: leadKeys.list(params ?? {}),
    queryFn:  () => api.get<LeadsResponse>(`/leads?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useMoveLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<Lead>(`/leads/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.lists() }),
  })
}
