import { Controller, Get, Param, Query, Header, NotFoundException } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { Public } from '../auth/decorators/public.decorator'
import { CmsService } from './cms.service'
import { mapDomainErrors } from '../common/errors/domain-error'

/**
 * The website's read surface. THE ENTIRE PUBLIC CMS API IS THIS FILE.
 *
 * Kept separate from `CmsController` for the reason `PublicLeadsController`
 * gives: a public surface that fits on one screen can be reviewed in full,
 * whereas a `@Public()` method hiding among authenticated ones cannot.
 *
 * ── WHAT MAKES THIS SAFE ───────────────────────────────────────────────────
 *
 * There is no parameter on any route below that selects a draft. Both content
 * routes read `livePublication.snapshot` — the projection frozen at publish
 * time — and filter on `state: 'PUBLISHED'` with `unpublishedAt` null. An
 * unpublished edit is not merely hidden here; it is unreachable, because no
 * argument the caller can supply reaches the `draft` column.
 *
 * The snapshot was already stripped of verifier identity, source vocabulary,
 * internal and feasibility subtrees, and unverified claims when it was frozen
 * (`toPublicProjection`, re-asserted by `findPrivateLeaks` inside the publish
 * transaction). Serving a stored projection rather than recomputing one means
 * what the public was given stays provable even after the projection code
 * changes.
 *
 * ── WHY THE TENANT IS A SLUG IN THE PATH ───────────────────────────────────
 *
 * This is a published website: which company's site you are reading is not a
 * secret, and the slug is the same one already in the CRM's URLs. It is NOT a
 * security boundary and is not treated as one — it selects among PUBLISHED
 * content only, so a wrong or guessed slug reveals nothing that was not
 * already published to the open internet. The authenticated surface never
 * accepts a tenant from the caller; this route is the deliberate exception,
 * and it is safe precisely because everything it can reach is already public.
 *
 * ── PREVIEW ────────────────────────────────────────────────────────────────
 *
 * The one route that reads unpublished content requires a signed, expiring
 * token that names the tenant and the item INSIDE the signature. It is served
 * `noindex`, because an indexed preview URL would outlive the token in a
 * search engine's cache.
 */
@ApiTags('cms')
@Controller({ path: 'public/cms', version: '1' })
export class CmsPublicController {
  constructor(private readonly cms: CmsService) {}

  /*
   * ORDER MATTERS: `preview/:token` must be declared BEFORE `:tenantSlug/:kind`.
   * Both match two path segments, Express takes the first declared, and with
   * the generic route first every preview link resolved as "list the PAGE
   * items of the tenant whose slug is `preview`" — which answered 200 with an
   * empty array instead of the preview. Silently, because an empty list is a
   * legitimate response. The E2E suite caught it; a reader will not, so this
   * is a note rather than a convention.
   */
  /**
   * Preview one unpublished item.
   *
   * Deliberately rate-limited harder than the published routes: this is the
   * only path to unpublished content, so it is also the only one where
   * guessing at tokens would be worth anybody's time.
   */
  @Get('preview/:token')
  @Public()
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Preview one unpublished item with a signed, expiring token' })
  @ApiResponse({ status: 404, description: 'Token invalid, expired, or item missing' })
  preview(@Param('token') token: string) {
    return mapDomainErrors(() => this.cms.resolvePreview(token))
  }

  /**
   * A signed URL for one media object belonging to this tenant. See
   * `CmsService.publicMediaUrl` for why the key itself, not a content
   * lookup, is what authorises this.
   *
   * The key is a QUERY parameter rather than a path segment: it contains
   * slashes (`<tenantId>/cms/<contentId>/<filename>`), and this Express 4
   * router's path-to-regexp does not support a named wildcard segment that
   * would capture them. A query string has no such restriction.
   *
   * Declared as its own literal segment (`media`) BEFORE `:tenantSlug/:kind`
   * for the same routing reason the file's own note gives for
   * `preview/:token`: both match two path segments, `:kind` would otherwise
   * swallow the literal `media` as a kind name, and the more specific route
   * has to come first or it is never reached.
   */
  @Get(':tenantSlug/media')
  @Public()
  @Throttle({ medium: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Signed URL for one media object, given its storage key' })
  async media(@Param('tenantSlug') tenantSlug: string, @Query('key') key: string) {
    return mapDomainErrors(async () => {
      if (!key) throw new NotFoundException('Not found')
      const tenantId = await this.cms.resolveTenantIdBySlug(tenantSlug)
      if (!tenantId) throw new NotFoundException('Not found')
      return this.cms.publicMediaUrl(tenantId, key)
    })
  }

  @Get(':tenantSlug/:kind/:slug')
  @Public()
  @Throttle({ medium: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'One published item, as the frozen public projection' })
  @ApiResponse({ status: 404, description: 'Not published, withdrawn, or no such item' })
  async one(
    @Param('tenantSlug') tenantSlug: string,
    @Param('kind') kind: string,
    @Param('slug') slug: string,
  ) {
    return mapDomainErrors(async () => {
      const tenantId = await this.cms.resolveTenantIdBySlug(tenantSlug)
      if (!tenantId) throw new NotFoundException('Not found')
      const item = await this.cms.publicBySlug(tenantId, kind.toUpperCase(), slug)
      if (!item) throw new NotFoundException('Not found')
      return item
    })
  }

  @Get(':tenantSlug/:kind')
  @Public()
  @Throttle({ medium: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Every published item of one kind' })
  async list(@Param('tenantSlug') tenantSlug: string, @Param('kind') kind: string) {
    return mapDomainErrors(async () => {
      const tenantId = await this.cms.resolveTenantIdBySlug(tenantSlug)
      if (!tenantId) return []
      return this.cms.publicList(tenantId, kind.toUpperCase())
    })
  }
}
