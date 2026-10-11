import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { PublicFormsService } from './public-forms.service'
import { SignPublicFormDto, StartPublicFormDto } from './dto/public-forms.dto'

/**
 * The website's representation protocol, for buildings that are not yet
 * projects. Its own small controller, like the public lead form's, so the
 * whole public surface reads in one file: no JWT, per-IP limits on every
 * route, strict DTOs, and only the approved wording accepted.
 */
@ApiTags('forms')
@Controller({ path: 'public/forms', version: '1' })
export class PublicFormsController {
  constructor(private readonly forms: PublicFormsService) {}

  /** Start a protocol: the initiator's lead, their signed row, and the neighbours' link. */
  @Post()
  @Public()
  @Throttle({ short: { limit: 2, ttl: 10_000 }, medium: { limit: 3, ttl: 60_000 }, long: { limit: 5, ttl: 600_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Start a representation protocol from the website' })
  start(@Body() body: StartPublicFormDto, @Req() req: any) {
    return this.forms.start(body, this.ctx(req))
  }

  @Get(':token')
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'A started protocol, as its neighbours’ link shows it' })
  view(@Param('token') token: string) {
    return this.forms.view(token)
  }

  @Post(':token/signatures')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 10_000 }, long: { limit: 20, ttl: 600_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'A neighbour signs their row' })
  sign(@Param('token') token: string, @Body() body: SignPublicFormDto, @Req() req: any) {
    return this.forms.sign(token, body, this.ctx(req))
  }

  private ctx(req: any) {
    return {
      ip: req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
      userAgent: req.headers?.['user-agent'] ?? null,
    }
  }
}
