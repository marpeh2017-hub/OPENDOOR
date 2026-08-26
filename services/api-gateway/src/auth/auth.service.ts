import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { PrismaService } from '../prisma.service'
import { SmsService } from '../sms/sms.service'
import { REDIS } from '../redis/redis.module'
import { LoginDto } from './dto/login.dto'
import { SendOtpDto } from './dto/send-otp.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'

const OTP_TTL_SECONDS  = 300    // 5 minutes
const RATE_TTL_SECONDS = 3600   // 1 hour
const RATE_MAX         = 3      // max OTPs per hour

// A revoked session must stay revoked for at least as long as the longest-lived
// token that carries its sessionId. The refresh token lives 30 days, so a 24h
// revocation window would let a stolen refresh token resurrect the session on
// day 2. Keep these two constants in lockstep.
const ACCESS_TOKEN_TTL   = '24h'
const REFRESH_TOKEN_TTL  = '30d'
const REVOCATION_TTL_SECONDS = 30 * 24 * 60 * 60  // 30 days — matches REFRESH_TOKEN_TTL

// scrypt parameters: N=2^15, r=8, p=1, 32-byte key — OWASP-acceptable for interactive login
const SCRYPT_N  = 32768
const SCRYPT_MEM = 128 * SCRYPT_N * 8 * 2  // 2× the theoretical minimum (64 MB)

export function hashPassword(plain: string): string {
  const salt = randomBytes(16)
  const key  = scryptSync(plain, salt, 32, { N: SCRYPT_N, r: 8, p: 1, maxmem: SCRYPT_MEM })
  return `$scrypt$${SCRYPT_N}$${salt.toString('base64')}$${key.toString('base64')}`
}

function checkPassword(plain: string, stored: string): boolean {
  if (stored.startsWith('$scrypt$')) {
    const [, , n, saltB64, keyB64] = stored.split('$')
    const salt     = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(keyB64, 'base64')
    const actual   = scryptSync(plain, salt, expected.length, { N: Number(n), r: 8, p: 1, maxmem: SCRYPT_MEM })
    return timingSafeEqual(actual, expected)
  }
  // Legacy dev-seed formats — verified then upgraded on login
  if (stored.startsWith('$sha256$')) {
    const hash = '$sha256$' + createHash('sha256').update(plain).digest('hex')
    return hash === stored
  }
  return plain === stored
}

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    @Inject(REDIS) private readonly redis: any,
  ) {}

  /* ─── Email / password login (CRM staff) ───────────────────────── */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
    })

    if (!user || !user.passwordHash || !checkPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('אימייל או סיסמה שגויים')
    }

    const sessionId = randomUUID()

    const payload = {
      sub:       user.id,
      email:     user.email,
      role:      user.role,
      tenantId:  user.tenantId,
      sessionId,
    }

    const accessToken  = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL })
    const refreshToken = this.jwtService.sign(
      { sub: user.id, sessionId },
      { expiresIn: REFRESH_TOKEN_TTL },
    )

    // Update last login; transparently upgrade legacy hashes to scrypt
    await this.prisma.user.update({
      where: { id: user.id },
      data:  {
        lastLoginAt: new Date(),
        ...(user.passwordHash.startsWith('$scrypt$')
          ? {}
          : { passwordHash: hashPassword(dto.password) }),
      },
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id:        user.id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role,
        tenantId:  user.tenantId,
      },
    }
  }

  /* ─── OTP flow (resident portal) ───────────────────────────────── */
  async sendOtp(dto: SendOtpDto) {
    if (!/^05\d{8}$/.test(dto.phone)) {
      throw new BadRequestException('מספר טלפון לא תקין — נדרש פורמט 05XXXXXXXX')
    }

    // Rate limiting: max RATE_MAX sends per hour per phone
    const rateKey = `otp:rate:${dto.phone}`
    const count   = await this.redis.incr(rateKey)
    if (count === 1) {
      await this.redis.expire(rateKey, RATE_TTL_SECONDS)
    }
    if (count > RATE_MAX) {
      throw new BadRequestException('יותר מדי בקשות OTP — נסה שוב בעוד שעה')
    }

    const otp     = Math.floor(100000 + Math.random() * 900000).toString()
    const otpKey  = `otp:${dto.phone}`

    // Store sha256(otp) — never plaintext
    await this.redis.setex(otpKey, OTP_TTL_SECONDS, hashOtp(otp))

    // Send via configured SMS provider (never logs the OTP value)
    await this.sms.sendOtp(dto.phone, otp)

    return { message: 'קוד OTP נשלח', expiresIn: OTP_TTL_SECONDS }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otpKey    = `otp:${dto.phone}`
    const storedHash = await this.redis.get(otpKey)

    if (!storedHash || storedHash !== hashOtp(dto.code)) {
      throw new UnauthorizedException('קוד OTP שגוי')
    }

    // Delete on success — single-use
    await this.redis.del(otpKey)

    // Look up resident by phone
    const resident = await this.prisma.resident.findFirst({
      where: { phone: dto.phone },
    })

    if (!resident) {
      throw new UnauthorizedException('מספר זה אינו רשום במערכת')
    }

    const sessionId = randomUUID()
    const payload = {
      sub:       resident.id,
      phone:     dto.phone,
      role:      'RESIDENT',
      tenantId:  resident.tenantId,
      sessionId,
    }

    const accessToken  = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL })
    const refreshToken = this.jwtService.sign(
      { sub: resident.id, sessionId },
      { expiresIn: REFRESH_TOKEN_TTL },
    )

    return { accessToken, refreshToken, residentId: resident.id }
  }

  /* ─── Refresh tokens ────────────────────────────────────────────── */
  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; sessionId: string }>(refreshToken)

      // A refresh token must carry a sessionId, otherwise it can never be
      // revoked. Reject legacy/forged tokens that omit it.
      if (!payload.sessionId) throw new UnauthorizedException('Refresh token לא תקין')

      // Logout revokes the whole session — the refresh token must not be able
      // to mint a fresh access token for a session that was already revoked.
      const revoked = await this.redis.exists(`jwt:revoked:${payload.sessionId}`)
      if (revoked) throw new UnauthorizedException('הסשן בוטל — יש להתחבר מחדש')

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user) throw new UnauthorizedException('משתמש לא נמצא')
      // A deactivated user must not be able to keep refreshing access.
      if (!user.isActive) throw new UnauthorizedException('החשבון אינו פעיל')

      const accessToken = this.jwtService.sign(
        {
          sub:       user.id,
          email:     user.email,
          role:      user.role,
          tenantId:  user.tenantId,
          sessionId: payload.sessionId,
        },
        { expiresIn: ACCESS_TOKEN_TTL },
      )

      return { accessToken }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err
      throw new UnauthorizedException('Refresh token לא תקין')
    }
  }

  /* ─── Logout — revoke session in Redis ─────────────────────────── */
  async logout(sessionId: string) {
    if (!sessionId) return
    // Revoke for the full refresh-token lifetime, not just the access-token
    // lifetime — otherwise the session resurrects once the marker expires.
    await this.redis.setex(`jwt:revoked:${sessionId}`, REVOCATION_TTL_SECONDS, '1')
  }
}
