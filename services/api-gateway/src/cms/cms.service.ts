import { Injectable } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'
/*
 * A VALUE import, not `import type`: `Prisma.DbNull` is a runtime sentinel and
 * is the only way to write SQL NULL into a Json column. Clearing
 * `verifiedValue` when a verified fact is edited needs exactly that, because
 * omitting the key on an update would leave the previous signature in place.
 */
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { DomainError } from '../common/errors/domain-error'
import type { AuditActor } from '../common/audit/audit.service'
import { toPublicProjection, findPrivateLeaks, type Json } from './cms.projection'
import {
  projectProjection, projectPublicationCheck,
  type DataQualityFlag, type ProjectDocument, type ProjectFact,
  type ProjectPublicationCheck, type VerificationStatus,
} from './project-document'

/** Mirrors `isPublishable`: only these two mean somebody stands behind it. */
function isPublishableStatus(s: VerificationStatus): boolean {
  return s === 'VERIFIED' || s === 'SELF_VERIFIED'
}

/**
 * A short, readable LABEL for a value, for the audit trail.
 *
 * Labels rather than values, because the trail has to be readable by somebody
 * who lacks permission to see every figure it mentions, and because a raw
 * object dumped into a log column is unreadable by everybody.
 */
function describeValue(v: unknown): string {
  if (v === null || v === undefined) return 'ריק'
  if (typeof v === 'boolean') return v ? 'כן' : 'לא'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v.length > 60 ? `${v.slice(0, 57)}...` : v
  if (typeof v === 'object' && 'he' in (v as Record<string, unknown>)) {
    const he = String((v as Record<string, unknown>)['he'] ?? '')
    return he.length > 60 ? `${he.slice(0, 57)}...` : he
  }
  return JSON.stringify(v).slice(0, 60)
}

/**
 * The Site Manager's domain service.
 *
 * ── TWO RULES, INHERITED FROM TenantScopeService AND NEVER BENT ────────────
 *
 *   1. Look the row up SCOPED, then mutate by id. Never mutate on a bare id.
 *   2. Another tenant's row is indistinguishable from a row that does not
 *      exist: both answer NOT_FOUND. Never 403, which would confirm the id is
 *      real somewhere else.
 *
 * `tenantId` always arrives from `AuditActor`, which is built from the verified
 * JWT by `actorFrom(req)`. No method here takes a tenant id from a DTO, so a
 * browser cannot nominate the tenant it would like to write to.
 *
 * ── DRAFT, REVISION, PUBLICATION ───────────────────────────────────────────
 *
 * Saving writes the draft AND appends a revision, in one transaction, so a
 * saved state that has no history entry cannot exist. Publishing projects the
 * draft through `toPublicProjection` and freezes the result. Restoring appends
 * a new revision rather than rewinding, so history only ever grows.
 */
@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════════════
  //  READ
  // ══════════════════════════════════════════════════════════════════════

  async list(tenantId: string, filter: { kind?: string; state?: string } = {}) {
    return this.prisma.cmsContent.findMany({
      where: {
        tenantId,
        ...(filter.kind ? { kind: filter.kind as never } : {}),
        ...(filter.state ? { state: filter.state as never } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, kind: true, slug: true, state: true, exposure: true,
        updatedAt: true, firstPublishedAt: true, livePublicationId: true,
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }

  /** Scoped lookup used by every mutation. 404 across tenants. */
  private async mustFind(tenantId: string, id: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).cmsContent.findFirst({
      where: { id, tenantId },
    })
    if (!row) throw DomainError.notFound('CMS_CONTENT_NOT_FOUND', `הפריט ${id} לא נמצא`)
    return row
  }

  async findOne(tenantId: string, id: string) {
    const row = await this.mustFind(tenantId, id)
    const verifications = await this.prisma.cmsVerification.findMany({
      where: { tenantId, contentId: id },
      select: { field: true, status: true, verifiedAt: true, source: true, sourceReference: true },
    })
    return { ...row, verifications }
  }

  async findBySlug(tenantId: string, kind: string, slug: string) {
    const row = await this.prisma.cmsContent.findFirst({
      where: { tenantId, kind: kind as never, slug },
    })
    if (!row) throw DomainError.notFound('CMS_CONTENT_NOT_FOUND', `הפריט ${slug} לא נמצא`)
    return row
  }

  async revisions(tenantId: string, id: string) {
    await this.mustFind(tenantId, id)
    return this.prisma.cmsRevision.findMany({
      where: { tenantId, contentId: id },
      orderBy: { sequence: 'desc' },
      select: {
        id: true, sequence: true, reason: true, stateAtRevision: true,
        createdAt: true, summary: true, restoredFromRevisionId: true,
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }

  async revision(tenantId: string, id: string, revisionId: string) {
    await this.mustFind(tenantId, id)
    const rev = await this.prisma.cmsRevision.findFirst({
      where: { id: revisionId, tenantId, contentId: id },
    })
    if (!rev) throw DomainError.notFound('CMS_REVISION_NOT_FOUND', `הגרסה ${revisionId} לא נמצאה`)
    return rev
  }

  // ══════════════════════════════════════════════════════════════════════
  //  WRITE
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Save the draft and append a revision, atomically.
   *
   * `expectedRevisionId` is optional optimistic concurrency: when the editor
   * sends the revision it loaded and that is no longer the current one, the
   * save is refused rather than silently overwriting a colleague. Optional
   * because the first editor screen has one user, and a required field here
   * would be one more thing to get wrong before there is anything to protect.
   */
  async save(
    actor: AuditActor,
    id: string,
    input: { draft: unknown; seo?: unknown; summary?: string; expectedRevisionId?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const content = await this.mustFind(actor.tenantId, id, tx)

      if (
        input.expectedRevisionId &&
        content.currentRevisionId &&
        input.expectedRevisionId !== content.currentRevisionId
      ) {
        throw DomainError.conflict(
          'CMS_REVISION_STALE',
          'הפריט נערך על ידי מישהו אחר מאז שנטען. רענן את העמוד כדי לראות את הגרסה העדכנית.',
        )
      }

      const last = await tx.cmsRevision.findFirst({
        where: { contentId: id },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      })

      const revision = await tx.cmsRevision.create({
        data: {
          tenantId: actor.tenantId,
          contentId: id,
          sequence: (last?.sequence ?? 0) + 1,
          reason: 'SAVE',
          snapshot: input.draft as Prisma.InputJsonValue,
          seo: (input.seo ?? content.seo ?? undefined) as Prisma.InputJsonValue,
          stateAtRevision: content.state,
          authorId: actor.userId,
          ...(input.summary ? { summary: input.summary } : {}),
        },
      })

      return tx.cmsContent.update({
        where: { id },
        data: {
          draft: input.draft as Prisma.InputJsonValue,
          ...(input.seo !== undefined ? { seo: input.seo as Prisma.InputJsonValue } : {}),
          currentRevisionId: revision.id,
          updatedById: actor.userId,
        },
      })
    })
  }

  /**
   * Move between DRAFT and IN_REVIEW.
   *
   * PUBLISHED and ARCHIVED are not reachable from here: publishing has its own
   * capability and its own method, and letting a state field be set directly
   * would route around it.
   */
  async setState(actor: AuditActor, id: string, state: 'DRAFT' | 'IN_REVIEW') {
    const content = await this.mustFind(actor.tenantId, id)
    if (content.state === 'ARCHIVED') {
      throw DomainError.conflict('CMS_ARCHIVED', 'פריט בארכיון. יש לשחזר אותו לפני עריכה.')
    }
    return this.prisma.cmsContent.update({
      where: { id },
      data: { state, updatedById: actor.userId },
    })
  }

  /**
   * Append a revision inside an existing transaction.
   *
   * Extracted because save, publish, unpublish, restore, setFact and verifyFact
   * all do it, and a path that changed the draft WITHOUT appending one would
   * produce a saved state with no history entry. Having one implementation is
   * what makes "history is complete" a property of the code rather than a
   * convention six call sites happen to follow.
   */
  private async appendRevision(
    tx: Prisma.TransactionClient,
    actor: AuditActor,
    content: { id: string; state: string; seo: unknown },
    draft: unknown,
    reason: 'SAVE' | 'PUBLISH' | 'UNPUBLISH' | 'RESTORE',
    summary?: string,
  ) {
    const last = await tx.cmsRevision.findFirst({
      where: { contentId: content.id },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    })
    return tx.cmsRevision.create({
      data: {
        tenantId: actor.tenantId,
        contentId: content.id,
        sequence: (last?.sequence ?? 0) + 1,
        reason,
        snapshot: draft as Prisma.InputJsonValue,
        seo: (content.seo ?? undefined) as Prisma.InputJsonValue,
        stateAtRevision: content.state as never,
        authorId: actor.userId,
        ...(summary ? { summary } : {}),
      },
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PROJECTION, IN ONE PLACE
  // ══════════════════════════════════════════════════════════════════════

  /**
   * How a draft becomes a public payload, chosen by kind.
   *
   * PROJECT uses the ALLOWLIST in `project-document.ts`, which names every
   * field that may travel and never reads `internal` or `feasibility`.
   * Everything else uses the block-tree rebuild from Pass 4B.
   *
   * Every caller goes through here — publish, preview and the check — so the
   * three can never disagree about what publishing would produce. A preview
   * that used a different projection from publish would be worse than no
   * preview: it would show a reviewer a page nobody is going to get.
   */
  private projectionFor(
    kind: string,
    draft: unknown,
    verificationStatuses: Record<string, string>,
  ): Json {
    if (kind === 'PROJECT') {
      return projectProjection(draft as ProjectDocument) as unknown as Json
    }
    return toPublicProjection(draft, { verification: verificationStatuses })
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PUBLICATION CHECK
  // ══════════════════════════════════════════════════════════════════════

  /**
   * What must be true before this may go live, and what merely ought to be.
   *
   * BLOCKERS disable the publish button and are re-checked server-side, because
   * a disabled button is a courtesy and not a control. WARNINGS never block:
   * a check that stops publication for a missing English translation would
   * teach people to bypass the check, and the localisation policy already says
   * English never blocks Hebrew.
   */
  async publicationCheck(tenantId: string, id: string) {
    const content = await this.mustFind(tenantId, id)

    /*
     * Projects answer a different question, so they get a different check.
     *
     * A page's check asks "is anything broken". A project's has to also
     * answer "what exactly is about to become public, and what stays
     * private" — because the person clicking Publish is holding a document
     * that contains a candidate boundary and a feasibility scenario, and
     * "trust me, those are filtered" is not something a UI should ask anyone
     * to take on faith. `projectPublicationCheck` returns both columns.
     */
    if (content.kind === 'PROJECT') {
      return projectPublicationCheck(content.draft as unknown as ProjectDocument, {
        exposure: content.exposure,
      })
    }
    const [verifications, media] = await Promise.all([
      this.prisma.cmsVerification.findMany({ where: { tenantId, contentId: id } }),
      this.prisma.cmsMediaReference.findMany({ where: { tenantId, contentId: id } }),
    ])

    const blockers: { code: string; message: string }[] = []
    const warnings: { code: string; message: string }[] = []

    if (content.exposure !== 'PUBLIC') {
      blockers.push({
        code: 'NOT_PUBLIC_EXPOSURE',
        message: 'הפריט מסומן כפנימי ואינו יכול להתפרסם.',
      })
    }

    for (const v of verifications) {
      if (v.status === 'UNVERIFIED') {
        warnings.push({
          code: 'UNVERIFIED_FACT',
          message: `הנתון "${v.field}" אינו מאומת ולא יופיע באתר.`,
        })
      }
      if (v.status === 'SECOND_REVIEW_REQUIRED') {
        blockers.push({
          code: 'SECOND_REVIEW_REQUIRED',
          message: `הנתון "${v.field}" ממתין לבדיקה נוספת.`,
        })
      }
    }

    for (const m of media) {
      const alt = m.alt as { he?: string } | null
      if (!alt || !alt.he) {
        blockers.push({
          code: 'MEDIA_MISSING_ALT',
          message: `לתמונה "${m.filename}" אין טקסט חלופי בעברית.`,
        })
      }
    }

    // The projection is computed here too, so the check answers the question
    // that actually matters: would publishing leak anything?
    const statuses = Object.fromEntries(verifications.map((v) => [v.field, v.status]))
    const projected = this.projectionFor(content.kind, content.draft, statuses)
    const leaks = findPrivateLeaks(projected)
    for (const path of leaks) {
      blockers.push({
        code: 'PRIVATE_FIELD_IN_PROJECTION',
        message: `שדה פנימי הגיע להקרנה הציבורית: ${path}`,
      })
    }

    return { canPublish: blockers.length === 0, blockers, warnings }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PUBLISH / UNPUBLISH / RESTORE
  // ══════════════════════════════════════════════════════════════════════

  async publish(actor: AuditActor, id: string) {
    const check = await this.publicationCheck(actor.tenantId, id)
    if (!check.canPublish) {
      throw new DomainError('VALIDATION', check.blockers)
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const content = await this.mustFind(actor.tenantId, id, tx)

      const verifications = await tx.cmsVerification.findMany({
        where: { tenantId: actor.tenantId, contentId: id },
        select: { field: true, status: true },
      })
      const statuses = Object.fromEntries(verifications.map((v) => [v.field, v.status]))
      const snapshot = this.projectionFor(content.kind, content.draft, statuses)

      // Last gate. The check above ran outside this transaction; re-running the
      // assertion on the exact bytes about to be frozen costs nothing and means
      // no path reaches `cms_publications` without passing it.
      const leaks = findPrivateLeaks(snapshot)
      if (leaks.length > 0) {
        throw DomainError.validation(
          'PRIVATE_FIELD_IN_PROJECTION',
          `שדה פנימי הגיע להקרנה הציבורית: ${leaks.join(', ')}`,
        )
      }

      const last = await tx.cmsRevision.findFirst({
        where: { contentId: id },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      })
      const revision = await tx.cmsRevision.create({
        data: {
          tenantId: actor.tenantId,
          contentId: id,
          sequence: (last?.sequence ?? 0) + 1,
          reason: 'PUBLISH',
          snapshot: content.draft as Prisma.InputJsonValue,
          seo: (content.seo ?? undefined) as Prisma.InputJsonValue,
          stateAtRevision: 'PUBLISHED',
          authorId: actor.userId,
        },
      })

      const publication = await tx.cmsPublication.create({
        data: {
          tenantId: actor.tenantId,
          contentId: id,
          revisionId: revision.id,
          snapshot: snapshot as Prisma.InputJsonValue,
          seo: (content.seo ?? undefined) as Prisma.InputJsonValue,
          publishedById: actor.userId,
        },
      })

      return tx.cmsContent.update({
        where: { id },
        data: {
          state: 'PUBLISHED',
          currentRevisionId: revision.id,
          livePublicationId: publication.id,
          updatedById: actor.userId,
          ...(content.firstPublishedAt ? {} : { firstPublishedAt: new Date() }),
        },
      })
    })

    // After the transaction, deliberately: revalidating a publication that
    // then rolled back would show the public a page that does not exist.
    await this.revalidateWebsite(result.slug)
    return result
  }

  /**
   * Take content off the website.
   *
   * The publication row is NOT deleted or edited: it is stamped
   * `unpublishedAt` and unlinked. "What did the site say on the day the
   * resident signed" must stay answerable after somebody withdraws the page.
   */
  async unpublish(actor: AuditActor, id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const content = await this.mustFind(actor.tenantId, id, tx)
      if (!content.livePublicationId) {
        throw DomainError.conflict('CMS_NOT_PUBLISHED', 'הפריט אינו מפורסם.')
      }

      await tx.cmsPublication.update({
        where: { id: content.livePublicationId },
        data: { unpublishedAt: new Date() },
      })

      const last = await tx.cmsRevision.findFirst({
        where: { contentId: id },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      })
      await tx.cmsRevision.create({
        data: {
          tenantId: actor.tenantId,
          contentId: id,
          sequence: (last?.sequence ?? 0) + 1,
          reason: 'UNPUBLISH',
          snapshot: content.draft as Prisma.InputJsonValue,
          stateAtRevision: 'DRAFT',
          authorId: actor.userId,
        },
      })

      return tx.cmsContent.update({
        where: { id },
        data: { state: 'DRAFT', livePublicationId: null, updatedById: actor.userId },
      })
    })

    await this.revalidateWebsite(result.slug)
    return result
  }

  /**
   * Restore a previous revision.
   *
   * Writes a NEW revision whose snapshot equals the old one and whose
   * `restoredFromRevisionId` records where it came from. History is appended
   * to, never rewound — what the page said last Tuesday stays true even after
   * somebody undoes it.
   *
   * Restoring does NOT publish. The restored content becomes the draft; making
   * it live is a separate, separately-permissioned act.
   */
  async restore(actor: AuditActor, id: string, revisionId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.mustFind(actor.tenantId, id, tx)

      const source = await tx.cmsRevision.findFirst({
        where: { id: revisionId, tenantId: actor.tenantId, contentId: id },
      })
      if (!source) {
        throw DomainError.notFound('CMS_REVISION_NOT_FOUND', `הגרסה ${revisionId} לא נמצאה`)
      }

      const last = await tx.cmsRevision.findFirst({
        where: { contentId: id },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      })

      const revision = await tx.cmsRevision.create({
        data: {
          tenantId: actor.tenantId,
          contentId: id,
          sequence: (last?.sequence ?? 0) + 1,
          reason: 'RESTORE',
          snapshot: source.snapshot as Prisma.InputJsonValue,
          seo: (source.seo ?? undefined) as Prisma.InputJsonValue,
          stateAtRevision: 'DRAFT',
          authorId: actor.userId,
          restoredFromRevisionId: source.id,
          summary: `שחזור מגרסה ${source.sequence}`,
        },
      })

      return tx.cmsContent.update({
        where: { id },
        data: {
          draft: source.snapshot as Prisma.InputJsonValue,
          ...(source.seo === null ? {} : { seo: source.seo as Prisma.InputJsonValue }),
          currentRevisionId: revision.id,
          updatedById: actor.userId,
        },
      })
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  //  VERIFICATION
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Where a fact lives inside a project document.
   *
   * `public.currentStage` is a fact in its own right; `public.facts.<key>` are
   * the rest; `milestones.<id>` carries one too. Parsing the path in one place
   * means the editor, the audit trail and the projection all agree about what
   * "the unitCount fact" refers to.
   */
  private locateFact(doc: ProjectDocument, field: string): ProjectFact | undefined {
    if (field === 'public.currentStage') return doc.public?.currentStage as ProjectFact | undefined
    if (field.startsWith('public.facts.')) return doc.public?.facts?.[field.slice(13)]
    if (field.startsWith('milestones.')) {
      return doc.milestones?.find((m) => m.id === field.slice(11))?.fact as ProjectFact | undefined
    }
    return undefined
  }

  private writeFact(doc: ProjectDocument, field: string, fact: ProjectFact): void {
    if (field === 'public.currentStage') {
      doc.public.currentStage = fact as ProjectFact<string>
      return
    }
    if (field.startsWith('public.facts.')) {
      doc.public.facts ??= {}
      doc.public.facts[field.slice(13)] = fact
      return
    }
    if (field.startsWith('milestones.')) {
      const m = doc.milestones?.find((x) => x.id === field.slice(11))
      if (m) m.fact = fact as ProjectFact<boolean>
      return
    }
    throw DomainError.validation('CMS_UNKNOWN_FACT_PATH', `נתיב נתון לא מוכר: ${field}`)
  }

  /**
   * Is this fact blocked from verification by an unresolved data-quality flag?
   *
   * A blocking flag stops the facts it NAMES, and only those. The workbook's
   * address discrepancy has nothing to do with whether OpenDoor organises the
   * complex, so a flag about one must not freeze the other — that is how a
   * quality system stops being used.
   */
  private blockingFlagsFor(doc: ProjectDocument, field: string): DataQualityFlag[] {
    return (doc.internal?.dataQualityFlags ?? []).filter(
      (f) => !f.resolved && f.severity === 'BLOCKING' && (f.blocks ?? []).includes(field),
    )
  }

  /** Keep the queryable index in step with the document, inside the same tx. */
  private async syncVerificationRow(
    tx: Prisma.TransactionClient,
    tenantId: string,
    contentId: string,
    field: string,
    fact: ProjectFact,
  ): Promise<string> {
    const data = {
      tenantId,
      contentId,
      field,
      value: (fact.value ?? null) as Prisma.InputJsonValue,
      verifiedValue: (fact.verifiedValue ?? Prisma.DbNull) as Prisma.InputJsonValue,
      status: fact.status,
      editedById: fact.editedByUserId ?? '',
      ...(fact.editedAt ? { editedAt: new Date(fact.editedAt) } : {}),
      ...(fact.verifiedByUserId ? { verifiedById: fact.verifiedByUserId } : { verifiedById: null }),
      ...(fact.verifiedAt ? { verifiedAt: new Date(fact.verifiedAt) } : { verifiedAt: null }),
      ...(fact.sourceId ? { source: fact.sourceId } : { source: null }),
      ...(fact.sourceReference ? { sourceReference: fact.sourceReference } : { sourceReference: null }),
    }
    const row = await tx.cmsVerification.upsert({
      where: { contentId_field: { contentId, field } },
      create: data as never,
      update: data as never,
    })
    return row.id
  }

  /**
   * Change a material fact's value.
   *
   * Editing a verified value INVALIDATES it, and does so by arithmetic rather
   * than by intention: `verifiedValue` keeps what was signed for, so the moment
   * `value` differs, nothing stands behind the field and the projection drops
   * it. Nobody has to remember to clear a flag, which is the failure mode a
   * boolean `isVerified` has.
   *
   * The previous verification is NOT erased. It stays in `cms_verification_audit`
   * as an INVALIDATED entry naming what changed, so "this was verified last
   * March and then edited" remains answerable.
   */
  async setFact(
    actor: AuditActor,
    id: string,
    field: string,
    input: { value: unknown; sourceId?: string; sourceReference?: string; note?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const content = await this.mustFind(actor.tenantId, id, tx)
      if (content.kind !== 'PROJECT') {
        throw DomainError.validation('CMS_NOT_A_PROJECT', 'אימות נתונים זמין לפרויקטים בלבד.')
      }

      const doc = JSON.parse(JSON.stringify(content.draft)) as ProjectDocument
      const before = this.locateFact(doc, field)
      const wasVerified = before ? isPublishableStatus(before.status) : false

      const next: ProjectFact = {
        ...(before ?? {}),
        value: input.value,
        editedByUserId: actor.userId,
        editedAt: new Date().toISOString(),
        ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
        ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference } : {}),
        status: 'UNVERIFIED',
      }

      // Unchanged value: the existing signature still covers it.
      const unchanged =
        before?.verifiedValue !== undefined &&
        JSON.stringify(before.verifiedValue) === JSON.stringify(input.value)
      if (unchanged && before) {
        next.status = before.status
        next.verifiedValue = before.verifiedValue
        if (before.verifiedByUserId) next.verifiedByUserId = before.verifiedByUserId
        if (before.verifiedAt) next.verifiedAt = before.verifiedAt
      } else {
        delete next.verifiedValue
        delete next.verifiedByUserId
        delete next.verifiedAt
      }

      this.writeFact(doc, field, next)
      const verificationId = await this.syncVerificationRow(tx, actor.tenantId, id, field, next)

      await tx.cmsVerificationAudit.create({
        data: {
          tenantId: actor.tenantId, contentId: id, verificationId, field,
          event: wasVerified && !unchanged ? 'INVALIDATED' : 'EDITED',
          status: next.status, actorId: actor.userId,
          ...(before !== undefined ? { previousValueLabel: describeValue(before.value) } : {}),
          newValueLabel: describeValue(input.value),
          ...(input.note ? { note: input.note } : {}),
        },
      })

      await this.appendRevision(tx, actor, content, doc, 'SAVE', `עריכת נתון: ${field}`)
      return tx.cmsContent.update({
        where: { id },
        data: { draft: doc as never, updatedById: actor.userId },
      })
    })
  }

  /**
   * Sign for a fact.
   *
   * ── SELF-VERIFICATION IS ALLOWED, AND SAID SO OUT LOUD ────────────────────
   *
   * A promoter this size does not have two people for every figure, and a rule
   * that cannot be followed gets worked around rather than obeyed. So the same
   * person may verify what they edited — recorded as SELF_VERIFIED, never as
   * VERIFIED. What the record must never do is claim independent review that
   * did not happen.
   *
   * `requiresSecondReview` exists for fields that later need four eyes; nothing
   * uses it yet, and the status it produces is not publishable.
   */
  async verifyFact(
    actor: AuditActor,
    id: string,
    field: string,
    input: { sourceId?: string; sourceReference?: string; note?: string; requiresSecondReview?: boolean },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const content = await this.mustFind(actor.tenantId, id, tx)
      if (content.kind !== 'PROJECT') {
        throw DomainError.validation('CMS_NOT_A_PROJECT', 'אימות נתונים זמין לפרויקטים בלבד.')
      }

      const doc = JSON.parse(JSON.stringify(content.draft)) as ProjectDocument
      const fact = this.locateFact(doc, field)
      if (!fact) {
        throw DomainError.notFound('CMS_FACT_NOT_FOUND', `הנתון ${field} לא נמצא בפרויקט.`)
      }

      // A blocking data-quality flag stops verification at the source, rather
      // than letting a fact be signed and then refused at publication — which
      // would waste the signature and teach people the check is noise.
      const blocking = this.blockingFlagsFor(doc, field)
      if (blocking.length > 0) {
        throw DomainError.conflict(
          'CMS_FACT_BLOCKED',
          `לא ניתן לאמת את הנתון בגלל בעיות איכות נתונים: ${blocking.map((b) => b.label).join(', ')}`,
        )
      }

      const selfVerifying = fact.editedByUserId === actor.userId
      const status: VerificationStatus = input.requiresSecondReview
        ? 'SECOND_REVIEW_REQUIRED'
        : selfVerifying
          ? 'SELF_VERIFIED'
          : 'VERIFIED'

      const next: ProjectFact = {
        ...fact,
        verifiedValue: fact.value,
        status,
        verifiedByUserId: actor.userId,
        verifiedAt: new Date().toISOString(),
        ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
        ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference } : {}),
      }

      this.writeFact(doc, field, next)
      const verificationId = await this.syncVerificationRow(tx, actor.tenantId, id, field, next)

      await tx.cmsVerificationAudit.create({
        data: {
          tenantId: actor.tenantId, contentId: id, verificationId, field,
          event: input.requiresSecondReview ? 'REVIEW_REQUESTED' : 'VERIFIED',
          status, actorId: actor.userId,
          newValueLabel: describeValue(fact.value),
          ...(input.sourceId ? { source: input.sourceId } : {}),
          ...(input.sourceReference ? { sourceReference: input.sourceReference } : {}),
          ...(input.note ? { note: input.note } : {}),
        },
      })

      await this.appendRevision(tx, actor, content, doc, 'SAVE', `אימות נתון: ${field}`)
      return tx.cmsContent.update({
        where: { id },
        data: { draft: doc as never, updatedById: actor.userId },
      })
    })
  }

  /**
   * The audit trail for one fact, or for the whole project.
   *
   * Append-only and never rewritten, so restoring an old revision does not
   * rewrite who verified what. Values appear as LABELS, so the trail can be
   * read by somebody without permission to see every figure it mentions.
   */
  async factHistory(tenantId: string, id: string, field?: string) {
    await this.mustFind(tenantId, id)
    return this.prisma.cmsVerificationAudit.findMany({
      where: { tenantId, contentId: id, ...(field ? { field } : {}) },
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true, field: true, event: true, status: true, occurredAt: true,
        previousValueLabel: true, newValueLabel: true, source: true,
        sourceReference: true, note: true,
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  //  CACHE INVALIDATION
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Tell the website that one page changed.
   *
   * ── WHY THIS NEVER THROWS ──────────────────────────────────────────────
   *
   * The publication is already committed by the time this runs. If the website
   * is unreachable, mid-deploy, or has no secret configured, the correct
   * outcome is a page that refreshes on its next revalidation window rather
   * than a publish that reports failure for work that actually succeeded — and
   * that an editor would then try again, producing a second publication row
   * for one editorial act.
   *
   * So this is best-effort by design, and its failure is logged rather than
   * raised. Staleness is self-correcting; a lie about whether publishing
   * worked is not.
   */
  private async revalidateWebsite(slug: string): Promise<void> {
    const base = process.env['WEBSITE_URL']
    const secret = process.env['CMS_REVALIDATE_SECRET']
    if (!base || !secret) return

    try {
      const res = await fetch(`${base.replace(/\/+$/, '')}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ slug }),
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) {
        console.warn(`[cms] revalidation for "${slug}" answered ${res.status}`)
      }
    } catch (e) {
      console.warn(`[cms] revalidation for "${slug}" failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PREVIEW TOKENS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * A short-lived, signed capability to view ONE unpublished item.
   *
   * HMAC over `contentId.tenantId.expiry` with the server's JWT secret. Not a
   * JWT: this is not a session, carries no identity, and must not be accepted
   * anywhere a session is. Whoever holds the link can read one draft until it
   * expires, which is exactly what "send the draft to a colleague" needs and
   * no more.
   *
   * The preview response is served `noindex`, because an indexed preview URL
   * would outlive the token in Google's cache.
   */
  private previewSecret(): string {
    const s = process.env['JWT_SECRET']
    if (!s) throw new Error('JWT_SECRET is required to sign preview links')
    return s
  }

  createPreviewToken(tenantId: string, contentId: string, ttlSeconds = 3600): string {
    const expiresAt = Date.now() + ttlSeconds * 1000
    const payload = `${contentId}.${tenantId}.${expiresAt}`
    const sig = createHmac('sha256', this.previewSecret()).update(payload).digest('hex')
    return Buffer.from(`${payload}.${sig}`).toString('base64url')
  }

  /** Returns the draft, or throws. Never reveals why a bad token was bad. */
  async resolvePreview(token: string) {
    const fail = () =>
      DomainError.notFound('CMS_PREVIEW_INVALID', 'קישור התצוגה המקדימה אינו תקף או שפג תוקפו.')

    let decoded: string
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8')
    } catch {
      throw fail()
    }

    const parts = decoded.split('.')
    if (parts.length !== 4) throw fail()
    const [contentId, tenantId, expiresRaw, sig] = parts as [string, string, string, string]

    const expected = createHmac('sha256', this.previewSecret())
      .update(`${contentId}.${tenantId}.${expiresRaw}`)
      .digest('hex')

    // Constant-time, and length-checked first because timingSafeEqual throws on
    // a length mismatch and that throw would itself be a timing signal.
    const a = Buffer.from(sig, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw fail()

    const expiresAt = Number(expiresRaw)
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) throw fail()

    // Scoped by the tenant named IN THE SIGNATURE, not by anything the caller
    // supplied alongside it.
    const content = await this.prisma.cmsContent.findFirst({
      where: { id: contentId, tenantId },
      select: { id: true, kind: true, slug: true, state: true, draft: true, seo: true, updatedAt: true },
    })
    if (!content) throw fail()

    const verifications = await this.prisma.cmsVerification.findMany({
      where: { tenantId, contentId },
      select: { field: true, status: true },
    })
    const statuses = Object.fromEntries(verifications.map((v) => [v.field, v.status]))

    return {
      ...content,
      // Previews show what publishing WOULD produce, not the raw draft: the
      // point of a preview is to answer "is this what the public will see".
      projection: this.projectionFor(content.kind, content.draft, statuses),
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PUBLIC READ (the website)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * What the website is served: the frozen projection of the live publication.
   *
   * Reads `livePublication`, never `draft`. An unpublished edit therefore
   * cannot reach the public through this method by any argument the caller can
   * supply — there is no parameter that selects the draft.
   */
  /**
   * Tenant slug to id, for the public website route.
   *
   * Public content only ever reached through this: the slug selects among
   * PUBLISHED rows, so it is a routing key rather than an authorisation one.
   * Returns null rather than throwing, so a wrong slug and an unpublished page
   * are indistinguishable from outside.
   */
  async resolveTenantIdBySlug(slug: string): Promise<string | null> {
    const t = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    })
    return t && t.isActive ? t.id : null
  }

  async publicBySlug(tenantId: string, kind: string, slug: string) {
    const content = await this.prisma.cmsContent.findFirst({
      where: { tenantId, kind: kind as never, slug, state: 'PUBLISHED' },
      select: {
        slug: true, kind: true, firstPublishedAt: true,
        livePublication: {
          select: { id: true, snapshot: true, seo: true, publishedAt: true, unpublishedAt: true },
        },
      },
    })
    if (!content?.livePublication || content.livePublication.unpublishedAt) return null
    return {
      slug: content.slug,
      kind: content.kind,
      publishedAt: content.livePublication.publishedAt,
      content: content.livePublication.snapshot as Json,
      seo: content.livePublication.seo as Json,
    }
  }

  async publicList(tenantId: string, kind: string) {
    const rows = await this.prisma.cmsContent.findMany({
      where: { tenantId, kind: kind as never, state: 'PUBLISHED' },
      select: {
        slug: true,
        livePublication: { select: { snapshot: true, publishedAt: true, unpublishedAt: true } },
      },
    })
    return rows
      .filter((r) => r.livePublication && !r.livePublication.unpublishedAt)
      .map((r) => ({
        slug: r.slug,
        publishedAt: r.livePublication!.publishedAt,
        content: r.livePublication!.snapshot as Json,
      }))
  }
}
