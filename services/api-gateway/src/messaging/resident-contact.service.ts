import { Injectable, Logger } from '@nestjs/common'
import type { MessageChannel } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { normaliseIsraeliPhone } from './phone'

/** A resolved, consented way to reach one resident. */
export interface ResidentRoute {
  residentId: string
  channel: MessageChannel
  toPhone: string | null
  toEmail: string | null
  /** For log lines and CRM diagnostics. Never contains the address itself. */
  rationale: string
}

/** Why a resident cannot be reached. Surfaced to staff, not to the resident. */
export interface ResidentUnreachable {
  residentId: string
  reason:
    | 'DO_NOT_CONTACT'
    | 'NO_CONSENTED_CHANNEL'
    | 'NO_VALID_PHONE'
    | 'NO_VALID_EMAIL'
    | 'INACTIVE'
    | 'NOT_FOUND'
  detail: string
}

export type ResidentRouteResult = ResidentRoute | ResidentUnreachable

export function isRoutable(r: ResidentRouteResult): r is ResidentRoute {
  return (r as ResidentRoute).channel !== undefined
}

/**
 * Turns "notify this resident" into "send on this channel, to this address" —
 * or into a recorded, explainable refusal.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY RESIDENTS ARE NOT USERS
 * ─────────────────────────────────────────────────────────────────────────
 * `Notification.userId` is an FK to `User`, so residents could not be notified
 * at all. The tempting fix — mint a `User` row per resident — is the wrong one
 * and is explicitly not taken here. A `User` carries a password, a role, a
 * session, and RBAC reach into a tenant's staff surfaces; a resident is a
 * subject of the project, not an operator of the CRM. Conflating them means
 * every future RBAC change has to reason about ten thousand "users" who must
 * never see a staff screen, and one missed `role !== 'RESIDENT'` check becomes
 * a data breach.
 *
 * Instead residents get their own path, which this service is the front door
 * of: `Message` rows addressed by `residentId`, dispatched over SMS / WhatsApp
 * / email / the portal inbox, with their own tokenised access
 * (`MeetingAccessToken`) when they need to act. Resident identity and staff
 * identity never meet.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CONSENT IS A GATE, NOT A PREFERENCE
 * ─────────────────────────────────────────────────────────────────────────
 * `doNotContact` short-circuits everything, including "important" project
 * communications. Israeli חוק הספאם (Communications Law amendment 40) makes an
 * unsolicited commercial message an offence with statutory damages, and in a
 * pinuy-binuy project the resident who opted out is very often the objecting
 * resident — precisely the person whose lawyer will read the message log. The
 * opt-in flags are then honoured per channel; the PORTAL inbox is the only
 * channel that does not require an opt-in, because it is pull, not push: it
 * puts nothing on the resident's phone and costs them nothing.
 */
@Injectable()
export class ResidentContactService {
  private readonly logger = new Logger(ResidentContactService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The columns needed to route. Note the tenant scoping is done by TRAVERSAL —
   * `Resident.tenantId` is documented in the schema as app-layer-only and is
   * therefore not the authority for a cross-tenant decision.
   */
  private async load(tenantId: string, residentIds: readonly string[]) {
    if (residentIds.length === 0) return []
    return this.prisma.resident.findMany({
      where: {
        id: { in: [...residentIds] },
        apartment: { building: { complex: { project: { tenantId } } } },
      },
      select: {
        id: true, isActive: true, phone: true, phone2: true, email: true,
        preferredChannel: true, whatsappOptIn: true, smsOptIn: true, emailOptIn: true,
        doNotContact: true, portalEnabled: true,
      },
    })
  }

  /** Routes one resident. */
  async route(tenantId: string, residentId: string): Promise<ResidentRouteResult> {
    const [r] = await this.routeMany(tenantId, [residentId])
    return r ?? { residentId, reason: 'NOT_FOUND', detail: 'resident not found in tenant' }
  }

  /**
   * Routes several residents in ONE query. Meeting fan-out is the main caller
   * and a per-resident round trip there would be N+1 against the slowest
   * traversal in the schema.
   *
   * Returns one entry per REQUESTED id, including the ones that could not be
   * found — a silent gap in the output is how "we invited 40 residents" quietly
   * becomes 37.
   */
  async routeMany(
    tenantId: string,
    residentIds: readonly string[],
  ): Promise<ResidentRouteResult[]> {
    const unique = [...new Set(residentIds.filter(Boolean))]
    const rows = await this.load(tenantId, unique)
    const byId = new Map(rows.map((r) => [r.id, r]))

    return unique.map((id) => {
      const r = byId.get(id)
      if (!r) {
        return { residentId: id, reason: 'NOT_FOUND' as const, detail: 'resident not found in tenant' }
      }
      if (!r.isActive) {
        return { residentId: id, reason: 'INACTIVE' as const, detail: 'resident is archived' }
      }
      if (r.doNotContact) {
        // Not overridable by an "urgent" flag, by design. If a project genuinely
        // must reach an opted-out resident, that is a phone call by a human who
        // can be held responsible for it, not an automated send.
        return { residentId: id, reason: 'DO_NOT_CONTACT' as const, detail: 'resident opted out of contact' }
      }

      const phone = firstValidMobile([r.phone, r.phone2])
      const email = validEmail(r.email)

      /*
       * Preference first, then a fixed fallback order. The fallback is not
       * "try everything" — sending the same invitation over three channels is
       * how a communications log becomes unreadable and how a resident starts
       * ignoring all of it. Exactly one channel is chosen per message.
       */
      const candidates: MessageChannel[] = dedupe([
        r.preferredChannel,
        'WHATSAPP', 'SMS', 'EMAIL', 'PORTAL',
      ])

      for (const channel of candidates) {
        switch (channel) {
          case 'WHATSAPP':
            if (r.whatsappOptIn && phone) {
              return { residentId: id, channel, toPhone: phone, toEmail: null, rationale: 'whatsapp opt-in' }
            }
            break
          case 'SMS':
            if (r.smsOptIn && phone) {
              return { residentId: id, channel, toPhone: phone, toEmail: null, rationale: 'sms opt-in' }
            }
            break
          case 'EMAIL':
            if (r.emailOptIn && email) {
              return { residentId: id, channel, toPhone: null, toEmail: email, rationale: 'email opt-in' }
            }
            break
          case 'PORTAL':
            // Pull, not push — no opt-in required. See the class comment.
            if (r.portalEnabled) {
              return { residentId: id, channel, toPhone: null, toEmail: null, rationale: 'portal inbox' }
            }
            break
          default:
            break
        }
      }

      // Distinguish "consented but we have no usable address" from "refused
      // every channel", because they need different fixes from different people.
      const consentedToPhone = r.smsOptIn || r.whatsappOptIn
      if (consentedToPhone && !phone) {
        return {
          residentId: id, reason: 'NO_VALID_PHONE' as const,
          detail: 'no valid Israeli mobile number on file',
        }
      }
      if (r.emailOptIn && !email) {
        return {
          residentId: id, reason: 'NO_VALID_EMAIL' as const,
          detail: 'no valid email address on file',
        }
      }
      return {
        residentId: id, reason: 'NO_CONSENTED_CHANNEL' as const,
        detail: 'resident has not opted in to any available channel',
      }
    })
  }
}

function dedupe<T>(xs: readonly T[]): T[] { return [...new Set(xs)] }

/**
 * Picks the first number that normalises to an Israeli MOBILE. A landline is
 * rejected for SMS/WhatsApp rather than attempted — the provider would accept
 * it, charge for it, and report success for a message nobody can receive.
 */
function firstValidMobile(candidates: readonly (string | null)[]): string | null {
  for (const c of candidates) {
    const n = normaliseIsraeliPhone(c)
    if (n.e164 && n.isMobile) return n.e164
  }
  return null
}

function validEmail(email: string | null): string | null {
  if (!email) return null
  const trimmed = email.trim()
  // Conservative. This is a gate before spending a provider call, not an
  // RFC 5322 parser.
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(trimmed) ? trimmed : null
}
