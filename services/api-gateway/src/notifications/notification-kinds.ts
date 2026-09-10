/**
 * The closed set of notification kinds.
 *
 * WHY A CONSTANT AND NOT A PRISMA ENUM
 * ------------------------------------
 * `Notification.type` is a String column. Making it a Prisma enum would mean a
 * migration every time a new module starts emitting, which is exactly the
 * friction that makes people reach for a free-form string instead. Keeping the
 * column a String but validating every write against THIS list gets the useful
 * half of an enum — nothing unrecognised is ever stored, the CRM can switch on
 * a known set, and adding a kind is a one-line change here — without the
 * migration tax.
 *
 * The validation is not advisory: `CreateNotificationDto` uses `@IsIn` and
 * `NotificationsService.emit` re-checks, so an internal caller cannot bypass
 * the DTO by calling the service directly.
 */

export const NOTIFICATION_KINDS = [
  /** A task was assigned, reassigned, or is due. */
  'TASK',
  /** Signature request sent, signed, declined, or expired. */
  'SIGNATURE',
  /** An inbound message or comment addressed to the user. */
  'MESSAGE',
  /** Project-level milestone, stage change, or threshold event. */
  'PROJECT',
  /** Meeting invitation, update, cancellation, or reminder. Phase C. */
  'MEETING',
  /** Document uploaded or a new version added to something the user follows. */
  'DOCUMENT',
  /** Anything the platform itself needs to tell the user. */
  'SYSTEM',
] as const

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && (NOTIFICATION_KINDS as readonly string[]).includes(value)
}

/**
 * Hebrew labels for the CRM. Mirrored in
 * `apps/crm/src/lib/notification-kinds.ts`; the server copy exists so the kind
 * list has exactly one source of truth on this side of the wire.
 */
export const NOTIFICATION_KIND_LABELS_HE: Record<NotificationKind, string> = {
  TASK:      'משימה',
  SIGNATURE: 'חתימה',
  MESSAGE:   'הודעה',
  PROJECT:   'פרויקט',
  MEETING:   'פגישה',
  DOCUMENT:  'מסמך',
  SYSTEM:    'מערכת',
}

/**
 * Entity types a notification may point at.
 *
 * Deliberately a list rather than "any string": `entityType`/`entityId` are
 * used to find and supersede earlier notifications about the same record, and
 * that only works if emitters agree on the spelling.
 */
export const NOTIFICATION_ENTITY_TYPES = [
  'Project', 'Task', 'Document', 'Meeting', 'SignatureRequest', 'Resident', 'Lead',
  // Raised by the resident portal when somebody asks staff to change contact
  // details they may not change themselves.
  'SupportTicket',
] as const

export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number]
