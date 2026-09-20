/**
 * The shape of the portal support endpoints.
 */

export interface SupportTicketSummary {
  id: string
  subject: string
  status: string
  category: string | null
  createdAt: string
  updatedAt: string
  /** Public replies only — internal staff notes are not replies to a resident. */
  replyCount: number
}

export interface SupportFaqEntry {
  question: string
  answer: string
  source: string
}

export interface SupportOverview {
  tickets: SupportTicketSummary[]
  faq: SupportFaqEntry[]
}

export interface SupportTicketDetail {
  id: string
  subject: string
  description: string
  status: string
  category: string | null
  createdAt: string
  resolvedAt: string | null
  closedAt: string | null
  canReply: boolean
  replies: {
    id: string
    body: string
    createdAt: string
    fromResident: boolean
    authorName: string
  }[]
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: 'פתוחה',
  IN_PROGRESS: 'בטיפול',
  RESOLVED: 'נפתרה',
  CLOSED: 'נסגרה',
}

export const TICKET_STATUS_CLASSES: Record<string, string> = {
  OPEN: 'bg-teal-50 text-teal-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  RESOLVED: 'bg-success-50 text-success-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}

export const TICKET_CATEGORIES: Record<string, string> = {
  GENERAL: 'כללי',
  SIGNATURE: 'חתימות',
  DOCUMENTS: 'מסמכים',
  MEETING: 'פגישות',
  CONSTRUCTION: 'בנייה ופינוי',
  COMPENSATION: 'תמורות',
  OTHER: 'אחר',
  /** Raised from the profile page, not selectable when opening a ticket. */
  CONTACT_UPDATE: 'עדכון פרטים',
}
