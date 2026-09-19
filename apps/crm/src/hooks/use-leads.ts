import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/** Mirrors the Lead model served by LeadsController. */
export interface Lead {
  id:           string
  tenantId:     string
  firstName:    string
  lastName:     string
  phone:        string | null
  email:        string | null
  address:      string | null
  city:         string | null
  source:       string | null
  status:       string
  score:        number
  notes:        string | null
  tags:         string[]
  estimatedUnits: number | null
  leadType:     string | null
  projectType:  string | null
  organizingStatus: string | null
  formType:     string | null
  consentContact: boolean
  consentPrivacy: boolean
  consentRecordedAt: string | null
  privacyPolicyVersion: string | null
  utmSource:    string | null
  utmMedium:    string | null
  utmCampaign:  string | null
  submissionId: string | null
  matchedBuildingId: string | null
  possibleDuplicateOfId: string | null
  assignedToId: string | null
  convertedToResidentId: string | null
  convertedAt:  string | null
  createdAt:    string
  updatedAt:    string
}

export interface LeadsResponse {
  data:  Lead[]
  total: number
  page:  number
  limit: number
}

export const leadKeys = {
  all:    ()           => ['leads'] as const,
  lists:  ()           => [...leadKeys.all(), 'list'] as const,
  list:   (f: object)  => [...leadKeys.lists(), f] as const,
  detail: (id: string) => [...leadKeys.all(), 'detail', id] as const,
}

export function useLeads(params?: {
  status?: string
  source?: string
  city?: string
  search?: string
  page?: number
  limit?: number
}) {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.source) q.set('source', params.source)
  if (params?.city)   q.set('city', params.city)
  if (params?.search) q.set('search', params.search)
  if (params?.page)   q.set('page',   String(params.page))
  if (params?.limit)  q.set('limit',  String(params.limit))

  return useQuery({
    queryKey: leadKeys.list(params ?? {}),
    queryFn:  () => api.get<LeadsResponse>(`/leads?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useMoveLead() {
  const qc = useQueryClient()
  return useMutation({
    // LeadsController exposes @Patch(':id/status') taking { status }.
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<Lead>(`/leads/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.lists() }),
  })
}

export function useAddLeadActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, type, note }: { id: string; type: string; note: string }) =>
      api.post<unknown>(`/leads/${id}/activity`, { type, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.lists() }),
  })
}
