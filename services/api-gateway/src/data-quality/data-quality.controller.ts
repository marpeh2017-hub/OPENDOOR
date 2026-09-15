import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { MANAGER_ROLES, STAFF_ROLES, SUPER_ADMIN_ONLY } from '../auth/roles.constants'
import { DataQualityService, type ListIssuesFilters } from './data-quality.service'

/**
 * RBAC rationale:
 *  - READS are STAFF_ROLES: every operational role needs to see and act on the
 *    data problems that block their own work (a FIELD_AGENT must know which
 *    owners have no phone number).
 *  - MUTATIONS and SCANS are MANAGER_ROLES: resolving/ignoring an issue is a
 *    governance decision, and a scan is a tenant-wide compute cost.
 *  - The GLOBAL scan crosses tenant boundaries and is SUPER_ADMIN only.
 *
 * JwtAuthGuard and RolesGuard are registered globally in AuthModule, so no
 * per-controller @UseGuards is needed (and adding one would double-run it).
 */
@ApiTags('data-quality')
@ApiBearerAuth()
@Controller({ path: 'data-quality', version: '1' })
export class DataQualityController {
  constructor(private readonly service: DataQualityService) {}

  private tenantId(req: any): string {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return req.user.tenantId
  }

  private actor(req: any) {
    return {
      // JwtStrategy.validate() maps the token's `sub` claim to `userId`.
      userId: (req.user?.userId as string | undefined) ?? null,
      ip: req.ip as string | undefined,
      userAgent: req.headers?.['user-agent'] as string | undefined,
    }
  }

  // ─── Catalogue ────────────────────────────────────────────────────────────

  @Get('rules')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Rule catalogue (ids, categories, emitted issue types)' })
  getRules() {
    return this.service.getRules()
  }

  // ─── Summaries ────────────────────────────────────────────────────────────

  @Get('summary')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Tenant-wide data-quality summary, score and trend' })
  getSummary(@Request() req: any) {
    return this.service.getTenantSummary(this.tenantId(req))
  }

  @Get('projects/:projectId/summary')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Per-project data-quality summary and 0-100 score' })
  getProjectSummary(@Param('projectId') projectId: string, @Request() req: any) {
    return this.service.getProjectSummary(this.tenantId(req), projectId)
  }

  // ─── Issues ───────────────────────────────────────────────────────────────

  @Get('issues')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List persisted data-quality issues' })
  @ApiQuery({ name: 'projectId',  required: false })
  @ApiQuery({ name: 'category',   required: false })
  @ApiQuery({ name: 'severity',   required: false })
  @ApiQuery({ name: 'status',     required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'issueType',  required: false })
  @ApiQuery({ name: 'search',     required: false })
  @ApiQuery({ name: 'sort',       required: false })
  listIssues(@Request() req: any, @Query() query: Record<string, string>) {
    const filters: ListIssuesFilters = {
      projectId:    query['projectId'] || undefined,
      category:     (query['category'] as ListIssuesFilters['category']) || undefined,
      severity:     (query['severity'] as ListIssuesFilters['severity']) || undefined,
      status:       (query['status'] as ListIssuesFilters['status']) || undefined,
      entityType:   (query['entityType'] as ListIssuesFilters['entityType']) || undefined,
      issueType:    query['issueType'] || undefined,
      search:       query['search'] || undefined,
      detectedFrom: query['detectedFrom'] || undefined,
      detectedTo:   query['detectedTo'] || undefined,
      sort:         (query['sort'] as ListIssuesFilters['sort']) || undefined,
      order:        (query['order'] as ListIssuesFilters['order']) || undefined,
      skip:         query['skip'] ? Number(query['skip']) : undefined,
      take:         query['take'] ? Number(query['take']) : undefined,
    }
    return this.service.listIssues(this.tenantId(req), filters)
  }

  @Get('issues/:id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Issue detail with resolution history' })
  getIssue(@Param('id') id: string, @Request() req: any) {
    return this.service.getIssue(this.tenantId(req), id)
  }

  @Patch('issues/:id/resolve')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Mark an issue as resolved (manager+)' })
  resolve(@Param('id') id: string, @Body() body: { note?: string }, @Request() req: any) {
    return this.service.resolveIssue(this.tenantId(req), id, this.actor(req), body?.note)
  }

  @Patch('issues/:id/ignore')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Ignore an issue — scans will not reopen it (manager+)' })
  ignore(@Param('id') id: string, @Body() body: { note?: string }, @Request() req: any) {
    return this.service.ignoreIssue(this.tenantId(req), id, this.actor(req), body?.note)
  }

  @Patch('issues/:id/reopen')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Reopen a resolved or ignored issue (manager+)' })
  reopen(@Param('id') id: string, @Body() body: { note?: string }, @Request() req: any) {
    return this.service.reopenIssue(this.tenantId(req), id, this.actor(req), body?.note)
  }

  @Patch('issues/:id/start')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Mark an issue as being worked on (manager+)' })
  start(@Param('id') id: string, @Body() body: { note?: string }, @Request() req: any) {
    return this.service.startIssue(this.tenantId(req), id, this.actor(req), body?.note)
  }

  // ─── Scanning ─────────────────────────────────────────────────────────────

  @Post('scan')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Run a scan — project-scoped when projectId is given (manager+)' })
  @ApiQuery({ name: 'projectId', required: false })
  async scan(@Request() req: any, @Query('projectId') projectId?: string) {
    const tenantId = this.tenantId(req)
    const actor = this.actor(req)
    return projectId
      ? this.service.scanProject(tenantId, projectId, actor.userId)
      : this.service.scanTenant(tenantId, actor.userId)
  }

  @Post('scan/project/:projectId')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Scan a single project (manager+)' })
  scanProject(@Param('projectId') projectId: string, @Request() req: any) {
    return this.service.scanProject(this.tenantId(req), projectId, this.actor(req).userId)
  }

  @Post('scan/tenant')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Scan the whole tenant (manager+)' })
  scanTenant(@Request() req: any) {
    return this.service.scanTenant(this.tenantId(req), this.actor(req).userId)
  }

  @Post('scan/global')
  @Roles(...SUPER_ADMIN_ONLY)
  @ApiOperation({ summary: 'Scan every active tenant (super admin only)' })
  scanGlobal(@Request() req: any) {
    return this.service.scanGlobal(this.actor(req).userId)
  }

  @Get('scans')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Recent scan history' })
  @ApiQuery({ name: 'projectId', required: false })
  listScans(@Request() req: any, @Query('projectId') projectId?: string) {
    return this.service.listScans(this.tenantId(req), projectId)
  }

  @Get('scans/:id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Scan status and metadata' })
  getScan(@Param('id') id: string, @Request() req: any) {
    return this.service.getScan(this.tenantId(req), id)
  }
}
