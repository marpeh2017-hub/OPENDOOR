import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import {
  CMS_VIEW_ROLES, CMS_EDIT_ROLES, CMS_VERIFY_ROLES, CMS_PUBLISH_ROLES,
} from '../auth/roles.constants'
import { CmsService } from './cms.service'
import {
  SaveContentDto, SetStateDto, ListContentQueryDto, SetFactDto, VerifyFactDto,
} from './dto/cms.dto'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'

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
