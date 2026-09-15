/**
 * The automation catalogue: which triggers exist, which action types the engine
 * can execute, and what config each one requires.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OUTBOUND ACTIONS AND THE SAFETY MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SEND_SMS / SEND_WHATSAPP / SEND_EMAIL and WEBHOOK reach OUTSIDE the company:
 * a real resident receives a message, or a third-party system receives a
 * payload. Neither can be recalled. Three independent controls apply, and an
 * outbound action must clear all of them:
 *
 *   1. DRY RUN BY DEFAULT. `Automation.dryRun` defaults true, and any automation
 *      containing an outbound action is forced back to dry run every time it is
 *      activated. In dry run the runner does the entire evaluation — resolves
 *      recipients, renders the template — and records what it WOULD have sent,
 *      dispatching nothing. Going live is a separate admin-only act per
 *      automation.
 *
 *   2. SEND CAPS. `sendCapPerHour` / `sendCapPerDay` are counted from `Message`
 *      rows already written and tagged with `automationId`, so the window
 *      survives a restart. Reaching a cap REFUSES the send; it does not queue
 *      it. An automation that silently accumulates a backlog of unsent resident
 *      messages is worse than one that stops and says so.
 *
 *   3. EGRESS ALLOWLIST (webhooks only). See `webhook-allowlist.ts`. Private,
 *      loopback and link-local destinations are refused even if an operator
 *      adds them to the allowlist.
 *
 * ── STILL DISABLED, AND WHY ────────────────────────────────────────────────
 *
 *   GENERATE_REPORT — the general reporting module does not exist, so there is
 *   nothing to call. Enabling it would be a promise the system cannot keep.
 *
 *   UPDATE_STATUS — automatically moving a project stage or signature status
 *   mutates the record that downstream threshold and compliance logic reads.
 *   That deserves its own design pass rather than a generic field setter.
 *
 * Disabled types are refused AT SAVE TIME, not skipped at run time, so an
 * automation can never look configured while doing nothing.
 */

export const AUTOMATION_TRIGGERS = [
  'LEAD_CREATED',
  'RESIDENT_CREATED',
  'MEETING_COMPLETED',
  'SIGNATURE_SENT',
  'SIGNATURE_SIGNED',
  'PROJECT_STAGE_CHANGED',
  'DOCUMENT_UPLOADED',
  'DEADLINE_REACHED',
  'TASK_OVERDUE',
  'CUSTOM',
] as const

export const AUTOMATION_ACTION_TYPES = [
  'CREATE_TASK',
  'SEND_WHATSAPP',
  'SEND_SMS',
  'SEND_EMAIL',
  'GENERATE_REPORT',
  'UPDATE_STATUS',
  'CREATE_NOTIFICATION',
  'WEBHOOK',
] as const

export type AutomationTriggerName = (typeof AUTOMATION_TRIGGERS)[number]
export type AutomationActionTypeName = (typeof AUTOMATION_ACTION_TYPES)[number]

/** The only action types `AutomationRunnerService` knows how to execute. */
export const ENABLED_ACTION_TYPES = [
  'CREATE_TASK',
  'CREATE_NOTIFICATION',
  'SEND_SMS',
  'SEND_WHATSAPP',
  'SEND_EMAIL',
  'WEBHOOK',
] as const satisfies readonly AutomationActionTypeName[]

/** Action types that contact a real person outside the company. */
export const SENDING_ACTION_TYPES = [
  'SEND_SMS',
  'SEND_WHATSAPP',
  'SEND_EMAIL',
] as const satisfies readonly AutomationActionTypeName[]

export function isSendingActionType(type: string): boolean {
  return (SENDING_ACTION_TYPES as readonly string[]).includes(type)
}

/**
 * True when an outbound automation has a usable volume ceiling.
 *
 * `SendCapService` treats "both caps null" as unlimited, which is the correct
 * reading of the data but the wrong thing to allow: an automation that reaches
 * real people should not be able to reach an unbounded number of them because
 * nobody filled a field in. One positive cap is enough to bound the blast
 * radius; requiring both would be theatre, since either alone bounds the total.
 */
export function hasSendCap(a: { sendCapPerHour: number | null; sendCapPerDay: number | null }): boolean {
  return (a.sendCapPerHour ?? 0) > 0 || (a.sendCapPerDay ?? 0) > 0
}

/** True if any action in the set reaches outside the company. */
export function hasOutboundAction(types: readonly string[]): boolean {
  return types.some((t) => isSendingActionType(t) || t === 'WEBHOOK')
}

/** Human-readable reason per disabled type, returned verbatim in the 400. */
/**
 * Hebrew, because these strings are returned by `GET /automations/catalog` and
 * rendered VERBATIM in the CRM, which is a Hebrew RTL product. They are user
 * copy, not developer diagnostics - the rest of this file's comments stay in
 * English, but anything a user reads does not.
 */
export const DISABLED_ACTION_REASONS: Record<string, string> = {
  GENERATE_REPORT:
    'מודול הדוחות טרם נבנה, ולכן אין לפעולה הזו למה לקרוא.',
  UPDATE_STATUS:
    'שינוי סטטוס אוטומטי אינו מופעל: הוא משנה רשומות שמנוע הסף ובדיקות הציות מסתמכים עליהן.',
}

export function isEnabledActionType(type: string): boolean {
  return (ENABLED_ACTION_TYPES as readonly string[]).includes(type)
}

/**
 * Trigger payload — what the emitting module hands the runner.
 *
 * `subjectId` is the id of the thing the trigger is about (the lead, the
 * resident, the document). `context` supplies template variables and task
 * fields. Neither is trusted for tenant scoping: the runner always re-reads
 * `tenantId` from the automation row it matched.
 */
export interface AutomationEvent {
  trigger: AutomationTriggerName
  tenantId: string
  projectId?: string | null
  subjectId?: string | null
  context?: Record<string, string | number | null>
}

/** Config shape per enabled action, validated before an automation is saved. */
export interface CreateTaskConfig {
  title: string
  description?: string
  assigneeId?: string
  priority?: string
  dueInDays?: number
}

export interface CreateNotificationConfig {
  /** Notification kind from the registry — validated against it at save time. */
  kind: string
  title: string
  body?: string
  /** Explicit recipients. Empty means "the project members", resolved at run time. */
  userIds?: string[]
}

export interface SendMessageConfig {
  /** Template to render. Must belong to the same tenant and match the channel. */
  templateId: string
  /**
   * Who receives it. `RESIDENT` uses the resident named by the triggering event;
   * `PROJECT_RESIDENTS` fans out to every resident on the project.
   */
  audience: 'RESIDENT' | 'PROJECT_RESIDENTS'
}

export const SEND_AUDIENCES = ['RESIDENT', 'PROJECT_RESIDENTS'] as const

/** Channel implied by each sending action type. */
export const ACTION_TYPE_CHANNEL: Record<string, string> = {
  SEND_SMS: 'SMS',
  SEND_WHATSAPP: 'WHATSAPP',
  SEND_EMAIL: 'EMAIL',
}

export interface WebhookConfig {
  /** https only, allowlisted host, never a private destination. */
  url: string
  /** Optional non-secret headers. Authorization/cookie headers are refused. */
  headers?: Record<string, string>
}
