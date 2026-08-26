import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { links } from '../data-quality.helpers'

/** Plausibility bounds for an Israeli residential unit. */
const MIN_SQM = 15
const MAX_SQM = 600

/**
 * Completeness and plausibility of the apartment inventory — the denominator of
 * every signature-threshold calculation.
 */
@Injectable()
export class ApartmentDataQualityRule implements DataQualityRule {
  readonly id = 'apartment'
  readonly title = 'איכות מלאי הדירות'
  readonly category = 'COMPLETENESS' as const
  readonly severity = 'HIGH' as const
  readonly issueTypes = [
    'APARTMENT_NO_OWNER',
    'APARTMENT_NO_RESIDENT',
    'APARTMENT_MISSING_SIZE',
    'APARTMENT_MISSING_ROOMS',
    'APARTMENT_MISSING_FLOOR',
    'APARTMENT_IMPLAUSIBLE_SIZE',
    'APARTMENT_FLOOR_EXCEEDS_BUILDING',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, index } = ctx
    const out: DetectedIssue[] = []
    const apartmentIds = index.apartmentIds
    if (apartmentIds.length === 0) return out

    // Two aggregate queries instead of one query per apartment.
    const [ownerCounts, residentCounts] = await Promise.all([
      prisma.ownerApartment.groupBy({
        by: ['apartmentId'],
        where: { apartmentId: { in: apartmentIds } },
        _count: { _all: true },
      }),
      prisma.resident.groupBy({
        by: ['apartmentId'],
        where: { apartmentId: { in: apartmentIds } },
        _count: { _all: true },
      }),
    ])
    const owned = new Set(ownerCounts.map(r => r.apartmentId))
    const inhabited = new Set(residentCounts.map(r => r.apartmentId))

    for (const apt of index.apartments.values()) {
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
          entityType: 'APARTMENT', entityId: apt.id, entityLabel: apt.label,
          projectId: apt.projectId, title, description, impact, recommendation,
          deepLink: links.apartment(apt.projectId, apt.id),
          metadata,
        })

      if (!owned.has(apt.id)) {
        push('APARTMENT_NO_OWNER', 'HIGH', 'INTEGRITY',
          'לדירה אין בעלים רשומים',
          `ל${apt.label} לא רשום אף בעלים.`,
          'דירה ללא בעלים אינה נספרת בחישוב רוב החתימות ומורידה את אחוז ההסכמה בפועל.',
          'הזינו את הבעלים מנסח הטאבו ושייכו חלקי בעלות.')
      }

      if (!inhabited.has(apt.id)) {
        push('APARTMENT_NO_RESIDENT', 'LOW', 'COMPLETENESS',
          'לדירה אין דיירים רשומים',
          `ל${apt.label} לא רשום אף דייר.`,
          'ללא דייר לא ניתן לנהל תקשורת שוטפת או לתעד סטטוס הסכמה.',
          'הוסיפו את הדיירים או סמנו את הדירה כלא מאוישת.')
      }

      if (apt.sizeSqm == null) {
        push('APARTMENT_MISSING_SIZE', 'MEDIUM', 'COMPLETENESS',
          'לדירה חסר שטח במ"ר',
          `ל${apt.label} לא רשום שטח.`,
          'שטח הדירה נדרש לחישוב תמורות ולהערכת כדאיות כלכלית.',
          'השלימו את השטח מנסח הטאבו או מתשריט.')
      } else if (apt.sizeSqm < MIN_SQM || apt.sizeSqm > MAX_SQM) {
        push('APARTMENT_IMPLAUSIBLE_SIZE', 'MEDIUM', 'ACCURACY',
          'שטח דירה חורג מטווח סביר',
          `ל${apt.label} רשום שטח ${apt.sizeSqm} מ"ר, מחוץ לטווח ${MIN_SQM}–${MAX_SQM} מ"ר.`,
          'שטח שגוי מעוות את חישובי התמורות ואת ההערכה הכלכלית של הפרויקט.',
          'ודאו את השטח מול נסח הטאבו ותקנו.',
          { sizeSqm: apt.sizeSqm })
      }

      if (apt.rooms == null) {
        push('APARTMENT_MISSING_ROOMS', 'LOW', 'COMPLETENESS',
          'לדירה חסר מספר חדרים',
          `ל${apt.label} לא רשום מספר חדרים.`,
          'מספר החדרים נדרש לתכנון תמהיל הדירות החדשות.',
          'השלימו את מספר החדרים.')
      }

      if (apt.floor == null) {
        push('APARTMENT_MISSING_FLOOR', 'LOW', 'COMPLETENESS',
          'לדירה חסרה קומה',
          `ל${apt.label} לא רשומה קומה.`,
          'ללא קומה לא ניתן להפיק מפת בניין ולתכנן פינוי מדורג.',
          'השלימו את מספר הקומה.')
      } else {
        const building = index.buildings.get(apt.buildingId)
        if (building?.floors != null && apt.floor > building.floors) {
          push('APARTMENT_FLOOR_EXCEEDS_BUILDING', 'MEDIUM', 'CONSISTENCY',
            'קומת הדירה גבוהה ממספר הקומות בבניין',
            `${apt.label} רשומה בקומה ${apt.floor}, אך לבניין רשומות ${building.floors} קומות בלבד.`,
            'סתירה בין נתוני הדירה לנתוני הבניין מעידה על שגיאת ייבוא ופוגעת באמינות הדוחות.',
            'תקנו את קומת הדירה או את מספר הקומות של הבניין.',
            { apartmentFloor: apt.floor, buildingFloors: building.floors })
        }
      }
    }

    return out
  }
}
