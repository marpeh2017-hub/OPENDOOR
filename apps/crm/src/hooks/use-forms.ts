import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RepresentationProtocol } from '@urban-renewal/api-contracts'
import { api } from '@/lib/api-client'

/**
 * Digital forms (/forms on the gateway): the representation-appointment
 * protocol, made for a complex, sent to its owners and tracked to the last
 * signature. The wording itself is @urban-renewal/api-contracts'; the gateway
 * keeps the snapshot it was sent with, and everything here reads that.
 */

export interface FormMeeting {
  compoundName: string
  address: string
  meetingDate: string
  meetingPlace: string
}

export interface FormProgress {
  owners: number
  ownersSigned: number
  apartments: number
  apartmentsSigned: number
  sharePercent: number
}

export type FormStatus =
  | 'DRAFT' | 'INTERNAL_REVIEW' | 'APPROVED' | 'SENT'
  | 'PARTIALLY_SIGNED' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED'

export interface FormListItem {
  id: string
  formType: string
  formVersion: string
  title: string
  status: FormStatus
  project: { id: string; name: string } | null
  compoundName: string
  address: string
  createdAt: string
  updatedAt: string
  progress: FormProgress
}

export interface FormRecordRow {
  recordId: string
  ownerId: string
  apartmentId: string
  apartmentNumber: string
  buildingAddress: string
  ownerName: string
  phone: string | null
  email: string | null
  share: number | null
  status: string
  method: string
  openedAt: string | null
  signedAt: string | null
  signedVia: 'LINK' | 'PORTAL' | 'MANUAL' | null
  deliveredVia: 'SMS' | 'EMAIL' | 'WHATSAPP' | 'UNSENT' | 'NONE' | 'FAILED' | null
  deliveredAt: string | null
  lastReminderAt: string | null
  hasPaperCopy: boolean
  isRepresentative: boolean
  /** Signed with an ID number other than the one on the owner's file. */
  idMismatch: boolean
}

export interface FormDetail {
  id: string
  formType: string
  formVersion: string
  title: string
  status: FormStatus
  documentHash: string | null
  project: { id: string; name: string } | null
  complexId: string
  text: RepresentationProtocol
  meeting: FormMeeting
  representatives: { ownerId: string; apartmentId: string; fullName: string; apartmentNumber: string; signed: boolean }[]
  records: FormRecordRow[]
  progress: FormProgress
  sentAt: string | null
  createdAt: string
  completedAt: string | null
  /** What the system sends by itself. WhatsApp from the CRM needs neither. */
  channels: { sms: boolean; email: boolean }
}

export interface FormDocumentRow {
  apartmentNumber: string
  fullName: string
  idNumber: string | null
  signedDate: string | null
  phone: string | null
  email: string | null
  signatureImage: string | null
  method: string
  channel: string | null
}

export interface FormDocument {
  packageId: string
  formVersion: string
  documentHash: string | null
  status: FormStatus
  completedAt: string | null
  text: RepresentationProtocol
  meeting: FormMeeting
  representatives: {
    fullName: string
    idNumber: string | null
    apartmentNumber: string
    signatureImage: string | null
    signed: boolean
    method: string | null
  }[]
  rows: FormDocumentRow[]
  totals: { owners: number; signed: number }
  preparerIdNumber: string | null
  generatedAt: string
}

export interface FormScope {
  id: string
  name: string
  complexes: { id: string; name: string; address: string | null; buildings: number; owners: number }[]
}

export const formKeys = {
  all: () => ['forms'] as const,
  list: () => [...formKeys.all(), 'list'] as const,
  scopes: () => [...formKeys.all(), 'scopes'] as const,
  detail: (id: string) => [...formKeys.all(), 'detail', id] as const,
  document: (id: string) => [...formKeys.all(), 'document', id] as const,
}

export function useForms() {
  return useQuery({ queryKey: formKeys.list(), queryFn: () => api.get<FormListItem[]>('/forms'), staleTime: 15_000 })
}

export function useFormScopes() {
  return useQuery({ queryKey: formKeys.scopes(), queryFn: () => api.get<FormScope[]>('/forms/scopes') })
}

export function useForm(id: string) {
  return useQuery({ queryKey: formKeys.detail(id), queryFn: () => api.get<FormDetail>(`/forms/${id}`) })
}

export function useFormDocument(id: string) {
  return useQuery({ queryKey: formKeys.document(id), queryFn: () => api.get<FormDocument>(`/forms/${id}/document`) })
}

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { templateId: string; projectId: string; complexId: string; text: RepresentationProtocol }) =>
      api.post<FormDetail>('/forms', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.list() }),
  })
}

/** Writes the form's detail back into the cache, so the screen shows what the server stored. */
function useDetailMutation<TInput>(id: string, run: (input: TInput) => Promise<FormDetail>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (detail) => {
      qc.setQueryData(formKeys.detail(id), detail)
      qc.invalidateQueries({ queryKey: formKeys.list() })
    },
  })
}

export function useUpdateForm(id: string) {
  return useDetailMutation(id, (input: { meeting?: Partial<FormMeeting>; representatives?: { ownerId: string; apartmentId: string }[] }) =>
    api.patch<FormDetail>(`/forms/${id}`, input),
  )
}

export function useSendForm(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ sent: true; delivery: Record<'SMS' | 'EMAIL' | 'NONE' | 'FAILED', number> }>(`/forms/${id}/send`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: formKeys.detail(id) })
      qc.invalidateQueries({ queryKey: formKeys.list() })
    },
  })
}

export function useRemind(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) => api.post<{ sent: true; channel: string }>(`/forms/${id}/records/${recordId}/remind`),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.detail(id) }),
  })
}

export function useRemindAll(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<{ sent: number; skippedRecent: number; noChannel: number; whatsApp: number; failed: number }>(
        `/forms/${id}/remind`,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.detail(id) }),
  })
}

/**
 * An owner's personal link, to copy or to send on WhatsApp from the staff
 * member's own phone. Each call is logged; a WhatsApp send also counts as
 * the link going out.
 */
export function useShareLink(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { recordId: string; via: 'WHATSAPP' | 'COPY' }) =>
      api.post<{ url: string; text: string; whatsappUrl: string | null }>(
        `/forms/${id}/records/${input.recordId}/link`,
        { via: input.via },
      ),
    onSuccess: (_data, input) => {
      if (input.via === 'WHATSAPP') qc.invalidateQueries({ queryKey: formKeys.detail(id) })
    },
  })
}

export function usePaperSignature(id: string) {
  return useDetailMutation(id, (input: { recordId: string; fullName: string; idNumber?: string; signedDate: string; documentId: string }) => {
    const { recordId, ...body } = input
    return api.post<FormDetail>(`/forms/${id}/records/${recordId}/paper`, body)
  })
}

export function useCancelForm(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<{ cancelled: true }>(`/forms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.all() }),
  })
}

/** An Israeli mobile number, the kind that can take an SMS or a WhatsApp. */
export function isMobile(phone: string | null | undefined): boolean {
  const digits = (phone ?? '').replace(/\D/g, '')
  return /^05\d{8}$/.test(digits) || /^9725\d{8}$/.test(digits)
}

/**
 * How a link will go, judged as the gateway judges it: SMS to a mobile when
 * there is an SMS provider, else email, else WhatsApp by hand from the CRM
 * for a mobile, else paper.
 */
export function deliveryOf(
  row: { phone: string | null; email: string | null },
  channels: { sms: boolean },
): 'SMS' | 'EMAIL' | 'WHATSAPP' | 'NONE' {
  const mobile = isMobile(row.phone)
  if (mobile && channels.sms) return 'SMS'
  if (row.email) return 'EMAIL'
  if (mobile) return 'WHATSAPP'
  return 'NONE'
}

/** 2026-10-20 → 20.10.2026, the way the protocol's date line is written. */
export function formatFormDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}.${m}.${y}` : ''
}
