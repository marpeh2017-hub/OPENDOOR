import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AuditService } from '../common/audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import {
  isEnabledActionType, isSendingActionType, ACTION_TYPE_CHANNEL,
  type AutomationEvent, type CreateTaskConfig, type CreateNotificationConfig,
  type SendMessageConfig, type WebhookConfig,
} from './automation-catalog'
import { TemplatesService } from '../templates/templates.service'
import { OutboundMessageService } from '../messaging/outbound-message.service'
import { ResidentContactService, isRoutable } from '../messaging/resident-contact.service'
import { SendCapService } from './send-cap.service'
import { validateWebhookUrl, WebhookUrlError } from './webhook-allowlist'

export interface AutomationRunResult {
  automationId: string
  actionsRun: number
  actionsFailed: number
}

/**
 * Executes automations when a trigger fires.
 *
 * ── HOW A TRIGGER REACHES HERE ─────────────────────────────────────────────
 *
 * `dispatch()` is called in-process by the module that owns the event. There is
 * no event-emitter package and no queue: an automation run is short, writes only
 * rows inside the tenant, and must not silently disappear into a background
 * worker whose failures nobody reads.
 *
 * ── FAILURE POLICY ─────────────────────────────────────────────────────────
 *
 * `dispatch()` NEVER throws. An automation is a side effect of some primary
 * operation (a lead was created, a document was uploaded); if the automation
 * fails, the primary operation must still succeed. Every failure is logged and
 * counted, and one failing action does not stop the remaining ones — the
 * actions are independent instructions, not a transaction.
 *
 * ── WHAT IS NOT IMPLEMENTED ────────────────────────────────────────────────
 *
 * `delayMinutes` is STORED BUT NOT HONOURED. Every action runs immediately.
 * Honouring it needs a scheduler with durable state — a delayed action has to
 * survive a restart, and the existing `MessageDispatcher` queue pattern is the
 * right model for it. Rather than pretend, `dispatch()` records
 * `delayIgnored: true` in the audit metadata for any action configured with a
 * delay, so the trail shows what actually happened.
 */
@Injectable()
export class AutomationRunnerService {
  private readonly logger = new Logger(AutomationRunnerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly templates: TemplatesService,
    private readonly outbound: OutboundMessageService,
    private readonly contacts: ResidentContactService,
    private readonly caps: SendCapService,
  ) {}

  async dispatch(event: AutomationEvent): Promise<AutomationRunResult[]> {
    try {
      const automations = await this.prisma.automation.findMany({
        where: {
          tenantId: event.tenantId,
          trigger: event.trigger as never,
          isActive: true,
          // A tenant-wide automation (projectId null) fires for every project;
          // a project-scoped one fires only for its own.
          ...(event.projectId
            ? { OR: [{ projectId: null }, { projectId: event.projectId }] }
            : { projectId: null }),
        },
        include: { actions: { orderBy: { order: 'asc' } } },
      })

      const results: AutomationRunResult[] = []
      for (const automation of automations) {
        results.push(await this.runOne(automation, event))
      }
      return results
    } catch (err) {
      // Never propagate into the caller's primary operation.
      this.logger.error(
        `Automation dispatch failed for trigger ${event.trigger}: ${(err as Error).message}`,
      )
      return []
    }
  }

  private async runOne(
    automation: {
      id: string; tenantId: string; projectId: string | null; actions: unknown[]
      dryRun: boolean; sendCapPerHour: number | null; sendCapPerDay: number | null
    },
    event: AutomationEvent,
  ): Promise<AutomationRunResult> {
    let actionsRun = 0
    let actionsFailed = 0
    let delayIgnored = false

    for (const raw of automation.actions) {
      const action = raw as { id: string; type: string; config: unknown; delayMinutes: number }
      if (action.delayMinutes > 0) delayIgnored = true

      try {
        if (!isEnabledActionType(action.type)) {
          // Defence in depth: `validateActions` refuses these at save time, so
          // reaching here means a row predates that check or was written
          // directly to the database.
          this.logger.warn(
            `Skipping disabled action type ${action.type} on automation ${automation.id}`,
          )
          actionsFailed++
          continue
        }
        await this.execute(action.type, action.config as Record<string, unknown>, automation, event)
        actionsRun++
      } catch (err) {
        actionsFailed++
        // No payload in the log line: action config carries resident-facing
        // text and ids.
        this.logger.error(
          `Automation ${automation.id} action ${action.id} (${action.type}) failed: ` +
          `${(err as Error).message}`,
        )
      }
    }

    await this.prisma.automation.update({
      where: { id: automation.id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    })

    // A run is a system action, not a user action, so it is audited without a
    // user actor. `recordAnonymous` is the existing shape for that.
    await this.audit.recordAnonymous(
      automation.tenantId,
      { ip: null, userAgent: 'automation-runner' },
      {
        action: 'UPDATE',
        entity: 'Automation',
        entityId: automation.id,
        metadata: {
          trigger: event.trigger,
          actionsRun,
          actionsFailed,
          ...(delayIgnored ? { delayIgnored: true } : {}),
        },
      },
    )

    return { automationId: automation.id, actionsRun, actionsFailed }
  }

  private async execute(
    type: string,
    config: Record<string, unknown>,
    automation: {
      id: string; tenantId: string; projectId: string | null
      dryRun: boolean; sendCapPerHour: number | null; sendCapPerDay: number | null
    },
    event: AutomationEvent,
  ): Promise<void> {
    if (type === 'CREATE_TASK') return this.createTask(config, automation, event)
    if (type === 'CREATE_NOTIFICATION') return this.createNotification(config, automation, event)
    if (isSendingActionType(type)) return this.sendMessages(type, config, automation, event)
    if (type === 'WEBHOOK') return this.callWebhook(config, automation, event)
    throw new Error(`No executor for action type ${type}`)
  }

  /**
   * Outbound send: resolve recipients, check the cap, render, then either
   * dispatch or - in dry run - record exactly what would have gone out.
   */
  private async sendMessages(
    type: string,
    config: Record<string, unknown>,
    automation: {
      id: string; tenantId: string; projectId: string | null
      dryRun: boolean; sendCapPerHour: number | null; sendCapPerDay: number | null
    },
    event: AutomationEvent,
  ): Promise<void> {
    const cfg = config as unknown as SendMessageConfig
    const channel = ACTION_TYPE_CHANNEL[type]!
    const projectId = automation.projectId ?? event.projectId ?? null

    // -- recipients --------------------------------------------------------
    let residentIds: string[] = []
    if (cfg.audience === 'RESIDENT') {
      if (event.subjectId) residentIds = [event.subjectId]
    } else if (projectId) {
      const residents = await this.prisma.resident.findMany({
        where: {
          tenantId: automation.tenantId,
          apartment: {
            building: { complex: { projectId, project: { tenantId: automation.tenantId } } },
          },
        },
        select: { id: true },
      })
      residentIds = residents.map((r) => r.id)
    }
    if (residentIds.length === 0) return

    // -- cap ---------------------------------------------------------------
    const decision = await this.caps.check(automation, residentIds.length)
    if (decision.blocked > 0) {
      // Refused, NOT queued for later. Recorded so the omission is visible
      // rather than silently absent.
      await this.audit.recordAnonymous(
        automation.tenantId,
        { ip: null, userAgent: 'automation-runner' },
        {
          action: 'REJECT',
          entity: 'Automation',
          entityId: automation.id,
          metadata: {
            reason: decision.reason ?? 'SEND_CAP',
            channel,
            requested: residentIds.length,
            permitted: decision.allowed,
            blocked: decision.blocked,
            capPerHour: decision.capPerHour ?? null,
            capPerDay: decision.capPerDay ?? null,
          },
        },
      )
    }
    const targets = residentIds.slice(0, decision.allowed)
    if (targets.length === 0) return

    // -- render + dispatch -------------------------------------------------
    for (const residentId of targets) {
      /**
       * `route()` is the single place that knows about consent, do-not-contact
       * and whether the stored phone/email is usable. An automation must not
       * step around it: a resident who has withdrawn consent is exactly the one
       * an unattended process would otherwise keep messaging.
       *
       * Unreachable residents are skipped and recorded with the REASON only -
       * `ResidentUnreachable.detail` is documented as never containing the
       * address itself, but the reason code is what staff need to fix it.
       */
      const route = await this.contacts.route(automation.tenantId, residentId)
      if (!isRoutable(route)) {
        await this.audit.recordAnonymous(
          automation.tenantId,
          { ip: null, userAgent: 'automation-runner' },
          {
            action: 'REJECT',
            entity: 'Automation',
            entityId: automation.id,
            metadata: { skipped: true, residentId, reason: route.reason, channel },
          },
        )
        continue
      }

      // The action names a channel; the resident must have a usable address for
      // THAT channel. Falling back to another channel would send WhatsApp text
      // as an email, or reach someone on a channel they did not consent to.
      const needsPhone = channel === 'SMS' || channel === 'WHATSAPP'
      const address = needsPhone ? route.toPhone : route.toEmail
      if (!address) {
        await this.audit.recordAnonymous(
          automation.tenantId,
          { ip: null, userAgent: 'automation-runner' },
          {
            action: 'REJECT',
            entity: 'Automation',
            entityId: automation.id,
            metadata: {
              skipped: true,
              residentId,
              reason: needsPhone ? 'NO_VALID_PHONE' : 'NO_VALID_EMAIL',
              channel,
            },
          },
        )
        continue
      }

      const rendered = await this.templates.preview(
        automation.tenantId,
        cfg.templateId,
        { ...(event.context ?? {}) } as Record<string, string | number>,
      )

      if (automation.dryRun) {
        /**
         * DRY RUN. Everything above is identical to a live run - same recipient
         * resolution, same cap accounting, same template render - so what is
         * recorded here is genuinely what would have been sent.
         *
         * The rendered BODY is deliberately NOT written into the audit row: it
         * is populated with a real resident name and address, and the audit
         * trail is not a place for resident PII. Template id and rendered length
         * are enough to confirm the right text was produced.
         */
        await this.audit.recordAnonymous(
          automation.tenantId,
          { ip: null, userAgent: 'automation-runner' },
          {
            action: 'UPDATE',
            entity: 'Automation',
            entityId: automation.id,
            metadata: {
              dryRun: true,
              wouldSend: true,
              channel,
              residentId,
              templateId: cfg.templateId,
              hasAddress: true,
              renderedLength: rendered.body.length,
            },
          },
        )
        continue
      }

      await this.outbound.enqueueSafe({
        tenantId: automation.tenantId,
        channel: channel as never,
        body: rendered.body,
        subject: rendered.subject ?? null,
        residentId,
        toPhone: needsPhone ? address : null,
        toEmail: needsPhone ? null : address,
        templateId: cfg.templateId,
        automationId: automation.id,
        // An automation can fire twice for one event on a retry; without a key
        // the resident receives the message twice.
        idempotencyKey:
          `auto:${automation.id}:${event.trigger}:${event.subjectId ?? 'none'}:${residentId}`,
      })
    }
  }

  /**
   * Webhook.
   *
   * The URL is re-validated HERE, immediately before dispatch, even though it
   * was already validated at save time. The allowlist is configuration and may
   * have been tightened since the row was written, and a row can be edited
   * directly in the database. Validating only at save time would make the
   * allowlist a suggestion rather than a control.
   */
  private async callWebhook(
    config: Record<string, unknown>,
    automation: { id: string; tenantId: string; dryRun: boolean },
    event: AutomationEvent,
  ): Promise<void> {
    const cfg = config as unknown as WebhookConfig
    let url: URL
    try {
      url = validateWebhookUrl(cfg.url ?? '')
    } catch (err) {
      if (err instanceof WebhookUrlError) {
        throw new Error(`Webhook refused (${err.code}): ${err.message}`)
      }
      throw err
    }

    /**
     * The payload carries IDS ONLY - never resident names, phone numbers or
     * national ids. A webhook ships data to a third party the resident never
     * consented to; a receiving system can look up whatever it is entitled to
     * through the API using its own credentials.
     */
    const payload = {
      trigger: event.trigger,
      tenantId: automation.tenantId,
      projectId: event.projectId ?? null,
      subjectId: event.subjectId ?? null,
      automationId: automation.id,
      firedAt: new Date().toISOString(),
    }

    if (automation.dryRun) {
      await this.audit.recordAnonymous(
        automation.tenantId,
        { ip: null, userAgent: 'automation-runner' },
        {
          action: 'UPDATE',
          entity: 'Automation',
          entityId: automation.id,
          metadata: { dryRun: true, wouldSend: true, webhookHost: url.hostname },
        },
      )
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(cfg.headers ?? {}) },
        body: JSON.stringify(payload),
        signal: controller.signal,
        // Never follow a redirect: a 302 to 169.254.169.254 would walk straight
        // past every check above.
        redirect: 'error',
      })
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`)
    } finally {
      clearTimeout(timer)
    }
  }

  private async createTask(
    config: Record<string, unknown>,
    automation: { tenantId: string; projectId: string | null },
    event: AutomationEvent,
  ): Promise<void> {
    const cfg = config as unknown as CreateTaskConfig

    // An assignee written into config could name a user from another tenant if
    // the row was tampered with; verify rather than trust.
    let assigneeId: string | null = null
    if (cfg.assigneeId) {
      const user = await this.prisma.user.findFirst({
        where: { id: cfg.assigneeId, tenantId: automation.tenantId },
        select: { id: true },
      })
      assigneeId = user?.id ?? null
    }

    const dueDate =
      cfg.dueInDays === undefined
        ? null
        : new Date(Date.now() + cfg.dueInDays * 24 * 60 * 60 * 1000)

    await this.prisma.task.create({
      data: {
        tenantId: automation.tenantId,
        title: cfg.title,
        description: cfg.description ?? null,
        priority: (cfg.priority ?? 'MEDIUM') as never,
        assigneeId,
        dueDate,
        // Project scope comes from the event when the automation is tenant-wide.
        projectId: automation.projectId ?? event.projectId ?? null,
        // `createdById` is nullable precisely so a system-created task is not
        // attributed to a person who did not create it.
        createdById: null,
      },
    })
  }

  private async createNotification(
    config: Record<string, unknown>,
    automation: { tenantId: string; projectId: string | null },
    event: AutomationEvent,
  ): Promise<void> {
    const cfg = config as unknown as CreateNotificationConfig
    const projectId = automation.projectId ?? event.projectId ?? null

    let userIds: string[] = []
    if (cfg.userIds?.length) {
      userIds = cfg.userIds
    } else if (projectId) {
      const members = await this.prisma.projectMember.findMany({
        where: { projectId, project: { tenantId: automation.tenantId } },
        select: { userId: true },
      })
      userIds = members.map((m) => m.userId)
    }

    if (userIds.length === 0) return

    // `emit` independently verifies each recipient is inside the tenant and
    // refuses the ones that are not, so a tampered `userIds` cannot reach across.
    await this.notifications.emitMany(userIds, {
      tenantId: automation.tenantId,
      type: cfg.kind as never,
      title: cfg.title,
      body: cfg.body ?? '',
      entityId: event.subjectId ?? null,
    })
  }
}
