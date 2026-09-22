import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Request, Query, UnauthorizedException, NotFoundException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../prisma.service'
import { STAFF_ROLES, MANAGER_ROLES } from '../auth/roles.constants'
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto'

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
  create(@Body() dto: CreateTaskDto, @Request() req: any) {
    const tenantId = this.tenantId(req)
    /*
     * `tenantId` and `createdById` are set here and cannot be sent: they are
     * absent from the DTO, so ValidationPipe rejects them outright rather
     * than letting them through to be overwritten by luck of key order.
     */
    return this.prisma.task.create({
      data: { ...dto, tenantId, createdById: req.user.userId },
    })
  }

  @Patch(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Update a task' })
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Request() req: any) {
    const tenantId = this.tenantId(req)
    /*
     * ── שתי שכבות, ובכוונה ────────────────────────────────────────────────
     *
     * ה-DTO הוא השכבה הראשונה: שדה שלא הוכרז נדחה, ולכן אי אפשר לשלוח
     * `tenantId` בכלל.
     *
     * `updateMany` עם `tenantId` ב-`where` היא השכבה השנייה, והיא החשובה:
     * היא מגנה גם אם מישהו יחזיר אי־פעם `@Body() any`. הקריאה היתה מוגבלת
     * לטננט והכתיבה לא, וזה בדיוק הפער שאיפשר להעביר רשומה לטננט אחר.
     *
     * `updateMany` ולא `update` כי `update` דורש בורר ייחודי, ול-Task אין
     * אינדקס ייחודי משותף על (id, tenantId) — כלומר אי אפשר לצמצם `update`
     * לטננט בלי מיגרציה. `updateMany` מקבל מסנן רגיל, ומחזיר ספירה שממנה
     * אפשר לדעת אם בכלל נמצאה רשומה.
     */
    const { count } = await this.prisma.task.updateMany({ where: { id, tenantId }, data: { ...dto } })
    if (count === 0) throw new NotFoundException('Task not found')
    return this.prisma.task.findFirstOrThrow({ where: { id, tenantId } })
  }

  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Delete a task (manager+)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const task = await this.prisma.task.findFirst({ where: { id, tenantId } })
    if (!task) throw new NotFoundException('Task not found')
    // אותו היגיון כמו בעדכון: המחיקה מוגבלת לטננט בעצמה, ולא נשענת על
    // הקריאה שלפניה.
    const { count } = await this.prisma.task.deleteMany({ where: { id, tenantId } })
    if (count === 0) throw new NotFoundException('Task not found')
    return task
  }
}
