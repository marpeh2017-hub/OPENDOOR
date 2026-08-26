import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../prisma.service'
import { SignatureStateMachineService } from './signature-state-machine.service'
import { SmsService } from '../sms/sms.service'
import { REDIS } from '../redis/redis.module'
import { EvidencePackageService } from './evidence-package.service'

const OTP_TTL_MS       = 5 * 60 * 1000   // 5 minutes
const OTP_MAX_ATTEMPTS = 5
const SESSION_TTL_DAYS = 7

// Requesting a fresh OTP resets otpAttempts to 0, so without a cap on resends
// the 5-attempt lockout is not a lockout at all — an attacker just cycles
// request-OTP → 5 guesses → request-OTP forever. Cap the resends per session so
// a signing session has a bounded total number of guesses.
const OTP_MAX_RESENDS       = 5
const OTP_RESEND_TTL_SECONDS = 60 * 60  // 1 hour window

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

@Injectable()
export class SigningSessionService {
  private readonly logger = new Logger(SigningSessionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly sm: SignatureStateMachineService,
    private readonly sms: SmsService,
    private readonly evidenceSvc: EvidencePackageService,
    @Inject(REDIS) private readonly redis: any,
  ) {}

  /** Issue (or reissue) a signing session for a SignatureRecord */
  async issueSession(recordId: string): Promise<{ token: string }> {
    const record = await this.prisma.signatureRecord.findUniqueOrThrow({
      where: { id: recordId },
      include: { package: true },
    })

    if (!['SENT', 'PARTIALLY_SIGNED'].includes(record.package.status)) {
      throw new BadRequestException('Package is not in a signable state')
    }

    const token    = randomBytes(48).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000)

    // Upsert — one session per record
    await this.prisma.signingSession.upsert({
      where:  { recordId },
      create: { recordId, token, expiresAt },
      update: { token, expiresAt, revokedAt: null, verifiedAt: null, otpAttempts: 0 },
    })

    await this.sm.logEvent(record.packageId, 'DELIVERED', { recordId, actorType: 'SYSTEM' })

    return { token }
  }

  /** Owner opens the signing link — log OPENED and track openedAt */
  async openSession(token: string, ip?: string, userAgent?: string) {
    const session = await this.resolveSession(token)
    const record  = await this.prisma.signatureRecord.findUniqueOrThrow({
      where:   { id: session.recordId },
      include: { package: { include: { records: true } } },
    })

    // Track first open time
    if (!record.openedAt) {
      await this.prisma.signatureRecord.update({
        where: { id: record.id },
        data:  { openedAt: new Date() },
      })
    }

    await this.sm.logEvent(record.packageId, 'OPENED', {
      recordId:  session.recordId,
      actorType: 'OWNER',
      actorId:   record.ownerId,
      ip,
      userAgent,
    })

    // Compute signing order block state (for portal UI — reading is always allowed)
    let orderBlocked = false
    if (record.package.signingOrder === 'SEQUENTIAL') {
      const blockers = record.package.records.filter(
        (r: any) => r.signingOrder < record.signingOrder && r.status !== 'SIGNED',
      )
      orderBlocked = blockers.length > 0
    }

    return {
      recordId:     session.recordId,
      packageId:    record.packageId,
      packageTitle: record.package.title,
      expiresAt:    record.package.expiresAt,
      orderBlocked,
    }
  }

  /** Send OTP to the owner's phone */
  async requestOtp(token: string, ip?: string): Promise<{ message: string; expiresIn: number }> {
    const session = await this.resolveSession(token)
    const record  = await this.prisma.signatureRecord.findUniqueOrThrow({
      where:   { id: session.recordId },
      include: { owner: true, package: { include: { records: true } } },
    })

    // Enforce sequential signing order
    await this.assertSigningOrderAllowed(record)

    const phone = record.owner?.phone
    if (!phone) throw new BadRequestException('Owner has no phone number on file')

    // Cap OTP resends per signing session — otherwise the 5-attempt verify
    // lockout can be reset indefinitely and brute-forced.
    const rateKey = `sig:otp:resend:${session.id}`
    const sends   = await this.redis.incr(rateKey)
    if (sends === 1) await this.redis.expire(rateKey, OTP_RESEND_TTL_SECONDS)
    if (sends > OTP_MAX_RESENDS) {
      await this.sm.logEvent(record.packageId, 'OTP_FAILED', {
        recordId:  session.recordId,
        actorType: 'OWNER',
        actorId:   record.ownerId,
        ip,
        metadata:  { reason: 'OTP_RESEND_LIMIT' },
      })
      throw new HttpException(
        'יותר מדי בקשות לקוד אימות — נסה שוב מאוחר יותר',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const otp        = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash    = hashOtp(otp)
    const otpExpires = new Date(Date.now() + OTP_TTL_MS)

    await this.prisma.signingSession.update({
      where: { id: session.id },
      data:  { otpHash, otpExpiresAt: otpExpires, otpAttempts: 0 },
    })

    await this.sm.logEvent(record.packageId, 'OTP_REQUESTED', {
      recordId: session.recordId,
      actorType: 'OWNER',
      actorId:   record.ownerId,
      ip,
      metadata: { phone: phone.slice(-4).padStart(phone.length, '*') },
    })

    // Send OTP via configured SMS provider — never logs the OTP value
    await this.sms.sendOtp(phone, otp)

    return { message: 'קוד OTP נשלח', expiresIn: 300 }
  }

  /** Verify OTP — returns verified session */
  async verifyOtp(
    token: string,
    otp: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ verified: boolean }> {
    const session = await this.resolveSession(token)
    const record  = await this.prisma.signatureRecord.findUniqueOrThrow({
      where: { id: session.recordId },
    })

    if (session.otpAttempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('יותר מדי ניסיונות — בקש קוד חדש')
    }
    if (!session.otpHash || !session.otpExpiresAt) {
      throw new BadRequestException('לא נשלח קוד OTP — בקש קוד תחילה')
    }
    if (new Date() > session.otpExpiresAt) {
      throw new UnauthorizedException('קוד OTP פג תוקף')
    }

    const match = session.otpHash === hashOtp(otp)

    await this.prisma.signingSession.update({
      where: { id: session.id },
      data: {
        otpAttempts: { increment: 1 },
        ...(match ? { verifiedAt: new Date(), otpHash: null } : {}),
      },
    })

    await this.sm.logEvent(record.packageId, match ? 'OTP_VERIFIED' : 'OTP_FAILED', {
      recordId: session.recordId,
      actorType: 'OWNER',
      actorId:   record.ownerId,
      ip,
      userAgent,
    })

    if (!match) throw new UnauthorizedException('קוד OTP שגוי')

    return { verified: true }
  }

  /** Execute signing after OTP verification */
  async sign(
    token: string,
    ip?: string,
    userAgent?: string,
  ) {
    const session = await this.resolveSession(token)
    if (!session.verifiedAt) throw new UnauthorizedException('OTP לא אומת — בקש קוד תחילה')

    const record = await this.prisma.signatureRecord.findUniqueOrThrow({
      where:   { id: session.recordId },
      include: { package: { include: { records: true } } },
    })

    // Enforce sequential signing order at sign step too — prevent API bypass
    await this.assertSigningOrderAllowed(record)

    if (record.status === 'SIGNED') throw new BadRequestException('מסמך כבר חתום')
    if (!['SENT', 'PARTIALLY_SIGNED'].includes(record.package.status)) {
      throw new BadRequestException('חבילת החתימות אינה פתוחה לחתימה')
    }

    await this.prisma.signatureRecord.update({
      where: { id: record.id },
      data: {
        status:   'SIGNED',
        signedAt: new Date(),
      },
    })

    // Revoke session after signing
    await this.prisma.signingSession.update({
      where: { id: session.id },
      data:  { revokedAt: new Date() },
    })

    await this.sm.logEvent(record.packageId, 'SIGNED', {
      recordId: session.recordId,
      actorType: 'OWNER',
      actorId:   record.ownerId,
      ip,
      userAgent,
    })

    // Check if all required signers are done → auto-complete
    const allSigned = record.package.records
      .filter(r => r.required)
      .every(r => r.id === record.id ? true : r.status === 'SIGNED')

    if (allSigned) {
      await this.sm.transition(record.packageId, 'COMPLETED', {
        actorType: 'SYSTEM',
        eventType: 'COMPLETED',
      })
      // Auto-generate evidence package — fire-and-forget
      this.evidenceSvc.generate(record.packageId, record.tenantId)
        .catch(err => this.logger.error(`Evidence generation failed: ${err.message}`))
    } else {
      // Move to PARTIALLY_SIGNED if still SENT
      if (record.package.status === 'SENT') {
        await this.sm.transition(record.packageId, 'PARTIALLY_SIGNED', {
          actorType: 'SYSTEM',
        })
      }
    }

    return { signed: true, packageCompleted: allSigned }
  }

  /** Decline signing */
  async decline(token: string, reason: string, ip?: string) {
    const session = await this.resolveSession(token)
    if (!session.verifiedAt) throw new UnauthorizedException('OTP לא אומת')

    const record = await this.prisma.signatureRecord.findUniqueOrThrow({
      where: { id: session.recordId },
    })

    await this.prisma.signatureRecord.update({
      where: { id: record.id },
      data: { status: 'DECLINED', declineReason: reason },
    })

    await this.prisma.signingSession.update({
      where: { id: session.id },
      data:  { revokedAt: new Date() },
    })

    // A decline on any required signer declines the whole package
    if (record.required) {
      await this.sm.transition(record.packageId, 'DECLINED', {
        recordId: record.id,
        actorType: 'OWNER',
        actorId:   record.ownerId,
        ip,
        eventType: 'DECLINED',
        metadata: { reason },
      })
    } else {
      await this.sm.logEvent(record.packageId, 'DECLINED', {
        recordId: session.recordId,
        actorType: 'OWNER',
        actorId:   record.ownerId,
        ip,
        metadata: { reason, nonRequired: true },
      })
    }

    return { declined: true }
  }

  /** Resend OTP invitation to a signer by recordId */
  async sendReminder(recordId: string, tenantId: string): Promise<{ sent: boolean }> {
    const record = await this.prisma.signatureRecord.findFirst({
      where:   { id: recordId, tenantId },
      include: { owner: true, package: true },
    })
    if (!record) throw new NotFoundException('רשומת חתימה לא נמצאה')
    if (record.status === 'SIGNED') throw new BadRequestException('הרשומה כבר חתומה')
    if (!['SENT', 'PARTIALLY_SIGNED'].includes(record.package.status)) {
      throw new BadRequestException('החבילה אינה פתוחה לחתימה')
    }

    const phone = record.owner?.phone
    if (!phone) throw new BadRequestException('לבעלים אין מספר טלפון')

    // Refresh session token
    const { token } = await this.issueSession(recordId)

    // Send reminder SMS with new signing link
    const portalUrl = process.env.PORTAL_URL ?? 'http://localhost:3002'
    const signingUrl = `${portalUrl}/he/sign/${token}`
    await this.sms.sendOtp(phone, `תזכורת לחתימה: ${signingUrl}`)

    await this.sm.logEvent(record.packageId, 'REMINDER_SENT', {
      recordId,
      actorType: 'SYSTEM',
      metadata:  { phone: phone.slice(-4).padStart(phone.length, '*') },
    })

    return { sent: true }
  }

  /**
   * Enforce sequential signing: all records with a lower signingOrder must be SIGNED
   * before this record can request an OTP or execute signing.
   */
  private async assertSigningOrderAllowed(record: any): Promise<void> {
    if (!record.package) return // safety — should always be included
    const pkg = record.package as { signingOrder: string; records: any[] }
    if (pkg.signingOrder !== 'SEQUENTIAL') return // parallel packages — no restriction

    const blockers = (pkg.records as any[]).filter(
      (r: any) => r.signingOrder < record.signingOrder && r.status !== 'SIGNED',
    )
    if (blockers.length > 0) {
      const minOrder = Math.min(...blockers.map((b: any) => b.signingOrder))
      throw new ForbiddenException(
        `לא ניתן לחתום לפני שחותם מספר ${minOrder + 1} השלים את חתימתו`,
      )
    }
  }

  private async resolveSession(token: string) {
    const session = await this.prisma.signingSession.findUnique({ where: { token } })
    if (!session) throw new NotFoundException('קישור חתימה לא נמצא')
    if (session.revokedAt) throw new UnauthorizedException('קישור חתימה בוטל')
    if (new Date() > session.expiresAt) throw new GoneException('קישור חתימה פג תוקף')
    return session
  }
}
