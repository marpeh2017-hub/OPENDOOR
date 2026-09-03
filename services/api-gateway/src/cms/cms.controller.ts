import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, HttpCode, HttpStatus,
  UploadedFile, UseInterceptors, UseFilters, PayloadTooLargeException, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import {
  CMS_VIEW_ROLES, CMS_EDIT_ROLES, CMS_VERIFY_ROLES, CMS_PUBLISH_ROLES,
  CMS_FEASIBILITY_ROLES,
} from '../auth/roles.constants'
import { CmsService } from './cms.service'
import {
  SaveContentDto, SetStateDto, ListContentQueryDto, SetFactDto, VerifyFactDto,
  FeasibilityEditDto,
} from './dto/cms.dto'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import { MulterExceptionFilter } from '../filters/multer-exception.filter'
import { validateFileSignature } from '../documents/document-upload.constants'

/** Deliberately smaller than the document library's 100MB: these are photos
 *  for a web page, not CAD sets. */
const MAX_MEDIA_BYTES = 15 * 1024 * 1024
const ALLOWED_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Local structural type, matching the one in documents.controller.ts —
 *  avoids depending on @types/multer being installed. */
interface UploadedFileLike {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/**
 * Site Manager API — the authenticated editing surface.
 *
 * ── THE TIERS, AND WHY THE ENFORCEMENT IS HERE ─────────────────────────────
 *
 *   READ    `CMS_VIEW_ROLES`    see the Site Manager and every draft in it
 *   WRITE   `CMS_EDIT_ROLES`    edit drafts, submit for review, preview
 *   PUBLISH `CMS_PUBLISH_ROLES` publish, withdraw, restore
 *
 * The CRM hides what a user cannot do, but hiding is not enforcement: these
 * decorators are, and the E2E suite drives the endpoints directly with a
 * viewer's token to prove it. That is the same discipline the rest of this
 * codebase states on IMPORT_ROLES and TEMPLATE_WRITE_ROLES.
 *
 * RESTORE sits in the PUBLISH tier rather than the EDIT tier: restoring a
 * PUBLISHED item changes what the public reads, so it is a publishing act
 * wearing a different name.
 *
 * Tenant identity comes from `actorFrom(req)` / `tenantFrom(req)`, i.e. from
 * the verified JWT. No route accepts a tenant id, in the body or the path.
 * Cross-tenant always answers 404, never 403.
 */
@ApiTags('cms')
@ApiBearerAuth()
@Controller({ path: 'cms/content', version: '1' })
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get()
  @Roles(...CMS_VIEW_ROLES)
  @ApiOperation({ summary: 'List content items in the tenant' })
  list(@Request() req: any, @Query() query: ListContentQueryDto) {
    return mapDomainErrors(() => this.cms.list(tenantFrom(req), query))
  }

  @Get(':id')
  @Roles(...CMS_VIEW_ROLES)
  @ApiOperation({ summary: 'One item with its verification state (404 across tenants)' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return mapDomainErrors(() => this.cms.findOne(tenantFrom(req), id))
  }

  @Get(':id/revisions')
  @Roles(...CMS_VIEW_ROLES)
  @ApiOperation({ summary: 'Revision history, newest first' })
  revisions(@Request() req: any, @Param('id') id: string) {
    return mapDomainErrors(() => this.cms.revisions(tenantFrom(req), id))
  }

  @Get(':id/revisions/:revisionId')
  @Roles(...CMS_VIEW_ROLES)
  @ApiOperation({ summary: 'One revision, with its full snapshot' })
  revision(@Request() req: any, @Param('id') id: string, @Param('revisionId') revisionId: string) {
    return mapDomainErrors(() => this.cms.revision(tenantFrom(req), id, revisionId))
  }

  @Get(':id/publication-check')
  @Roles(...CMS_VIEW_ROLES)
  @ApiOperation({ summary: 'Blockers and warnings for publishing this item' })
  publicationCheck(@Request() req: any, @Param('id') id: string) {
    return mapDomainErrors(() => this.cms.publicationCheck(tenantFrom(req), id))
  }

  @Patch(':id')
  @Roles(...CMS_EDIT_ROLES)
  @ApiOperation({ summary: 'Save the draft and append a revision' })
  save(@Request() req: any, @Param('id') id: string, @Body() dto: SaveContentDto) {
    return mapDomainErrors(() => this.cms.save(actorFrom(req), id, dto))
  }

  @Patch(':id/state')
  @Roles(...CMS_EDIT_ROLES)
  @ApiOperation({ summary: 'Move between DRAFT and IN_REVIEW' })
  setState(@Request() req: any, @Param('id') id: string, @Body() dto: SetStateDto) {
    return mapDomainErrors(() => this.cms.setState(actorFrom(req), id, dto.state))
  }

  /**
   * Mint a preview link.
   *
   * EDIT rather than PUBLISH: showing a colleague an unpublished draft is part
   * of drafting. The token grants exactly one item for about an hour, carries
   * no identity, and the page it opens is served `noindex`.
   */
  @Post(':id/preview-token')
  @Roles(...CMS_EDIT_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mint a signed, expiring preview link for one item' })
  async previewToken(@Request() req: any, @Param('id') id: string) {
    const tenantId = tenantFrom(req)
    return mapDomainErrors(async () => {
      // Scoped lookup first: minting a token for another tenant's id must 404
      // rather than hand out a signature over an id we never verified.
      await this.cms.findOne(tenantId, id)
      const token = this.cms.createPreviewToken(tenantId, id)
      return { token, expiresInSeconds: 3600 }
    })
  }

  // ── Verification ──────────────────────────────────────────────────────
  //
  // EDIT and VERIFY are separate capabilities and separate routes, because
  // they are separate acts: typing a number correctly is not the same as
  // checking it against a source and standing behind it. The split is why
  // SELF_VERIFIED can be distinguished from VERIFIED at all.

  @Get(':id/facts/history')
  @Roles(...CMS_VIEW_ROLES)
  @ApiOperation({ summary: 'Verification audit trail for the project, or one field' })
  factHistory(@Request() req: any, @Param('id') id: string, @Query('field') field?: string) {
    return mapDomainErrors(() => this.cms.factHistory(tenantFrom(req), id, field))
  }

  @Patch(':id/facts/:field')
  @Roles(...CMS_EDIT_ROLES)
  @ApiOperation({ summary: "Set a material fact's value, invalidating any verification" })
  setFact(
    @Request() req: any,
    @Param('id') id: string,
    @Param('field') field: string,
    @Body() dto: SetFactDto,
  ) {
    return mapDomainErrors(() => this.cms.setFact(actorFrom(req), id, field, dto))
  }

  @Post(':id/facts/:field/verify')
  @Roles(...CMS_VERIFY_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign for a fact. Same-person signing records SELF_VERIFIED.' })
  verifyFact(
    @Request() req: any,
    @Param('id') id: string,
    @Param('field') field: string,
    @Body() dto: VerifyFactDto,
  ) {
    return mapDomainErrors(() => this.cms.verifyFact(actorFrom(req), id, field, dto))
  }

  // ── Project media ─────────────────────────────────────────────────────
  //
  // Bytes only. The reference (classification, alt text, caption, credit,
  // order) is edited and saved through the ordinary PATCH above, exactly
  // like a milestone — these two routes exist only because a browser cannot
  // put file bytes into a JSON PATCH body.

  @Post(':id/media/upload')
  @Roles(...CMS_EDIT_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_MEDIA_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload one image for this project (multipart/form-data)' })
  async uploadMedia(@Request() req: any, @Param('id') id: string, @UploadedFile() file: UploadedFileLike | undefined) {
    return mapDomainErrors(async () => {
      if (!file || !file.size) throw new BadRequestException('לא נבחר קובץ')
      if (file.size > MAX_MEDIA_BYTES) {
        throw new PayloadTooLargeException(
          `הקובץ גדול מדי — הגודל המרבי הוא ${Math.round(MAX_MEDIA_BYTES / (1024 * 1024))} מגה-בייט`,
        )
      }
      if (!ALLOWED_MEDIA_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException('סוג הקובץ אינו נתמך. ניתן להעלות JPEG, PNG או WebP')
      }
      const sig = validateFileSignature(file.mimetype, file.originalname, file.buffer)
      if (!sig.ok) throw new BadRequestException(sig.message)

      return this.cms.uploadProjectMedia(actorFrom(req), id, file)
    })
  }

  @Get(':id/media/:mediaId/url')
  @Roles(...CMS_VIEW_ROLES)
  @ApiOperation({ summary: 'Signed preview URL for one media entry already on the project' })
  mediaUrl(@Request() req: any, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return mapDomainErrors(() => this.cms.projectMediaUrl(tenantFrom(req), id, mediaId))
  }

  // ── Feasibility ───────────────────────────────────────────────────────
  //
  // Its own tier, not EDIT. Editing the sentence that describes a project and
  // editing the scenario that says it sells for 825 million shekels are
  // different acts, and the second is not implied by the first.
  //
  // There is no publish route here, and there will not be one: feasibility is
  // never publishable, and `CmsService.projectProjection` never reads it.

  @Get(':id/feasibility')
  @Roles(...CMS_FEASIBILITY_ROLES)
  @ApiOperation({ summary: "The project's private feasibility workspace" })
  feasibility(@Request() req: any, @Param('id') id: string) {
    return mapDomainErrors(() => this.cms.feasibility(tenantFrom(req), id))
  }

  @Patch(':id/feasibility')
  @Roles(...CMS_FEASIBILITY_ROLES)
  @ApiOperation({ summary: 'Apply one edit, recompute dependents, append a revision' })
  saveFeasibility(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: FeasibilityEditDto,
  ) {
    return mapDomainErrors(() =>
      this.cms.saveFeasibility(actorFrom(req), id, dto as never))
  }

  @Post(':id/publish')
  @Roles(...CMS_PUBLISH_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Freeze the public projection and make it live' })
  publish(@Request() req: any, @Param('id') id: string) {
    return mapDomainErrors(() => this.cms.publish(actorFrom(req), id))
  }

  @Post(':id/unpublish')
  @Roles(...CMS_PUBLISH_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw from the website, keeping the publication record' })
  unpublish(@Request() req: any, @Param('id') id: string) {
    return mapDomainErrors(() => this.cms.unpublish(actorFrom(req), id))
  }

  @Post(':id/revisions/:revisionId/restore')
  @Roles(...CMS_PUBLISH_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a revision by appending a new one' })
  restore(@Request() req: any, @Param('id') id: string, @Param('revisionId') revisionId: string) {
    return mapDomainErrors(() => this.cms.restore(actorFrom(req), id, revisionId))
  }
}
