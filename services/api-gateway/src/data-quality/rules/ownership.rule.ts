import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { links, sumFractions } from '../data-quality.helpers'

/**
 * Integrity of the ownership registry (OwnerApartment).
 * Signature thresholds are computed over ownership SHARES, so a fraction that
 * does not sum to exactly 1 invalidates the majority calculation.
 */
@Injectable()
export class OwnershipDataQualityRule implements DataQualityRule {
  readonly id = 'ownership'
  readonly title = 'שלמות רישום הבעלות'
  readonly category = 'CONSISTENCY' as const
  readonly severity = 'CRITICAL' as const
  readonly issueTypes = [
    'OWNERSHIP_SHARE_SUM_INVALID',
    'OWNERSHIP_INVALID_FRACTION',
    'OWNERSHIP_ORPHAN_APARTMENT',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, tenantId, index } = ctx
    const out: DetectedIssue[] = []

    const holdings = await prisma.ownerApartment.findMany({
      where: {
        owner: { tenantId },
        ...(ctx.projectId ? { apartmentId: { in: index.apartmentIds } } : {}),
      },
      select: {
        id: true, ownerId: true, apartmentId: true,
        shareNumerator: true, shareDenominator: true,
        owner: { select: { fullName: true } },
      },
    })

    const byApartment = new Map<string, typeof holdings>()
    for (const h of holdings) {
      const arr = byApartment.get(h.apartmentId) ?? []
      arr.push(h)
      byApartment.set(h.apartmentId, arr)

      // ── Malformed individual fraction ──────────────────────────────────────
      const bad =
        h.shareDenominator <= 0 ||
        h.shareNumerator <= 0 ||
        h.shareNumerator > h.shareDenominator
      if (bad) {
        const apt = index.apartments.get(h.apartmentId)
        out.push({
          issueType: 'OWNERSHIP_INVALID_FRACTION',
          category: 'ACCURACY',
          severity: 'CRITICAL',
          entityType: 'OWNER_APARTMENT',
          entityId: h.id,
          entityLabel: `${h.owner.fullName} — ${apt?.label ?? h.apartmentId}`,
          projectId: apt?.projectId ?? null,
          title: 'חלק בעלות לא חוקי',
          description: `חלק הבעלות הרשום הוא ${h.shareNumerator}/${h.shareDenominator} — ערך שאינו שבר חוקי בין 0 ל-1.`,
          impact: 'חישוב אחוז החתימות מסתמך על חלקי הבעלות; שבר לא חוקי מייצר סף חתימות שגוי.',
          recommendation: 'תקנו את המונה/המכנה בהתאם לנסח הטאבו.',
          deepLink: links.apartment(apt?.projectId ?? null, h.apartmentId),
          metadata: { shareNumerator: h.shareNumerator, shareDenominator: h.shareDenominator },
        })
      }

      // ── Holding pointing outside the tenant's own project tree ─────────────
      if (!index.apartments.has(h.apartmentId) && !ctx.projectId) {
        out.push({
          issueType: 'OWNERSHIP_ORPHAN_APARTMENT',
          category: 'INTEGRITY',
          severity: 'CRITICAL',
          entityType: 'OWNER_APARTMENT',
          entityId: h.id,
          entityLabel: h.owner.fullName,
          projectId: null,
          title: 'אחזקה מפנה לדירה שאינה בפרויקטים של הארגון',
          description: `רשומת בעלות של ${h.owner.fullName} מפנה לדירה שאינה נמצאת באף פרויקט של הארגון.`,
          impact: 'הפניה חוצת-ארגון או שארית מייבוא כושל — מקור לדליפת נתונים ולחישובים שגויים.',
          recommendation: 'בדקו את מקור הייבוא והסירו את האחזקה השגויה.',
          deepLink: links.owner(h.ownerId),
        })
      }
    }

    // ── Share sum per apartment ────────────────────────────────────────────
    for (const [apartmentId, parts] of byApartment) {
      const apt = index.apartments.get(apartmentId)
      if (!apt) continue
      const valid = parts.filter(p => p.shareDenominator > 0 && p.shareNumerator > 0)
      if (valid.length === 0) continue
      const { num, den } = sumFractions(valid)
      if (num === den) continue

      out.push({
        issueType: 'OWNERSHIP_SHARE_SUM_INVALID',
        category: 'CONSISTENCY',
        severity: 'CRITICAL',
        entityType: 'APARTMENT',
        entityId: apartmentId,
        entityLabel: apt.label,
        projectId: apt.projectId,
        title: 'סכום חלקי הבעלות אינו שווה ל-1',
        description: `סכום חלקי הבעלות ב${apt.label} הוא ${num}/${den} במקום 1 (${parts.length} בעלים רשומים).`,
        impact:
          'רוב החתימות מחושב לפי חלקי בעלות. סכום שאינו 1 גורם לחישוב סף שגוי ועלול לפסול את התהליך מול הרשות.',
        recommendation:
          num > den
            ? 'קיימת בעלות עודפת — בדקו רישום כפול של אותו בעלים או שבר שגוי.'
            : 'חסרה בעלות — אתרו את יתרת הבעלים (יורשים, בני זוג) והשלימו את הרישום.',
        deepLink: links.apartment(apt.projectId, apartmentId),
        metadata: { sumNumerator: num, sumDenominator: den, ownerCount: parts.length },
      })
    }

    return out
  }
}
