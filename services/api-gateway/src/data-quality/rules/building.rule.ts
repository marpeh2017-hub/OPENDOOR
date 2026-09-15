import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { isBlank, links } from '../data-quality.helpers'

const MIN_YEAR = 1900

/** Structural completeness and internal consistency of buildings. */
@Injectable()
export class BuildingDataQualityRule implements DataQualityRule {
  readonly id = 'building'
  readonly title = 'איכות נתוני בניינים'
  readonly category = 'CONSISTENCY' as const
  readonly severity = 'HIGH' as const
  readonly issueTypes = [
    'BUILDING_NO_APARTMENTS',
    'BUILDING_MISSING_ADDRESS',
    'BUILDING_UNIT_COUNT_MISMATCH',
    'BUILDING_MISSING_CONSTRUCTION_YEAR',
    'BUILDING_INVALID_CONSTRUCTION_YEAR',
    'BUILDING_MISSING_FLOORS',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { index, now } = ctx
    const out: DetectedIssue[] = []

    // Apartment counts come from the already-loaded index — no extra queries.
    const actualByBuilding = new Map<string, number>()
    for (const apt of index.apartments.values()) {
      actualByBuilding.set(apt.buildingId, (actualByBuilding.get(apt.buildingId) ?? 0) + 1)
    }

    for (const b of index.buildings.values()) {
      const label = b.address || `בניין ${b.id.slice(0, 8)}`
      const actual = actualByBuilding.get(b.id) ?? 0

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
          entityType: 'BUILDING', entityId: b.id, entityLabel: label,
          projectId: b.projectId || null, title, description, impact, recommendation,
          deepLink: links.building(b.projectId || null, b.id),
          metadata,
        })

      if (isBlank(b.address)) {
        push('BUILDING_MISSING_ADDRESS', 'HIGH', 'COMPLETENESS',
          'לבניין אין כתובת',
          'רשומת בניין נשמרה ללא כתובת.',
          'ללא כתובת לא ניתן להגיש בקשות לרשות המקומית ולא לזהות את הבניין בשטח.',
          'השלימו את כתובת הבניין.')
      }

      if (actual === 0) {
        push('BUILDING_NO_APARTMENTS', 'HIGH', 'INTEGRITY',
          'לבניין אין דירות',
          `לבניין ${label} לא רשומה אף דירה.`,
          'בניין ללא דירות אינו תורם ליחידות הפרויקט ומעיד על ייבוא חלקי.',
          'ייבאו את רשימת הדירות מנסח הבית המשותף.')
      } else if (b.totalApartments != null && b.totalApartments !== actual) {
        push('BUILDING_UNIT_COUNT_MISMATCH', 'MEDIUM', 'CONSISTENCY',
          'אי-התאמה במספר הדירות בבניין',
          `לבניין ${label} רשומות ${b.totalApartments} דירות בשדה הסיכום, אך בפועל קיימות ${actual} רשומות דירה.`,
          'אי-התאמה זו מייצרת אחוז חתימות שגוי מול הסף הנדרש.',
          'השוו לנסח הבית המשותף ותקנו את הצד השגוי.',
          { declared: b.totalApartments, actual })
      }

      if (b.floors == null) {
        push('BUILDING_MISSING_FLOORS', 'LOW', 'COMPLETENESS',
          'לבניין חסר מספר קומות',
          `לבניין ${label} לא רשום מספר קומות.`,
          'מספר הקומות נדרש לבדיקת זכויות בנייה ולתכנון.',
          'השלימו את מספר הקומות.')
      }

      if (b.constructionYear == null) {
        push('BUILDING_MISSING_CONSTRUCTION_YEAR', 'LOW', 'COMPLETENESS',
          'לבניין חסרה שנת בנייה',
          `לבניין ${label} לא רשומה שנת בנייה.`,
          'שנת הבנייה קובעת זכאות לתמ"א ולמסלולי התחדשות עירונית.',
          'השלימו את שנת הבנייה מתיק הבניין.')
      } else if (b.constructionYear < MIN_YEAR || b.constructionYear > now.getFullYear()) {
        push('BUILDING_INVALID_CONSTRUCTION_YEAR', 'MEDIUM', 'ACCURACY',
          'שנת בנייה לא תקינה',
          `לבניין ${label} רשומה שנת בנייה ${b.constructionYear}, מחוץ לטווח ${MIN_YEAR}–${now.getFullYear()}.`,
          'שנת בנייה שגויה עלולה להוביל לסיווג מסלול התחדשות שגוי.',
          'תקנו את שנת הבנייה.',
          { constructionYear: b.constructionYear })
      }
    }

    return out
  }
}
