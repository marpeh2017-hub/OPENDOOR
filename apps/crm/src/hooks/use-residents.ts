import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Mirrors ResidentsService in the API Gateway.
 * NOTE: `nationalId` is deliberately absent — the API redacts it before the
 * payload leaves the server. Do not add it here.
 */
export interface Resident {
  id:                  string
  tenantId:            string
  apartmentId:         string | null
  firstName:           string
  lastName:            string
  phone:               string | null
  phone2:              string | null
  email:               string | null
  ownershipPercentage: number | null
  isPrimaryContact:    boolean
  signatureStatus:     string
  isObjecting:         boolean
  objectionReason:     string | null
  riskScore:           number
  preferredChannel:    string | null
  doNotContact:        boolean
  notes:               string | null
  createdAt:           string
  updatedAt:           string
  apartment?: {
    id:              string
    apartmentNumber: string
    floor:           number | null
    rooms:           number | null
    sizeSqm:         number | null
    building?: {
      id:      string
      address: string
      city:    string
      complex?: { id: string; name: string; project?: { id?: string; name: string; city: string; stage?: string } }
    }
  } | null
  signatures?: { status: string; signedAt: string | null }[]
}

export interface ResidentActivity {
  id:        string
  type:      string
  title:     string
  note:      string | null
  createdAt: string
}

export interface ResidentDetail extends Resident {
  activityLog: ResidentActivity[]
  tasks:       { id: string; title: string; status: string; priority: string; dueDate: string | null }[]
  tickets:     { id: string; subject?: string; status: string; createdAt: string }[]
}

export interface ResidentsResponse {
  data:  Resident[]
  total: number
  page:  number
  limit: number
}

export const residentKeys = {
  all:    ()           => ['residents'] as const,
  lists:  ()           => [...residentKeys.all(), 'list'] as const,
  list:   (f: object)  => [...residentKeys.lists(), f] as const,
  detail: (id: string) => [...residentKeys.all(), 'detail', id] as const,
}

export function useResidents(params?: {
  projectId?: string
  signatureStatus?: string
  search?: string
  page?: number
  limit?: number
}) {
  const q = new URLSearchParams()
  if (params?.projectId)       q.set('projectId',       params.projectId)
  if (params?.signatureStatus) q.set('signatureStatus', params.signatureStatus)
  if (params?.search)          q.set('search',          params.search)
  if (params?.page)            q.set('page',            String(params.page))
  if (params?.limit)           q.set('limit',           String(params.limit))

  return useQuery({
    queryKey: residentKeys.list(params ?? {}),
    queryFn:  () => api.get<ResidentsResponse>(`/residents?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useResident(id: string) {
  return useQuery({
    queryKey: residentKeys.detail(id),
    queryFn:  () => api.get<ResidentDetail>(`/residents/${id}`),
    enabled:  Boolean(id),
    staleTime: 30_000,
  })
}

/** Mirrors RESIDENT_SIGNATURE_STATUSES in residents/dto/resident-actions.dto.ts. */
export const RESIDENT_SIGNATURE_STATUSES: Record<string, string> = {
  NOT_CONTACTED: 'לא נוצר קשר',
  CONTACTED:     'נוצר קשר',
  INTERESTED:    'מעוניין',
  SIGNED:        'חתם',
  OBJECTING:     'מתנגד',
  UNDECIDED:     'לא החליט',
  UNREACHABLE:   'לא זמין',
}

/**
 * Mirrors CreateResidentDto.
 *
 * `nationalId` is write-only: it may be SENT on create/update, and the API
 * encrypts it and never returns it. It is deliberately absent from `Resident`
 * above — do not add it there, and never log this value.
 */
export interface CreateResidentDto {
  apartmentId:          string
  firstName:            string
  lastName:             string
  nationalId?:          string
  phone?:               string
  phone2?:              string
  email?:               string
  ownershipPercentage?: number
  language?:            string
  preferredChannel?:    string
  isPrimaryContact?:    boolean
  doNotContact?:        boolean
  notes?:               string
}

/** `apartmentId` is not updatable — moving a resident is its own endpoint. */
export type UpdateResidentDto = Omit<CreateResidentDto, 'apartmentId'>

export function useCreateResident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateResidentDto) => api.post<Resident>('/residents', dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: residentKeys.lists() }) },
  })
}

export function useUpdateResident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & UpdateResidentDto) =>
      api.patch<Resident>(`/residents/${id}`, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: residentKeys.lists() })
      qc.invalidateQueries({ queryKey: residentKeys.detail(v.id) })
    },
  })
}

/**
 * PATCH /residents/:id/apartment — MANAGER_ROLES only.
 * A move changes which project's signature threshold the resident counts
 * towards, which is why it is separately audited rather than a plain field.
 */
export function useMoveResident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, apartmentId }: { id: string; apartmentId: string }) =>
      api.patch<Resident>(`/residents/${id}/apartment`, { apartmentId }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: residentKeys.lists() })
      qc.invalidateQueries({ queryKey: residentKeys.detail(v.id) })
      qc.invalidateQueries({ queryKey: ['buildings'] })
    },
  })
}

export function useSetResidentActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<Resident>(`/residents/${id}/active`, { isActive }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: residentKeys.lists() })
      qc.invalidateQueries({ queryKey: residentKeys.detail(v.id) })
    },
  })
}

/** DELETE /residents/:id archives — history and signatures are preserved. */
export function useArchiveResident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<Resident>(`/residents/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: residentKeys.lists() })
      qc.invalidateQueries({ queryKey: residentKeys.detail(id) })
    },
  })
}

/** POST /residents/bulk/signature-status — one server-side transaction. */
export function useBulkResidentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ids: string[]; status: string }) =>
      api.post<{ updated: number; status: string }>('/residents/bulk/signature-status', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: residentKeys.all() }) },
  })
}

export function useUpdateResidentStatus() {
  const qc = useQueryClient()
  return useMutation({
    // ResidentsController exposes @Patch(':id/signature-status') taking { status }.
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<Resident>(`/residents/${id}/signature-status`, { status }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: residentKeys.lists() })
      qc.invalidateQueries({ queryKey: residentKeys.detail(id) })
    },
  })
}

export function useAddResidentActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, type, title, note }: { id: string; type: string; title: string; note?: string }) =>
      api.post<ResidentActivity>(`/residents/${id}/activity`, { type, title, note }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: residentKeys.detail(id) })
    },
  })
}
