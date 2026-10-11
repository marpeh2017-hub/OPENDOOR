import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RepresentationProtocol } from '@urban-renewal/api-contracts'
import { api } from '@/lib/api-client'
import type { FormMeeting } from './use-forms'

/**
 * Representation protocols started on the website (/website-forms on the
 * gateway): a building that is not yet a project, an owner who filled in the
 * protocol and signed it, and the neighbours who signed through the link they
 * shared. Each one is also a lead. Nothing here is verified; the screens say
 * so.
 */

export type WebsiteFormStatus = 'OPEN' | 'CLOSED'

export interface WebsiteFormListItem {
  id: string
  status: WebsiteFormStatus
  leadId: string | null
  compoundName: string
  address: string
  initiator: { fullName: string; phone: string | null } | null
  signatures: number
  createdAt: string
}

export interface WebsiteFormRow {
  apartmentNumber: string
  fullName: string
  idNumber: string | null
  signedDate: string
  phone: string | null
  email: string | null
  signatureImage: string
  method: string
  isInitiator: boolean
  signedAt: string
}

export interface WebsiteFormDetail {
  id: string
  status: WebsiteFormStatus
  formVersion: string
  createdAt: string
  /** The neighbours' link, to send on to more of them. */
  shareUrl: string
  preparerIdNumber: string | null
  text: RepresentationProtocol
  building: { address: string; city: string; compoundName: string }
  meeting: FormMeeting
  members: { fullName: string; apartmentNumber: string; idNumber: string | null; signatureImage: string | null; signed: boolean }[]
  rows: WebsiteFormRow[]
  lead: { id: string; firstName: string; lastName: string; phone: string | null; status: string } | null
}

export const websiteFormKeys = {
  all: () => ['forms', 'website'] as const,
  list: () => [...websiteFormKeys.all(), 'list'] as const,
  detail: (id: string) => [...websiteFormKeys.all(), 'detail', id] as const,
}

export function useWebsiteForms() {
  return useQuery({
    queryKey: websiteFormKeys.list(),
    queryFn: () => api.get<WebsiteFormListItem[]>('/website-forms'),
    staleTime: 15_000,
  })
}

export function useWebsiteForm(id: string) {
  return useQuery({ queryKey: websiteFormKeys.detail(id), queryFn: () => api.get<WebsiteFormDetail>(`/website-forms/${id}`) })
}

/** Close the neighbours' link (no more rows), or open it again. */
export function useSetWebsiteFormStatus(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (status: WebsiteFormStatus) => api.patch<{ status: WebsiteFormStatus }>(`/website-forms/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: websiteFormKeys.all() }),
  })
}
