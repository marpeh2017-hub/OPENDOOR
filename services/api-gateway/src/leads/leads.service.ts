import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CreateLeadDto } from './dto/create-lead.dto'
import { CreatePublicLeadDto } from './dto/create-public-lead.dto'

/**
 * Tenant that public website submissions are filed under.
 *
 * TODO(multi-tenant): the marketing site is single-tenant today, so this is a
 * constant. Resolve it from the request host or an explicit site identifier
 * before a second tenant gets its own public site.
 */
const WEBSITE_TENANT_ID = process.env['WEBSITE_TENANT_ID'] ?? 'tnt_01'

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: Record<string, string>, tenantId: string) {
    const { status, source, search, assignedToId, page = '1', limit = '50' } = query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { tenantId }
    if (status)       where.status = status
    if (source)       where.source = source
    if (assignedToId) where.assignedToId = assignedToId
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName:  { contains: search } },
        { phone:     { contains: search } },
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

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where:   { id },
      include: { activities: { orderBy: { createdAt: 'desc' }, take: 20 } },
    })
    if (!lead) throw new NotFoundException(`ליד ${id} לא נמצא`)
    return lead
  }

  async create(data: CreateLeadDto, tenantId: string) {
    // tenantId is taken from the request context, never from the body: the DTO
    // has no tenantId field, so a caller cannot write a lead into another tenant.
    return this.prisma.lead.create({
      data: { ...data, tenantId } as any,
    })
  }

  /**
   * Create a lead from the public website form. source and status are set
   * here rather than taken from the request, so an anonymous caller cannot
   * plant a lead that looks like it came from anywhere else or is further
   * along the pipeline than it is.
   */
  async createFromWebsite(data: CreatePublicLeadDto) {
    return this.prisma.lead.create({
      data: {
        ...data,
        tenantId: WEBSITE_TENANT_ID,
        source: 'WEBSITE',
        status: 'NEW',
        language: 'he',
      } as any,
    })
  }

  async updateStatus(id: string, status: string, userId: string) {
    const lead = await this.findOne(id)
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

  async addActivity(id: string, type: string, note: string, userId: string) {
    await this.findOne(id)
    return this.prisma.leadActivity.create({
      data: { leadId: id, type, note, createdById: userId },
    })
  }
}
