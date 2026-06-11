import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

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

  async create(data: any, tenantId: string) {
    return this.prisma.lead.create({
      data: { ...data, tenantId },
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
