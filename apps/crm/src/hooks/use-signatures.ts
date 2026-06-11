import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface SignatureRequest {
  id:          string
  residentId:  string
  projectId:   string
  status:      string
  sentAt?:     string
  signedAt?:   string
  reminders:   number
  resident?:   { firstName: string; lastName: string; phone: string }
  project?:    { name: string; city: string }
}

export const sigKeys = {
  all:    ()           => ['signatures'] as const,
  lists:  ()           => [...sigKeys.all(), 'list'] as const,
  list:   (f: object)  => [...sigKeys.lists(), f] as const,
}

export function useSignatures(params?: { projectId?: string; status?: string }) {
  const q = new URLSearchParams()
  if (params?.projectId) q.set('projectId', params.projectId)
  if (params?.status)    q.set('status',    params.status)

  return useQuery({
    queryKey: sigKeys.list(params ?? {}),
    queryFn:  () => api.get<{ data: SignatureRequest[]; total: number }>(`/signatures?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useSendSignatureRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (residentId: string) =>
      api.post<SignatureRequest>('/signatures', { residentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sigKeys.lists() }),
  })
}

export function useSendReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<SignatureRequest>(`/signatures/${id}/remind`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: sigKeys.lists() }),
  })
}
