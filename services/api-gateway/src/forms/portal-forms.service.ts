import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { FieldEncryptionService } from '../crypto/field-encryption.service'
import { SigningSessionService } from '../signatures/signing-session.service'
import type { PortalScope } from '../portal/portal-scope.service'
import { FormsService } from './forms.service'
import { FORM_SESSION_TTL_DAYS, isSignable, maskIdNumber, parseFormData, parseSignerData, plainText } from './form-data'

const VISIBLE_STATUSES = ['SENT', 'PARTIALLY_SIGNED', 'COMPLETED']
const OPEN_STATUSES = ['SENT', 'PARTIALLY_SIGNED']

/**
 * A resident's forms, in the personal area.
 *
 * Everything is scoped by the session: the resident's linked owner
 * (Owner.residentId) and the session's project. A package id that is not
 * one of theirs is a 404, not a permission decision.
 *
 * ── WHO SEES WHICH ROWS ────────────────────────────────────────────────────
 *
 * An owner sees the protocol as sent and their own row: never another
 * owner's ID number, phone or email. A member of the form's representation
 * sees the combined document, every signed row included: the owner decided
 * (2026-10-07) that it goes to the representation as well as to the company.
 */
@Injectable()
export class PortalFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
    private readonly sessions: SigningSessionService,
    private readonly forms: FormsService,
  ) {}

  /** Pending forms carry the path to sign them; signed ones, to their copy. */
  async list(scope: PortalScope) {
    const records = await this.ownRecords(scope)
    const [apartments, sentEvents] = await Promise.all([
      this.prisma.apartment.findMany({
        where: { id: { in: [...new Set(records.map((r) => r.apartmentId))] } },
        select: { id: true, apartmentNumber: true },
      }),
      this.prisma.signatureEvent.findMany({
        where: { packageId: { in: [...new Set(records.map((r) => r.package.id))] }, type: 'SENT' },
        select: { packageId: true, createdAt: true },
      }),
    ])
    const result = []
    for (const record of records) {
      const form = parseFormData(record.package.formData)
      const open = OPEN_STATUSES.includes(record.package.status) && record.status !== 'SIGNED'
      const signable = isSignable(record.package.formType)
      result.push({
        packageId: record.package.id,
        formType: record.package.formType,
        title: form ? plainText(form.text.title) : record.package.title,
        compoundName: form?.meeting.compoundName ?? '',
        apartmentNumber: apartments.find((a) => a.id === record.apartmentId)?.apartmentNumber ?? '',
        // A notice has nothing to sign: it is there to read while it is open.
        status: !signable ? (open ? 'NOTICE' : 'CLOSED') : record.status === 'SIGNED' ? 'SIGNED' : open ? 'PENDING' : 'CLOSED',
        signedAt: record.signedAt,
        sentAt: sentEvents.find((e) => e.packageId === record.package.id)?.createdAt ?? null,
        // The live link, never a reissued one: reissuing would kill the link
        // already sitting in the owner's SMS.
        signPath: open ? `/sign/${await this.sessions.currentToken(record.id, FORM_SESSION_TTL_DAYS)}` : null,
        isRepresentative: Boolean(
          form?.representatives.some((m) => m.ownerId === record.ownerId && m.apartmentId === record.apartmentId),
        ),
      })
    }
    return result
  }

  /** The resident's copy: their own rows, or the combined document for a member. */
  async copy(scope: PortalScope, packageId: string) {
    const records = (await this.ownRecords(scope)).filter((r) => r.package.id === packageId)
    if (records.length === 0) throw new NotFoundException('הטופס לא נמצא')
    const pkg = records[0].package
    const form = parseFormData(pkg.formData)
    if (!form) throw new NotFoundException('הטופס לא נמצא')

    // A notice is the same for every owner: its text with the assembly's details.
    if (!isSignable(pkg.formType)) {
      return {
        kind: 'NOTICE' as const,
        packageId: pkg.id,
        formType: pkg.formType,
        formVersion: pkg.formVersion,
        status: pkg.status,
        text: form.text,
        meeting: form.meeting,
        fields: form.fields ?? null,
      }
    }

    const isRepresentative = form.representatives.some((m) =>
      records.some((r) => r.ownerId === m.ownerId && r.apartmentId === m.apartmentId),
    )
    if (isRepresentative) {
      return { kind: 'COMBINED' as const, ...(await this.forms.buildDocument(pkg)) }
    }

    const apartmentIds = [...records.map((r) => r.apartmentId), ...form.representatives.map((m) => m.apartmentId)]
    const [apartments, members, memberRecords] = await Promise.all([
      this.prisma.apartment.findMany({ where: { id: { in: apartmentIds } }, select: { id: true, apartmentNumber: true } }),
      this.prisma.owner.findMany({
        where: { id: { in: form.representatives.map((m) => m.ownerId) }, tenantId: scope.tenantId },
        select: { id: true, fullName: true },
      }),
      this.prisma.signatureRecord.findMany({
        where: { packageId: pkg.id, OR: form.representatives.map((m) => ({ ownerId: m.ownerId, apartmentId: m.apartmentId })) },
        select: { ownerId: true, apartmentId: true, status: true },
      }),
    ])
    const apartmentNumber = (id: string) => apartments.find((a) => a.id === id)?.apartmentNumber ?? ''

    const first = await this.prisma.signatureRecord.findFirst({
      where: { packageId: pkg.id, status: 'SIGNED' },
      orderBy: { signedAt: 'asc' },
      select: { signerData: true },
    })

    return {
      kind: 'OWN' as const,
      packageId: pkg.id,
      formType: pkg.formType,
      formVersion: pkg.formVersion,
      documentHash: pkg.documentHash,
      status: pkg.status,
      text: form.text,
      meeting: form.meeting,
      fields: form.fields ?? null,
      // The agreement's determining date, and the company's signature on it.
      determiningDate: parseSignerData(first?.signerData)?.signedDate ?? null,
      organizer: form.organizer ? { signatureImage: form.organizer.signatureImage, signedDate: form.organizer.signedDate } : null,
      // Names and apartments, as the protocol prints them; members' ID
      // numbers are for the company and the representation.
      representatives: form.representatives.map((m) => ({
        fullName: members.find((o) => o.id === m.ownerId)?.fullName ?? '',
        apartmentNumber: apartmentNumber(m.apartmentId),
        signed: memberRecords.some((r) => r.ownerId === m.ownerId && r.apartmentId === m.apartmentId && r.status === 'SIGNED'),
      })),
      rows: records
        .filter((r) => r.status === 'SIGNED')
        .map((r) => {
          const signer = parseSignerData(r.signerData)
          return {
            apartmentNumber: apartmentNumber(r.apartmentId),
            fullName: signer?.fullName ?? '',
            idNumber: maskIdNumber(this.encryption.decrypt(signer?.idNumber ?? null)),
            signedDate: signer?.signedDate ?? null,
            phone: signer?.phone ?? null,
            email: signer?.email ?? null,
            signatureImage: r.signatureImage,
            method: r.method,
            channel: signer?.channel ?? null,
          }
        }),
      preparerIdNumber: process.env.PROTOCOL_PREPARER_ID_NUMBER?.trim() || null,
    }
  }

  private ownRecords(scope: PortalScope) {
    return this.prisma.signatureRecord.findMany({
      where: {
        tenantId: scope.tenantId,
        owner: { residentId: scope.residentId, isActive: true },
        package: { formType: { not: null }, projectId: scope.projectId, status: { in: VISIBLE_STATUSES } },
      },
      select: {
        id: true,
        ownerId: true,
        apartmentId: true,
        status: true,
        signedAt: true,
        signerData: true,
        signatureImage: true,
        method: true,
        package: {
          select: {
            id: true,
            formType: true,
            title: true,
            status: true,
            formData: true,
            formVersion: true,
            documentHash: true,
            completedAt: true,
            tenantId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
