/**
 * Meeting vocabulary.
 *
 * Both `Meeting.status` and `MeetingAttendee.rsvpStatus` are String columns in
 * the schema. Like `Notification.type`, they are validated against these lists
 * on every write, so the column is effectively closed without the migration
 * cost of a Prisma enum. Values are LOWER-CASE because that is what the
 * existing schema default (`"scheduled"`) already stores — changing the casing
 * would mean rewriting rows for no benefit.
 */

export const MEETING_STATUSES = ['scheduled', 'completed', 'cancelled'] as const
export type MeetingStatus = (typeof MEETING_STATUSES)[number]

/**
 * RSVP — what the invitee SAID they would do.
 *
 * Deliberately separate from `MeetingAttendee.attended`, which is what actually
 * happened and is recorded afterwards. For a פינוי-בינוי resident meeting the
 * gap between the two is the interesting number: accepted-but-absent is the
 * signal that a follow-up call is needed, and it is invisible if RSVP and
 * attendance share one column.
 */
export const RSVP_STATUSES = ['pending', 'accepted', 'declined', 'tentative'] as const
export type RsvpStatus = (typeof RSVP_STATUSES)[number]

/** `organizer` is informational — permission comes from RBAC, not from this. */
export const ATTENDEE_ROLES = ['organizer', 'attendee', 'guest'] as const
export type AttendeeRole = (typeof ATTENDEE_ROLES)[number]

export const MEETING_STATUS_LABELS_HE: Record<MeetingStatus, string> = {
  scheduled: 'מתוכננת',
  completed: 'התקיימה',
  cancelled: 'בוטלה',
}

export const RSVP_STATUS_LABELS_HE: Record<RsvpStatus, string> = {
  pending:   'ממתין לתשובה',
  accepted:  'אישר הגעה',
  declined:  'לא יגיע',
  tentative: 'אולי',
}
