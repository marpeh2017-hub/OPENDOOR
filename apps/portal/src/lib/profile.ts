/**
 * The shape of `GET /api/v1/portal/profile`.
 */

export interface PortalProfile {
  resident: {
    id: string
    name: string
    firstName: string
    lastName: string
    phone: string | null
    phone2: string | null
    email: string | null
  }
  home: {
    projectName: string
    buildingAddress: string
    apartmentNumber: string
    ownershipPercentage: number
    isPrimaryContact: boolean
  }
  standing: {
    signatureStatus: string
    isObjecting: boolean
  }
  preferences: {
    language: string
    preferredChannel: string
    whatsappOptIn: boolean
    smsOptIn: boolean
    emailOptIn: boolean
    /** Shown, never editable here — see the endpoint's DTO for why. */
    doNotContact: boolean
    portalInboxEnabled: boolean
  }
  pendingContactRequest: { id: string; createdAt: string; status: string } | null
}

/** The five fields the endpoint accepts. Anything else is a 400 there. */
export interface EditablePreferences {
  language?: string
  preferredChannel?: string
  whatsappOptIn?: boolean
  smsOptIn?: boolean
  emailOptIn?: boolean
}

export const LANGUAGE_LABELS: Record<string, string> = {
  he: 'עברית',
  en: 'English',
  ru: 'Русский',
  ar: 'العربية',
}

export const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  EMAIL: 'אימייל',
}

export const SIGNATURE_STATUS_LABELS: Record<string, string> = {
  NOT_CONTACTED: 'טרם יצרנו קשר',
  CONTACTED: 'יצרנו קשר',
  INTERESTED: 'הבעת עניין',
  SIGNED: 'חתמת',
  OBJECTING: 'רשמנו התנגדות',
  UNDECIDED: 'טרם החלטת',
  UNREACHABLE: 'לא הצלחנו להשיג אותך',
}
