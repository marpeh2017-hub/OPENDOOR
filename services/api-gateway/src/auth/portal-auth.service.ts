import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomBytes, randomUUID } from 'crypto'
import { REDIS } from '../redis/redis.module'
import { SmsService } from '../sms/sms.service'
import { generateOtp, hashOtp, otpMatches } from '../common/otp/otp'
import { ResidentIdentityService, type ResidentContext } from './resident-identity.service'
import { EmailOtpSender, maskEmail } from './email-otp.sender'

/**
 * Resident portal sign-in.
 *
 * ── THE SHAPE OF THE FLOW, AND WHY ──────────────────────────────────────────
 *
 * Three facts have to be established before a session exists, and they are
 * deliberately established separately:
 *
 *   1. WHICH HANDSET — the OTP. Proves possession of a phone. Nothing else.
 *   2. WHICH RESIDENT FILE — an invitation token, a tenant context, or an
 *      explicit choice by the person holding the handset.
 *   3. WHAT THE SESSION MAY SEE — tenantId + projectId + residentId, fixed at
 *      issue and carried in the token, never taken from a later request.
 *
 * Collapsing (1) into (2) is the bug this replaces: `findFirst({ phone })`
 * treated "controls this handset" as "is entitled to this file", and with one
 * number in two tenants that is a takeover with no attacker effort.
 *
 * ── WHY OTP COMES FIRST, EVEN WITH AN INVITATION ────────────────────────────
 *
 * An invitation link travels by SMS or email and can be forwarded, screenshotted
 * or found in a shared inbox. On its own it is a bearer token for somebody
 * else's file. Requiring the OTP on the invitation's OWN number means a leaked
 * link is useless without the handset it was addressed to.
 *
 * ── EMAIL: THE SAME THREE STEPS ─────────────────────────────────────────────
 *
 * A resident may prove an inbox instead of a handset (`sendEmailOtp`,
 * `verifyEmailOtp`). Nothing else changes: the code proves the inbox and
 * nothing more, the file is decided exactly as for a phone, and the session
 * carries the same fixed scope. Two differences, both deliberate. A code goes
 * only to an address that is on a resident's file, under the same answer
 * either way, so the endpoint can neither mail strangers nor say which
 * addresses are registered (its response time still differs: hiding that
 * would mean not knowing whether the email went out). And invitations stay
 * with the phone: an invitation names a number, and its code goes there.
 */

const OTP_TTL_SECONDS = 300
const OTP_MAX_ATTEMPTS = 5
const RATE_TTL_SECONDS = 3600
const RATE_MAX = 3

/*
 * Deliberately the SAME Redis namespace the resident OTP has always used, not
 * a `portal:` one of its own.
 *
 * There is one resident login, and it must have one send budget. A second
 * namespace would give an attacker RATE_MAX sends per door instead of
 * RATE_MAX in total, and a code requested at one door would not verify at the
 * other — a split-brain that only shows up in production, on the day somebody
 * points the app at the older route.
 */
const otpKey = (phone: string) => `otp:${phone}`
const attemptsKey = (phone: string) => `otp:attempts:${phone}`
const rateKey = (phone: string) => `otp:rate:${phone}`

/** The email door's own budget: one per address, as the phone's is one per number. */
const emailOtpKey = (email: string) => `otp:email:${email}`
const emailAttemptsKey = (email: string) => `otp:email:attempts:${email}`
const emailRateKey = (email: string) => `otp:email:rate:${email}`

/** The selection challenge is genuinely new, so it gets its own namespace. */
const selectionKey = (token: string) => `portal:select:${hashOtp(token)}`

/**
 * The selection challenge is short-lived on purpose. It is a half-authenticated
 * state — the handset is proven, the file is not — and nothing should sit in
 * that state for long.
 */
const SELECTION_TTL_SECONDS = 300

const ACCESS_TOKEN_TTL = '12h'
const REFRESH_TOKEN_TTL = '30d'

/** What a resident session carries. Read by `JwtStrategy`, never re-derived. */
export interface ResidentJwtPayload {
  sub: string
  role: 'RESIDENT'
  tenantId: string
  projectId: string
  residentId: string
  sessionId: string
}

type SelectionState = {
  /** What the code proved, a handset or an inbox. For the log line only. */
  phone?: string
  email?: string
  contexts: { residentId: string }[]
}

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name)

  constructor(
    private readonly identity: ResidentIdentityService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
    @Inject(REDIS) private readonly redis: any,
    private readonly emailOtp: EmailOtpSender,
  ) {}

  // ── Step 0: what does this invitation say, before anyone types a code ─────

  /**
   * Preview for the invitation landing page.
   *
   * Returns the project and apartment so the resident recognises the link, and
   * a MASKED phone so they know which handset to have in hand — never the full
   * number, because the link may be open on a device that is not theirs.
   */
  async previewInvitation(token: string) {
    const check = await this.identity.checkInvitation(token)
    if (!check.ok) {
      // One message for every rejection. Distinguishing "expired" from "wrong
      // phone" from "never existed" tells an anonymous caller things they
      // should not learn by probing.
      this.logger.log(`Invitation preview rejected: ${check.reason}`)
      throw new UnauthorizedException({
        code: 'INVITATION_INVALID',
        message: 'הקישור אינו תקף. ייתכן שפג תוקפו או שכבר נעשה בו שימוש. פנו אלינו לקבלת קישור חדש.',
      })
    }
    return {
      projectName: check.context.projectName,
      buildingAddress: check.context.buildingAddress,
      apartmentNumber: check.context.apartmentNumber,
      maskedPhone: maskPhone(check.phone),
    }
  }

  // ── Step 1: prove the handset ─────────────────────────────────────────────

  async sendOtp(phone: string, invitationToken?: string | null) {
    // With an invitation, the code goes to the number the invitation names —
    // not to whatever the caller typed. Otherwise a forwarded link plus an
    // attacker's own phone would be a complete bypass.
    let target = phone
    if (invitationToken) {
      const check = await this.identity.checkInvitation(invitationToken)
      if (!check.ok) {
        throw new UnauthorizedException({
          code: 'INVITATION_INVALID',
          message: 'הקישור אינו תקף.',
        })
      }
      target = check.phone
      if (target !== phone) {
        // Answered identically to a valid request so the response cannot be
        // used to discover the invited number.
        this.logger.warn('Portal OTP requested with a phone that does not match the invitation')
        return { message: 'קוד נשלח', expiresIn: OTP_TTL_SECONDS }
      }
    }

    await this.takeSendBudget(rateKey(target))
    const code = await this.issueCode(otpKey(target), attemptsKey(target))
    await this.sms.sendOtp(target, code)

    return { message: 'קוד נשלח', expiresIn: OTP_TTL_SECONDS }
  }

  // ── The two doors share these, so their limits cannot drift apart ─────────

  /** Three sends per hour per handset or address, whatever the outcome. */
  private async takeSendBudget(key: string): Promise<void> {
    const count = await this.redis.incr(key)
    if (count === 1) await this.redis.expire(key, RATE_TTL_SECONDS)
    if (count > RATE_MAX) {
      throw new BadRequestException({
        code: 'OTP_RATE_LIMITED',
        message: 'יותר מדי בקשות OTP — נסה שוב בעוד שעה',
      })
    }
  }

  /** A fresh code: only its hash is stored, and the attempt count restarts. */
  private async issueCode(codeKey: string, attempts: string): Promise<string> {
    const code = generateOtp()
    await this.redis.setex(codeKey, OTP_TTL_SECONDS, hashOtp(code))
    await this.redis.del(attempts)
    return code
  }

  /** Checks a code and spends it: five guesses, then the code is gone. */
  private async consumeCode(codeKey: string, attempts: string, code: string): Promise<void> {
    const stored = await this.redis.get(codeKey)
    if (!stored) throw new UnauthorizedException({ code: 'OTP_INVALID', message: 'קוד שגוי או פג תוקף' })

    if (!otpMatches(stored, code)) {
      const used = await this.redis.incr(attempts)
      if (used === 1) await this.redis.expire(attempts, OTP_TTL_SECONDS)
      if (used >= OTP_MAX_ATTEMPTS) {
        await this.redis.del(codeKey, attempts)
        throw new UnauthorizedException({
          code: 'OTP_ATTEMPTS_EXCEEDED',
          message: 'יותר מדי ניסיונות שגויים — בקשו קוד חדש',
        })
      }
      throw new UnauthorizedException({ code: 'OTP_INVALID', message: 'קוד שגוי' })
    }

    // Single use, whatever happens next. A code that opened a selection screen
    // must not also open a second one.
    await this.redis.del(codeKey, attempts)
  }

  // ── Step 2: prove the handset, then decide whose file ─────────────────────

  async verifyOtp(input: {
    phone: string
    code: string
    tenantSlug?: string | null
    invitationToken?: string | null
  }) {
    await this.consumeCode(otpKey(input.phone), attemptsKey(input.phone), input.code)

    // ── Narrowest path first: an invitation names exactly one file ──────────
    if (input.invitationToken) {
      const check = await this.identity.checkInvitation(input.invitationToken, input.phone)
      if (!check.ok) {
        throw new UnauthorizedException({ code: 'INVITATION_INVALID', message: 'הקישור אינו תקף.' })
      }
      await this.identity.consumeInvitation(check.invitationId)
      return this.issueSession(check.context, 'INVITATION')
    }

    const { contexts } = await this.identity.resolveByPhone(input.phone, input.tenantSlug)

    if (contexts.length === 0) {
      throw new UnauthorizedException({
        code: 'RESIDENT_NOT_FOUND',
        message: 'מספר זה אינו רשום במערכת.',
      })
    }
    if (contexts.length === 1) {
      return this.issueSession(contexts[0]!, input.tenantSlug ? 'TENANT_CONTEXT' : 'PHONE_ONLY')
    }

    // ── More than one file: the person chooses, not the code ────────────────
    //
    // The options carry project, building and apartment — the minimum needed to
    // recognise your own home — and no other person's details. The caller
    // already controls this handset, so learning which of THEIR OWN files exist
    // is not a disclosure about anyone else.
    return this.beginSelection({ phone: input.phone }, contexts)
  }

  // ── The email door ────────────────────────────────────────────────────────

  /** Trimmed and lower-cased: one budget and one code per address, however typed. */
  private static normaliseEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  async sendEmailOtp(rawEmail: string) {
    const email = PortalAuthService.normaliseEmail(rawEmail)
    const answer = { message: 'אם הכתובת רשומה אצלנו, שלחנו אליה קוד.', expiresIn: OTP_TTL_SECONDS }

    // Both before the lookup, so neither a missing provider nor a spent budget
    // can tell a registered address from an unknown one.
    this.emailOtp.assertReady()
    await this.takeSendBudget(emailRateKey(email))

    const { contexts } = await this.identity.resolveByEmail(email)
    if (contexts.length === 0) {
      this.logger.log(`Portal email code requested for ${maskEmail(email)}, which no resident file holds: nothing sent`)
      return answer
    }

    const code = await this.issueCode(emailOtpKey(email), emailAttemptsKey(email))
    await this.emailOtp.send(email, code)
    return answer
  }

  async verifyEmailOtp(input: { email: string; code: string; tenantSlug?: string | null }) {
    const email = PortalAuthService.normaliseEmail(input.email)
    await this.consumeCode(emailOtpKey(email), emailAttemptsKey(email), input.code)

    const { contexts } = await this.identity.resolveByEmail(email, input.tenantSlug)
    if (contexts.length === 0) {
      throw new UnauthorizedException({ code: 'RESIDENT_NOT_FOUND', message: 'הכתובת אינה רשומה במערכת.' })
    }
    if (contexts.length === 1) {
      return this.issueSession(contexts[0]!, input.tenantSlug ? 'TENANT_CONTEXT' : 'EMAIL_ONLY')
    }
    return this.beginSelection({ email }, contexts)
  }

  private async beginSelection(subject: { phone?: string; email?: string }, contexts: ResidentContext[]) {
    const selectionToken = randomBytes(32).toString('base64url')
    const state: SelectionState = { ...subject, contexts: contexts.map((c) => ({ residentId: c.residentId })) }
    await this.redis.setex(selectionKey(selectionToken), SELECTION_TTL_SECONDS, JSON.stringify(state))

    return {
      selectionRequired: true as const,
      selectionToken,
      expiresIn: SELECTION_TTL_SECONDS,
      options: contexts.map((c) => ({
        residentId: c.residentId,
        projectName: c.projectName,
        buildingAddress: c.buildingAddress,
        apartmentNumber: c.apartmentNumber,
      })),
    }
  }

  // ── Step 3: the explicit choice ───────────────────────────────────────────

  async completeSelection(selectionToken: string, residentId: string) {
    const key = selectionKey(selectionToken)
    const raw = await this.redis.get(key)
    if (!raw) {
      throw new UnauthorizedException({
        code: 'SELECTION_EXPIRED',
        message: 'תוקף הבחירה פג. התחילו את ההתחברות מחדש.',
      })
    }
    const state: SelectionState = JSON.parse(raw)

    /*
     * The chosen id must be one this challenge actually offered. Without this
     * the selection token would be a licence to open ANY resident file by id,
     * which is a far worse hole than the one this whole flow replaces.
     */
    if (!state.contexts.some((c) => c.residentId === residentId)) {
      // Masked, because this line is about an attempt on someone's account and
      // the handset is what identifies the attempt — not what should be logged
      // in full for it.
      this.logger.warn(
        `Portal selection from ${state.phone ? maskPhone(state.phone) : maskEmail(state.email)} named resident ${residentId}, ` +
        'which this challenge did not offer — refused.',
      )
      throw new UnauthorizedException({ code: 'SELECTION_INVALID', message: 'בחירה לא תקפה.' })
    }

    // Single use.
    await this.redis.del(key)

    // Re-read rather than trusting what was cached: the resident may have been
    // archived or moved in the five minutes since the list was built.
    const context = await this.identity.contextForResident(residentId)
    if (!context) {
      throw new UnauthorizedException({ code: 'RESIDENT_NOT_FOUND', message: 'הפרופיל אינו זמין עוד.' })
    }

    return this.issueSession(context, 'SELECTION')
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  /**
   * Mints a fresh access token for an existing resident session.
   *
   * Called from `AuthService.refreshTokens` after it has verified the refresh
   * token's signature and checked the revocation marker. The session id is
   * KEPT, not regenerated: it is the handle logout revokes by, and a refresh
   * that changed it would hand the holder a session the revocation list no
   * longer names.
   */
  async refreshSession(residentId: string, sessionId: string) {
    const context = await this.identity.contextForResident(residentId)
    if (!context) {
      // Archived since the session began. The refresh window is 30 days, which
      // is far too long to keep honouring a grant nobody re-checked.
      throw new UnauthorizedException({
        code: 'RESIDENT_NOT_FOUND',
        message: 'הפרופיל אינו זמין עוד — יש להתחבר מחדש.',
      })
    }
    const payload: ResidentJwtPayload = {
      sub: context.residentId,
      role: 'RESIDENT',
      tenantId: context.tenantId,
      projectId: context.projectId,
      residentId: context.residentId,
      sessionId,
    }
    return { accessToken: this.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL }) }
  }

  // ── The session ───────────────────────────────────────────────────────────

  private async issueSession(context: ResidentContext, via: string) {
    const sessionId = randomUUID()
    const payload: ResidentJwtPayload = {
      sub: context.residentId,
      role: 'RESIDENT',
      tenantId: context.tenantId,
      projectId: context.projectId,
      residentId: context.residentId,
      sessionId,
    }

    this.logger.log(
      `Portal session issued via ${via} for resident ${context.residentId} ` +
      `(tenant ${context.tenantId}, project ${context.projectId})`,
    )

    return {
      accessToken: this.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL }),
      // `role` is what tells the refresh endpoint to look this `sub` up as a
      // resident rather than as a staff user. No scope is carried here: the
      // refresh re-derives it.
      refreshToken: this.jwt.sign({ sub: context.residentId, sessionId, role: 'RESIDENT' }, { expiresIn: REFRESH_TOKEN_TTL }),
      // Kept alongside the nested object for the callers that read the flat id.
      residentId: context.residentId,
      resident: {
        id: context.residentId,
        name: context.residentName,
        projectName: context.projectName,
        buildingAddress: context.buildingAddress,
        apartmentNumber: context.apartmentNumber,
      },
    }
  }
}

/** `0548018613` → `054‑****613`. Enough to recognise, not enough to dial. */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return '***'
  return `${phone.slice(0, 3)}-****${phone.slice(-3)}`
}
