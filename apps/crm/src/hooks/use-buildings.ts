import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Mirrors BuildingsController / ComplexesController / ApartmentsController.
 *
 * Buildings have no tenantId of their own — the API scopes them through
 * Project → Complex → Building, so anything returned here is already
 * tenant-safe.
 */

export interface BuildingProjectRef {
  id:    string
  name:  string
  code:  string
  stage: string
}

export interface BuildingComplexRef {
  id:      string
  name:    string
  project: BuildingProjectRef
}

/** Row shape from GET /buildings. */
export interface BuildingListItem {
  id:               string
  complexId:        string
  address:          string
  streetNumber:     string | null
  city:             string | null
  zipCode:          string | null
  floors:           number | null
  totalApartments:  number | null
  constructionYear: number | null
  buildingClass:    string | null
  status:           string
  createdAt:        string
  updatedAt:        string
  complex:          BuildingComplexRef
  apartmentCount:   number
  residentCount:    number
}

export interface ApartmentResident {
  id:              string
  firstName:       string
  lastName:        string
  phone?:          string | null
  signatureStatus: string
}

export interface ApartmentOwnerHolding {
  id:               string
  shareNumerator:   number
  shareDenominator: number
  owner: { id: string; fullName: string; isEstate: boolean }
}

export interface BuildingApartment {
  id:              string
  apartmentNumber: string
  floor:           number | null
  sizeSqm:         number | null
  rooms:           number | null
  hasParking:      boolean
  parkingSpots:    number
  hasStorage:      boolean
  hasBalcony:      boolean
  status:          string
  residents:       ApartmentResident[]
  owners:          ApartmentOwnerHolding[]
}

/** Shape from GET /buildings/:id. */
export interface BuildingDetail extends Omit<BuildingListItem, 'apartmentCount' | 'residentCount'> {
  apartments: BuildingApartment[]
}

export interface ComplexListItem {
  id:        string
  name:      string
  address:   string | null
  status:    string
  projectId: string
  project:   { id: string; name: string; code: string }
  _count:    { buildings: number }
}

export const buildingKeys = {
  all:    ()                 => ['buildings'] as const,
  lists:  ()                 => [...buildingKeys.all(), 'list'] as const,
  list:   (f: object)        => [...buildingKeys.lists(), f] as const,
  detail: (id: string)       => [...buildingKeys.all(), 'detail', id] as const,
  complexes: (f: object)     => ['complexes', f] as const,
}

export function useBuildings(params?: { projectId?: string; city?: string; search?: string }) {
  const q = new URLSearchParams()
  if (params?.projectId) q.set('projectId', params.projectId)
  if (params?.city)      q.set('city',      params.city)
  if (params?.search)    q.set('search',    params.search)

  return useQuery({
    queryKey: buildingKeys.list(params ?? {}),
    queryFn:  () => api.get<BuildingListItem[]>(`/buildings?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useBuilding(id: string) {
  return useQuery({
    queryKey: buildingKeys.detail(id),
    queryFn:  () => api.get<BuildingDetail>(`/buildings/${id}`),
    enabled:  Boolean(id),
    staleTime: 30_000,
  })
}

export function useComplexes(projectId?: string) {
  const q = new URLSearchParams()
  if (projectId) q.set('projectId', projectId)

  return useQuery({
    queryKey: buildingKeys.complexes({ projectId }),
    queryFn:  () => api.get<ComplexListItem[]>(`/complexes?${q.toString()}`),
    staleTime: 5 * 60_000,
  })
}

export interface CreateBuildingDto {
  complexId:         string
  address:           string
  streetNumber?:     string
  city?:             string
  zipCode?:          string
  floors?:           number
  totalApartments?:  number
  constructionYear?: number
  buildingClass?:    string
}

/** POST /buildings — MANAGER_ROLES only; other roles get a 403 ApiError. */
export function useCreateBuilding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateBuildingDto) => api.post<BuildingListItem>('/buildings', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.lists() }),
  })
}

export function useUpdateBuilding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<CreateBuildingDto>) =>
      api.patch<BuildingListItem>(`/buildings/${id}`, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: buildingKeys.lists() })
      qc.invalidateQueries({ queryKey: buildingKeys.detail(vars.id) })
    },
  })
}

export function useDeleteBuilding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<BuildingListItem>(`/buildings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.lists() }),
  })
}

/**
 * PATCH /buildings/:id/status — 'active' | 'archived'. Archiving a building
 * archives its apartments too (server-side, in one transaction).
 */
export function useSetBuildingStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'archived' }) =>
      api.patch<BuildingListItem>(`/buildings/${id}/status`, { status }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: buildingKeys.lists() })
      qc.invalidateQueries({ queryKey: buildingKeys.detail(v.id) })
    },
  })
}

/**
 * PATCH /buildings/:id/complex — moving a building between complexes is its own
 * endpoint precisely because `complexId` is not settable on a general update.
 */
export function useMoveBuilding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, complexId }: { id: string; complexId: string }) =>
      api.patch<BuildingListItem>(`/buildings/${id}/complex`, { complexId }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: buildingKeys.lists() })
      qc.invalidateQueries({ queryKey: buildingKeys.detail(v.id) })
    },
  })
}

// ── Bulk (MANAGER_ROLES; each endpoint is one server-side transaction) ───────

export function useBulkBuildingStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ids: string[]; status: 'active' | 'archived' }) =>
      api.post<{ updated: number; status: string }>('/buildings/bulk/status', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.all() }),
  })
}

export function useBulkMoveBuildings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ids: string[]; complexId: string }) =>
      api.post<{ moved: number; complexId: string }>('/buildings/bulk/move', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.all() }),
  })
}

// ── Apartments (ApartmentsController, same buildings.controller.ts file) ─────

export interface CreateApartmentDto {
  buildingId:      string
  apartmentNumber: string
  floor?:          number
  sizeSqm?:        number
  rooms?:          number
  hasParking?:     boolean
  parkingSpots?:   number
  hasStorage?:     boolean
  storageCount?:   number
  hasBalcony?:     boolean
  balconySqm?:     number
  notes?:          string
}

/** UpdateApartmentDto omits `buildingId` — an apartment cannot change building. */
export type UpdateApartmentDto = Omit<CreateApartmentDto, 'buildingId'>

export const apartmentKeys = {
  all:    ()           => ['apartments'] as const,
  list:   (f: object)  => [...apartmentKeys.all(), 'list', f] as const,
  detail: (id: string) => [...apartmentKeys.all(), 'detail', id] as const,
  owners: (id: string) => [...apartmentKeys.all(), 'owners', id] as const,
}

/** Row shape from GET /apartments — a flat list for pickers. */
export interface ApartmentListItem {
  id:              string
  buildingId:      string
  apartmentNumber: string
  floor:           number | null
  rooms:           number | null
  sizeSqm:         number | null
  status:          string
}

/**
 * GET /apartments — optionally scoped to one building.
 *
 * Used by the resident forms to pick a target apartment. Pass a building id
 * rather than fetching every apartment in the tenant and filtering client-side.
 */
export function useApartments(buildingId?: string, enabled = true) {
  const q = new URLSearchParams()
  if (buildingId) q.set('buildingId', buildingId)

  return useQuery({
    queryKey: apartmentKeys.list({ buildingId }),
    queryFn:  () => api.get<ApartmentListItem[]>(`/apartments?${q.toString()}`),
    enabled,
    staleTime: 60_000,
  })
}

export function useCreateApartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateApartmentDto) => api.post<BuildingApartment>('/apartments', dto),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: buildingKeys.detail(v.buildingId) })
      qc.invalidateQueries({ queryKey: buildingKeys.lists() })
    },
  })
}

export function useUpdateApartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, buildingId: _b, ...patch }: { id: string; buildingId?: string } & UpdateApartmentDto) =>
      api.patch<BuildingApartment>(`/apartments/${id}`, patch),
    onSuccess: (_d, v) => {
      if (v.buildingId) qc.invalidateQueries({ queryKey: buildingKeys.detail(v.buildingId) })
      qc.invalidateQueries({ queryKey: buildingKeys.all() })
      qc.invalidateQueries({ queryKey: apartmentKeys.detail(v.id) })
    },
  })
}

/** DELETE /apartments/:id archives — ownership and signature history survive. */
export function useArchiveApartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; buildingId?: string }) =>
      api.delete<BuildingApartment>(`/apartments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.all() }),
  })
}

export function useSetApartmentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'archived'; buildingId?: string }) =>
      api.patch<BuildingApartment>(`/apartments/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.all() }),
  })
}

// ── Apartment ownership ─────────────────────────────────────────────────────

/**
 * Shares are EXACT integer fractions on the wire. The server recomputes the sum
 * with BigInt rationals (src/common/fractions) and is the only authority on
 * whether a set is complete — `sum` below is that exact reduced value, not a
 * float, and must be rendered as num/den rather than divided.
 */
export interface ApartmentOwnersResponse {
  apartmentId: string
  owners: {
    id:               string
    apartmentId:      string
    ownerId:          string
    shareNumerator:   number
    shareDenominator: number
    viaInheritance:   boolean
    owner: { id: string; fullName: string; isEstate: boolean; phone: string | null; email: string | null }
  }[]
  sum:        { num: number; den: number }
  /** True only when the shares sum to EXACTLY 1 — never "close to 1". */
  isComplete: boolean
}

export interface OwnershipAssignmentInput {
  ownerId:          string
  shareNumerator:   number
  shareDenominator: number
  viaInheritance?:  boolean
}

export function useApartmentOwners(id: string) {
  return useQuery({
    queryKey: apartmentKeys.owners(id),
    queryFn:  () => api.get<ApartmentOwnersResponse>(`/apartments/${id}/owners`),
    enabled:  Boolean(id),
    staleTime: 30_000,
  })
}

/**
 * PUT /apartments/:id/owners — replaces the apartment's ownership wholesale.
 *
 * `requireCompleteShares` is left to the caller: the API defaults it to false
 * because real tabu extracts routinely arrive with missing heirs, and blocking
 * the write pushes staff to invent shares. An incomplete set is recorded and
 * flagged rather than rejected, and can never count as fully signed.
 */
export function useSetApartmentOwners() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, owners, requireCompleteShares }: {
      id: string
      owners: OwnershipAssignmentInput[]
      requireCompleteShares?: boolean
      buildingId?: string
    }) =>
      api.put<ApartmentOwnersResponse>(`/apartments/${id}/owners`, {
        owners,
        ...(requireCompleteShares === undefined ? {} : { requireCompleteShares }),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: apartmentKeys.owners(v.id) })
      qc.invalidateQueries({ queryKey: buildingKeys.all() })
      qc.invalidateQueries({ queryKey: ['owners'] })
    },
  })
}

export function useRemoveApartmentOwner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ownerId }: { id: string; ownerId: string }) =>
      api.delete<ApartmentOwnersResponse>(`/apartments/${id}/owners/${ownerId}`),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: apartmentKeys.owners(v.id) })
      qc.invalidateQueries({ queryKey: buildingKeys.all() })
      qc.invalidateQueries({ queryKey: ['owners'] })
    },
  })
}
