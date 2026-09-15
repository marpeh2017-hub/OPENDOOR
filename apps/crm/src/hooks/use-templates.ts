import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useCurrentUser } from './use-auth'

/**
 * Mirrors TemplatesController (`/communication-templates`).
 *
 * `variables` is READ-ONLY here on purpose: the server derives it from the body
 * text on every write. Sending it would be rejected by `forbidNonWhitelisted`,
 * and more importantly it would create a second source of truth that drifts
 * from the actual `{{placeholders}}`.
 */

export const MESSAGE_CHANNELS = ['WHATSAPP', 'SMS', 'EMAIL', 'PUSH', 'IN_APP', 'PORTAL'] as const
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number]

/** Channels a template can actually be sent on today. */
export const SENDABLE_CHANNELS = ['SMS', 'WHATSAPP', 'EMAIL'] as const

export const CHANNEL_LABELS: Record<MessageChannel, string> = {
  WHATSAPP: 'וואטסאפ',
  SMS:      'SMS',
  EMAIL:    'אימייל',
  PUSH:     'התראת דחיפה',
  IN_APP:   'בתוך המערכת',
  PORTAL:   'פורטל דיירים',
}

export const TEMPLATE_LANGUAGES = ['he', 'en', 'ru', 'ar'] as const
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<TemplateLanguage, string> = {
  he: 'עברית', en: 'אנגלית', ru: 'רוסית', ar: 'ערבית',
}

export interface CommunicationTemplate {
  id:        string
  name:      string
  channel:   MessageChannel
  language:  TemplateLanguage
  subject:   string | null
  body:      string
  /** Derived server-side from the body/subject. Never sent on a write. */
  variables: string[]
  isActive:   boolean
  isApproved: boolean
  waTemplateName: string | null
  waCategory:     string | null
  createdAt: string
  updatedAt: string
}

export interface TemplatePreview {
  id:        string
  channel:   MessageChannel
  language:  TemplateLanguage
  subject:   string | null
  body:      string
  variables: string[]
}

export const templateKeys = {
  all:   ()          => ['communication-templates'] as const,
  lists: ()          => [...templateKeys.all(), 'list'] as const,
  list:  (f: object) => [...templateKeys.lists(), f] as const,
  one:   (id: string) => [...templateKeys.all(), id] as const,
}

export interface TemplateFilters {
  channel?:  MessageChannel
  language?: TemplateLanguage
  isActive?: boolean
}

export function useTemplates(filters: TemplateFilters = {}) {
  const q = new URLSearchParams()
  if (filters.channel)  q.set('channel', filters.channel)
  if (filters.language) q.set('language', filters.language)
  // `false` is a meaningful filter (show only retired), so compare to undefined.
  if (filters.isActive !== undefined) q.set('isActive', String(filters.isActive))

  return useQuery({
    queryKey: templateKeys.list(filters),
    queryFn:  () => api.get<CommunicationTemplate[]>(`/communication-templates?${q.toString()}`),
    staleTime: 30_000,
  })
}

export interface CreateTemplateInput {
  name:     string
  channel:  MessageChannel
  language?: TemplateLanguage
  subject?: string
  body:     string
  isActive?: boolean
  waTemplateName?: string
  waCategory?: string
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTemplateInput) =>
      api.post<CommunicationTemplate>('/communication-templates', input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: templateKeys.all() }) },
  })
}

export type UpdateTemplateInput = Partial<
  Omit<CreateTemplateInput, 'channel' | 'language'>
>

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTemplateInput & { id: string }) =>
      api.patch<CommunicationTemplate>(`/communication-templates/${id}`, input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: templateKeys.all() }) },
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: true }>(`/communication-templates/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: templateKeys.all() }) },
  })
}

/**
 * Render a template with sample values.
 *
 * A mutation rather than a query: it takes a body, it is triggered by an
 * explicit click, and caching a render keyed by arbitrary values would be
 * pointless. The server answers 200 (not 201) because nothing is created.
 */
export function usePreviewTemplate() {
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, string> }) =>
      api.post<TemplatePreview>(`/communication-templates/${id}/preview`, { values }),
  })
}

/** Admin-only: records the WhatsApp provider's approval of this exact wording. */
export function useSetTemplateApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      api.patch<CommunicationTemplate>(`/communication-templates/${id}/approval`, { isApproved }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: templateKeys.all() }) },
  })
}

/**
 * Mirrors `TEMPLATE_WRITE_ROLES` on the API.
 *
 * This hook ONLY hides buttons. The server is the enforcement — the E2E suite
 * asserts a field agent gets 403 from the endpoint independently of this.
 */
const TEMPLATE_WRITE_ROLES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'RESIDENT_RELATIONS_MANAGER',
]

export function useCanWriteTemplates(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role && TEMPLATE_WRITE_ROLES.includes(data.role))
}

/** Mirrors `ADMIN_ROLES` — only admins may record provider approval. */
export function useCanApproveTemplates(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role && ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(data.role))
}
