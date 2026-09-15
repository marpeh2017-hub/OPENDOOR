import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Request, Query, UnauthorizedException, NotFoundException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../prisma.service'
import { STAFF_ROLES, MANAGER_ROLES } from '../auth/roles.constants'

@ApiTags('tasks')
@ApiBearerAuth()
@Controller({ path: 'tasks', version: '1' })
export class TasksController {
  constructor(private readonly prisma: PrismaService) {}

  private tenantId(req: any): string {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return req.user.tenantId
  }

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List tasks for tenant' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'assigneeId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @Request() req: any,
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = this.tenantId(req)
    return this.prisma.task.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
    })
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get a task' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const task = await this.prisma.task.findFirst({ where: { id, tenantId } })
    if (!task) throw new NotFoundException('Task not found')
    return task
  }

  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create a task' })
  create(@Body() body: any, @Request() req: any) {
    const tenantId = this.tenantId(req)
    return this.prisma.task.create({
      data: { ...body, tenantId, createdById: req.user.userId },
    })
  }

  @Patch(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Update a task' })
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const task = await this.prisma.task.findFirst({ where: { id, tenantId } })
    if (!task) throw new NotFoundException('Task not found')
    return this.prisma.task.update({ where: { id }, data: body })
  }

  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Delete a task (manager+)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const task = await this.prisma.task.findFirst({ where: { id, tenantId } })
    if (!task) throw new NotFoundException('Task not found')
    return this.prisma.task.delete({ where: { id } })
  }
}
