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

  /**
   * Staff email/password sign-in.
   *
   * ── WHY THIS NEEDED A LIMIT OF ITS OWN ────────────────────────────────────
   *
   * It had none. `login()` checks the password, throws 401 on a mismatch, and
   * counts nothing — there is no account lockout — so the only ceiling was the
   * global default of 300 requests a minute per IP. Three hundred password
   * guesses a minute against the strongest identity in the system: a
   * COMPANY_ADMIN account opens every project, every resident and every
   * document in the tenant.
   *
   * Found by probing rather than by reading — twelve wrong passwords in a row
   * drew twelve 401s and no 429.
   *
   * 5 a minute is generous for a person typing their own password and useless
   * for a dictionary. The hourly bound is what stops a slow grind under the
   * per-minute limit, which is the attack that actually gets run.
   *
   * A LIMIT, NOT A LOCKOUT. Deliberately per-IP: locking the ACCOUNT after N
   * failures hands anybody who knows an email address a way to lock a project
   * manager out of their own system on the morning of a signing deadline.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short:  { limit: 3, ttl: 10_000 },
    medium: { limit: 5, ttl: 60_000 },
    long:   { limit: 20, ttl: 3_600_000 },
  })
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

  /**
   * Exchange a refresh token for a fresh access token.
   *
   * Guessing a signed JWT is not a practical attack, so this limit is not about
   * brute force. It is about the same thing every other unauthenticated route
   * here is capped for: an endpoint that does database work on behalf of an
   * anonymous caller should not be free to call three hundred times a minute.
   *
   * Set higher than login because a legitimate client refreshes on a timer and
   * several tabs may do it at once.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short:  { limit: 5, ttl: 10_000 },
    medium: { limit: 20, ttl: 60_000 },
    long:   { limit: 120, ttl: 3_600_000 },
  })
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
