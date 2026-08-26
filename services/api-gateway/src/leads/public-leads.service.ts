import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { AutomationRunnerService } from '../automations/automation-runner.service'
import { PrismaService } from '../prisma.service'
import { AuditService } from '../common/audit/audit.service'
import type { PublicLeadDto } from './dto/public-lead.dto'

/**
 * Public marketing-site lead intake.
 *
 * The marketing site has no backend of its own — the CRM *is* its backend, and
 * a submission lands directly in `Lead` with no intermediate review queue.
 * That makes this the only unauthenticated write in the system, so the rules
 * below are load-bearing rather than defensive habit.
 *
 * ── Tenant assignment ─────────────────────────────────────────────────────
 * A public form has no authenticated tenant, and the client must never get a
 * say. The destination is read from `PUBLIC_LEAD_TENANT_ID` (or
 * `PUBLIC_LEAD_TENANT_SLUG`) in server configuration and verified to exist and
 * be active. If it is unset or unresolvable the endpoint refuses the write
 * outright — silently dropping real prospects would be worse than an outage,
 * and guessing "the only tenant" would become a cross-tenant write the moment
 * a second tenant is onboarded.
 *
 * ── What the caller learns ────────────────────────────────────────────────
 * Nothing. Every accepted, spam-rejected and duplicate submission returns the
 * same generic acknowledgement with no id, no count, and no signal about
 * whether the address is already known. A spammer must not be able to learn
 * that the honeypot caught them, and nobody may use the form to test whether a
 * given person is in the CRM.
 */

/** Minimum plausible time a human spends on the form before submitting. */
const MIN_TIME_ON_FORM_MS = 3_000

/** Beyond this the timestamp is stale or fabricated; treat it as untrusted. */
const MAX_TIME_ON_FORM_MS = 6 * 60 * 60 * 1_000

/** Why a submission was silently discarded. Never leaves the server. */
type SpamVerdict = 'HONEYPOT' | 'TOO_FAST' | 'STALE_TIMESTAMP' | null

export interface PublicLeadContext {
  ip: string | null
  userAgent: string | null
}

@Injectable()
export class PublicLeadsService {
  private readonly logger = new Logger(PublicLeadsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly automations: AutomationRunnerService,
  ) {}

  /**
   * Resolves the destination tenant from CONFIGURATION ONLY.
   *
   * There is no parameter for this by design. If a future caller wants to pass
   * a tenant in, that is the bug this signature exists to prevent.
   */
  private async resolveTenantId(): Promise<string> {
    const id = process.env.PUBLIC_LEAD_TENANT_ID?.trim()
    const slug = process.env.PUBLIC_LEAD_TENANT_SLUG?.trim()

    if (!id && !slug) {
      this.logger.error(
        'Public lead form is not configured: set PUBLIC_LEAD_TENANT_ID or PUBLIC_LEAD_TENANT_SLUG',
      )
      throw new ServiceUnavailableException('הטופס אינו זמין כרגע')
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: id ? { id } : { slug },
      select: { id: true, isActive: true },
    })

    if (!tenant || !tenant.isActive) {
      this.logger.error('Public lead destination tenant is missing or inactive')
      throw new ServiceUnavailableException('הטופס אינו זמין כרגע')
    }
    return tenant.id
  }

  /**
   * Cheap bot filters. Neither is a security control — they exist to stop
   * commodity form-spam without adding a paid captcha service, which would be
   * a cost decision that is not ours to make.
   */
  private spamVerdict(dto: PublicLeadDto): SpamVerdict {
    // A human never sees the honeypot field, so any value is a bot.
    if (dto.company && dto.company.trim().length > 0) return 'HONEYPOT'

    if (dto.renderedAt) {
      const rendered = Date.parse(dto.renderedAt)
      if (Number.isFinite(rendered)) {
        const elapsed = Date.now() - rendered
        if (elapsed < MIN_TIME_ON_FORM_MS) return 'TOO_FAST'
        if (elapsed > MAX_TIME_ON_FORM_MS) return 'STALE_TIMESTAMP'
      }
    }
    return null
  }

  /**
   * Creates a lead from a public submission.
   *
   * Returns void: there is nothing the caller is allowed to know. The
   * controller turns every outcome into the same response.
   */
  async submit(dto: PublicLeadDto, ctx: PublicLeadContext): Promise<void> {
    // Resolve the tenant BEFORE the spam check, so a misconfigured deployment
    // surfaces as an outage rather than being masked by a silent discard.
    const tenantId = await this.resolveTenantId()

    const verdict = this.spamVerdict(dto)
    if (verdict) {
      // Audited but not persisted as a lead. The audit row is how anyone finds
      // out the form is under attack; the submitter learns nothing.
      await this.audit.recordAnonymous(
        tenantId,
        { ip: ctx.ip, userAgent: ctx.userAgent },
        {
          action: 'CREATE',
          entity: 'PublicLeadSubmission',
          entityId: null,
          metadata: { outcome: 'DISCARDED', reason: verdict, source: 'WEBSITE' },
        },
      )
      this.logger.warn(`Public lead discarded: ${verdict}`)
      return
    }

    const notes = [
      dto.message,
      dto.interest ? `תחום עניין: ${dto.interest}` : null,
    ].filter(Boolean).join('\n') || null

    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone ?? null,
        city: dto.city ?? null,
        notes,
        // Server-decided, never client-supplied.
        source: 'WEBSITE',
        status: 'NEW',
        language: 'he',
      },
      select: { id: true },
    })

    // Source attribution on the lead's own timeline, so whoever picks it up in
    // the kanban can see it arrived unattended from the marketing site.
    await this.prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'public_form_submission',
        note: 'ליד נוצר מטופס יצירת קשר באתר השיווקי',
        metadata: JSON.stringify({
          source: 'WEBSITE',
          interest: dto.interest ?? null,
          // Deliberately no IP here: the audit row already carries it, and a
          // lead timeline is read by staff far more widely than an audit log.
        }),
        createdById: null,
      },
    })

    await this.audit.recordAnonymous(
      tenantId,
      { ip: ctx.ip, userAgent: ctx.userAgent },
      {
        action: 'CREATE',
        entity: 'Lead',
        entityId: lead.id,
        metadata: { outcome: 'CREATED', source: 'WEBSITE', channel: 'public-marketing-form' },
      },
    )

    /**
     * Fired last, after the lead, its timeline entry and the audit row are all
     * committed.
     *
     * This path matters more than the staff one: a public submission arrives
     * with nobody watching, at any hour, which is exactly the case automations
     * exist for — and exactly the case where an automation misfiring is least
     * likely to be noticed. `dispatch()` never throws, so a broken automation
     * cannot turn a captured lead into a 500 for the member of the public who
     * submitted the form.
     *
     * The context carries only what a template legitimately needs. No IP, and
     * no email or phone: those reach the resident through the message itself,
     * not through automation context that is copied into audit metadata.
     */
    await this.automations.dispatch({
      trigger: 'LEAD_CREATED',
      tenantId,
      subjectId: lead.id,
      context: {
        leadFirstName: dto.firstName,
        leadLastName: dto.lastName,
        leadCity: dto.city ?? '',
        leadSource: 'WEBSITE',
      },
    })
  }
}
