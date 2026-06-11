import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

@Injectable()
export class ResidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: Record<string, string>, tenantId: string) {
    const { projectId, signatureStatus, search, page = '1', limit = '20' } = query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { tenantId }
    if (signatureStatus) where.signatureStatus = signatureStatus
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName:  { contains: search } },
        { phone:     { contains: search } },
      ]
    }
    if (projectId) {
      where.apartment = { building: { complex: { projectId } } }
    }

    const [data, total] = await Promise.all([
      this.prisma.resident.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { lastName: 'asc' },
        include: {
          apartment: {
            include: {
              building: {
                include: { complex: { include: { project: { select: { name: true, city: true } } } } },
              },
            },
          },
          signatures: { select: { status: true, signedAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.resident.count({ where }),
    ])

    return { data, total, page: Number(page), limit: Number(limit) }
  }

  async findOne(id: string) {
    const resident = await this.prisma.resident.findUnique({
      where: { id },
      include: {
        apartment: {
          include: {
            building: {
              include: { complex: { include: { project: { select: { id: true, name: true, city: true, stage: true } } } } },
            },
          },
        },
        activityLog: { orderBy: { createdAt: 'desc' }, take: 20 },
        signatures:  { orderBy: { createdAt: 'desc' }, take: 5 },
        tasks:       { where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }, orderBy: { dueDate: 'asc' } },
        tickets:     { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })
    if (!resident) throw new NotFoundException(`דייר ${id} לא נמצא`)
    return resident
  }

  async updateStatus(id: string, signatureStatus: string, userId: string) {
    await this.findOne(id)
    const updated = await this.prisma.resident.update({
      where: { id },
      data:  { signatureStatus: signatureStatus as any },
    })
    await this.prisma.residentActivity.create({
      data: {
        residentId:  id,
        type:        'status_change',
        title:       `סטטוס עודכן ל-${signatureStatus}`,
        createdById: userId,
      },
    })
    return updated
  }

  async addActivity(id: string, type: string, title: string, note: string, userId: string) {
    await this.findOne(id)
    return this.prisma.residentActivity.create({
      data: { residentId: id, type, title, note, createdById: userId },
    })
  }
}
