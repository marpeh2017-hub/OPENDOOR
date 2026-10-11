import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { mapDomainErrors } from '../common/errors/domain-error'
import { PortalRegistrationsService } from './portal-registrations.service'
import { RegistrationCodeDto, SubmitRegistrationDto } from './dto/portal-registration.dto'

/**
 * Asking for the personal area. Public, so per-IP limits sit on top of the
 * per-phone and per-address budgets the service keeps: the code route sends
 * messages to numbers a stranger types, which makes it the one to hold
 * tightest.
 */
@ApiTags('portal')
@Controller({ path: 'public/portal-registrations', version: '1' })
export class PublicPortalRegistrationsController {
  constructor(private readonly registrations: PortalRegistrationsService) {}

  @Post('code')
  @Public()
  @Throttle({ short: { limit: 2, ttl: 10_000 }, medium: { limit: 4, ttl: 60_000 }, long: { limit: 8, ttl: 3_600_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a registration code to the phone (or the email when nothing can text)' })
  sendCode(@Body() body: RegistrationCodeDto) {
    return this.registrations.sendCode(body)
  }

  @Post()
  @Public()
  @Throttle({ short: { limit: 3, ttl: 10_000 }, medium: { limit: 6, ttl: 60_000 }, long: { limit: 12, ttl: 3_600_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Ask for the personal area, with the code' })
  submit(@Body() body: SubmitRegistrationDto, @Req() req: any) {
    return mapDomainErrors(() =>
      this.registrations.submit(body, {
        ip: req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
        userAgent: req.headers?.['user-agent'] ?? null,
      }),
    )
  }
}
