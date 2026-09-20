import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { PublicLeadDto } from './dto/public-lead.dto'
import { PublicLeadsService } from './public-leads.service'

/**
 * The public marketing-site lead form.
 *
 * Kept in its OWN controller rather than added to `LeadsController`, because
 * that controller carries a class-level `@Roles(...STAFF_ROLES)` authorization
 * floor and this route deliberately has none. Separating them means the public
 * surface is one small file that can be read in full during a security review,
 * instead of one `@Public()` method hiding among authenticated ones.
 *
 * Everything about this route assumes hostile input:
 *   - `@Public()` — no JWT, and `RolesGuard` bypasses accordingly.
 *   - `@Throttle` — per-IP limits, using the app's existing global
 *     `ThrottlerGuard`. No second rate-limiting mechanism was invented.
 *   - `PublicLeadDto` — strict allow-list; `tenantId` is not a field.
 *   - The response is a fixed acknowledgement that reveals nothing.
 */
@ApiTags('leads')
@Controller({ path: 'public/leads', version: '1' })
export class PublicLeadsController {
  constructor(private readonly publicLeads: PublicLeadsService) {}

  /**
   * Rate limits, per IP, layered so a burst and a slow grind are both capped:
   *   - 2 per 10s stops double-submits and trivial hammering.
   *   - 5 per 10 minutes is the real ceiling for one address.
   *
   * These override the global defaults (20/s, 100/10s, 300/min), which are far
   * too generous for an endpoint that writes rows on behalf of strangers.
   */
  @Post()
  @Public()
  @Throttle({
    short:  { limit: 2, ttl: 10_000 },
    medium: { limit: 3, ttl: 60_000 },
    long:   { limit: 5, ttl: 600_000 },
  })
  // 200, not 201: the response intentionally carries no resource and no
  // Location header, because the caller may not learn that a row was created.
  @HttpCode(200)
  @ApiOperation({ summary: 'Submit a lead from the public marketing site' })
  @ApiResponse({
    status: 200,
    description:
      'Generic acknowledgement. Identical for an accepted lead, a duplicate, ' +
      'and a submission rejected as spam — the caller learns nothing either way.',
  })
  async submit(@Body() body: PublicLeadDto, @Req() req: any) {
    await this.publicLeads.submit(body, {
      // `req.ip` is the direct peer. Behind a load balancer this is the LB
      // unless Express `trust proxy` is enabled — see the deployment note in
      // the Phase 2 report; the header is read only as a fallback and is never
      // used for anything but rate-limit attribution and the audit row.
      ip: req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    })

    // One fixed response for every outcome. No id, no count, no hint about
    // whether this email was already known.
    return { success: true, message: 'תודה! קיבלנו את פנייתכם וניצור קשר בקרוב.' }
  }
}
