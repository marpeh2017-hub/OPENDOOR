/**
 * The shape of `GET /api/v1/portal/messages`.
 */

export interface PortalMessage {
  id: string
  subject: string | null
  body: string
  channel: string
  sentAt: string
  deliveredAt: string | null
  /** Sent by a rule rather than by a person. */
  automated: boolean
  templateName: string | null
}

export interface PortalMessages {
  total: number
  /** The project. `Message` records no individual author. */
  from: string
  messages: PortalMessage[]
  nextCursor: string | null
}

/** How the message reached them. Worth saying — it is their record of it. */
export const CHANNEL_LABELS: Record<string, string> = {
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'אימייל',
  PORTAL: 'הודעה בפורטל',
  PUSH: 'התראה',
  IN_APP: 'התראה',
}
