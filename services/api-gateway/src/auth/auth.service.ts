import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomUUID } from 'crypto'
import { PrismaService } from '../prisma.service'
import { LoginDto } from './dto/login.dto'
import { SendOtpDto } from './dto/send-otp.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'

// In-memory OTP store (replace with Redis in production)
const otpStore = new Map<string, { otp: string; expires: number }>()

function checkPassword(plain: string, stored: string): boolean {
  // Supports sha256 hashes (dev seed) and plain text (legacy dev)
  if (stored.startsWith('$sha256$')) {
    const hash = '$sha256$' + createHash('sha256').update(plain).digest('hex')
    return hash === stored
  }
  return plain === stored
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
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

    const accessToken  = this.jwtService.sign(payload, { expiresIn: '24h' })
    const refreshToken = this.jwtService.sign(
      { sub: user.id, sessionId },
      { expiresIn: '30d' },
    )

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date() },
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

    const otp     = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = Date.now() + 5 * 60 * 1000

    otpStore.set(dto.phone, { otp, expires })

    // Log to console in dev — wire Twilio/Vonage for production
    console.log(`[DEV OTP] ${dto.phone} → ${otp}`)

    return { message: 'קוד OTP נשלח', expiresIn: 300 }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const stored = otpStore.get(dto.phone)

    if (!stored || stored.otp !== dto.code) {
      throw new UnauthorizedException('קוד OTP שגוי')
    }
    if (Date.now() > stored.expires) {
      otpStore.delete(dto.phone)
      throw new UnauthorizedException('קוד OTP פג תוקף')
    }
    otpStore.delete(dto.phone)

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

    const accessToken  = this.jwtService.sign(payload, { expiresIn: '24h' })
    const refreshToken = this.jwtService.sign(
      { sub: resident.id, sessionId },
      { expiresIn: '30d' },
    )

    return { accessToken, refreshToken, residentId: resident.id }
  }

  /* ─── Refresh tokens ────────────────────────────────────────────── */
  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; sessionId: string }>(refreshToken)

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user) throw new UnauthorizedException('משתמש לא נמצא')

      const accessToken = this.jwtService.sign(
        {
          sub:       user.id,
          email:     user.email,
          role:      user.role,
          tenantId:  user.tenantId,
          sessionId: payload.sessionId,
        },
        { expiresIn: '24h' },
      )

      return { accessToken }
    } catch {
      throw new UnauthorizedException('Refresh token לא תקין')
    }
  }

  /* ─── Logout ────────────────────────────────────────────────────── */
  async logout(_sessionId: string) {
    // In production: delete session from Redis
  }
}
