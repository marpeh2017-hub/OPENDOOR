import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Personal-area registration requests (/portal-registrations on the gateway):
 * people the sign-in cannot find yet, who confirmed their phone or email with
 * a code and wait for staff to put them on their apartment.
 */

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type RegistrationRelation = 'OWNER' | 'FAMILY' | 'TENANT'

export const RELATION_LABELS: Record<RegistrationRelation, string> = {
  OWNER: 'בעל/ת הדירה',
  FAMILY: 'בן/בת משפחה של בעל/ת הדירה',
  TENANT: 'שוכר/ת',
}

export interface RegistrationListItem {
  id: string
  fullName: string
  phone: string
  email: string | null
  address: string
  city: string
  apartmentNumber: string
  relation: RegistrationRelation
  verifiedVia: 'SMS' | 'EMAIL'
  status: RegistrationStatus
  leadId: string | null
  residentId: string | null
  createdAt: string
  decidedAt: string | null
  building: { id: string; address: string; projectName: string } | null
}

export interface RegistrationApartment {
  id: string
  apartmentNumber: string
  /** The apartment number the person gave. */
  suggested: boolean
  residents: { id: string; name: string; phone: string | null; email: string | null }[]
}

export interface RegistrationDetail extends Omit<RegistrationListItem, 'building'> {
  tenantId: string
  idNumber: string | null
  decisionNote: string | null
  decidedById: string | null
  matchedBuildingId: string | null
  updatedAt: string
  building: {
    id: string
    address: string
    city: string | null
    project: { id: string; name: string }
    apartments: RegistrationApartment[]
  } | null
}

export interface ApproveResult {
  status: 'APPROVED'
  residentId: string
  notifiedVia: 'SMS' | 'EMAIL' | null
  whatsappUrl: string
}

export const registrationKeys = {
  all: () => ['portal-registrations'] as const,
  list: (status?: RegistrationStatus) => [...registrationKeys.all(), 'list', status ?? 'ALL'] as const,
  detail: (id: string) => [...registrationKeys.all(), 'detail', id] as const,
}

export function useRegistrations(status?: RegistrationStatus) {
  return useQuery({
    queryKey: registrationKeys.list(status),
    queryFn: () => api.get<RegistrationListItem[]>(`/portal-registrations${status ? `?status=${status}` : ''}`),
    staleTime: 15_000,
  })
}

export function useRegistration(id: string) {
  return useQuery({
    queryKey: registrationKeys.detail(id),
    queryFn: () => api.get<RegistrationDetail>(`/portal-registrations/${id}`),
  })
}

export function useApproveRegistration(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { residentId?: string; apartmentId?: string; replacePhone?: boolean }) =>
      api.post<ApproveResult>(`/portal-registrations/${id}/approve`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: registrationKeys.all() }),
  })
}

export function useRejectRegistration(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (note: string) =>
      api.post<{ status: 'REJECTED' }>(`/portal-registrations/${id}/reject`, note.trim() ? { note: note.trim() } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: registrationKeys.all() }),
  })
}
