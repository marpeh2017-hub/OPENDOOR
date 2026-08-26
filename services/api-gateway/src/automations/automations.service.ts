import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AuditService } from '../common/audit/audit.service'
import type { AuditActor } from '../common/audit/audit.service'
import { NOTIFICATION_KINDS } from '../notifications/notification-kinds'
import {
  isEnabledActionType, DISABLED_ACTION_REASONS, hasOutboundAction,
  isSendingActionType, ACTION_TYPE_CHANNEL, SEND_AUDIENCES,
  type CreateTaskConfig, type CreateNotificationConfig,
  type SendMessageConfig, type WebhookConfig,
} from './automation-catalog'
import { validateWebhookUrl, WebhookUrlError } from './webhook-allowlist'
import type { CreateAutomationDto, UpdateAutomationDto, AutomationActionInputDto } from './dto/automation.dto'

const AUTOMATION_INCLUDE = {
  actions: { orderBy: { order: 'asc' } },
} as const

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, filters: { projectId?: string; isActive?: boolean } = {}) {
    return this.prisma.automation.findMany({
      where: {
        tenantId,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      },
      include: AUTOMATION_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    })
  }

  async findOne(tenantId: string, id: string) {
    const row = await this.prisma.automation.findFirst({
      where: { id, tenantId },
      include: AUTOMATION_INCLUDE,
    })
    if (!row) throw new NotFoundException('Automation not found')
    return row
  }

  /**
   * Validate every action before anything is written.
   *
   * Disabled action types are rejected HERE, at save time, rather than skipped
   * at run time. The alternative — accepting the row and quietly not executing
   * it — produces an automation that looks armed in the UI and does nothing,
   * which is the single most misleading state this feature could have.
   */
  private validateActions(actions: AutomationActionInputDto[]) {
    if (actions.length === 0) {
      throw new BadRequestException({
        code: 'AUTOMATION_NO_ACTIONS',
        message: 'An automation must have at least one action',
      })
    }

    const orders = new Set<number>()
    for (const action of actions) {
      if (orders.has(action.order)) {
        throw new BadRequestException({
          code: 'AUTOMATION_DUPLICATE_ORDER',
          message: `Two actions share order ${action.order}; execution order would be undefined`,
        })
      }
      orders.add(action.order)

      if (!isEnabledActionType(action.type)) {
        throw new BadRequestException({
          code: 'AUTOMATION_ACTION_NOT_ENABLED',
          actionType: action.type,
          message:
            DISABLED_ACTION_REASONS[action.type] ??
            `Action type ${action.type} is not enabled`,
        })
      }

      this.validateActionConfig(action.type, action.config)
    }
  }

  private validateActionConfig(type: string, config: Record<string, unknown>) {
    if (type === 'CREATE_TASK') {
      const cfg = config as unknown as CreateTaskConfig
      if (!cfg.title || typeof cfg.title !== 'string' || cfg.title.trim() === '') {
        throw new BadRequestException({
          code: 'AUTOMATION_ACTION_CONFIG_INVALID',
          actionType: type,
          message: 'CREATE_TASK requires a non-empty `title`',
        })
      }
      if (cfg.dueInDays !== undefined
        && (!Number.isInteger(cfg.dueInDays) || cfg.dueInDays < 0 || cfg.dueInDays > 3650)) {
        throw new BadRequestException({
          code: 'AUTOMATION_ACTION_CONFIG_INVALID',
          actionType: type,
          message: '`dueInDays` must be an integer between 0 and 3650',
        })
      }
      return
    }

    if (type === 'CREATE_NOTIFICATION') {
      const cfg = config as unknown as CreateNotificationConfig
      if (!cfg.title || typeof cfg.title !== 'string' || cfg.title.trim() === '') {
        throw new BadRequestException({
          code: 'AUTOMATION_ACTION_CONFIG_INVALID',
          actionType: type,
          message: 'CREATE_NOTIFICATION requires a non-empty `title`',
        })
      }
      // The kind must be in the registry or `NotificationsService.emit` refuses
      // it at run time and logs an error — a failure the author would never see.
      if (!(NOTIFICATION_KINDS as readonly string[]).includes(cfg.kind)) {
        throw new BadRequestException({
          code: 'AUTOMATION_ACTION_CONFIG_INVALID',
          actionType: type,
          message: `\`kind\` must be one of: ${NOTIFICATION_KINDS.join(', ')}`,
        })
      }
      return
    }

    if (isSendingActionType(type)) {
      const cfg = config as unknown as SendMessageConfig
      if (!cfg.templateId || typeof cfg.templateId !== 'string') {
        throw new BadRequestException({
          code: 'AUTOMATION_ACTION_CONFIG_INVALID',
          actionType: type,
          message: `${type} requires a \`templateId\``,
        })
      }
      if (!(SEND_AUDIENCES as readonly string[]).includes(cfg.audience)) {
        throw new BadRequestException({
          code: 'AUTOMATION_ACTION_CONFIG_INVALID',
          actionType: type,
          message: `\`audience\` must be one of: ${SEND_AUDIENCES.join(', ')}`,
        })
      }
      return
    }

    if (type === 'WEBHOOK') {
      const cfg = config as unknown as WebhookConfig
      try {
        validateWebhookUrl(cfg.url ?? '')
      } catch (err) {
        if (err instanceof WebhookUrlError) {
          throw new BadRequestException({
            code: err.code, actionType: type, message: err.message,
          })
        }
        throw err
      }
      // Secrets must not live in an automation row: it is readable by every
      // staff role and copied into audit metadata.
      for (const header of Object.keys(cfg.headers ?? {})) {
        if (/^(authorization|cookie|proxy-authorization|x-api-key)$/i.test(header)) {
          throw new BadRequestException({
            code: 'AUTOMATION_ACTION_CONFIG_INVALID',
            actionType: type,
            message: `Header '${header}' may not be set from automation config`,
          })
        }
      }
      return
    }

    /* istanbul ignore next — every entry in ENABLED_ACTION_TYPES is handled
       above. Kept so adding a type without adding its validation fails loudly
       instead of accepting anything. */
    throw new BadRequestException({
      code: 'AUTOMATION_ACTION_CONFIG_UNVALIDATED',
      message: `No config validation is defined for action type ${type}`,
    })
  }

  /** A project-scoped automation must name a project in the caller's tenant. */
  private async assertProjectInTenant(tenantId: string, projectId?: string) {
    if (!projectId) return
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    })
    if (!project) {
      throw new BadRequestException({
        code: 'AUTOMATION_PROJECT_NOT_FOUND',
        message: 'Project not found in this tenant',
      })
    }
  }


  /**
   * Async half of action validation: a `templateId` must name a template in the
   * caller's tenant whose CHANNEL matches the action type.
   *
   * Kept separate from `validateActionConfig` because that one is pure and
   * synchronous. The channel match matters: a SEND_SMS action pointing at an
   * EMAIL template would render a subject nobody sends and, for WhatsApp, would
   * bypass the provider-approval state that only WhatsApp templates carry.
   */
  private async assertTemplatesUsable(
    tenantId: string,
    actions: AutomationActionInputDto[],
  ): Promise<void> {
    const sends = actions.filter((a) => isSendingActionType(a.type))
    for (const action of sends) {
      const cfg = action.config as unknown as SendMessageConfig
      const template = await this.prisma.communicationTemplate.findFirst({
        where: { id: cfg.templateId, tenantId },
        select: { id: true, channel: true, isActive: true, isApproved: true },
      })
      if (!template) {
        throw new BadRequestException({
          code: 'AUTOMATION_TEMPLATE_NOT_FOUND',
          actionType: action.type,
          message: 'Template not found in this tenant',
        })
      }
      const expected = ACTION_TYPE_CHANNEL[action.type]
      if (template.channel !== expected) {
        throw new BadRequestException({
          code: 'AUTOMATION_TEMPLATE_CHANNEL_MISMATCH',
          actionType: action.type,
          message: `${action.type} needs a ${expected} template, but this one is ${template.channel}`,
        })
      }
      if (!template.isActive) {
        throw new BadRequestException({
          code: 'AUTOMATION_TEMPLATE_INACTIVE',
          actionType: action.type,
          message: 'Template is deactivated and cannot be used by an automation',
        })
      }
      if (template.channel === 'WHATSAPP' && !template.isApproved) {
        throw new BadRequestException({
          code: 'AUTOMATION_TEMPLATE_NOT_APPROVED',
          actionType: action.type,
          message: 'WhatsApp template has not been approved by the provider',
        })
      }
    }
  }

  async create(actor: AuditActor, dto: CreateAutomationDto) {
    this.validateActions(dto.actions)
    await this.assertProjectInTenant(actor.tenantId, dto.projectId)
    await this.assertTemplatesUsable(actor.tenantId, dto.actions)

    // An automation that reaches outside the company always starts in dry run,
    // whatever the caller asked for. Going live is a separate admin-only act.
    const outbound = hasOutboundAction(dto.actions.map((a) => a.type))

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.automation.create({
        data: {
          tenantId:  actor.tenantId,
          projectId: dto.projectId ?? null,
          name:      dto.name,
          description: dto.description ?? null,
          trigger:   dto.trigger as never,
          triggerConfig: (dto.triggerConfig ?? {}) as never,
          // Saving an automation does not arm it — see the DTO.
          isActive:  dto.isActive ?? false,
          // Always true on create, never taken from the caller. It is only
          // consulted for outbound actions, so setting it unconditionally costs
          // nothing and removes a branch where a new automation could be born
          // live.
          dryRun:    true,
          sendCapPerHour: dto.sendCapPerHour ?? null,
          sendCapPerDay:  dto.sendCapPerDay ?? null,
          actions: {
            create: dto.actions.map((a) => ({
              order: a.order,
              type: a.type as never,
              config: a.config as never,
              delayMinutes: a.delayMinutes ?? 0,
            })),
          },
        },
        include: AUTOMATION_INCLUDE,
      })

      await this.audit.record(
        actor,
        {
          action: 'CREATE',
          entity: 'Automation',
          entityId: row.id,
          metadata: {
            name: row.name,
            trigger: row.trigger,
            isActive: row.isActive,
            dryRun: row.dryRun,
            outbound,
            actionTypes: row.actions.map((a) => a.type),
          },
        },
        tx,
      )
      return row
    })
  }

  async update(actor: AuditActor, id: string, dto: UpdateAutomationDto) {
    const existing = await this.prisma.automation.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, isActive: true, dryRun: true, actions: { select: { type: true } } },
    })
    if (!existing) throw new NotFoundException('Automation not found')

    if (dto.actions) {
      this.validateActions(dto.actions)
      await this.assertTemplatesUsable(actor.tenantId, dto.actions)
    }

    /**
     * ACTIVATING an outbound automation forces it back into dry run.
     *
     * This is the control the product decision asked for: every automation that
     * contacts residents must default to dry run when first activated, and be
     * taken live deliberately and separately. It re-applies on EVERY activation,
     * not only the first, because the interesting case is an automation that was
     * live, was paused to have its wording changed, and is then switched back
     * on — that is exactly when a stale "live" flag would send the new text to
     * everyone with nobody having reviewed it.
     */
    const actionTypes = (dto.actions ?? existing.actions).map((a) => a.type)
    const outbound = hasOutboundAction(actionTypes)
    const beingActivated = dto.isActive === true && !existing.isActive
    const forceDryRun = outbound && beingActivated

    return this.prisma.$transaction(async (tx) => {
      if (dto.actions) {
        // Replace wholesale. Ordering is a property of the SET, so a partial
        // edit cannot express "these three, in this order" unambiguously.
        await tx.automationAction.deleteMany({ where: { automationId: id } })
      }

      const row = await tx.automation.update({
        where: { id },
        data: {
          ...(dto.name        === undefined ? {} : { name: dto.name }),
          ...(dto.description === undefined ? {} : { description: dto.description }),
          ...(dto.isActive    === undefined ? {} : { isActive: dto.isActive }),
          ...(dto.triggerConfig === undefined ? {} : { triggerConfig: dto.triggerConfig as never }),
          ...(dto.sendCapPerHour === undefined ? {} : { sendCapPerHour: dto.sendCapPerHour }),
          ...(dto.sendCapPerDay  === undefined ? {} : { sendCapPerDay:  dto.sendCapPerDay }),
          ...(forceDryRun ? { dryRun: true } : {}),
          ...(dto.actions ? {
            actions: {
              create: dto.actions.map((a) => ({
                order: a.order,
                type: a.type as never,
                config: a.config as never,
                delayMinutes: a.delayMinutes ?? 0,
              })),
            },
          } : {}),
        },
        include: AUTOMATION_INCLUDE,
      })

      await this.audit.record(
        actor,
        {
          action: 'UPDATE',
          entity: 'Automation',
          entityId: id,
          metadata: {
            fields: Object.keys(dto),
            ...(dto.isActive !== undefined && dto.isActive !== existing.isActive
              ? { armedChanged: dto.isActive }
              : {}),
          },
        },
        tx,
      )
      return row
    })
  }


  /**
   * Take an outbound automation out of dry run, or put it back.
   *
   * Separate from `update` and restricted to admins in the controller, because
   * this is the moment real residents start receiving real messages. It is the
   * manual confirmation step the product decision requires, and it is recorded
   * as its own audit action rather than as a field edit buried in a PATCH.
   */
  async setDryRun(actor: AuditActor, id: string, dryRun: boolean) {
    const existing = await this.prisma.automation.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, actions: { select: { type: true } } },
    })
    if (!existing) throw new NotFoundException('Automation not found')

    if (!hasOutboundAction(existing.actions.map((a) => a.type))) {
      throw new BadRequestException({
        code: 'AUTOMATION_NOT_OUTBOUND',
        message: 'Dry run only applies to automations with a send or webhook action',
      })
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.automation.update({
        where: { id },
        data: { dryRun },
        include: AUTOMATION_INCLUDE,
      })
      await this.audit.record(
        actor,
        {
          action: dryRun ? 'REJECT' : 'APPROVE',
          entity: 'Automation',
          entityId: id,
          metadata: { dryRun, wentLive: !dryRun },
        },
        tx,
      )
      return row
    })
  }

  /**
   * Read-only "what is currently armed" view.
   *
   * Deliberately a narrow projection rather than the full rows: the question it
   * answers is "what can fire right now, and will it actually send?" — which is
   * the thing someone needs before trusting the system unattended.
   */
  async armed(tenantId: string) {
    const rows = await this.prisma.automation.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true, name: true, trigger: true, projectId: true,
        dryRun: true, sendCapPerHour: true, sendCapPerDay: true,
        runCount: true, lastRunAt: true,
        actions: { select: { type: true }, orderBy: { order: 'asc' } },
        project: { select: { name: true } },
      },
      orderBy: [{ lastRunAt: 'desc' }, { name: 'asc' }],
    })

    return rows.map((r) => {
      const actionTypes = r.actions.map((a) => a.type)
      const outbound = hasOutboundAction(actionTypes)
      return {
        id: r.id,
        name: r.name,
        trigger: r.trigger,
        projectId: r.projectId,
        projectName: r.project?.name ?? null,
        actionTypes,
        outbound,
        // The single most important field on this screen: an armed outbound
        // automation in dry run does NOT contact anyone.
        willActuallySend: outbound && !r.dryRun,
        dryRun: r.dryRun,
        sendCapPerHour: r.sendCapPerHour,
        sendCapPerDay: r.sendCapPerDay,
        runCount: r.runCount,
        lastRunAt: r.lastRunAt,
      }
    })
  }

  async remove(actor: AuditActor, id: string) {
    const existing = await this.prisma.automation.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, name: true },
    })
    if (!existing) throw new NotFoundException('Automation not found')

    await this.prisma.$transaction(async (tx) => {
      // `AutomationAction.automation` cascades, so the actions go with it.
      await tx.automation.delete({ where: { id } })
      await this.audit.record(
        actor,
        { action: 'DELETE', entity: 'Automation', entityId: id, metadata: { name: existing.name } },
        tx,
      )
    })
    return { deleted: true }
  }
}
