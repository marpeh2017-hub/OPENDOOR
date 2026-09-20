import {
  Injectable, NotFoundException, BadRequestException, ConflictException, Logger,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { AuditService } from '../common/audit/audit.service'
import type { AuditActor } from '../common/audit/audit.service'
import { extractVariables, renderTemplate, TemplateRenderError } from './template-render'
import type { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto'

/**
 * Columns returned to API callers. The row has no secrets today, but listing
 * them explicitly keeps a future sensitive column from leaking by default.
 */
const TEMPLATE_SELECT = {
  id: true, name: true, channel: true, language: true,
  subject: true, body: true, variables: true,
  isActive: true, isApproved: true,
  waTemplateName: true, waCategory: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.CommunicationTemplateSelect

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    tenantId: string,
    filters: { channel?: string; language?: string; isActive?: boolean } = {},
  ) {
    return this.prisma.communicationTemplate.findMany({
      where: {
        tenantId,
        ...(filters.channel  ? { channel:  filters.channel  as never } : {}),
        ...(filters.language ? { language: filters.language as never } : {}),
        ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      },
      select: TEMPLATE_SELECT,
      orderBy: [{ name: 'asc' }],
    })
  }

  async findOne(tenantId: string, id: string) {
    const template = await this.prisma.communicationTemplate.findFirst({
      where: { id, tenantId },
      select: TEMPLATE_SELECT,
    })
    if (!template) throw new NotFoundException('Template not found')
    return template
  }

  /**
   * A subject only means something on EMAIL. Silently dropping it on an SMS
   * template would lose the author text without saying so; storing it would
   * imply it gets sent. Reject instead.
   */
  private assertSubjectMatchesChannel(channel: string, subject?: string | null) {
    if (subject && channel !== 'EMAIL') {
      throw new BadRequestException({
        code: 'TEMPLATE_SUBJECT_NOT_APPLICABLE',
        message: 'Only EMAIL templates can carry a subject',
      })
    }
  }

  async create(actor: AuditActor, dto: CreateTemplateDto) {
    this.assertSubjectMatchesChannel(dto.channel, dto.subject)
    const variables = extractVariables(dto.body, dto.subject)

    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.communicationTemplate.create({
          data: {
            tenantId:  actor.tenantId,
            name:      dto.name,
            channel:   dto.channel as never,
            language:  (dto.language ?? 'he') as never,
            subject:   dto.subject ?? null,
            body:      dto.body,
            variables,
            isActive:  dto.isActive ?? true,
            // Never trusted from the client: a brand new WhatsApp template has
            // not been reviewed by the provider yet, by definition.
            isApproved: false,
            waTemplateName: dto.waTemplateName ?? null,
            waCategory:     dto.waCategory ?? null,
          },
          select: TEMPLATE_SELECT,
        })
        await this.audit.record(
          actor,
          {
            action: 'CREATE',
            entity: 'CommunicationTemplate',
            entityId: row.id,
            // The body is the author own text, not resident data, but it is
            // still not logged: templates are edited often and the trail should
            // record THAT it changed and by whom, not accumulate copies.
            metadata: {
              name: row.name, channel: row.channel, language: row.language, variables,
            },
          },
          tx,
        )
        return row
      })
    } catch (err) {
      throw this.translateUniqueViolation(err)
    }
  }

  async update(actor: AuditActor, id: string, dto: UpdateTemplateDto) {
    const existing = await this.prisma.communicationTemplate.findFirst({
      where: { id, tenantId: actor.tenantId },
    })
    if (!existing) throw new NotFoundException('Template not found')

    const nextSubject = dto.subject === undefined ? existing.subject : dto.subject
    const nextBody    = dto.body    === undefined ? existing.body    : dto.body
    this.assertSubjectMatchesChannel(existing.channel, nextSubject)

    const variables = extractVariables(nextBody, nextSubject)

    /**
     * Editing the TEXT of an approved WhatsApp template invalidates that
     * approval: the provider approved specific wording, not a row id. Resetting
     * is the safe direction. The alternative is a row claiming provider approval
     * for text the provider never saw, which fails at send time against real
     * recipients rather than here.
     */
    const textChanged  = nextBody !== existing.body || nextSubject !== existing.subject
    const approvalReset = existing.isApproved && textChanged
    if (approvalReset) {
      this.logger.warn(
        `WhatsApp approval reset for template ${id}: body/subject edited after approval`,
      )
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.communicationTemplate.update({
          where: { id },
          data: {
            ...(dto.name     === undefined ? {} : { name: dto.name }),
            ...(dto.subject  === undefined ? {} : { subject: dto.subject }),
            ...(dto.body     === undefined ? {} : { body: dto.body }),
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
            ...(dto.waTemplateName === undefined ? {} : { waTemplateName: dto.waTemplateName }),
            ...(dto.waCategory     === undefined ? {} : { waCategory: dto.waCategory }),
            variables,
            ...(approvalReset ? { isApproved: false } : {}),
          },
          select: TEMPLATE_SELECT,
        })
        await this.audit.record(
          actor,
          {
            action: 'UPDATE',
            entity: 'CommunicationTemplate',
            entityId: id,
            metadata: {
              fields: Object.keys(dto),
              variables,
              ...(approvalReset ? { approvalReset: true } : {}),
            },
          },
          tx,
        )
        return row
      })
    } catch (err) {
      throw this.translateUniqueViolation(err)
    }
  }

  /** WhatsApp approval is an external fact, so it is recorded, never inferred. */
  async setApproval(actor: AuditActor, id: string, isApproved: boolean) {
    const existing = await this.prisma.communicationTemplate.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, channel: true },
    })
    if (!existing) throw new NotFoundException('Template not found')
    if (existing.channel !== 'WHATSAPP') {
      throw new BadRequestException({
        code: 'TEMPLATE_APPROVAL_NOT_APPLICABLE',
        message: 'Only WHATSAPP templates carry a provider approval state',
      })
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.communicationTemplate.update({
        where: { id },
        data: { isApproved },
        select: TEMPLATE_SELECT,
      })
      await this.audit.record(
        actor,
        {
          action: isApproved ? 'APPROVE' : 'REJECT',
          entity: 'CommunicationTemplate',
          entityId: id,
          metadata: { isApproved },
        },
        tx,
      )
      return row
    })
  }

  /**
   * Deletion is refused once the template has sent anything.
   *
   * `Message.template` is an OPTIONAL relation, so Prisma default referential
   * action is SetNull: deleting would quietly strip `templateId` from historical
   * messages and destroy the record of what text a resident was actually sent.
   * For a system whose messages concern a legal signature process, that history
   * is the point. Deactivation (`isActive: false`) is the supported way to
   * retire a template, and it keeps provenance intact.
   */
  async remove(actor: AuditActor, id: string) {
    const existing = await this.prisma.communicationTemplate.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, name: true },
    })
    if (!existing) throw new NotFoundException('Template not found')

    const usage = await this.prisma.message.count({ where: { templateId: id } })
    if (usage > 0) {
      throw new ConflictException({
        code: 'TEMPLATE_IN_USE',
        message:
          `Template has been used by ${usage} message(s) and cannot be deleted. ` +
          'Deactivate it instead (isActive: false).',
        messageCount: usage,
      })
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.communicationTemplate.delete({ where: { id } })
      await this.audit.record(
        actor,
        {
          action: 'DELETE',
          entity: 'CommunicationTemplate',
          entityId: id,
          metadata: { name: existing.name },
        },
        tx,
      )
    })
    return { deleted: true }
  }

  /**
   * Render with caller-supplied values.
   *
   * The rendered text is returned to the caller and deliberately NOT logged: a
   * realistic preview is populated with a real resident name, address and
   * apartment, which is exactly the payload that must stay out of logs.
   */
  async preview(tenantId: string, id: string, values: Record<string, string | number>) {
    const template = await this.findOne(tenantId, id)
    try {
      return {
        id: template.id,
        channel: template.channel,
        language: template.language,
        subject: template.subject ? renderTemplate(template.subject, values) : null,
        body: renderTemplate(template.body, values),
        variables: template.variables,
      }
    } catch (err) {
      if (err instanceof TemplateRenderError) {
        throw new BadRequestException({ code: err.code, message: err.message, ...err.details })
      }
      throw err
    }
  }

  private translateUniqueViolation(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException({
        code: 'TEMPLATE_NAME_TAKEN',
        message: 'A template with this name already exists for this channel and language',
      })
    }
    return err
  }
}
