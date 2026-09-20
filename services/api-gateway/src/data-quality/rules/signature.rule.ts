import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { links } from '../data-quality.helpers'

const CLOSED_PACKAGE_STATUSES = new Set([
  'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED',
])

/** Integrity of the digital-signature chain: package → record → session. */
@Injectable()
export class SignatureDataQualityRule implements DataQualityRule {
  readonly id = 'signature'
  readonly title = 'שלמות תהליך החתימות'
  readonly category = 'INTEGRITY' as const
  readonly severity = 'CRITICAL' as const
  readonly issueTypes = [
    'SIGNATURE_ORPHAN_RECORD_OWNER',
    'SIGNATURE_ORPHAN_RECORD_APARTMENT',
    'SIGNATURE_RECORD_NO_SESSION',
    'SIGNATURE_SIGNED_WITHOUT_TIMESTAMP',
    'SIGNATURE_PACKAGE_NO_RECORDS',
    'SIGNATURE_PACKAGE_EXPIRED_NOT_CLOSED',
    'SIGNATURE_PACKAGE_ORPHAN_PROJECT',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, tenantId, index, now } = ctx
    const out: DetectedIssue[] = []

    const packages = await prisma.signaturePackage.findMany({
      where: {
        tenantId,
        ...(ctx.projectId ? { projectId: ctx.projectId } : {}),
      },
      select: { id: true, title: true, status: true, projectId: true, expiresAt: true },
    })
    if (packages.length === 0) return out
    const packageIds = packages.map(p => p.id)
    const packageMap = new Map(packages.map(p => [p.id, p]))

    const records = await prisma.signatureRecord.findMany({
      where: { tenantId, packageId: { in: packageIds } },
      select: {
        id: true, packageId: true, ownerId: true, apartmentId: true,
        status: true, signedAt: true,
        owner: { select: { id: true, fullName: true, tenantId: true } },
      },
    })

    const sessions = records.length
      ? await prisma.signingSession.findMany({
          where: { recordId: { in: records.map(r => r.id) } },
          select: { recordId: true },
        })
      : []
    const hasSession = new Set(sessions.map(s => s.recordId))

    const recordCountByPackage = new Map<string, number>()
    for (const r of records) {
      recordCountByPackage.set(r.packageId, (recordCountByPackage.get(r.packageId) ?? 0) + 1)
    }

    // ── Package-level ────────────────────────────────────────────────────────
    for (const pkg of packages) {
      const label = pkg.title
      const push = (
        issueType: string,
        severity: DetectedIssue['severity'],
        category: DetectedIssue['category'],
        title: string,
        description: string,
        impact: string,
        recommendation: string,
      ) =>
        out.push({
          issueType, category, severity,
          entityType: 'SIGNATURE_PACKAGE', entityId: pkg.id, entityLabel: label,
          projectId: pkg.projectId, title, description, impact, recommendation,
          deepLink: links.signaturePackage(pkg.id),
        })

      if (!index.projects.has(pkg.projectId)) {
        push('SIGNATURE_PACKAGE_ORPHAN_PROJECT', 'CRITICAL', 'INTEGRITY',
          'חבילת חתימה מפנה לפרויקט שאינו קיים',
          `חבילת החתימה "${label}" משויכת לפרויקט שאינו קיים בארגון.`,
          'הפניה שבורה או חוצת-ארגון — החבילה לא תופיע בדוחות ועלולה להעיד על דליפת נתונים.',
          'בדקו את שיוך החבילה ותקנו או בטלו אותה.')
      }

      if ((recordCountByPackage.get(pkg.id) ?? 0) === 0) {
        push('SIGNATURE_PACKAGE_NO_RECORDS', 'HIGH', 'INTEGRITY',
          'חבילת חתימה ללא חותמים',
          `לחבילת החתימה "${label}" לא משויכת אף רשומת חתימה.`,
          'חבילה ללא חותמים לא תתקדם לעולם ומנפחת את מדדי ההתקדמות.',
          'הוסיפו את החותמים הנדרשים או בטלו את החבילה.')
      }

      if (pkg.expiresAt && pkg.expiresAt < now && !CLOSED_PACKAGE_STATUSES.has(pkg.status)) {
        push('SIGNATURE_PACKAGE_EXPIRED_NOT_CLOSED', 'MEDIUM', 'TIMELINESS',
          'חבילת חתימה פגת תוקף שלא נסגרה',
          `תוקף החבילה "${label}" פג אך הסטטוס עדיין ${pkg.status}.`,
          'חבילה פגת תוקף שנשארת פתוחה מוצגת כממתינה ומסתירה את הצורך בשליחה מחדש.',
          'סמנו את החבילה כפג תוקף או הנפיקו חבילה חדשה.')
      }
    }

    // ── Record-level ─────────────────────────────────────────────────────────
    for (const rec of records) {
      const pkg = packageMap.get(rec.packageId)
      const label = `${rec.owner?.fullName ?? 'חותם לא ידוע'} — ${pkg?.title ?? rec.packageId}`
      const push = (
        issueType: string,
        severity: DetectedIssue['severity'],
        category: DetectedIssue['category'],
        title: string,
        description: string,
        impact: string,
        recommendation: string,
      ) =>
        out.push({
          issueType, category, severity,
          entityType: 'SIGNATURE_RECORD', entityId: rec.id, entityLabel: label,
          projectId: pkg?.projectId ?? null, title, description, impact, recommendation,
          deepLink: links.signatureRecord(rec.packageId, rec.id),
        })

      if (!rec.owner || rec.owner.tenantId !== tenantId) {
        push('SIGNATURE_ORPHAN_RECORD_OWNER', 'CRITICAL', 'INTEGRITY',
          'רשומת חתימה מפנה לבעלים שאינו קיים',
          'רשומת חתימה מפנה לבעלים שאינו קיים בארגון.',
          'חתימה ללא בעלים מזוהה חסרת תוקף משפטי ועלולה לפסול את חבילת החתימה כולה.',
          'אתרו את הבעלים הנכון ושייכו מחדש, או בטלו את הרשומה.')
      }

      if (!index.apartments.has(rec.apartmentId)) {
        push('SIGNATURE_ORPHAN_RECORD_APARTMENT', 'CRITICAL', 'INTEGRITY',
          'רשומת חתימה מפנה לדירה שאינה קיימת',
          `רשומת החתימה של ${rec.owner?.fullName ?? 'חותם'} מפנה לדירה שאינה נמצאת בפרויקטים של הארגון.`,
          'לא ניתן לשייך את החתימה ליחידה — היחידה לא תיספר בסף ההסכמה.',
          'תקנו את שיוך הדירה ברשומת החתימה.')
      }

      if (rec.status === 'SIGNED' && !rec.signedAt) {
        push('SIGNATURE_SIGNED_WITHOUT_TIMESTAMP', 'HIGH', 'CONSISTENCY',
          'חתימה ללא חותמת זמן',
          `רשומת חתימה מסומנת כ"נחתמה" אך אין לה תאריך חתימה.`,
          'חותמת זמן היא חלק מחבילת הראיות; חסרונה פוגע בקבילות החתימה.',
          'בדקו את יומן האירועים של החבילה והשלימו את חותמת הזמן.')
      }

      if (
        rec.status === 'PENDING' &&
        pkg?.status === 'SENT' &&
        !hasSession.has(rec.id)
      ) {
        push('SIGNATURE_RECORD_NO_SESSION', 'MEDIUM', 'INTEGRITY',
          'לא הונפק סשן חתימה',
          `החבילה נשלחה אך לא הונפק סשן חתימה עבור ${rec.owner?.fullName ?? 'החותם'}.`,
          'החותם לא קיבל קישור חתימה — התהליך תקוע ללא כל אינדיקציה בממשק.',
          'הנפיקו מחדש קישור חתימה לחותם.')
      }
    }

    return out
  }
}
