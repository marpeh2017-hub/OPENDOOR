import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { buildingKeys } from './use-buildings'

/**
 * Mirrors OwnersController / OwnersService.
 *
 * Owner is NOT Resident. An Owner holds registered title (tabu) and may live
 * abroad, be an estate with unsettled inheritance, or hold shares in several
 * apartments; a Resident physically lives there and may hold no title at all.
 * The two are linked only through the optional `Owner.residentId`. They are
 * never merged, and this hook never reads or writes resident state.
 *
 * `nationalId` is absent from every type below on purpose: the service
 * AES-256-GCM encrypts it and returns only `hasNationalId` + `nationalIdMasked`.
 * Do not add a plaintext field here, and never log the masked one either.
 */

export interface Owner {
  id:              string
  fullName:        string
  phone:           string | null
  email:           string | null
  addressAbroad:   string | null
  isEstate:        boolean
  guardianContact: string | null
  notes:           string | null
  residentId:      string | null
  isActive:        boolean
  createdAt:       string
  updatedAt:       string
  /** Derived server-side — never the ID itself. */
  hasNationalId:    boolean
  nationalIdMasked: string | null
  apartmentCount:   number
  signatureCount:   number
}

export interface OwnerHolding {
  id:               string
  shareNumerator:   number
  shareDenominator: number
  viaInheritance:   boolean
  apartment: {
    id:              string
    apartmentNumber: string
    floor:           number | null
    status:          string
    building: {
      id:           string
      address:      string
      streetNumber: string | null
      city:         string | null
      complex: {
        id:        string
        name:      string
        projectId: string
        project:   { id: string; name: string; code: string }
      }
    }
  }
}

export interface OwnerDetail extends Omit<Owner, 'apartmentCount' | 'signatureCount'> {
  holdings:   OwnerHolding[]
  signatures: {
    id: string
    status: string
    signedAt: string | null
    package: { id: string; title: string; version: number; status: string; projectId: string }
  }[]
  resident: { id: string; firstName: string; lastName: string } | null
}

export interface CreateOwnerDto {
  fullName:         string
  /** Sent once on write, never read back. Encrypted at rest by the API. */
  nationalId?:      string
  phone?:           string
  email?:           string
  addressAbroad?:   string
  isEstate?:        boolean
  guardianContact?: string
  notes?:           string
  residentId?:      string
}

export const ownerKeys = {
  all:      ()           => ['owners'] as const,
  lists:    ()           => [...ownerKeys.all(), 'list'] as const,
  list:     (f: object)  => [...ownerKeys.lists(), f] as const,
  detail:   (id: string) => [...ownerKeys.all(), 'detail', id] as const,
  holdings: (id: string) => [...ownerKeys.all(), 'holdings', id] as const,
}

export interface OwnerFilters {
  projectId?: string
  search?:    string
  isActive?:  boolean
  isEstate?:  boolean
}

export function useOwners(filters: OwnerFilters = {}) {
  const q = new URLSearchParams()
  if (filters.projectId)       q.set('projectId', filters.projectId)
  if (filters.search)          q.set('search',    filters.search)
  if (filters.isActive !== undefined) q.set('isActive', String(filters.isActive))
  if (filters.isEstate !== undefined) q.set('isEstate', String(filters.isEstate))

  return useQuery({
    queryKey: ownerKeys.list(filters),
    queryFn:  () => api.get<Owner[]>(`/owners?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useOwner(id: string) {
  return useQuery({
    queryKey: ownerKeys.detail(id),
    queryFn:  () => api.get<OwnerDetail>(`/owners/${id}`),
    enabled:  Boolean(id),
    staleTime: 30_000,
  })
}

/** POST /owners — MANAGER_ROLES only; other roles get a 403 ApiError. */
export function useCreateOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateOwnerDto) => api.post<Owner>('/owners', dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ownerKeys.lists() }) },
  })
}

export function useUpdateOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<CreateOwnerDto>) =>
      api.patch<Owner>(`/owners/${id}`, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ownerKeys.lists() })
      qc.invalidateQueries({ queryKey: ownerKeys.detail(v.id) })
    },
  })
}

/** PATCH /owners/:id/active — deactivate keeps holdings and signature history. */
export function useSetOwnerActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<Owner>(`/owners/${id}/active`, { isActive }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ownerKeys.lists() })
      qc.invalidateQueries({ queryKey: ownerKeys.detail(v.id) })
    },
  })
}

/** DELETE /owners/:id — a soft archive in the API, not a hard delete. */
export function useArchiveOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<Owner>(`/owners/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ownerKeys.lists() })
      qc.invalidateQueries({ queryKey: ownerKeys.detail(id) })
      // A holding change moves the ownership sums shown on the buildings screen.
      qc.invalidateQueries({ queryKey: buildingKeys.all() })
    },
  })
}

export function useOwnerHoldings(id: string) {
  return useQuery({
    queryKey: ownerKeys.holdings(id),
    queryFn:  () => api.get<OwnerHolding[]>(`/owners/${id}/holdings`),
    enabled:  Boolean(id),
    staleTime: 30_000,
  })
}

/**
 * PATCH /owners/:id/holdings — set THIS owner's share of ONE apartment.
 *
 * The numerator/denominator pair is passed straight through as exact integers.
 * Never compute a share as a float and round it before calling this.
 */
export function useSetOwnerShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: {
      id: string
      apartmentId: string
      shareNumerator: number
      shareDenominator: number
      viaInheritance?: boolean
    }) => {
      const { id, ...body } = v
      return api.patch<unknown>(`/owners/${id}/holdings`, body)
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ownerKeys.holdings(v.id) })
      qc.invalidateQueries({ queryKey: ownerKeys.detail(v.id) })
      qc.invalidateQueries({ queryKey: buildingKeys.all() })
    },
  })
}

export function useRemoveOwnerHolding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, apartmentId }: { id: string; apartmentId: string }) =>
      api.delete<unknown>(`/owners/${id}/holdings/${apartmentId}`),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ownerKeys.holdings(v.id) })
      qc.invalidateQueries({ queryKey: ownerKeys.detail(v.id) })
      qc.invalidateQueries({ queryKey: buildingKeys.all() })
    },
  })
}
