import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AutomationRunnerService } from '../automations/automation-runner.service'

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automations: AutomationRunnerService,
  ) {}

  async findAll(query: Record<string, string>, tenantId: string) {
    const { status, source, city, search, assignedToId, page = '1', limit = '50' } = query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { tenantId }
    if (status)       where.status = status
    if (source)       where.source = source
    if (city)         where.city = { equals: city, mode: 'insensitive' }
    if (assignedToId) where.assignedToId = assignedToId
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName:  { contains: search } },
        { phone:     { contains: search } },
        { email:     { contains: search, mode: 'insensitive' } },
        { address:   { contains: search, mode: 'insensitive' } },
        { city:      { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lead.count({ where }),
    ])

    return { data, total, page: Number(page), limit: Number(limit) }
  }

  async findOne(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where:   { id, tenantId },
      include: { activities: { orderBy: { createdAt: 'desc' }, take: 20 } },
    })
    if (!lead) throw new NotFoundException(`ליד ${id} לא נמצא`)
    return lead
  }

  async create(data: any, tenantId: string) {
    const lead = await this.prisma.lead.create({
      data: { ...data, tenantId },
    })

    /**
     * Fired AFTER the write, never inside a transaction.
     *
     * Two reasons. The automation performs its own writes, so running it
     * inside the caller's transaction would let an automation failure roll
     * back the lead itself. And an automation must only ever act on
     * committed state - messaging a resident about a lead that then rolled
     * back is not recoverable.
     *
     * `dispatch()` never throws (see AutomationRunnerService), so this is
     * not awaited for safety, only for determinism in tests.
     */
    await this.automations.dispatch({
      trigger: 'LEAD_CREATED',
      tenantId,
      subjectId: lead.id,
      context: {
        leadFirstName: lead.firstName ?? '',
        leadLastName: lead.lastName ?? '',
        leadCity: lead.city ?? '',
      },
    })

    return lead
  }

  async updateStatus(id: string, status: string, tenantId: string, userId: string) {
    const lead = await this.findOne(id, tenantId)
    const updated = await this.prisma.lead.update({
      where: { id },
      data:  { status: status as any },
    })
    await this.prisma.leadActivity.create({
      data: {
        leadId:      id,
        type:        'status_change',
        note:        `סטטוס שונה מ-${lead.status} ל-${status}`,
        createdById: userId,
      },
    })
    return updated
  }

  async addActivity(id: string, type: string, note: string, tenantId: string, userId: string) {
    await this.findOne(id, tenantId)
    return this.prisma.leadActivity.create({
      data: { leadId: id, type, note, createdById: userId },
    })
  }
}
