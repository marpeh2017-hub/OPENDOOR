import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: Record<string, string>, tenantId: string) {
    const { stage, city, search, page = '1', limit = '20' } = query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { tenantId }
    if (stage)  where.stage = stage
    if (city)   where.city  = { contains: city }
    if (search) {
      where.OR = [
        { name:    { contains: search } },
        { address: { contains: search } },
        { code:    { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          members: {
            include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ])

    return { data, total, page: Number(page), limit: Number(limit) }
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, role: true, email: true } } },
        },
        stages: { orderBy: { enteredAt: 'desc' }, take: 10 },
        complexes: {
          include: {
            buildings: {
              include: {
                apartments: {
                  include: { residents: { select: { id: true, firstName: true, lastName: true, signatureStatus: true, phone: true } } },
                },
              },
            },
          },
        },
      },
    })
    if (!project) throw new NotFoundException(`פרויקט ${id} לא נמצא`)
    return project
  }

  async create(dto: CreateProjectDto, tenantId: string) {
    return this.prisma.project.create({
      data: {
        tenantId,
        code:         `PRJ-${Date.now().toString(36).toUpperCase()}`,
        name:         dto.name,
        address:      dto.address ?? '',
        city:         dto.city,
        neighborhood: dto.neighborhood,
        totalUnits:   Number(dto.totalUnits ?? 0),
        stage:        (dto.stage as any) ?? 'DISCOVERY',
      },
    })
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id)
    const { stage, city, ...rest } = dto as any
    return this.prisma.project.update({
      where: { id },
      data:  { ...rest, ...(stage && { stage }), ...(city && { city }) },
    })
  }

  async advanceStage(id: string, stage: string, notes?: string, userId?: string) {
    const project = await this.findOne(id)

    // Close previous stage entry
    await this.prisma.projectStageHistory.updateMany({
      where: { projectId: id, exitedAt: null },
      data:  { exitedAt: new Date() },
    })

    await this.prisma.projectStageHistory.create({
      data: { projectId: id, stage: stage as any, notes, changedById: userId },
    })

    return this.prisma.project.update({ where: { id }, data: { stage: stage as any } })
  }

  async getSignatureReport(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { totalUnits: true, signedUnits: true, name: true },
    })
    if (!project) throw new NotFoundException()

    const residents = await this.prisma.resident.findMany({
      where: { apartment: { building: { complex: { projectId: id } } } },
      select: { id: true, firstName: true, lastName: true, signatureStatus: true, phone: true },
    })

    const signed = residents.filter(r => r.signatureStatus === 'SIGNED').length
    return {
      totalUnits:  project.totalUnits,
      signedUnits: project.signedUnits,
      percentage:  project.totalUnits ? Math.round((project.signedUnits / project.totalUnits) * 100) : 0,
      residents,
    }
  }
}
