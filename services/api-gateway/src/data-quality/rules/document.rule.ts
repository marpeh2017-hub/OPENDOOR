import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { isBlank, links } from '../data-quality.helpers'

const STALE_REVIEW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** Document-store integrity. Storage keys are never echoed into issue text. */
@Injectable()
export class DocumentDataQualityRule implements DataQualityRule {
  readonly id = 'document'
  readonly title = 'איכות ניהול המסמכים'
  readonly category = 'INTEGRITY' as const
  readonly severity = 'CRITICAL' as const
  readonly issueTypes = [
    'DOCUMENT_MISSING_STORAGE_KEY',
    'DOCUMENT_ZERO_SIZE',
    'DOCUMENT_EXPIRED_NOT_ARCHIVED',
    'DOCUMENT_ORPHAN_PROJECT',
    'DOCUMENT_REVIEW_STALE',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, tenantId, index, now } = ctx
    const out: DetectedIssue[] = []

    const documents = await prisma.document.findMany({
      where: { tenantId, ...(ctx.projectId ? { projectId: ctx.projectId } : {}) },
      select: {
        id: true, title: true, projectId: true, status: true, category: true,
        fileSize: true, s3Key: true, s3Bucket: true, expiresAt: true, updatedAt: true,
      },
    })

    for (const d of documents) {
      const label = d.title
      const push = (
        issueType: string,
        severity: DetectedIssue['severity'],
        category: DetectedIssue['category'],
        title: string,
        description: string,
        impact: string,
        recommendation: string,
        metadata?: Record<string, unknown>,
      ) =>
        out.push({
          issueType, category, severity,
          entityType: 'DOCUMENT', entityId: d.id, entityLabel: label,
          projectId: d.projectId, title, description, impact, recommendation,
          deepLink: links.document(d.id), metadata,
        })

      // The key itself is intentionally omitted from the description.
      if (isBlank(d.s3Key) || isBlank(d.s3Bucket)) {
        push('DOCUMENT_MISSING_STORAGE_KEY', 'CRITICAL', 'INTEGRITY',
          'למסמך אין קובץ מאוחסן',
          `למסמך "${label}" חסר מיקום אחסון תקין.`,
          'המסמך לא ניתן להורדה — סיכון לאובדן ראיה משפטית או מסמך חתום.',
          'העלו מחדש את הקובץ או מחקו את הרשומה הריקה.')
      }

      if (d.fileSize <= 0) {
        push('DOCUMENT_ZERO_SIZE', 'HIGH', 'ACCURACY',
          'קובץ בגודל אפס',
          `למסמך "${label}" רשום גודל קובץ ${d.fileSize} בתים.`,
          'קובץ ריק מעיד על העלאה שנכשלה — המסמך למעשה אינו קיים.',
          'העלו מחדש את הקובץ.',
          { fileSize: d.fileSize })
      }

      if (d.projectId && !index.projects.has(d.projectId)) {
        push('DOCUMENT_ORPHAN_PROJECT', 'HIGH', 'INTEGRITY',
          'מסמך משויך לפרויקט שאינו קיים',
          `המסמך "${label}" משויך לפרויקט שאינו קיים בארגון.`,
          'המסמך לא יופיע בתיק הפרויקט ולא ייכלל בחבילות ראיות.',
          'שייכו את המסמך לפרויקט הנכון.')
      }

      if (d.expiresAt && d.expiresAt < now && d.status !== 'EXPIRED' && d.status !== 'ARCHIVED') {
        push('DOCUMENT_EXPIRED_NOT_ARCHIVED', 'MEDIUM', 'TIMELINESS',
          'מסמך פג תוקף שלא סומן ככזה',
          `תוקף המסמך "${label}" פג אך הסטטוס עדיין ${d.status}.`,
          'מסמך פג תוקף שמוצג כתקף עלול לשמש בטעות בהליך משפטי או מול הרשות.',
          'סמנו את המסמך כפג תוקף או העלו גרסה מעודכנת.')
      }

      if (
        d.status === 'PENDING_REVIEW' &&
        now.getTime() - d.updatedAt.getTime() > STALE_REVIEW_DAYS * DAY_MS
      ) {
        push('DOCUMENT_REVIEW_STALE', 'LOW', 'TIMELINESS',
          'מסמך ממתין לאישור מעל 30 יום',
          `המסמך "${label}" ממתין לאישור מעל ${STALE_REVIEW_DAYS} יום.`,
          'צוואר בקבוק בתהליך האישורים שמעכב את התקדמות הפרויקט.',
          'העבירו את המסמך לאישור או דחו אותו.')
      }
    }

    return out
  }
}
