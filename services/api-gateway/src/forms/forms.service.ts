import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { FieldEncryptionService } from '../crypto/field-encryption.service'
import { SignatureStateMachineService } from '../signatures/signature-state-machine.service'
import { SigningSessionService } from '../signatures/signing-session.service'
import { EvidencePackageService } from '../signatures/evidence-package.service'
import { SigningEmailSender } from '../signatures/signing-email.sender'
import { SmsService } from '../sms/sms.service'
import { FormLinkSender, signingUrl, type DeliveryChannel, type LinkCopy } from './form-link.sender'
import {
  FORM_SESSION_TTL_DAYS,
  FORM_TEMPLATES,
  FORM_TYPES,
  MAX_REPRESENTATIVES,
  cleanFields,
  cleanMeeting,
  emptyMeeting,
  formHash,
  isIsoDate,
  isSignable,
  isValidIsraeliId,
  israelToday,
  missingForSending,
  needsRepresentatives,
  parseFormData,
  parseSignerData,
  plainText,
  validateSnapshot,
  type FormData,
  type FormMeeting,
  type FormRepresentative,
  type StoredSignerData,
} from './form-data'

/** A drawn signature: a PNG data URL, 90KB at most (as an owner's). */
const MAX_SIGNATURE_LENGTH = 90 * 1024

const OPEN_STATUSES = ['SENT', 'PARTIALLY_SIGNED']
/** One reminder a day per owner, however often the button is pressed. */
const REMINDER_GAP_MS = 20 * 60 * 60 * 1000

interface RecordRow {
  id: string
  ownerId: string
  apartmentId: string
  status: string
  method: string
  openedAt: Date | null
  signedAt: Date | null
  signerData: string | null
  signatureImage: string | null
  deliveredVia: string | null
  deliveredAt: Date | null
  evidenceDocId: string | null
  owner: { id: string; fullName: string; phone: string | null; email: string | null; nationalId: string | null }
}

/**
 * Digital forms, run as signature packages: the representation-appointment
 * protocol, the organizing agreement (signed the same way, plus its gaps and
 * the company's signature on the organiser's line), and the assembly notice
 * (sent the same way, opened and never signed).
 *
 * A form is made for one complex (מתחם): its signers are every active owner
 * of every apartment in the complex's buildings, one record per owner and
 * apartment, as the owners' table on paper has one row per signature. Staff
 * fill in the meeting's details and choose the representation members from
 * those owners; sending hashes the form, opens it, and sends each owner a
 * personal link. A member signs once: the same record fills their row in
 * both tables.
 *
 * Who sees what: staff see everything here. The combined document, with
 * every owner's ID number, phone and email, is for the company and the
 * representation (PortalFormsService gives it to members only). An owner
 * sees their own row.
 */
@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
    private readonly sm: SignatureStateMachineService,
    private readonly sessions: SigningSessionService,
    private readonly evidence: EvidencePackageService,
    private readonly links: FormLinkSender,
    private readonly sms: SmsService,
    private readonly email: SigningEmailSender,
  ) {}

  /* ─── What a form can be made for ─────────────────────────────── */

  /** The tenant's projects and their complexes, with how many owners each has. */
  async scopes(tenantId: string) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        complexes: {
          select: { id: true, name: true, address: true, buildings: { select: { id: true } } },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
    const result = []
    for (const project of projects) {
      const complexes = []
      for (const complex of project.complexes) {
        const owners = await this.prisma.ownerApartment.count({
          where: { apartment: { building: { complexId: complex.id } }, owner: { tenantId, isActive: true } },
        })
        complexes.push({
          id: complex.id,
          name: complex.name,
          address: complex.address,
          buildings: complex.buildings.length,
          owners,
        })
      }
      result.push({ id: project.id, name: project.name, complexes })
    }
    return result
  }

  /* ─── Create and edit a draft ─────────────────────────────────── */

  async create(
    dto: { templateId: string; projectId: string; complexId: string; text: unknown },
    userId: string,
    tenantId: string,
  ) {
    const formType = FORM_TEMPLATES[dto.templateId]
    if (!formType) throw new BadRequestException('תבנית טופס לא מוכרת')
    const text = validateSnapshot(dto.text, dto.templateId)

    const complex = await this.prisma.complex.findFirst({
      where: { id: dto.complexId, projectId: dto.projectId, project: { tenantId } },
      select: {
        id: true,
        name: true,
        address: true,
        projectId: true,
        buildings: { select: { address: true, streetNumber: true, city: true } },
      },
    })
    if (!complex) throw new NotFoundException('המתחם לא נמצא בפרויקט')

    const ownerships = await this.ownershipsOf(complex.id, tenantId)
    if (ownerships.length === 0) {
      throw new BadRequestException('אין בעלי דירות רשומים במתחם הזה. יש להוסיף בעלים לדירות לפני יצירת טופס.')
    }

    const meeting: FormMeeting = {
      ...emptyMeeting(),
      compoundName: complex.name,
      address: complex.address || this.buildingAddresses(complex.buildings),
    }
    const form: FormData = {
      template: dto.templateId,
      complexId: complex.id,
      text,
      meeting,
      representatives: [],
      ...(formType === FORM_TYPES.REPRESENTATION_PROTOCOL ? {} : { fields: this.startingFields(formType, complex, meeting) }),
    }

    const pkg = await this.prisma.signaturePackage.create({
      data: {
        tenantId,
        projectId: complex.projectId,
        title: `${plainText(text.title)} · ${complex.name}`,
        status: 'DRAFT',
        signingOrder: 'PARALLEL',
        verificationMethod: 'SMS_OTP',
        createdById: userId,
        formType,
        formVersion: text.version,
        formData: JSON.stringify(form),
      },
    })
    await this.prisma.signatureRecord.createMany({
      data: ownerships.map((o) => ({
        tenantId,
        packageId: pkg.id,
        ownerId: o.ownerId,
        apartmentId: o.apartmentId,
        signerRole: 'OWNER',
        required: true,
        status: 'PENDING',
        method: 'DIGITAL',
      })),
      skipDuplicates: true,
    })
    await this.sm.logEvent(pkg.id, 'CREATED', { actorType: 'USER', actorId: userId })
    return this.get(pkg.id, tenantId)
  }

  /** The meeting's details, the form's own gaps, and the representatives. Drafts only. */
  async update(
    id: string,
    dto: { meeting?: Partial<FormMeeting>; fields?: Record<string, unknown>; representatives?: FormRepresentative[] },
    tenantId: string,
  ) {
    const pkg = await this.loadPackage(id, tenantId)
    if (pkg.status !== 'DRAFT') throw new BadRequestException('אפשר לערוך רק טופס שעוד לא נשלח')
    const form = this.formOf(pkg)

    form.meeting = cleanMeeting(dto.meeting, form.meeting)
    if (pkg.formType !== FORM_TYPES.REPRESENTATION_PROTOCOL) {
      form.fields = cleanFields(pkg.formType!, dto.fields, form.fields)
    }
    if (dto.representatives) {
      if (!needsRepresentatives(pkg.formType)) throw new BadRequestException('בהודעה אין נציגים')
      form.representatives = await this.checkRepresentatives(dto.representatives, pkg.id)
    }
    await this.prisma.signaturePackage.update({
      where: { id: pkg.id },
      data: { formData: JSON.stringify(form) },
    })
    return this.get(pkg.id, tenantId)
  }

  /* ─── Send ────────────────────────────────────────────────────── */

  async send(id: string, userId: string, tenantId: string) {
    const pkg = await this.loadPackage(id, tenantId)
    if (pkg.status !== 'DRAFT') throw new BadRequestException('הטופס כבר נשלח')
    const form = this.formOf(pkg)

    const missing = missingForSending(form, pkg.formType!)
    if (missing.length) {
      throw new BadRequestException({
        code: 'FORM_INCOMPLETE',
        fields: missing,
        message: `לפני השליחה חסרים: ${missing.join(', ')}`,
      })
    }

    // The owners as they are now: anyone added since the draft was made
    // signs (or is notified) too, anyone no longer an owner is not.
    await this.syncRecords(pkg.id, form.complexId, tenantId)
    if (needsRepresentatives(pkg.formType)) {
      form.representatives = await this.checkRepresentatives(form.representatives, pkg.id)
    }

    await this.prisma.signaturePackage.update({
      where: { id: pkg.id },
      data: { formData: JSON.stringify(form), documentHash: formHash(form) },
    })
    // The package lifecycle has a review step; for a form, sending IS the
    // approval, so the steps are taken together and each one is logged.
    await this.sm.transition(pkg.id, 'INTERNAL_REVIEW', { actorType: 'USER', actorId: userId })
    await this.sm.transition(pkg.id, 'APPROVED', { actorType: 'USER', actorId: userId, eventType: 'APPROVED' })
    await this.sm.transition(pkg.id, 'SENT', { actorType: 'USER', actorId: userId, eventType: 'SENT' })

    const records = await this.prisma.signatureRecord.findMany({
      where: { packageId: pkg.id },
      include: { owner: { select: { fullName: true, phone: true, email: true } } },
    })
    const delivery: Record<DeliveryChannel, number> = { SMS: 0, EMAIL: 0, WHATSAPP: 0, UNSENT: 0, NONE: 0, FAILED: 0 }
    const copy = this.copyOf(pkg, form)
    for (const record of records) {
      const { token } = await this.sessions.issueSession(record.id, FORM_SESSION_TTL_DAYS)
      const channel = await this.links.send(record.owner, { ...copy, url: signingUrl(token), reminder: false })
      delivery[channel]++
      await this.prisma.signatureRecord.update({
        where: { id: record.id },
        data: { deliveredVia: channel, deliveredAt: channel === 'SMS' || channel === 'EMAIL' ? new Date() : null },
      })
    }
    // No automation dispatch here, unlike SignaturePackageService.send: each
    // owner has just been sent their link, and an automation reacting to
    // SIGNATURE_SENT would message them a second time.
    return { sent: true, delivery }
  }

  /* ─── Read ────────────────────────────────────────────────────── */

  async list(tenantId: string, projectId?: string) {
    const packages = await this.prisma.signaturePackage.findMany({
      where: { tenantId, formType: { not: null }, ...(projectId ? { projectId } : {}), status: { not: 'CANCELLED' } },
      include: { records: { select: { ownerId: true, apartmentId: true, status: true, openedAt: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const projects = await this.prisma.project.findMany({
      where: { tenantId, id: { in: [...new Set(packages.map((p) => p.projectId))] } },
      select: { id: true, name: true },
    })
    const shares = await this.sharesFor(packages.flatMap((p) => p.records))
    return packages.map((pkg) => {
      const form = parseFormData(pkg.formData)
      return {
        id: pkg.id,
        formType: pkg.formType,
        formVersion: pkg.formVersion,
        title: pkg.title,
        status: pkg.status,
        project: projects.find((p) => p.id === pkg.projectId) ?? null,
        compoundName: form?.meeting.compoundName ?? '',
        address: form?.meeting.address ?? '',
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
        progress: progressOf(pkg.records, shares),
      }
    })
  }

  /** Everything the setup and tracking screens show. Staff only. */
  async get(id: string, tenantId: string) {
    const pkg = await this.loadPackage(id, tenantId)
    const form = this.formOf(pkg)
    const records = await this.recordsOf(pkg.id)
    const shares = await this.sharesFor(records)
    const apartments = await this.apartmentsFor(records.map((r) => r.apartmentId))
    const project = await this.prisma.project.findFirst({
      where: { id: pkg.projectId, tenantId },
      select: { id: true, name: true },
    })
    const reminders = await this.prisma.signatureEvent.groupBy({
      by: ['recordId'],
      where: { packageId: pkg.id, type: 'REMINDER_SENT' },
      _max: { createdAt: true },
    })
    const sentEvent = await this.prisma.signatureEvent.findFirst({
      where: { packageId: pkg.id, type: 'SENT' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    })

    const isRepresentative = (r: { ownerId: string; apartmentId: string }) =>
      form.representatives.some((m) => m.ownerId === r.ownerId && m.apartmentId === r.apartmentId)

    const rows = records
      .map((record) => {
        const apartment = apartments.get(record.apartmentId)
        const signer = parseSignerData(record.signerData)
        return {
          recordId: record.id,
          ownerId: record.ownerId,
          apartmentId: record.apartmentId,
          apartmentNumber: apartment?.apartmentNumber ?? '',
          buildingAddress: apartment?.buildingAddress ?? '',
          ownerName: record.owner.fullName,
          phone: record.owner.phone,
          email: record.owner.email,
          share: shares.get(key(record)) ?? null,
          status: record.status,
          method: record.method,
          openedAt: record.openedAt,
          signedAt: record.signedAt,
          signedVia: signer?.channel ?? null,
          deliveredVia: record.deliveredVia,
          deliveredAt: record.deliveredAt,
          lastReminderAt: reminders.find((r) => r.recordId === record.id)?._max.createdAt ?? null,
          hasPaperCopy: Boolean(record.evidenceDocId),
          isRepresentative: isRepresentative(record),
          // Signed with an ID number other than the one on file: for staff to check.
          idMismatch: signer?.idMatchesFile === false,
        }
      })
      .sort(byApartment)

    return {
      id: pkg.id,
      formType: pkg.formType,
      formVersion: pkg.formVersion,
      title: pkg.title,
      status: pkg.status,
      documentHash: pkg.documentHash,
      project,
      complexId: form.complexId,
      text: form.text,
      meeting: form.meeting,
      representatives: form.representatives.map((m) => {
        const row = rows.find((r) => r.ownerId === m.ownerId && r.apartmentId === m.apartmentId)
        return {
          ownerId: m.ownerId,
          apartmentId: m.apartmentId,
          fullName: row?.ownerName ?? '',
          apartmentNumber: row?.apartmentNumber ?? '',
          signed: row?.status === 'SIGNED',
        }
      }),
      records: rows,
      progress: progressOf(records, shares),
      sentAt: sentEvent?.createdAt ?? null,
      createdAt: pkg.createdAt,
      completedAt: pkg.completedAt,
      // What the system can send by itself; WhatsApp from the CRM always works.
      channels: { sms: this.sms.isConfigured, email: this.email.isConfigured },
      fields: form.fields ?? null,
      signable: isSignable(pkg.formType),
      // The agreement's company signature: whether it is there, never the image.
      organizer: form.organizer ? { signedDate: form.organizer.signedDate, signedAt: form.organizer.signedAt } : null,
    }
  }

  /**
   * The combined document: the protocol with this meeting's details, the
   * representation table and every signed row of the owners' table, with ID
   * numbers decrypted. Staff (with a signing role) and, through
   * PortalFormsService, the representation's members.
   */
  async document(id: string, tenantId: string) {
    const pkg = await this.loadPackage(id, tenantId)
    if (pkg.status === 'DRAFT') throw new BadRequestException('הטופס עוד לא נשלח')
    return this.buildDocument(pkg)
  }

  async buildDocument(pkg: { id: string; formType?: string | null; formData: string | null; formVersion: string | null; documentHash: string | null; status: string; completedAt: Date | null; tenantId: string }) {
    const form = this.formOf(pkg)
    const records = await this.recordsOf(pkg.id)
    const apartments = await this.apartmentsFor(records.map((r) => r.apartmentId))

    const rowOf = (record: RecordRow) => {
      const signer = parseSignerData(record.signerData)
      return {
        apartmentNumber: apartments.get(record.apartmentId)?.apartmentNumber ?? '',
        fullName: signer?.fullName ?? record.owner.fullName,
        idNumber: this.encryption.decrypt(signer?.idNumber ?? null),
        signedDate: signer?.signedDate ?? null,
        phone: signer?.phone ?? null,
        email: signer?.email ?? null,
        signatureImage: record.signatureImage,
        method: record.method,
        channel: signer?.channel ?? null,
      }
    }

    const representatives = form.representatives.map((m) => {
      const record = records.find((r) => r.ownerId === m.ownerId && r.apartmentId === m.apartmentId)
      if (!record) return { fullName: '', idNumber: null, apartmentNumber: '', signatureImage: null, signed: false, method: null }
      const signed = record.status === 'SIGNED'
      const row = rowOf(record)
      return {
        fullName: row.fullName,
        // Their own ID number when they signed; until then, the one on file.
        idNumber: signed ? row.idNumber : this.encryption.decrypt(record.owner.nationalId),
        apartmentNumber: row.apartmentNumber,
        signatureImage: signed ? record.signatureImage : null,
        signed,
        method: signed ? record.method : null,
      }
    })

    const rows = records.filter((r) => r.status === 'SIGNED').map(rowOf).sort(byApartment)
    // The agreement's determining date is the day the first owner signed.
    const signedDates = rows.map((r) => r.signedDate).filter((d): d is string => Boolean(d)).sort()

    return {
      packageId: pkg.id,
      formType: pkg.formType ?? null,
      formVersion: pkg.formVersion,
      documentHash: pkg.documentHash,
      status: pkg.status,
      completedAt: pkg.completedAt,
      text: form.text,
      meeting: form.meeting,
      fields: form.fields ?? null,
      determiningDate: signedDates[0] ?? null,
      organizer: form.organizer ? { signatureImage: form.organizer.signatureImage, signedDate: form.organizer.signedDate } : null,
      representatives,
      rows,
      totals: { owners: records.length, signed: rows.length },
      // The preparer's ID number belongs on the signed document only, and
      // lives in the gateway's environment rather than in any code that
      // reaches a browser.
      preparerIdNumber: process.env.PROTOCOL_PREPARER_ID_NUMBER?.trim() || null,
      generatedAt: new Date(),
    }
  }

  /* ─── Reminders ───────────────────────────────────────────────── */

  async remind(id: string, recordId: string, tenantId: string) {
    const pkg = await this.loadPackage(id, tenantId)
    if (!OPEN_STATUSES.includes(pkg.status)) throw new BadRequestException('הטופס אינו פתוח לחתימה')
    const form = this.formOf(pkg)
    const record = await this.prisma.signatureRecord.findFirst({
      where: { id: recordId, packageId: pkg.id },
      include: { owner: { select: { fullName: true, phone: true, email: true } } },
    })
    if (!record) throw new NotFoundException('השורה לא נמצאה')
    if (record.status === 'SIGNED') throw new BadRequestException('בעל הדירה כבר חתם')
    const channel = await this.deliverReminder(pkg.id, record, this.copyOf(pkg, form))
    if (channel === 'UNSENT') throw new BadRequestException('אין ספק SMS ואין אימייל בתיק. שלחו את התזכורת בווטסאפ.')
    if (channel === 'NONE') throw new BadRequestException('אין בתיק טלפון נייד או אימייל. אפשר להחתים ידנית.')
    if (channel === 'FAILED') throw new BadRequestException('שליחת התזכורת נכשלה. נסו שוב מאוחר יותר.')
    return { sent: true, channel }
  }

  /**
   * "תזכורת לכל מי שלא חתם": each unsigned owner with a channel, once a day.
   * For a notice, which nobody signs, everyone who has not opened it yet.
   */
  async remindAll(id: string, tenantId: string) {
    const pkg = await this.loadPackage(id, tenantId)
    if (!OPEN_STATUSES.includes(pkg.status)) throw new BadRequestException('הטופס אינו פתוח לחתימה')
    const form = this.formOf(pkg)
    const records = await this.prisma.signatureRecord.findMany({
      where: { packageId: pkg.id, status: { not: 'SIGNED' }, ...(isSignable(pkg.formType) ? {} : { openedAt: null }) },
      include: { owner: { select: { fullName: true, phone: true, email: true } } },
    })
    const copy = this.copyOf(pkg, form)
    const recent = await this.prisma.signatureEvent.findMany({
      where: { packageId: pkg.id, type: 'REMINDER_SENT', createdAt: { gt: new Date(Date.now() - REMINDER_GAP_MS) } },
      select: { recordId: true },
    })
    const result = { sent: 0, skippedRecent: 0, noChannel: 0, whatsApp: 0, failed: 0 }
    for (const record of records) {
      if (recent.some((e) => e.recordId === record.id)) {
        result.skippedRecent++
        continue
      }
      const channel = await this.deliverReminder(pkg.id, record, copy)
      if (channel === 'SMS' || channel === 'EMAIL') result.sent++
      else if (channel === 'UNSENT') result.whatsApp++
      else if (channel === 'NONE') result.noChannel++
      else result.failed++
    }
    return result
  }

  private async deliverReminder(
    packageId: string,
    record: { id: string; owner: { fullName: string; phone: string | null; email: string | null } },
    copy: LinkCopy,
  ): Promise<DeliveryChannel> {
    // The live link if there is one, so the link already in the owner's SMS
    // keeps working; a new one only when it expired.
    const token = await this.sessions.currentToken(record.id, FORM_SESSION_TTL_DAYS)
    const channel = await this.links.send(record.owner, { ...copy, url: signingUrl(token), reminder: true })
    if (channel === 'SMS' || channel === 'EMAIL') {
      await this.prisma.signatureRecord.update({
        where: { id: record.id },
        data: { deliveredVia: channel, deliveredAt: new Date() },
      })
      await this.sm.logEvent(packageId, 'REMINDER_SENT', { recordId: record.id, actorType: 'SYSTEM', metadata: { channel } })
    }
    return channel
  }

  /* ─── Sharing a link by hand ──────────────────────────────────── */

  /**
   * An owner's personal link, for staff to send themselves: copied, or on
   * WhatsApp from their own phone (no provider needed). The live link is
   * reused, so the one already in an SMS keeps working. Every share is
   * logged; a WhatsApp share also counts as the link going out.
   */
  async shareLink(id: string, recordId: string, via: 'WHATSAPP' | 'COPY', userId: string, tenantId: string) {
    const pkg = await this.loadPackage(id, tenantId)
    if (!OPEN_STATUSES.includes(pkg.status)) throw new BadRequestException('הטופס אינו פתוח לחתימה')
    const form = this.formOf(pkg)
    const record = await this.prisma.signatureRecord.findFirst({
      where: { id: recordId, packageId: pkg.id },
      include: { owner: { select: { fullName: true, phone: true, email: true } } },
    })
    if (!record) throw new NotFoundException('השורה לא נמצאה')
    if (record.status === 'SIGNED') throw new BadRequestException('בעל הדירה כבר חתם')

    const token = await this.sessions.currentToken(record.id, FORM_SESSION_TTL_DAYS)
    const url = signingUrl(token)
    const whatsApp = this.links.whatsApp(record.owner, { ...this.copyOf(pkg, form), url })
    if (via === 'WHATSAPP' && !whatsApp.url) throw new BadRequestException('אין בתיק מספר נייד לשליחה בווטסאפ')

    if (via === 'WHATSAPP') {
      await this.prisma.signatureRecord.update({
        where: { id: record.id },
        data: { deliveredVia: 'WHATSAPP', deliveredAt: new Date() },
      })
    }
    await this.sm.logEvent(pkg.id, 'LINK_SHARED', {
      recordId: record.id,
      actorType: 'USER',
      actorId: userId,
      metadata: { via },
    })
    return { url, text: whatsApp.text, whatsappUrl: whatsApp.url }
  }

  /* ─── Signing on paper ────────────────────────────────────────── */

  /**
   * Records an owner who signed the printed form: staff enter the row as it
   * was written on paper and attach the scanned page (uploaded through the
   * documents module). The row then appears in the combined document as
   * "נחתם ידנית".
   */
  async markSignedOnPaper(
    id: string,
    recordId: string,
    dto: { fullName: string; idNumber?: string; signedDate: string; documentId: string },
    userId: string,
    tenantId: string,
  ) {
    const pkg = await this.loadPackage(id, tenantId)
    if (!isSignable(pkg.formType)) throw new BadRequestException('בהודעה אין מה לחתום')
    if (!OPEN_STATUSES.includes(pkg.status)) throw new BadRequestException('הטופס אינו פתוח לחתימה')
    const record = await this.prisma.signatureRecord.findFirst({ where: { id: recordId, packageId: pkg.id } })
    if (!record) throw new NotFoundException('השורה לא נמצאה')
    if (record.status === 'SIGNED') throw new BadRequestException('בעל הדירה כבר חתם')

    const fullName = dto.fullName.trim().replace(/\s+/g, ' ')
    if (fullName.length < 2) throw new BadRequestException('יש לרשום את השם כפי שנחתם')
    const idNumber = dto.idNumber ? dto.idNumber.replace(/\D/g, '') : ''
    if (idNumber && !isValidIsraeliId(idNumber)) throw new BadRequestException('מספר תעודת הזהות אינו תקין')
    if (!isIsoDate(dto.signedDate)) throw new BadRequestException('תאריך החתימה אינו תקין')
    const document = await this.prisma.document.findFirst({
      where: { id: dto.documentId, tenantId },
      select: { id: true },
    })
    if (!document) throw new BadRequestException('יש לצרף את הטופס החתום')

    const signerData: StoredSignerData = {
      fullName,
      idNumber: idNumber ? this.encryption.encrypt(idNumber.padStart(9, '0')) : null,
      phone: null,
      email: null,
      signedDate: dto.signedDate,
      channel: 'MANUAL',
    }
    await this.prisma.signatureRecord.update({
      where: { id: record.id },
      data: {
        status: 'SIGNED',
        method: 'WET',
        signedAt: new Date(),
        signerData: JSON.stringify(signerData),
        evidenceDocId: document.id,
        validatedById: userId,
      },
    })
    await this.prisma.signingSession.updateMany({
      where: { recordId: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await this.sm.logEvent(pkg.id, 'SIGNED', {
      recordId: record.id,
      actorType: 'USER',
      actorId: userId,
      metadata: { form: { version: pkg.formVersion, channel: 'MANUAL' }, documentId: document.id },
    })
    await this.completeIfDone(pkg.id, pkg.status, tenantId)
    return this.get(pkg.id, tenantId)
  }

  /* ─── The organiser's signature ───────────────────────────────── */

  /**
   * The agreement's "המארגן" line: the company signs once, after the form
   * went out (its words are then fixed), by a staff member who manages
   * forms drawing the signature in the CRM. Not part of the document hash,
   * which covers what the owners sign; logged like a signature.
   */
  async signAsOrganizer(id: string, signatureImage: string, userId: string, tenantId: string) {
    const pkg = await this.loadPackage(id, tenantId)
    if (pkg.formType !== FORM_TYPES.ORGANIZING_AGREEMENT) throw new BadRequestException('חתימת המארגן שייכת להסכם הארגון והליווי')
    if (!['SENT', 'PARTIALLY_SIGNED', 'COMPLETED'].includes(pkg.status)) {
      throw new BadRequestException('המארגן חותם אחרי שההסכם נשלח לבעלי הדירות')
    }
    if (!signatureImage.startsWith('data:image/png;base64,') || signatureImage.length > MAX_SIGNATURE_LENGTH) {
      throw new BadRequestException('החתימה אינה תקינה')
    }
    const form = this.formOf(pkg)
    if (form.organizer) throw new BadRequestException('המארגן כבר חתם על ההסכם')
    form.organizer = { signatureImage, signedDate: israelToday(), signedAt: new Date().toISOString(), signedById: userId }
    await this.prisma.signaturePackage.update({ where: { id: pkg.id }, data: { formData: JSON.stringify(form) } })
    await this.sm.logEvent(pkg.id, 'ORGANIZER_SIGNED', { actorType: 'USER', actorId: userId })
    return this.get(pkg.id, tenantId)
  }

  async cancel(id: string, userId: string, tenantId: string) {
    const pkg = await this.loadPackage(id, tenantId)
    await this.sm.transition(pkg.id, 'CANCELLED', { actorType: 'USER', actorId: userId, eventType: 'CANCELLED' })
    await this.prisma.signingSession.updateMany({
      where: { recordId: { in: (await this.prisma.signatureRecord.findMany({ where: { packageId: pkg.id }, select: { id: true } })).map((r) => r.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { cancelled: true }
  }

  /* ─── Internals ───────────────────────────────────────────────── */

  private async completeIfDone(packageId: string, status: string, tenantId: string) {
    const remaining = await this.prisma.signatureRecord.count({
      where: { packageId, required: true, status: { not: 'SIGNED' } },
    })
    if (remaining === 0) {
      await this.sm.transition(packageId, 'COMPLETED', { actorType: 'SYSTEM', eventType: 'COMPLETED' })
      this.evidence.generate(packageId, tenantId).catch((err) => this.logger.error(`Evidence generation failed: ${err.message}`))
    } else if (status === 'SENT') {
      await this.sm.transition(packageId, 'PARTIALLY_SIGNED', { actorType: 'SYSTEM' })
    }
  }

  private async loadPackage(id: string, tenantId: string) {
    const pkg = await this.prisma.signaturePackage.findFirst({ where: { id, tenantId, formType: { not: null } } })
    if (!pkg) throw new NotFoundException('הטופס לא נמצא')
    return pkg
  }

  private formOf(pkg: { formData: string | null }): FormData {
    const form = parseFormData(pkg.formData)
    if (!form) throw new BadRequestException('נתוני הטופס פגומים')
    return form
  }

  private recordsOf(packageId: string): Promise<RecordRow[]> {
    return this.prisma.signatureRecord.findMany({
      where: { packageId },
      select: {
        id: true,
        ownerId: true,
        apartmentId: true,
        status: true,
        method: true,
        openedAt: true,
        signedAt: true,
        signerData: true,
        signatureImage: true,
        deliveredVia: true,
        deliveredAt: true,
        evidenceDocId: true,
        owner: { select: { id: true, fullName: true, phone: true, email: true, nationalId: true } },
      },
    })
  }

  /** Active owners of the complex's apartments: one entry per owner and apartment. */
  private async ownershipsOf(complexId: string, tenantId: string) {
    return this.prisma.ownerApartment.findMany({
      where: { apartment: { building: { complexId } }, owner: { tenantId, isActive: true } },
      select: { ownerId: true, apartmentId: true },
    })
  }

  /** Brings a draft's records in line with the complex's current owners. */
  private async syncRecords(packageId: string, complexId: string, tenantId: string) {
    const current = await this.ownershipsOf(complexId, tenantId)
    if (current.length === 0) throw new BadRequestException('אין בעלי דירות רשומים במתחם הזה')
    const existing = await this.prisma.signatureRecord.findMany({
      where: { packageId },
      select: { id: true, ownerId: true, apartmentId: true },
    })
    const wanted = new Set(current.map(key))
    const stale = existing.filter((r) => !wanted.has(key(r)))
    if (stale.length) await this.prisma.signatureRecord.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } })
    const have = new Set(existing.map(key))
    const added = current.filter((o) => !have.has(key(o)))
    if (added.length) {
      await this.prisma.signatureRecord.createMany({
        data: added.map((o) => ({
          tenantId,
          packageId,
          ownerId: o.ownerId,
          apartmentId: o.apartmentId,
          signerRole: 'OWNER',
          required: true,
          status: 'PENDING',
          method: 'DIGITAL',
        })),
        skipDuplicates: true,
      })
    }
  }

  /** Members must be owners on this form, each listed once. */
  private async checkRepresentatives(input: FormRepresentative[], packageId: string): Promise<FormRepresentative[]> {
    if (input.length > MAX_REPRESENTATIVES) {
      throw new BadRequestException(`אפשר עד ${MAX_REPRESENTATIVES} חברי נציגות`)
    }
    const records = await this.prisma.signatureRecord.findMany({
      where: { packageId },
      select: { ownerId: true, apartmentId: true, owner: { select: { fullName: true } } },
    })
    const unique = new Map<string, FormRepresentative>()
    for (const member of input) {
      if (!records.some((r) => key(r) === key(member))) {
        throw new BadRequestException('חבר נציגות שנבחר אינו רשום כבעלים בדירה במתחם. יש לבחור מחדש את חברי הנציגות.')
      }
      unique.set(key(member), { ownerId: member.ownerId, apartmentId: member.apartmentId })
    }
    return [...unique.values()]
  }

  /** Each record's share of its apartment, normalised so an apartment sums to 1. */
  private async sharesFor(all: { ownerId: string; apartmentId: string }[]) {
    const shares = new Map<string, number>()
    // One entry per owner and apartment: the list view passes the records of
    // several forms, and the same owner counted twice would halve every share.
    const records = [...new Map(all.map((r) => [key(r), r])).values()]
    if (records.length === 0) return shares
    const rows = await this.prisma.ownerApartment.findMany({
      where: { OR: records.map((r) => ({ ownerId: r.ownerId, apartmentId: r.apartmentId })) },
      select: { ownerId: true, apartmentId: true, shareNumerator: true, shareDenominator: true },
    })
    const raw = new Map(rows.map((r) => [key(r), r.shareDenominator > 0 ? r.shareNumerator / r.shareDenominator : 0]))
    const perApartment = new Map<string, number>()
    for (const record of records) {
      perApartment.set(record.apartmentId, (perApartment.get(record.apartmentId) ?? 0) + (raw.get(key(record)) ?? 0))
    }
    const owners = new Map<string, number>()
    for (const record of records) owners.set(record.apartmentId, (owners.get(record.apartmentId) ?? 0) + 1)
    for (const record of records) {
      const total = perApartment.get(record.apartmentId) ?? 0
      // No recorded shares at all: the owners split the apartment equally.
      const share = total > 0 ? (raw.get(key(record)) ?? 0) / total : 1 / (owners.get(record.apartmentId) ?? 1)
      shares.set(key(record), share)
    }
    return shares
  }

  private async apartmentsFor(ids: string[]) {
    const apartments = await this.prisma.apartment.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, apartmentNumber: true, building: { select: { address: true, streetNumber: true } } },
    })
    return new Map(
      apartments.map((a) => [
        a.id,
        {
          apartmentNumber: a.apartmentNumber,
          buildingAddress: [a.building.address, a.building.streetNumber].filter(Boolean).join(' '),
        },
      ]),
    )
  }

  private buildingAddresses(buildings: { address: string; streetNumber: string | null }[]): string {
    return [...new Set(buildings.map((b) => [b.address, b.streetNumber].filter(Boolean).join(' ')))].join(', ')
  }

  /**
   * A new form's own gaps, from what the system knows: the agreement's street
   * and city from the complex's buildings (when they agree), the notice's
   * address line from the complex. Block and parcel are left for staff.
   */
  private startingFields(
    formType: string,
    complex: { name: string; buildings: { address: string; streetNumber: string | null; city: string | null }[] },
    meeting: FormMeeting,
  ): Record<string, string> {
    if (formType === FORM_TYPES.ASSEMBLY_NOTICE) {
      return { compound: [complex.name, meeting.address].filter(Boolean).join(', '), meetingTime: '' }
    }
    const cities = [...new Set(complex.buildings.map((b) => b.city?.trim()).filter(Boolean))]
    return { street: this.buildingAddresses(complex.buildings), city: cities.length === 1 ? cities[0]! : '', gush: '', helka: '' }
  }

  /** What a link's message says about this form: its kind, and the notice's assembly. */
  private copyOf(pkg: { formType: string | null }, form: FormData): LinkCopy {
    const [y, m, d] = form.meeting.meetingDate.split('-')
    return {
      compoundName: form.meeting.compoundName,
      formType: pkg.formType,
      ...(pkg.formType === FORM_TYPES.ASSEMBLY_NOTICE
        ? {
            when: {
              date: y && m && d ? `${d}.${m}.${y}` : '',
              time: form.fields?.meetingTime ?? '',
              place: form.meeting.meetingPlace,
            },
          }
        : {}),
    }
  }
}

function key(r: { ownerId: string; apartmentId: string }): string {
  return `${r.ownerId}:${r.apartmentId}`
}

function byApartment(a: { apartmentNumber: string }, b: { apartmentNumber: string }): number {
  return a.apartmentNumber.localeCompare(b.apartmentNumber, 'he', { numeric: true })
}

/**
 * Signing progress three ways: owners (rows), apartments fully signed, and
 * the share of ownership signed (each apartment counting once, split by its
 * owners' shares), which is how a majority in pinui-binui is counted.
 */
function progressOf(
  records: { ownerId: string; apartmentId: string; status: string; openedAt?: Date | null }[],
  shares: Map<string, number>,
) {
  const apartments = new Map<string, { total: number; signed: number }>()
  let signedShare = 0
  for (const record of records) {
    const apartment = apartments.get(record.apartmentId) ?? { total: 0, signed: 0 }
    apartment.total++
    if (record.status === 'SIGNED') {
      apartment.signed++
      signedShare += shares.get(key(record)) ?? 0
    }
    apartments.set(record.apartmentId, apartment)
  }
  const apartmentCount = apartments.size
  return {
    owners: records.length,
    ownersSigned: records.filter((r) => r.status === 'SIGNED').length,
    // A notice is read, not signed: how many opened their link.
    ownersOpened: records.filter((r) => r.openedAt).length,
    apartments: apartmentCount,
    apartmentsSigned: [...apartments.values()].filter((a) => a.total > 0 && a.signed === a.total).length,
    sharePercent: apartmentCount ? Math.round((signedShare / apartmentCount) * 1000) / 10 : 0,
  }
}
