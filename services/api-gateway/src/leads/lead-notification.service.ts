import { Injectable, Logger } from '@nestjs/common'
import type { MessageChannel } from '@prisma/client'
import { OutboundMessageService } from '../messaging/outbound-message.service'
import { normaliseIsraeliPhone } from '../messaging/phone'

/**
 * Tells somebody at the company that a lead arrived from the marketing site.
 *
 * ── WHY THIS IS NOT AN AUTOMATION ──────────────────────────────────────────
 *
 * `Automation` already has a `LEAD_CREATED` trigger and a `SEND_WHATSAPP`
 * action, and `PublicLeadsService` already dispatches that trigger, so the
 * obvious move is to configure a row and write no code at all. That does not
 * work, and it fails SILENTLY, which is worse than failing.
 *
 * Every `SEND_*` action in `AutomationRunnerService` resolves its recipients as
 * RESIDENTS: either `prisma.resident.findMany` across the project, or the
 * event's `subjectId` treated as a resident id. It then routes each one through
 * `ResidentContactService`, which checks opt-in and consent.
 *
 * For `LEAD_CREATED` the `subjectId` is a LEAD id. Handed to the resident
 * router it matches nothing, so the message is skipped and recorded as
 * unreachable; and a website lead has no project, so the project-wide branch
 * resolves to an empty list and returns early. Either way the automation runs,
 * increments `runCount`, and delivers nothing.
 *
 * That is not a bug in the runner. Resident messaging SHOULD be gated on
 * consent, and a member of staff is not a resident: there is no opt-in to
 * check, no preferred channel to respect, and no per-resident cap that makes
 * sense. Bending the resident path around a staff recipient would weaken the
 * consent checks that protect residents, to serve a case that does not need
 * them. So this is a separate, deliberately small path.
 *
 * It still goes through `OutboundMessageService`, which means it inherits the
 * outbox: retries, backoff, the `MESSAGING_SIMULATE` switch, and provider
 * selection. Nothing about delivery is reimplemented here.
 *
 * ── WHAT IS NOT TRUE YET ───────────────────────────────────────────────────
 *
 * The WhatsApp transport in this repository is META CLOUD (`whatsapp:meta-
 * cloud`), not Vonage. Vonage is the SMS provider. Sending WhatsApp through
 * Vonage would mean a second integration against their Messages API and a
 * WhatsApp Business Account linked to it, which does not exist.
 *
 * Meta also only permits PRE-APPROVED TEMPLATE messages for business-initiated
 * conversations — a new-lead alert is exactly that. Free text is accepted only
 * inside an open 24-hour service window. The provider says so in its own
 * header comment, and `AutomationsService` already refuses an unapproved
 * WhatsApp template.
 *
 * So `LEAD_NOTIFY_CHANNEL` exists and defaults to WhatsApp as asked, but SMS is
 * a supported value and is the channel that actually works today, because
 * Vonage SMS is configured and verified. In development none of it transmits:
 * `MESSAGING_SIMULATE` resolves the no-op provider before any of this matters.
 */

/** Recipients of a lead alert, one per line, as the office would read it. */
const CHANNELS: readonly MessageChannel[] = ['WHATSAPP', 'SMS']

export interface LeadAlert {
  id: string
  firstName: string
  lastName: string
  phone: string
  email?: string | null
  city?: string | null
  address?: string | null
  notes?: string | null
  formType?: string | null
}

@Injectable()
export class LeadNotificationService {
  private readonly logger = new Logger(LeadNotificationService.name)

  constructor(private readonly outbound: OutboundMessageService) {}

  /**
   * Queue one alert for one lead.
   *
   * NEVER THROWS. A lead that is safely in the database must not be reported as
   * a failure to the visitor because the office alert could not be queued — the
   * enquiry is the thing that matters, and it is already saved by the time this
   * runs.
   */
  async notify(tenantId: string, lead: LeadAlert): Promise<void> {
    try {
      const to = this.recipient()
      if (!to) return

      await this.outbound.enqueue({
        tenantId,
        channel: this.channel(),
        toPhone: to,
        body: this.compose(lead),
        // One alert per lead, whatever retries happen upstream. Without this a
        // retried submission would ring the office twice for one enquiry.
        idempotencyKey: `lead-notify:${lead.id}`,
        // A stale alert is worse than none: if it has not gone out after a few
        // tries, somebody is already looking at a CRM that has the lead in it.
        maxAttempts: 3,
        // IDs only. The body already carries the lead's name and number because
        // that is the entire point of the alert, but the metadata is what ends
        // up in dashboards and exports, and it does not need a second copy.
        metadata: { kind: 'lead-alert', leadId: lead.id, formType: lead.formType ?? null },
      })
    } catch (err) {
      // Logged with the lead id so it can be found, and without the lead's
      // details, which would put personal data into the error log.
      this.logger.error(
        `Could not queue the new-lead alert for ${lead.id}. The lead itself is saved. ` +
        `${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  /** The office number, normalised, or null when none is configured. */
  private recipient(): string | null {
    const raw = process.env.LEAD_NOTIFY_PHONE?.trim()
    if (!raw) {
      // Not an error: a deployment may deliberately run without alerts. Said
      // once per lead rather than silently, because "nobody was told" is the
      // exact failure this service exists to prevent.
      this.logger.warn('LEAD_NOTIFY_PHONE is not set — no new-lead alert was queued')
      return null
    }

    const normalised = normaliseIsraeliPhone(raw)
    if (!normalised.e164 || !normalised.isMobile) {
      this.logger.error(
        'LEAD_NOTIFY_PHONE is not a usable Israeli mobile number — no alert was queued',
      )
      return null
    }
    return normalised.e164
  }

  private channel(): MessageChannel {
    const configured = process.env.LEAD_NOTIFY_CHANNEL?.trim().toUpperCase()
    if (configured && (CHANNELS as readonly string[]).includes(configured)) {
      return configured as MessageChannel
    }
    if (configured) {
      this.logger.warn(
        `LEAD_NOTIFY_CHANNEL="${configured}" is not one of ${CHANNELS.join(', ')} — using WHATSAPP`,
      )
    }
    return 'WHATSAPP'
  }

  /**
   * The alert body.
   *
   * Written to be read on a phone lock screen: who, their number, and what they
   * said, in that order, because the first thing anyone does with this is call
   * the person back.
   */
  private compose(lead: LeadAlert): string {
    const name = `${lead.firstName} ${lead.lastName}`.trim() || 'ללא שם'
    const lines = [
      'פנייה חדשה מהאתר',
      '',
      `שם: ${name}`,
      `טלפון: ${lead.phone}`,
    ]

    if (lead.email) lines.push(`דוא״ל: ${lead.email}`)

    const place = [lead.address, lead.city].filter(Boolean).join(', ')
    if (place) lines.push(`כתובת: ${place}`)

    // Kept last and length-capped: a long message splits into several billed
    // segments, and the details above are the part that must survive.
    if (lead.notes?.trim()) {
      const notes = lead.notes.trim()
      lines.push('', `הערות: ${notes.length > 300 ? `${notes.slice(0, 300)}…` : notes}`)
    }

    return lines.join('\n')
  }
}
