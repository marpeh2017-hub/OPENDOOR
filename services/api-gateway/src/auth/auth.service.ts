import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash, createHmac, randomInt, randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { PrismaService } from '../prisma.service'
import { SmsService } from '../sms/sms.service'
import { REDIS } from '../redis/redis.module'
import { LoginDto } from './dto/login.dto'
import { SendOtpDto } from './dto/send-otp.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'

const OTP_TTL_SECONDS  = 300    // 5 minutes
const RATE_TTL_SECONDS = 3600   // 1 hour
const RATE_MAX         = 3      // max OTPs per hour

/**
 * Failed verification attempts allowed per issued code, after which the code is
 * destroyed and a new one must be requested.
 *
 * Without this, a 6-digit code with a 5-minute life is limited only by the
 * global throttler — roughly 1,500 guesses per window per IP, and an attacker
 * with several IPs multiplies that freely. Five is the same order as the
 * `SigningSession.otpAttempts` counter the signing flow already enforces; this
 * brings the login flow up to the standard the signing flow already meets.
 */
const OTP_MAX_ATTEMPTS = 5

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

/**
 * OTP storage hash — HMAC, not a bare digest.
 *
 * A six-digit code has 10^6 pre-images. `sha256(otp)` is therefore not a hash
 * in any useful sense: anyone who can read Redis enumerates the whole space in
 * milliseconds. The HMAC key makes the stored value useless without the server
 * secret.
 *
 * The pepper is DERIVED from `JWT_SECRET` rather than being a new environment
 * variable. `JwtStrategy` already refuses to construct without `JWT_SECRET`, so
 * this cannot be silently unset in production — and a new required variable is
 * a new way for a deployment to fail. The domain separator keeps this key
 * distinct from anything else derived from the same secret.
 */
function otpPepper(): Buffer {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is required to hash OTP codes')
  return createHmac('sha256', secret).update('otp-pepper-v1').digest()
}

function hashOtp(otp: string): string {
  return createHmac('sha256', otpPepper()).update(otp).digest('hex')
}

/**
 * Constant-time comparison of two hex digests.
 *
 * `a !== b` on a hash leaks nothing useful in practice, but the codebase
 * already uses `timingSafeEqual` for password checks and consistency here
 * costs nothing.
 */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  if (left.length !== right.length || left.length === 0) return false
  return timingSafeEqual(left, right)
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

    // `Math.random()` is xorshift128+: fast, and its internal state is
    // recoverable from a modest number of outputs, after which every later code
    // is computable rather than guessable. For the resident portal's ONLY
    // authentication factor that is not acceptable.
    const otp     = randomInt(100000, 1000000).toString()
    const otpKey  = `otp:${dto.phone}`

    // Store HMAC(otp) — never plaintext, and never a bare digest over 10^6.
    await this.redis.setex(otpKey, OTP_TTL_SECONDS, hashOtp(otp))
    // A fresh code resets the attempt budget. Tied to the code's own lifetime,
    // so the counter cannot outlive the secret it protects.
    await this.redis.del(`otp:attempts:${dto.phone}`)

    // Send via configured SMS provider (never logs the OTP value)
    await this.sms.sendOtp(dto.phone, otp)

    return { message: 'קוד OTP נשלח', expiresIn: OTP_TTL_SECONDS }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otpKey      = `otp:${dto.phone}`
    const attemptsKey = `otp:attempts:${dto.phone}`
    const storedHash  = await this.redis.get(otpKey)

    if (!storedHash) {
      throw new UnauthorizedException('קוד OTP שגוי או פג תוקף')
    }

    if (!digestsMatch(storedHash, hashOtp(dto.code))) {
      // Count the failure against THIS code, and destroy the code once the
      // budget is spent. Incrementing before the check would be off by one;
      // incrementing after the throw would never run.
      const attempts = await this.redis.incr(attemptsKey)
      if (attempts === 1) await this.redis.expire(attemptsKey, OTP_TTL_SECONDS)
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await this.redis.del(otpKey)
        await this.redis.del(attemptsKey)
        throw new UnauthorizedException('יותר מדי ניסיונות שגויים — בקשו קוד חדש')
      }
      throw new UnauthorizedException('קוד OTP שגוי')
    }

    // Delete on success — single-use, and the attempt budget dies with it.
    await this.redis.del(otpKey)
    await this.redis.del(attemptsKey)

    // ── Who is this? ────────────────────────────────────────────────────────
    //
    // The OTP proves control of a phone number. It proves NOTHING about which
    // tenant, project or resident profile the caller is entitled to — phone
    // numbers are not unique across tenants and nothing in the schema makes
    // them so.
    //
    // The previous `findFirst({ where: { phone } })` therefore handed out a
    // session for whichever row the query planner happened to reach first,
    // carrying that row's `tenantId`. With two tenants holding the same number
    // that is a cross-tenant account takeover with no attacker effort at all.
    //
    // Archived residents are excluded: a soft-archived profile is a former
    // resident, and `isActive` is exactly the flag that says so.
    const candidates = await this.prisma.resident.findMany({
      where: { phone: dto.phone, isActive: true },
      select: { id: true, tenantId: true },
    })

    if (candidates.length === 0) {
      throw new UnauthorizedException('מספר זה אינו רשום במערכת')
    }
    if (candidates.length > 1) {
      // Refuse rather than choose. Picking one would be a coin flip between
      // two people's data.
      //
      // The resident-facing selection flow (subdomain context, invitation
      // token, explicit choice) is the next phase of work; until it exists,
      // refusing is the only safe behaviour and it is deliberate, not a stub.
      throw new UnauthorizedException(
        'מספר הטלפון משויך ליותר מפרופיל דייר אחד. פנו אלינו כדי להשלים את ההתחברות.',
      )
    }

    const resident = candidates[0]!

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
