import {
  BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException,
} from '@nestjs/common'
import { REDIS } from '../redis/redis.module'
import { PrismaService } from '../prisma.service'
import { SmsService } from '../sms/sms.service'
import { FieldEncryptionService } from '../crypto/field-encryption.service'
import { NationalIdService } from '../common/pii/national-id.service'
import { TenantScopeService } from '../common/tenant/tenant-scope.service'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { generateOtp, hashOtp, otpMatches } from '../common/otp/otp'
import { ResidentIdentityService } from '../auth/resident-identity.service'
import { maskEmail } from '../auth/email-otp.sender'
import { SigningEmailSender } from '../signatures/signing-email.sender'
import { PublicLeadsService } from '../leads/public-leads.service'
import { LeadNotificationService } from '../leads/lead-notification.service'
import { byApartmentNumber, matchBuilding } from './registration-address'
import type {
  ApproveRegistrationDto, RegistrationCodeDto, SubmitRegistrationDto,
} from './dto/portal-registration.dto'

const CODE_TTL_SECONDS = 600
const CODE_MAX_ATTEMPTS = 5
const RATE_TTL_SECONDS = 3600
const RATE_MAX = 3
/** Fewer than this many milliseconds on the page is a script, not a person. */
const MIN_TIME_ON_FORM_MS = 3_000

const codeKey = (phone: string) => `portal:register:code:${phone}`
const attemptsKey = (phone: string) => `portal:register:attempts:${phone}`
const rateKey = (target: string) => `portal:register:rate:${target}`

interface StoredCode {
  /** The code's hash, never the code. */
  h: string
  via: 'SMS' | 'EMAIL'
  email?: string
}

interface Ctx {
  ip: string | null
  userAgent: string | null
}

const RELATION_LABELS: Record<string, string> = {
  OWNER: 'בעל/ת הדירה',
  FAMILY: 'בן/בת משפחה של בעל/ת הדירה',
  TENANT: 'שוכר/ת',
}

function maskPhone(phone: string): string {
  return phone.length < 7 ? '***' : `${phone.slice(0, 3)}-****${phone.slice(-3)}`
}

function splitFullName(input: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = input.trim().split(/\s+/)
  return { firstName: firstName ?? '', lastName: rest.join(' ') }
}

/**
 * Registration for the personal area: the owner's choice (2026-10-10) of
 * "request, and we approve".
 *
 * Sign-in finds a person by the phone or email on a resident file, so
 * somebody we have no file for, or a file without their number, cannot get
 * in. Here they ask: they confirm their phone with a code (or their email,
 * when there is no SMS provider), say where they live, and wait. Staff put
 * them on an apartment, an existing resident file or a new one, and from then
 * on they sign in like everyone else. Nothing is opened before a person
 * decides.
 *
 * A building that is not one of ours is a building that might become one, so
 * that request also arrives as a lead, through the public intake and its
 * office alert. A request for a building we know gets the office alert alone.
 *
 * The code is this flow's own (its own Redis keys and send budget): it proves
 * a contact, not a sign-in, and must not spend or satisfy the login's.
 */
@Injectable()
export class PortalRegistrationsService {
  private readonly logger = new Logger(PortalRegistrationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: any,
    private readonly sms: SmsService,
    private readonly email: SigningEmailSender,
    private readonly encryption: FieldEncryptionService,
    private readonly nationalIds: NationalIdService,
    private readonly scope: TenantScopeService,
    private readonly audit: AuditService,
    private readonly identity: ResidentIdentityService,
    private readonly publicLeads: PublicLeadsService,
    private readonly alerts: LeadNotificationService,
  ) {}

  /* ─── Public ──────────────────────────────────────────────────── */

  /** Step 1: a code to the phone, or to the email when nothing can text. */
  async sendCode(dto: RegistrationCodeDto) {
    const via: 'SMS' | 'EMAIL' | null = this.sms.isConfigured ? 'SMS' : dto.email ? 'EMAIL' : null
    if (!via) {
      throw new BadRequestException({ code: 'EMAIL_REQUIRED', message: 'כדי לקבל קוד, הוסיפו כתובת אימייל.' })
    }
    const email = dto.email?.toLowerCase()
    const answer = { channel: via, sentTo: via === 'SMS' ? maskPhone(dto.phone) : maskEmail(email), expiresIn: CODE_TTL_SECONDS }

    // A script gets the same answer as a person, and nothing is sent.
    if (this.isSpam(dto)) {
      this.logger.warn('Registration code request discarded as spam')
      return answer
    }

    await this.takeBudget(rateKey(dto.phone))
    if (via === 'EMAIL') await this.takeBudget(rateKey(`email:${email}`))

    const code = generateOtp()
    const stored: StoredCode = { h: hashOtp(code), via, ...(via === 'EMAIL' ? { email } : {}) }
    await this.redis.setex(codeKey(dto.phone), CODE_TTL_SECONDS, JSON.stringify(stored))
    await this.redis.del(attemptsKey(dto.phone))

    if (via === 'SMS') {
      await this.sms.sendOtp(dto.phone, code)
    } else {
      await this.email.sendText(email!, 'קוד אימות להרשמה לאזור האישי', [
        `קוד האימות שלכם להרשמה לאזור האישי של OpenDoor: ${code}`,
        '',
        'הקוד תקף לעשר דקות. אם לא ביקשתם להירשם, אפשר להתעלם מההודעה.',
      ])
    }
    return answer
  }

  /**
   * Step 2: the request. The code first, then: someone who can already sign
   * in is told so; a pending request for the same phone is brought up to date
   * rather than doubled; anything else is a new request.
   */
  async submit(dto: SubmitRegistrationDto, ctx: Ctx): Promise<{ status: 'RECEIVED' | 'ALREADY_REGISTERED' }> {
    const tenantId = await this.publicLeads.resolveTenantId()
    if (this.isSpam(dto)) {
      this.logger.warn('Registration discarded as spam')
      return { status: 'RECEIVED' }
    }

    const replay = await this.prisma.portalRegistration.findUnique({
      where: { tenantId_submissionId: { tenantId, submissionId: dto.submissionId } },
      select: { id: true },
    })
    if (replay) return { status: 'RECEIVED' }

    // Before the code is spent, so a mistyped ID does not cost a new code.
    const idNumber = this.nationalIds.encryptForWrite(dto.idNumber, 'idNumber')
    const proved = await this.consumeCode(dto.phone, dto.code)
    const email = dto.email?.toLowerCase() ?? null
    if (proved.via === 'EMAIL' && proved.email !== email) {
      throw new UnauthorizedException({ code: 'OTP_INVALID', message: 'הקוד שגוי או שפג תוקפו' })
    }

    // The code proved this contact, so saying it already opens a file tells
    // the caller about their own access, nobody else's.
    const known = proved.via === 'SMS'
      ? await this.identity.resolveByPhone(dto.phone)
      : await this.identity.resolveByEmail(email!)
    if (known.contexts.some((c) => c.tenantId === tenantId)) return { status: 'ALREADY_REGISTERED' }

    const matchedBuildingId = await this.findBuilding(tenantId, dto.address, dto.city)
    const details = {
      fullName: dto.fullName.replace(/\s+/g, ' '),
      email,
      idNumber,
      address: dto.address,
      city: dto.city,
      apartmentNumber: dto.apartmentNumber,
      relation: dto.relation,
      verifiedVia: proved.via,
      matchedBuildingId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    }

    const pending = await this.prisma.portalRegistration.findFirst({
      where: { tenantId, phone: dto.phone, status: 'PENDING' },
      select: { id: true },
    })
    if (pending) {
      // The latest details win, under the latest submission id, so a retry of this one is a replay.
      await this.prisma.portalRegistration.update({
        where: { id: pending.id },
        data: { ...details, submissionId: dto.submissionId },
      })
      return { status: 'RECEIVED' }
    }

    const registration = await this.prisma.portalRegistration.create({
      data: { tenantId, phone: dto.phone, submissionId: dto.submissionId, ...details },
      select: { id: true },
    })
    const where = `${dto.address}, ${dto.city}, דירה ${dto.apartmentNumber}`

    if (!matchedBuildingId) {
      // Not one of our buildings: a lead, with its office alert.
      await this.publicLeads.submit(
        {
          kind: 'PORTAL_REGISTRATION',
          submissionId: dto.submissionId,
          fullName: details.fullName,
          phone: dto.phone,
          ...(email ? { email } : {}),
          address: dto.address,
          city: dto.city,
          message: `ביקש/ה הרשמה לאזור האישי (${RELATION_LABELS[dto.relation]}, דירה ${dto.apartmentNumber}). הבניין אינו במערכת.`,
          consentContact: true,
          consentPrivacy: true,
          privacyPolicyVersion: dto.privacyPolicyVersion,
          sourcePage: '/register',
          locale: dto.locale,
          submittedAt: new Date().toISOString(),
          renderedAt: dto.renderedAt,
        },
        ctx,
      )
      const lead = await this.prisma.lead.findUnique({
        where: { tenantId_submissionId: { tenantId, submissionId: dto.submissionId } },
        select: { id: true },
      })
      if (lead) await this.prisma.portalRegistration.update({ where: { id: registration.id }, data: { leadId: lead.id } })
    } else {
      const { firstName, lastName } = splitFullName(details.fullName)
      await this.alerts.notify(tenantId, {
        id: registration.id,
        heading: 'בקשת הרשמה לאזור האישי',
        firstName,
        lastName,
        phone: dto.phone,
        email,
        address: dto.address,
        city: dto.city,
        notes: `${RELATION_LABELS[dto.relation]}, ${where}. ממתין לאישור ב־CRM.`,
        formType: 'PORTAL_REGISTRATION',
      })
    }
    return { status: 'RECEIVED' }
  }

  /* ─── Staff ───────────────────────────────────────────────────── */

  async list(tenantId: string, status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const rows = await this.prisma.portalRegistration.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, fullName: true, phone: true, email: true, address: true, city: true, apartmentNumber: true,
        relation: true, verifiedVia: true, status: true, matchedBuildingId: true, leadId: true, residentId: true,
        createdAt: true, decidedAt: true,
      },
    })
    const buildingIds = [...new Set(rows.map((r) => r.matchedBuildingId).filter((id): id is string => Boolean(id)))]
    const buildings = buildingIds.length
      ? await this.prisma.building.findMany({
          where: { id: { in: buildingIds } },
          select: { id: true, address: true, complex: { select: { project: { select: { name: true } } } } },
        })
      : []
    const byId = new Map(buildings.map((b) => [b.id, b]))
    return rows.map(({ matchedBuildingId, ...row }) => {
      const building = matchedBuildingId ? byId.get(matchedBuildingId) : undefined
      return {
        ...row,
        building: building ? { id: building.id, address: building.address, projectName: building.complex.project.name } : null,
      }
    })
  }

  /**
   * One request, with what staff need to decide: the building it matched
   * (matched again now, in case the building was added since) and that
   * building's apartments with the residents on file.
   */
  async get(id: string, tenantId: string) {
    const row = await this.prisma.portalRegistration.findFirst({ where: { id, tenantId } })
    if (!row) throw new NotFoundException('הבקשה לא נמצאה')

    let buildingId = row.matchedBuildingId
    if (!buildingId && row.status === 'PENDING') {
      buildingId = await this.findBuilding(tenantId, row.address, row.city)
      if (buildingId) await this.prisma.portalRegistration.update({ where: { id }, data: { matchedBuildingId: buildingId } })
    }
    const building = buildingId
      ? await this.prisma.building.findFirst({
          where: { id: buildingId, complex: { project: { tenantId } } },
          select: {
            id: true, address: true, city: true,
            complex: { select: { project: { select: { id: true, name: true } } } },
            apartments: {
              select: {
                id: true, apartmentNumber: true,
                residents: {
                  where: { isActive: true },
                  select: { id: true, firstName: true, lastName: true, phone: true, email: true },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        })
      : null

    const { idNumber, ip: _ip, userAgent: _ua, submissionId: _s, ...rest } = row
    return {
      ...rest,
      idNumber: this.decrypt(idNumber),
      building: building
        ? {
            id: building.id,
            address: building.address,
            city: building.city,
            project: building.complex.project,
            apartments: building.apartments
              .map((a) => ({
                id: a.id,
                apartmentNumber: a.apartmentNumber,
                suggested: a.apartmentNumber.trim() === row.apartmentNumber.trim(),
                residents: a.residents.map((r) => ({
                  id: r.id,
                  name: `${r.firstName} ${r.lastName}`.trim(),
                  phone: r.phone,
                  email: r.email,
                })),
              }))
              .sort((a, b) => byApartmentNumber(a.apartmentNumber, b.apartmentNumber)),
          }
        : null,
    }
  }

  /**
   * Approve: the person goes on a resident file, so the sign-in finds them.
   * On an existing file their phone becomes the file's (a different phone
   * already there is replaced only when staff say so); on an apartment they
   * become a new resident. Then they are told, by SMS or email when one is
   * available, and staff get a WhatsApp link either way.
   */
  async approve(id: string, dto: ApproveRegistrationDto, actor: AuditActor) {
    if (Boolean(dto.residentId) === Boolean(dto.apartmentId)) {
      throw new BadRequestException('יש לבחור דייר קיים או דירה, אחד מהשניים')
    }
    const row = await this.pendingRow(id, actor.tenantId)
    const { firstName, lastName } = splitFullName(row.fullName)

    const residentId = await this.prisma.$transaction(async (tx) => {
      let resident: { id: string }
      if (dto.residentId) {
        await this.scope.assertResident(dto.residentId, actor.tenantId, tx)
        const current = await tx.resident.findUniqueOrThrow({
          where: { id: dto.residentId },
          select: { id: true, phone: true, email: true, isActive: true },
        })
        if (!current.isActive) throw new ConflictException('תיק הדייר הזה סגור. בחרו דייר פעיל או דירה.')
        if (current.phone && current.phone !== row.phone && !dto.replacePhone) {
          throw new ConflictException({
            code: 'PHONE_ON_FILE',
            message: 'בתיק של הדייר רשום טלפון אחר. סמנו החלפה של הטלפון בתיק, או צרו דייר חדש בדירה.',
          })
        }
        resident = await tx.resident.update({
          where: { id: current.id },
          data: { phone: row.phone, ...(current.email ? {} : { email: row.email }) },
          select: { id: true },
        })
      } else {
        await this.scope.assertApartment(dto.apartmentId!, actor.tenantId, tx)
        resident = await tx.resident.create({
          data: {
            tenantId: actor.tenantId,
            apartmentId: dto.apartmentId!,
            firstName,
            lastName,
            nationalId: row.idNumber,
            phone: row.phone,
            email: row.email,
            isPrimaryContact: false,
          },
          select: { id: true },
        })
      }

      await tx.residentActivity.create({
        data: {
          residentId: resident.id,
          type: 'note',
          title: 'נרשם/ה לאזור האישי',
          note: `בקשת הרשמה מהאזור האישי אושרה (${RELATION_LABELS[row.relation] ?? row.relation}).`,
          metadata: { portalRegistrationId: row.id, linkedExisting: Boolean(dto.residentId) },
          createdById: actor.userId,
        },
      })
      await tx.portalRegistration.update({
        where: { id: row.id },
        data: { status: 'APPROVED', residentId: resident.id, decidedById: actor.userId, decidedAt: new Date() },
      })
      await this.audit.record(actor, {
        action: dto.residentId ? 'UPDATE' : 'CREATE',
        entity: 'Resident',
        entityId: resident.id,
        metadata: { via: 'portal-registration', portalRegistrationId: row.id, replacedPhone: Boolean(dto.replacePhone) },
      }, tx)
      return resident.id
    })

    const text = `שלום ${firstName}, הבקשה שלכם לאזור האישי של OpenDoor אושרה. להתחברות עם הטלפון או האימייל שלכם: ${this.portalUrl()}/he/login`
    const notifiedVia = await this.tell(row.phone, row.email, text)
    return {
      status: 'APPROVED' as const,
      residentId,
      notifiedVia,
      whatsappUrl: `https://wa.me/972${row.phone.slice(1)}?text=${encodeURIComponent(text)}`,
    }
  }

  async reject(id: string, note: string | undefined, actor: AuditActor) {
    const row = await this.pendingRow(id, actor.tenantId)
    await this.prisma.portalRegistration.update({
      where: { id: row.id },
      data: { status: 'REJECTED', decisionNote: note || null, decidedById: actor.userId, decidedAt: new Date() },
    })
    return { status: 'REJECTED' as const }
  }

  /* ─── Internals ───────────────────────────────────────────────── */

  private isSpam(dto: { company?: string; renderedAt: string }): boolean {
    if (dto.company?.trim()) return true
    return Date.now() - Date.parse(dto.renderedAt) < MIN_TIME_ON_FORM_MS
  }

  private async takeBudget(key: string): Promise<void> {
    const count = await this.redis.incr(key)
    if (count === 1) await this.redis.expire(key, RATE_TTL_SECONDS)
    if (count > RATE_MAX) {
      throw new BadRequestException({ code: 'OTP_RATE_LIMITED', message: 'יותר מדי בקשות קוד. נסו שוב בעוד שעה.' })
    }
  }

  /** Checks a code and spends it: five guesses, then it is gone. */
  private async consumeCode(phone: string, code: string): Promise<StoredCode> {
    const raw = await this.redis.get(codeKey(phone))
    if (!raw) throw new UnauthorizedException({ code: 'OTP_INVALID', message: 'הקוד שגוי או שפג תוקפו' })
    const stored = JSON.parse(raw) as StoredCode
    if (!otpMatches(stored.h, code)) {
      const used = await this.redis.incr(attemptsKey(phone))
      if (used === 1) await this.redis.expire(attemptsKey(phone), CODE_TTL_SECONDS)
      if (used >= CODE_MAX_ATTEMPTS) {
        await this.redis.del(codeKey(phone), attemptsKey(phone))
        throw new UnauthorizedException({ code: 'OTP_ATTEMPTS_EXCEEDED', message: 'יותר מדי ניסיונות שגויים. בקשו קוד חדש.' })
      }
      throw new UnauthorizedException({ code: 'OTP_INVALID', message: 'הקוד שגוי' })
    }
    await this.redis.del(codeKey(phone), attemptsKey(phone))
    return stored
  }

  private async findBuilding(tenantId: string, address: string, city: string): Promise<string | null> {
    const buildings = await this.prisma.building.findMany({
      where: { complex: { project: { tenantId } } },
      select: { id: true, address: true, streetNumber: true, city: true },
    })
    return matchBuilding(buildings, address, city)
  }

  private async pendingRow(id: string, tenantId: string) {
    const row = await this.prisma.portalRegistration.findFirst({ where: { id, tenantId } })
    if (!row) throw new NotFoundException('הבקשה לא נמצאה')
    if (row.status !== 'PENDING') throw new ConflictException('כבר הוחלט על הבקשה הזאת')
    return row
  }

  /** SMS when there is a provider, else email, else nobody (staff have the WhatsApp link). Never throws. */
  private async tell(phone: string, email: string | null, text: string): Promise<'SMS' | 'EMAIL' | null> {
    try {
      if (this.sms.isConfigured) {
        await this.sms.sendText(phone, text)
        return 'SMS'
      }
      if (email) {
        await this.email.sendText(email, 'הבקשה שלכם לאזור האישי אושרה', [text])
        return 'EMAIL'
      }
    } catch (err) {
      this.logger.error(`Could not tell an approved registrant: ${err instanceof Error ? err.message : String(err)}`)
    }
    return null
  }

  private decrypt(stored: string | null): string | null {
    if (!stored) return null
    try {
      return this.encryption.decrypt(stored)
    } catch {
      return null
    }
  }

  /** Required in production (main.ts refuses to start without it). */
  private portalUrl(): string {
    return (process.env.PORTAL_URL ?? 'http://localhost:3002').replace(/\/+$/, '')
  }
}
