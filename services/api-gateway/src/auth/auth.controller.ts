import {
  Controller, Post, Body, Get, Req, HttpCode, HttpStatus,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { PortalAuthService } from './portal-auth.service'
import { PortalSendOtpDto, PortalVerifyOtpDto } from './dto/portal-login.dto'
import { LoginDto } from './dto/login.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { Public } from './decorators/public.decorator'

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly portal: PortalAuthService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  /*
   * ── RESIDENT SIGN-IN ──────────────────────────────────────────────────────
   *
   * Same two paths as before, now served by `PortalAuthService`, which decides
   * WHICH resident file the proven handset opens instead of taking the first
   * row a phone number matched.
   *
   * The per-IP limits below sit on top of the per-phone budget the service
   * enforces (3 sends/hour, 5 guesses/code). Those cap the pressure on one
   * number; these cap one source working through many numbers — the global
   * defaults, 20/s and 300/min, are an invitation to enumerate.
   */

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 2, ttl: 10_000 },
    medium: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @ApiOperation({ summary: 'Send OTP to phone (resident login)' })
  sendOtp(@Body() dto: PortalSendOtpDto) {
    return this.portal.sendOtp(dto.phone, dto.invitationToken)
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 3, ttl: 10_000 },
    medium: { limit: 10, ttl: 60_000 },
    long: { limit: 40, ttl: 3_600_000 },
  })
  @ApiOperation({ summary: 'Verify OTP and open a resident session' })
  @ApiResponse({
    status: 200,
    description:
      'Either a session, or — when the number matches more than one resident ' +
      'record — a short-lived selection challenge carrying no session at all.',
  })
  verifyOtp(@Body() dto: PortalVerifyOtpDto) {
    return this.portal.verifyOtp({
      phone: dto.phone,
      code: dto.code,
      tenantSlug: dto.tenantSlug,
      invitationToken: dto.invitationToken,
    })
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout – invalidate session' })
  logout(@Req() req: { user: { sessionId: string } }) {
    return this.authService.logout(req.user.sessionId)
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@Req() req: { user: unknown }) {
    return req.user
  }
}
