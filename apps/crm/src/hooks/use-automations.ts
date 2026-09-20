import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useCurrentUser } from './use-auth'

/**
 * Mirrors AutomationsController.
 *
 * The catalogue of triggers and action types is fetched from the SERVER
 * (`GET /automations/catalog`) rather than hardcoded here. Which action types
 * are executable is a server-side product decision that changes independently
 * of this app, and a hardcoded copy would eventually offer the user an action
 * the API refuses to save.
 */

export interface AutomationAction {
  id:     string
  order:  number
  type:   string
  config: Record<string, unknown>
  delayMinutes: number
}

export interface Automation {
  id:          string
  name:        string
  description: string | null
  trigger:     string
  projectId:   string | null
  triggerConfig: Record<string, unknown>
  isActive:    boolean
  /** True means it evaluates and logs but dispatches nothing. */
  dryRun:      boolean
  sendCapPerHour: number | null
  sendCapPerDay:  number | null
  runCount:    number
  lastRunAt:   string | null
  actions:     AutomationAction[]
  createdAt:   string
  updatedAt:   string
}

/** The narrow operational projection from `GET /automations/armed`. */
export interface ArmedAutomation {
  id:          string
  name:        string
  trigger:     string
  projectId:   string | null
  projectName: string | null
  actionTypes: string[]
  outbound:    boolean
  /** Armed AND live. The single field that answers "will a resident be contacted?". */
  willActuallySend: boolean
  dryRun:      boolean
  sendCapPerHour: number | null
  sendCapPerDay:  number | null
  runCount:    number
  lastRunAt:   string | null
}

export interface AutomationCatalog {
  triggers: string[]
  actionTypes: {
    type: string
    enabled: boolean
    disabledReason: string | null
  }[]
}

export const TRIGGER_LABELS: Record<string, string> = {
  LEAD_CREATED:          'נוצר ליד חדש',
  RESIDENT_CREATED:      'נוסף דייר',
  MEETING_COMPLETED:     'פגישה הסתיימה',
  SIGNATURE_SENT:        'נשלחה בקשת חתימה',
  SIGNATURE_SIGNED:      'התקבלה חתימה',
  PROJECT_STAGE_CHANGED: 'שלב הפרויקט השתנה',
  DOCUMENT_UPLOADED:     'הועלה מסמך',
  DEADLINE_REACHED:      'הגיע מועד יעד',
  TASK_OVERDUE:          'משימה באיחור',
  CUSTOM:                'הפעלה ידנית',
}

export const ACTION_LABELS: Record<string, string> = {
  CREATE_TASK:         'יצירת משימה',
  CREATE_NOTIFICATION: 'שליחת התראה במערכת',
  SEND_SMS:            'שליחת SMS לדייר',
  SEND_WHATSAPP:       'שליחת וואטסאפ לדייר',
  SEND_EMAIL:          'שליחת אימייל לדייר',
  WEBHOOK:             'קריאת Webhook',
  GENERATE_REPORT:     'הפקת דוח',
  UPDATE_STATUS:       'עדכון סטטוס',
}

/**
 * Triggers that no module fires yet.
 *
 * Shown in the UI as "not wired" rather than hidden: hiding them would make the
 * list look complete, and a user would build an automation on a trigger that
 * never arrives and conclude the feature is broken.
 */
export const UNWIRED_TRIGGERS = new Set([
  'DOCUMENT_UPLOADED', 'DEADLINE_REACHED', 'TASK_OVERDUE', 'CUSTOM', 'SIGNATURE_SIGNED',
])

export const automationKeys = {
  all:     ()          => ['automations'] as const,
  lists:   ()          => [...automationKeys.all(), 'list'] as const,
  list:    (f: object) => [...automationKeys.lists(), f] as const,
  armed:   ()          => [...automationKeys.all(), 'armed'] as const,
  catalog: ()          => [...automationKeys.all(), 'catalog'] as const,
}

export function useAutomationCatalog() {
  return useQuery({
    queryKey: automationKeys.catalog(),
    queryFn:  () => api.get<AutomationCatalog>('/automations/catalog'),
    // Product configuration, not data — it changes on deploy, not on use.
    staleTime: 10 * 60_000,
  })
}

export function useAutomations(filters: { projectId?: string; isActive?: boolean } = {}) {
  const q = new URLSearchParams()
  if (filters.projectId) q.set('projectId', filters.projectId)
  if (filters.isActive !== undefined) q.set('isActive', String(filters.isActive))

  return useQuery({
    queryKey: automationKeys.list(filters),
    queryFn:  () => api.get<Automation[]>(`/automations?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useArmedAutomations() {
  return useQuery({
    queryKey: automationKeys.armed(),
    queryFn:  () => api.get<ArmedAutomation[]>('/automations/armed'),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })
}

export interface AutomationActionInput {
  order:  number
  type:   string
  config: Record<string, unknown>
  delayMinutes?: number
}

export interface CreateAutomationInput {
  name:        string
  description?: string
  trigger:     string
  projectId?:  string
  triggerConfig?: Record<string, unknown>
  isActive?:   boolean
  sendCapPerHour?: number
  sendCapPerDay?:  number
  actions:     AutomationActionInput[]
}

export function useCreateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAutomationInput) => api.post<Automation>('/automations', input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: automationKeys.all() }) },
  })
}

export function useUpdateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreateAutomationInput> & { id: string }) =>
      api.patch<Automation>(`/automations/${id}`, input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: automationKeys.all() }) },
  })
}

export function useDeleteAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: true }>(`/automations/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: automationKeys.all() }) },
  })
}

/**
 * Admin-only: take an outbound automation live, or return it to dry run.
 *
 * Separate from the update mutation on purpose — this is the moment real
 * residents start receiving real messages, and it should never ride along in a
 * general "save" of an edit form.
 */
export function useSetAutomationDryRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dryRun }: { id: string; dryRun: boolean }) =>
      api.patch<Automation>(`/automations/${id}/dry-run`, { dryRun }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: automationKeys.all() }) },
  })
}

/** Mirrors `MANAGER_ROLES` — writing an automation is narrower than most writes. */
export function useCanWriteAutomations(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role &&
    ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(data.role))
}

/** Mirrors `ADMIN_ROLES` — only admins may take an automation live. */
export function useCanGoLive(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role && ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(data.role))
}
