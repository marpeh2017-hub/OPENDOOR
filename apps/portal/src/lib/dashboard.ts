/**
 * The shape of `GET /api/v1/portal/dashboard`.
 *
 * Written out rather than inferred, because it is a contract with a service in
 * another package: if the gateway changes a field, this file is where the
 * mismatch should show up, at build time.
 */

export interface DashboardStage {
  key: string
  label: string
  done: boolean
  current: boolean
}

export interface Dashboard {
  resident: {
    firstName: string
    name: string
    apartmentNumber: string
    buildingAddress: string
  }
  project: {
    name: string
    status: string
    stage: string
    stageLabel: string
    progressPercent: number
    stages: DashboardStage[]
  }
  signature: {
    signed: boolean
    status: string
    isObjecting: boolean
    signedAt: string | null
    pending: {
      documentId: string | null
      documentTitle: string | null
      sentAt: string | null
      expiresAt: string | null
    } | null
  }
  documents: {
    id: string
    title: string
    category: string
    addedAt: string
    signed: boolean
  }[]
  messages: {
    id: string
    title: string
    preview: string
    channel: string
    sentAt: string
  }[]
  meetings: {
    id: string
    title: string
    startTime: string
    location: string | null
    isVirtual: boolean
    rsvpStatus: string
  }[]
  contact: {
    projectManager: { name: string; email: string | null } | null
  }
}

/** Dates arrive as ISO strings and are shown in the Israeli civil format. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}
