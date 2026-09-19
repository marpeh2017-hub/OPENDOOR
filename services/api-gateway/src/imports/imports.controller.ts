import {
  Controller, Get, Post, Delete, Param, Body, Query, Request, Res,
  UploadedFile, UseInterceptors, UseFilters, HttpCode, HttpStatus, ParseIntPipe,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody,
} from '@nestjs/swagger'
import type { Response } from 'express'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES, IMPORT_ROLES } from '../auth/roles.constants'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import { ImportsService, type UploadedFileLike } from './imports.service'
import { ImportUploadExceptionFilter } from './import-upload-exception.filter'
import { MAX_IMPORT_BYTES } from './excel-import.constants'
import {
  UploadImportDto, ConfirmMappingDto, CommitImportDto,
  PreviewQueryDto, ListImportsQueryDto, ListIssuesQueryDto, ResolveReviewDto,
} from './dto/import.dto'

/**
 * Excel import of owners and residents.
 *
 * CONTRACT NOTES
 * --------------
 *   - Every handler takes an explicit `class-validator` DTO. There is no
 *     `@Body()` spread reaching a Prisma `data` object (mass assignment) and no
 *     `@Body('field')` extraction (which bypasses the global ValidationPipe
 *     entirely, so `forbidNonWhitelisted` would never run). Both have been real
 *     bugs in this codebase.
 *   - The actor comes from `actorFrom(req)`, which reads `req.user.userId`.
 *     `req.user.sub` is `undefined` here — `JwtStrategy.validate()` returns
 *     `userId` — and would write anonymous audit rows.
 *   - Running an import is restricted to `IMPORT_ROLES` (managers plus
 *     FIELD_AGENT, who collect the sheets); reading the history is open to all
 *     staff. Hiding the CRM button is not enforcement — these decorators are,
 *     and the E2E suite asserts both that a field agent gets through and that a
 *     role outside the list gets 403 from the endpoint.
 *   - A job belonging to another tenant is a 404, never a 403: a 403 would
 *     confirm the id exists somewhere else. `ImportsService.loadJob` scopes
 *     every lookup by tenant to guarantee that.
 */
@ApiTags('imports')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller({ path: 'imports', version: '1' })
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  // ── Upload ────────────────────────────────────────────────────────────────

  /**
   * `UseFilters` is controller-METHOD scoped here rather than class scoped: the
   * multer filter is only relevant to the multipart route, and a catch-all
   * filter over the whole controller would sit in front of every other
   * handler's error path for no benefit.
   */
  @Post('upload')
  @Roles(...IMPORT_ROLES)
  @UseFilters(ImportUploadExceptionFilter)
  @UseInterceptors(FileInterceptor('file', {
    // Multer's own ceiling, so an oversize body is cut off at the stream rather
    // than buffered in full and rejected afterwards.
    limits: { fileSize: MAX_IMPORT_BYTES, files: 1 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a workbook; returns headers and a suggested column mapping (manager+)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'projectId', 'entityType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        projectId: { type: 'string' },
        entityType: { type: 'string', enum: ['OWNER', 'RESIDENT'] },
        mode: { type: 'string', enum: ['ADD_ONLY', 'UPDATE_ONLY', 'ADD_AND_UPDATE'] },
      },
    },
  })
  upload(
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() dto: UploadImportDto,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.imports.upload(file, dto, actorFrom(req)))
  }

  // ── Workflow ──────────────────────────────────────────────────────────────

  @Post(':id/mapping')
  @Roles(...IMPORT_ROLES)
  // 200, not Nest's default 201: this updates an existing job rather than
  // creating a resource, and it returns the job — same contract as the other
  // workflow steps below.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm the column mapping (manager+)' })
  confirmMapping(
    @Param('id') id: string,
    @Body() dto: ConfirmMappingDto,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.imports.confirmMapping(id, dto, actorFrom(req)))
  }

  /**
   * POST, not GET: it re-validates every row against live data and persists the
   * resulting issue rows, so it is not safe to cache or to replay from a link.
   */
  @Post(':id/preview')
  @Roles(...IMPORT_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate every row and return the preview (manager+)' })
  preview(
    @Param('id') id: string,
    @Query() query: PreviewQueryDto,
    @Request() req: any,
  ) {
    return mapDomainErrors(() =>
      this.imports.preview(id, actorFrom(req), { page: query.page, pageSize: query.pageSize }),
    )
  }

  // ── Ambiguous-duplicate resolution queue ──────────────────────────────────

  /**
   * GET, unlike `/preview`: this persists nothing. It re-validates in memory to
   * build a CURRENT candidate list for each ambiguous row (the stored issue
   * rows keep only the matcher's first guess, and candidates are live data), and
   * returns it alongside any ruling already recorded.
   *
   * IMPORT_ROLES rather than STAFF_ROLES: the response puts existing owners'
   * names, phones and emails beside the sheet's, which is the same disclosure
   * `/preview` makes and is limited to the people who run imports.
   */
  @Get(':id/review')
  @Roles(...IMPORT_ROLES)
  @ApiOperation({ summary: 'Rows awaiting a duplicate ruling, with candidates (import roles)' })
  review(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.imports.review(id, actorFrom(req)))
  }

  /**
   * Record per-row rulings. Writes no domain data — the rulings are applied at
   * the next preview/commit, re-checked against live candidates. Returns the
   * refreshed queue so the client does not need a second round-trip.
   */
  @Post(':id/review')
  @Roles(...IMPORT_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve ambiguous duplicate rows (import roles)' })
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveReviewDto,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.imports.resolve(id, dto, actorFrom(req)))
  }

  /** Undo one ruling, returning the row to the queue. */
  @Delete(':id/review/:rowNumber')
  @Roles(...IMPORT_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the ruling on one row (import roles)' })
  clearDecision(
    @Param('id') id: string,
    @Param('rowNumber', ParseIntPipe) rowNumber: number,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.imports.clearDecision(id, rowNumber, actorFrom(req)))
  }

  @Post(':id/commit')
  @Roles(...IMPORT_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply the import in one transaction (manager+)' })
  commit(
    @Param('id') id: string,
    @Body() dto: CommitImportDto,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.imports.commit(id, dto, actorFrom(req)))
  }

  @Post(':id/cancel')
  @Roles(...IMPORT_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abandon an import and delete the stored workbook (manager+)' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.imports.cancel(id, actorFrom(req)))
  }

  // ── History and reports (read-only, all staff) ────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Import history' })
  list(@Query() query: ListImportsQueryDto, @Request() req: any) {
    return mapDomainErrors(() =>
      this.imports.list(tenantFrom(req), { projectId: query.projectId, status: query.status }),
    )
  }

  @Get(':id')
  @ApiOperation({ summary: 'Import job detail' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.imports.findOne(id, tenantFrom(req)))
  }

  @Get(':id/issues')
  @ApiOperation({ summary: 'Per-row issues (national IDs are masked at source)' })
  issues(
    @Param('id') id: string,
    @Query() query: ListIssuesQueryDto,
    @Request() req: any,
  ) {
    return mapDomainErrors(() =>
      this.imports.issues(id, tenantFrom(req), { severity: query.severity }),
    )
  }

  /**
   * The downloadable error report.
   *
   * Streamed as `text/csv` with a UTF-8 BOM (added by the service) so Excel
   * opens the Hebrew correctly instead of showing mojibake. `Content-Disposition`
   * carries an ASCII-safe fallback plus the RFC 5987 `filename*` form.
   */
  @Get(':id/errors.csv')
  @ApiOperation({ summary: 'Download the row-level error report as CSV' })
  async errorReport(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const { fileName, csv } = await mapDomainErrors(() =>
      this.imports.errorReportCsv(id, tenantFrom(req)),
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    )
    // Defence in depth: the report is user-derived content served from our
    // origin, so make sure a browser never sniffs it into something executable.
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(csv)
  }
}
