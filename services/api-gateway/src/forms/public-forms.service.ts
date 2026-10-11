import {
  BadRequestException, ConflictException, GoneException, Injectable, Logger, NotFoundException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../prisma.service'
import { FieldEncryptionService } from '../crypto/field-encryption.service'
import { PublicLeadsService } from '../leads/public-leads.service'
import type { PublicLeadDto } from '../leads/dto/public-lead.dto'
import { FORM_TEMPLATES, isApprovedSnapshot, isIsoDate, validateSignerInput, validateSnapshot } from './form-data'
import type { PublicRowDto, SignPublicFormDto, StartPublicFormDto } from './dto/public-forms.dto'

/** Fewer than this many milliseconds on the page is a script, not a person. */
const MIN_TIME_ON_FORM_MS = 3_000
/** A building's owners' table, with room to spare; more is abuse. */
const MAX_SIGNATURES = 300

interface PublicFormData {
  template: string
  text: Record<string, unknown>
  building: { address: string; city: string; compoundName: string }
  meeting: { compoundName: string; address: string; meetingDate: string; meetingPlace: string }
  members: { fullName: string; apartmentNumber: string }[]
}

interface Ctx {
  ip: string | null
  userAgent: string | null
}

/**
 * Representation protocols started on the website, for buildings that are
 * not yet projects: the owner's chosen way (2026-10-10) to bring in new
 * buildings.
 *
 * An owner fills in the building, the meeting, the proposed members and
 * their own row, and signs. That becomes a lead through the public intake
 * (its spam checks, duplicate detection and the office alert), and a link
 * for the neighbours, each of whom adds their own row. Nothing here is
 * verified: anyone with the link can sign, which is the point, so staff check
 * ownership against the land registry before relying on the protocol, and
 * the CRM says so on it.
 *
 * Only the approved wording is accepted (by hash): the link puts the text in
 * front of neighbours, and a stranger must not be able to write it.
 */
@Injectable()
export class PublicFormsService {
  private readonly logger = new Logger(PublicFormsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
    private readonly publicLeads: PublicLeadsService,
  ) {}

  /* ─── Public ──────────────────────────────────────────────────── */

  async start(dto: StartPublicFormDto, ctx: Ctx): Promise<{ shareToken: string | null }> {
    const tenantId = await this.publicLeads.resolveTenantId()

    // A retry of the same submission gets the same link.
    const replay = await this.prisma.lead.findUnique({
      where: { tenantId_submissionId: { tenantId, submissionId: dto.submissionId } },
      select: { id: true },
    })
    if (replay) {
      const form = await this.prisma.publicForm.findFirst({ where: { tenantId, leadId: replay.id }, select: { shareToken: true } })
      if (form) return { shareToken: form.shareToken }
    }

    // Everything is checked before anything is written.
    const formType = FORM_TEMPLATES[dto.templateId]
    if (!formType || !isApprovedSnapshot(dto.text, dto.templateId)) {
      throw new BadRequestException('נוסח הטופס אינו הנוסח המאושר. רעננו את העמוד ונסו שוב.')
    }
    const text = validateSnapshot(dto.text, dto.templateId)
    if (!isIsoDate(dto.meeting.meetingDate)) throw new BadRequestException('תאריך האסיפה אינו תקין')
    const row = this.validRow(dto.initiator, { phoneRequired: true })
    const members = this.cleanMembers(dto.members)
    const compoundName = dto.building.compoundName?.trim() || dto.building.address

    await this.publicLeads.submit(
      {
        kind: 'PROTOCOL',
        submissionId: dto.submissionId,
        fullName: row.fullName,
        phone: row.phone as string,
        email: row.email ?? undefined,
        address: dto.building.address,
        city: dto.building.city,
        leadType: 'OWNER',
        projectType: 'PINUY_BINUY',
        organizingStatus: 'REPRESENTATION_FORMED',
        message:
          `התחיל באתר פרוטוקול מינוי נציגות לבניין ${dto.building.address}, ${dto.building.city}, ` +
          `עם ${members.length} חברי נציגות מוצעים. נוצר קישור לחתימת השכנים.`,
        consentContact: true,
        consentPrivacy: true,
        privacyPolicyVersion: dto.privacyPolicyVersion,
        sourcePage: '/forms/representation-protocol/start',
        locale: dto.locale,
        submittedAt: new Date().toISOString(),
        renderedAt: dto.renderedAt,
        company: dto.company,
      } as PublicLeadDto,
      ctx,
    )
    const lead = await this.prisma.lead.findUnique({
      where: { tenantId_submissionId: { tenantId, submissionId: dto.submissionId } },
      select: { id: true },
    })
    // The intake discarded it as spam, and said nothing; so do we.
    if (!lead) return { shareToken: null }

    const data: PublicFormData = {
      template: dto.templateId,
      text,
      building: { address: dto.building.address, city: dto.building.city, compoundName },
      meeting: {
        compoundName,
        address: `${dto.building.address}, ${dto.building.city}`,
        meetingDate: dto.meeting.meetingDate,
        meetingPlace: dto.meeting.meetingPlace.trim(),
      },
      members,
    }
    const shareToken = randomBytes(24).toString('base64url')
    await this.prisma.$transaction(async (tx) => {
      const form = await tx.publicForm.create({
        data: {
          tenantId,
          leadId: lead.id,
          formType,
          formVersion: text.version,
          formData: JSON.stringify(data),
          shareToken,
        },
      })
      await tx.publicFormSignature.create({
        data: { publicFormId: form.id, ...this.rowData(dto.initiator.apartmentNumber, row), isInitiator: true, ip: ctx.ip, userAgent: ctx.userAgent },
      })
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          type: 'public_protocol_started',
          note: 'התחיל באתר פרוטוקול מינוי נציגות וחתם עליו; קישור לחתימת השכנים נוצר',
          metadata: { publicFormId: form.id, members: members.length },
          createdById: null,
        },
      })
    })
    return { shareToken }
  }

  /** What the neighbours' link shows: the protocol, the meeting, the members' names. Nobody's details. */
  async view(shareToken: string) {
    const form = await this.byToken(shareToken)
    const data = this.dataOf(form.formData)
    const signed = await this.prisma.publicFormSignature.count({ where: { publicFormId: form.id } })
    return {
      compoundName: data.meeting.compoundName,
      text: data.text,
      meeting: data.meeting,
      members: data.members,
      signed,
      open: form.status === 'OPEN',
    }
  }

  async sign(shareToken: string, dto: SignPublicFormDto, ctx: Ctx): Promise<{ signed: true; count: number }> {
    const form = await this.byToken(shareToken)
    if (form.status !== 'OPEN') throw new GoneException('החתימה על הטופס הזה נסגרה. לשאלות: 054-8018613.')

    // A filled honeypot or a form "read" in under three seconds is a script:
    // answered as if signed, and not stored.
    if (dto.company?.trim() || Date.now() - Date.parse(dto.renderedAt) < MIN_TIME_ON_FORM_MS) {
      this.logger.warn(`Public form signature discarded as automated (form ${form.id})`)
      return { signed: true, count: await this.prisma.publicFormSignature.count({ where: { publicFormId: form.id } }) }
    }

    const row = this.validRow(dto, { phoneRequired: false })
    const existing = await this.prisma.publicFormSignature.findMany({
      where: { publicFormId: form.id },
      select: { apartmentNumber: true, idNumber: true },
    })
    if (existing.length >= MAX_SIGNATURES) throw new BadRequestException('הטופס הגיע למספר החתימות המרבי. פנו אלינו.')
    const apartment = dto.apartmentNumber.trim()
    const already = existing.some((r) => r.apartmentNumber === apartment && this.decryptId(r.idNumber) === row.idNumber)
    if (already) throw new ConflictException('כבר חתמתם על הפרוטוקול הזה, עם אותו מספר זהות ובאותה דירה.')

    await this.prisma.publicFormSignature.create({
      data: { publicFormId: form.id, ...this.rowData(apartment, row), ip: ctx.ip, userAgent: ctx.userAgent },
    })
    return { signed: true, count: existing.length + 1 }
  }

  /* ─── Staff ───────────────────────────────────────────────────── */

  async list(tenantId: string) {
    const forms = await this.prisma.publicForm.findMany({
      where: { tenantId },
      include: {
        _count: { select: { signatures: true } },
        signatures: { where: { isInitiator: true }, select: { fullName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return forms.map((form) => {
      const data = this.dataOf(form.formData)
      return {
        id: form.id,
        status: form.status,
        leadId: form.leadId,
        compoundName: data.meeting.compoundName,
        address: data.meeting.address,
        initiator: form.signatures[0] ?? null,
        signatures: form._count.signatures,
        createdAt: form.createdAt,
      }
    })
  }

  /** Everything, ID numbers decrypted: for the roles that manage signatures. */
  async get(id: string, tenantId: string) {
    const form = await this.prisma.publicForm.findFirst({
      where: { id, tenantId },
      include: { signatures: { orderBy: { signedAt: 'asc' } } },
    })
    if (!form) throw new NotFoundException('הטופס לא נמצא')
    const data = this.dataOf(form.formData)
    const lead = form.leadId
      ? await this.prisma.lead.findFirst({
          where: { id: form.leadId, tenantId },
          select: { id: true, firstName: true, lastName: true, phone: true, status: true },
        })
      : null
    const rows = form.signatures.map((s) => ({
      apartmentNumber: s.apartmentNumber,
      fullName: s.fullName,
      idNumber: this.decryptId(s.idNumber),
      signedDate: s.signedAt.toISOString().slice(0, 10),
      phone: s.phone,
      email: s.email,
      signatureImage: s.signatureImage,
      method: 'DIGITAL',
      isInitiator: s.isInitiator,
      signedAt: s.signedAt,
    }))
    // A member signs once: their row in the owners' table also fills the
    // members' table, matched by apartment and name.
    const same = (a: string, b: string) => a.replace(/[\s"'״׳-]/g, '') === b.replace(/[\s"'״׳-]/g, '')
    const members = data.members.map((m) => {
      const row = rows.find((r) => r.apartmentNumber === m.apartmentNumber && same(r.fullName, m.fullName))
      return {
        fullName: m.fullName,
        apartmentNumber: m.apartmentNumber,
        idNumber: row?.idNumber ?? null,
        signatureImage: row?.signatureImage ?? null,
        signed: Boolean(row),
      }
    })
    return {
      id: form.id,
      status: form.status,
      formVersion: form.formVersion,
      createdAt: form.createdAt,
      // For staff to send on to more neighbours; the website builds the same.
      shareUrl: `${this.websiteUrl()}/he/forms/join/${form.shareToken}`,
      preparerIdNumber: process.env.PROTOCOL_PREPARER_ID_NUMBER?.trim() || null,
      text: data.text,
      building: data.building,
      meeting: data.meeting,
      members,
      rows,
      lead,
    }
  }

  /** Closing stops new rows; the link then says signing has closed. Noted on the lead. */
  async setStatus(id: string, status: 'OPEN' | 'CLOSED', userId: string, tenantId: string) {
    const form = await this.prisma.publicForm.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, leadId: true },
    })
    if (!form) throw new NotFoundException('הטופס לא נמצא')
    if (form.status === status) return { status }
    await this.prisma.$transaction(async (tx) => {
      await tx.publicForm.update({ where: { id }, data: { status } })
      if (form.leadId) {
        await tx.leadActivity.create({
          data: {
            leadId: form.leadId,
            type: status === 'CLOSED' ? 'public_protocol_closed' : 'public_protocol_reopened',
            note: status === 'CLOSED' ? 'הקישור לחתימת השכנים נסגר' : 'הקישור לחתימת השכנים נפתח מחדש',
            metadata: { publicFormId: id },
            createdById: userId,
          },
        })
      }
    })
    return { status }
  }

  /* ─── Internals ───────────────────────────────────────────────── */

  private async byToken(shareToken: string) {
    if (!/^[\w-]{16,64}$/.test(shareToken)) throw new NotFoundException('הקישור לא נמצא')
    const form = await this.prisma.publicForm.findUnique({ where: { shareToken } })
    if (!form) throw new NotFoundException('הקישור לא נמצא')
    return form
  }

  private websiteUrl(): string {
    return (process.env.WEBSITE_URL?.trim() || 'http://localhost:3003').replace(/\/+$/, '')
  }

  private dataOf(raw: string): PublicFormData {
    return JSON.parse(raw) as PublicFormData
  }

  private validRow(input: PublicRowDto, opts: { phoneRequired: boolean }) {
    const row = validateSignerInput(input)
    if (!input.apartmentNumber?.trim()) throw new BadRequestException('יש לרשום מספר דירה')
    if (opts.phoneRequired && !row.phone) {
      throw new BadRequestException({ code: 'FORM_ROW_INVALID', fields: ['טלפון'], message: 'יש לבדוק: טלפון' })
    }
    return row
  }

  private rowData(apartmentNumber: string, row: ReturnType<typeof validateSignerInput>) {
    return {
      apartmentNumber: apartmentNumber.trim(),
      fullName: row.fullName,
      idNumber: this.encryption.encrypt(row.idNumber) as string,
      phone: row.phone,
      email: row.email,
      signatureImage: row.signatureImage,
    }
  }

  private cleanMembers(members: { fullName: string; apartmentNumber: string }[]) {
    const seen = new Set<string>()
    const out: { fullName: string; apartmentNumber: string }[] = []
    for (const m of members) {
      const fullName = m.fullName.trim().replace(/\s+/g, ' ')
      const apartmentNumber = m.apartmentNumber.trim()
      const key = `${apartmentNumber}:${fullName}`
      if (fullName.length < 2 || !apartmentNumber || seen.has(key)) continue
      seen.add(key)
      out.push({ fullName, apartmentNumber })
    }
    if (out.length === 0) throw new BadRequestException('יש לרשום לפחות חבר נציגות אחד')
    return out
  }

  private decryptId(stored: string): string | null {
    try {
      return this.encryption.decrypt(stored)
    } catch {
      return null
    }
  }
}
