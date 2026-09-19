import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import type { PortalScope } from './portal-scope.service'

/**
 * The resident dashboard, assembled from what the database can actually answer.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 *
 * The page was five components holding hard-coded arrays: a seven-stage
 * progress bar that does not match the twelve-stage `ProjectStage` enum, three
 * invented documents, three invented announcements, a signature date of
 * "15 במרץ 2025", and a company phone number in the markup. It rendered the
 * same thing for every resident because it never asked who was looking.
 *
 * ── ONE RULE ────────────────────────────────────────────────────────────────
 *
 * Every query below is filtered by values from `PortalScope`, which came from
 * the authenticated session and was re-checked against the database. No id in
 * this file is ever read from a request. That is the whole tenant-isolation
 * story for this endpoint: there is no parameter to tamper with.
 *
 * ── WHERE THE MOCK PROMISED SOMETHING THAT DOES NOT EXIST ───────────────────
 *
 * The mock's "הודעות" implied an announcements feed. There is no announcement
 * model in this schema — `Notification` belongs to `User`, and residents are
 * not users — so the honest answer is the messages the project actually sent
 * THIS resident, which is a real table with real rows. Inventing an
 * `Announcement` model to satisfy a mock would be building the product
 * backwards from a placeholder.
 */

/**
 * The project lifecycle, in order.
 *
 * `ProjectStage` is a Prisma enum, and enums have no inherent order at runtime
 * — `Object.keys` order is a fact about the generated client, not a promise.
 * The sequence is written out here so "which stages are behind us" is a
 * decision this file makes explicitly rather than one it inherits by accident.
 */
const STAGE_ORDER = [
  'DISCOVERY',
  'FEASIBILITY',
  'RESIDENT_ORGANIZATION',
  'SIGNATURES',
  'DEVELOPER_SELECTION',
  'PLANNING',
  'MUNICIPAL_APPROVAL',
  'PERMIT',
  'EVACUATION',
  'CONSTRUCTION',
  'DELIVERY',
  'POST_DELIVERY',
] as const

type Stage = (typeof STAGE_ORDER)[number]

const STAGE_LABELS: Record<Stage, string> = {
  DISCOVERY: 'איתור',
  FEASIBILITY: 'בדיקת היתכנות',
  RESIDENT_ORGANIZATION: 'התארגנות דיירים',
  SIGNATURES: 'חתימות',
  DEVELOPER_SELECTION: 'בחירת יזם',
  PLANNING: 'תכנון',
  MUNICIPAL_APPROVAL: 'אישור עירייה',
  PERMIT: 'היתר בנייה',
  EVACUATION: 'פינוי',
  CONSTRUCTION: 'בנייה',
  DELIVERY: 'מסירה',
  POST_DELIVERY: 'אחרי מסירה',
}

/** How many rows each list section returns. The page shows a preview, not an archive. */
const DOCUMENT_PREVIEW = 5
const MESSAGE_PREVIEW = 5
const MEETING_PREVIEW = 3

@Injectable()
export class PortalDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async build(scope: PortalScope) {
    const now = new Date()

    const [project, stageHistory, signature, documents, messages, meetings, contact] = await Promise.all([
      this.project(scope),
      this.stageHistory(scope),
      this.signature(scope),
      this.documents(scope),
      this.messages(scope),
      this.meetings(scope, now),
      this.contact(scope),
    ])

    return {
      resident: {
        firstName: scope.residentFirstName,
        name: scope.residentName,
        apartmentNumber: scope.apartmentNumber,
        buildingAddress: scope.buildingAddress,
      },
      project: {
        name: project.name,
        status: project.status,
        stage: project.stage,
        stageLabel: STAGE_LABELS[project.stage as Stage] ?? project.stage,
        progressPercent: progressOf(project.stage as Stage),
        stages: buildStages(project.stage as Stage, stageHistory),
      },
      signature,
      documents,
      messages,
      meetings,
      contact,
    }
  }

  // ── Who this resident should talk to ──────────────────────────────────────

  /**
   * The project's manager, by name.
   *
   * Deliberately NOT their phone number, though the column holds one. That
   * column is filled from staff onboarding and is often a personal mobile;
   * publishing it to every resident in a project is a disclosure decision for
   * the product to make on purpose, with the staff member's knowledge, and not
   * one an endpoint should make silently because the field happened to be
   * available. The email is a work address by construction — it is the login.
   *
   * The office numbers the page already shows are company contact details that
   * are published on the public website, so they stay in the page.
   *
   * ── WHY THIS IS TWO QUERIES AND NOT A JOIN ──────────────────────────────
   *
   * `Project.projectManagerId` is a bare `String?` with no foreign key — the
   * same shape as `Resident.tenantId`, and with the same consequence: nothing
   * in the database stops it naming a user in another tenant. So the id is
   * read from the project and then resolved through a lookup that is itself
   * scoped by tenant. A mis-set id yields "no contact" instead of a name from
   * somebody else's organisation.
   */
  private async contact(scope: PortalScope) {
    const project = await this.prisma.project.findFirstOrThrow({
      where: { id: scope.projectId, tenantId: scope.tenantId },
      select: { projectManagerId: true },
    })
    if (!project.projectManagerId) return { projectManager: null }

    const pm = await this.prisma.user.findFirst({
      where: { id: project.projectManagerId, tenantId: scope.tenantId, isActive: true },
      select: { firstName: true, lastName: true, email: true },
    })
    // Absent, in another tenant, or a person who has left. Naming any of them
    // sends residents to an address nobody reads.
    if (!pm) return { projectManager: null }

    return {
      projectManager: {
        name: `${pm.firstName} ${pm.lastName}`.trim(),
        email: pm.email,
      },
    }
  }

  // ── The project this resident's apartment sits in ─────────────────────────

  private async project(scope: PortalScope) {
    /*
     * Looked up by BOTH ids, though `projectId` alone is unique. The tenant
     * clause costs nothing and means a future change that lets projectId come
     * from somewhere less trustworthy still cannot cross a tenant boundary.
     */
    return this.prisma.project.findFirstOrThrow({
      where: { id: scope.projectId, tenantId: scope.tenantId },
      select: { name: true, status: true, stage: true },
    })
  }

  private async stageHistory(scope: PortalScope) {
    const rows = await this.prisma.projectStageHistory.findMany({
      where: { projectId: scope.projectId, project: { tenantId: scope.tenantId } },
      select: { stage: true, enteredAt: true, exitedAt: true },
      orderBy: { enteredAt: 'asc' },
    })
    return rows
  }

  // ── This resident's own signing position ──────────────────────────────────

  private async signature(scope: PortalScope) {
    const [resident, request] = await Promise.all([
      this.prisma.resident.findFirstOrThrow({
        where: { id: scope.residentId },
        select: { signatureStatus: true, isObjecting: true },
      }),
      /*
       * The newest signature request addressed to this resident. Scoped by
       * tenantId as well as residentId: `SignatureRequest` carries its own
       * tenant column, and a resident id is not by itself a tenant claim.
       */
      this.prisma.signatureRequest.findFirst({
        where: { residentId: scope.residentId, tenantId: scope.tenantId },
        select: {
          status: true, signedAt: true, sentAt: true, expiresAt: true,
          document: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const signed = resident.signatureStatus === 'SIGNED' || request?.status === 'SIGNED'

    return {
      signed,
      status: resident.signatureStatus,
      isObjecting: resident.isObjecting,
      // Null when the resident is recorded as signed on paper: the CRM knows
      // they signed, and no e-signature request carries the date. Better an
      // absent date than a plausible invented one.
      signedAt: request?.signedAt ?? null,
      /** Present only while something is genuinely awaiting them. */
      pending: !signed && request && request.status !== 'REJECTED' && request.status !== 'EXPIRED'
        ? {
            documentId: request.document?.id ?? null,
            documentTitle: request.document?.title ?? null,
            sentAt: request.sentAt,
            expiresAt: request.expiresAt,
          }
        : null,
    }
  }

  // ── Documents attached to this resident ───────────────────────────────────

  private async documents(scope: PortalScope) {
    /*
     * `ResidentDocument` is the join that says a document belongs to a
     * resident. Nothing here reads the project's document library: a resident
     * sees what was attached to them, not what exists in their project.
     *
     * `isLatest` keeps superseded versions out — a resident should see the
     * current power of attorney, not the three drafts before it.
     */
    const rows = await this.prisma.residentDocument.findMany({
      where: {
        residentId: scope.residentId,
        document: { tenantId: scope.tenantId, isLatest: true },
      },
      select: {
        addedAt: true,
        document: {
          select: { id: true, title: true, category: true, fileName: true, mimeType: true, createdAt: true },
        },
      },
      orderBy: { addedAt: 'desc' },
      take: DOCUMENT_PREVIEW,
    })

    // Which of those this resident has actually signed. One query rather than
    // one per document.
    const signedIds = new Set(
      (
        await this.prisma.signatureRequest.findMany({
          where: {
            residentId: scope.residentId,
            tenantId: scope.tenantId,
            status: 'SIGNED',
            documentId: { in: rows.map((r) => r.document.id) },
          },
          select: { documentId: true },
        })
      ).map((r) => r.documentId),
    )

    return rows.map((r) => ({
      id: r.document.id,
      title: r.document.title,
      category: r.document.category,
      addedAt: r.addedAt,
      signed: signedIds.has(r.document.id),
    }))
  }

  // ── What the project has actually sent this resident ──────────────────────

  private async messages(scope: PortalScope) {
    const rows = await this.prisma.message.findMany({
      where: {
        residentId: scope.residentId,
        tenantId: scope.tenantId,
        direction: 'OUTBOUND',
        // Anything not yet handed to a provider has not reached them, and a
        // failed send certainly has not. Showing either would tell a resident
        // they were informed of something they never received.
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
      },
      select: { id: true, subject: true, body: true, channel: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_PREVIEW,
    })

    return rows.map((m) => ({
      id: m.id,
      title: m.subject ?? firstLine(m.body),
      preview: firstLine(m.body, 140),
      channel: m.channel,
      sentAt: m.createdAt,
    }))
  }

  // ── Meetings this resident is invited to ──────────────────────────────────

  private async meetings(scope: PortalScope, now: Date) {
    const rows = await this.prisma.meetingAttendee.findMany({
      where: {
        residentId: scope.residentId,
        meeting: {
          tenantId: scope.tenantId,
          startTime: { gte: now },
          status: { not: 'cancelled' },
        },
      },
      select: {
        rsvpStatus: true,
        meeting: {
          select: { id: true, title: true, startTime: true, location: true, isVirtual: true },
        },
      },
      orderBy: { meeting: { startTime: 'asc' } },
      take: MEETING_PREVIEW,
    })

    return rows.map((a) => ({
      id: a.meeting.id,
      title: a.meeting.title,
      startTime: a.meeting.startTime,
      location: a.meeting.location,
      isVirtual: a.meeting.isVirtual,
      rsvpStatus: a.rsvpStatus,
    }))
  }
}

/**
 * Marks each stage done / current / upcoming.
 *
 * History is authoritative where it exists: a stage with a recorded exit was
 * genuinely completed, whatever its position in the list. Where a project has
 * no history rows — which is most of them today — position relative to the
 * current stage is the only available answer, and it is the one a resident
 * would assume anyway.
 */
function buildStages(
  current: Stage,
  history: { stage: string; exitedAt: Date | null }[],
) {
  const completed = new Set(history.filter((h) => h.exitedAt).map((h) => h.stage))
  const currentIdx = STAGE_ORDER.indexOf(current)

  return STAGE_ORDER.map((stage, idx) => ({
    key: stage,
    label: STAGE_LABELS[stage],
    done: completed.has(stage) || (currentIdx >= 0 && idx < currentIdx),
    current: stage === current,
  }))
}

function progressOf(current: Stage): number {
  const idx = STAGE_ORDER.indexOf(current)
  if (idx < 0) return 0
  // The current stage counts as reached, not as finished.
  return Math.round(((idx + 1) / STAGE_ORDER.length) * 100)
}

/** A messaging body is one blob of text; the list needs a line. */
function firstLine(body: string, max = 80): string {
  const line = body.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}
