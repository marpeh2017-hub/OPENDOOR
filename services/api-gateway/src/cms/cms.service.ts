import { Injectable } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { DomainError } from '../common/errors/domain-error'
import type { AuditActor } from '../common/audit/audit.service'
import { toPublicProjection, findPrivateLeaks, type Json } from './cms.projection'

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
    const projected = toPublicProjection(content.draft, { verification: statuses })
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
      const snapshot = toPublicProjection(content.draft, { verification: statuses })

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
      projection: toPublicProjection(content.draft, { verification: statuses }) as Json,
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
