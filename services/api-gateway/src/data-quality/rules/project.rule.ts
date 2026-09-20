import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { links } from '../data-quality.helpers'

/** Project stages from which a signature threshold rule must already exist. */
const THRESHOLD_REQUIRED_STAGES = new Set([
  'SIGNATURES', 'DEVELOPER_SELECTION', 'PLANNING', 'MUNICIPAL_APPROVAL',
  'PERMIT', 'EVACUATION', 'CONSTRUCTION', 'DELIVERY', 'POST_DELIVERY',
])

const OPEN_STATUSES = new Set(['ACTIVE', 'ON_HOLD'])

/** Project-header consistency against the structure actually recorded beneath it. */
@Injectable()
export class ProjectDataQualityRule implements DataQualityRule {
  readonly id = 'project'
  readonly title = 'איכות נתוני פרויקט'
  readonly category = 'CONSISTENCY' as const
  readonly severity = 'HIGH' as const
  readonly issueTypes = [
    'PROJECT_NO_STRUCTURE',
    'PROJECT_UNIT_COUNT_MISMATCH',
    'PROJECT_MISSING_MANAGER',
    'PROJECT_TARGET_DATE_PASSED',
    'PROJECT_INVALID_DATE_RANGE',
    'PROJECT_MISSING_THRESHOLD_RULE',
    'PROJECT_SIGNED_EXCEEDS_TOTAL',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, index, now } = ctx
    const out: DetectedIssue[] = []
    if (index.projectIds.length === 0) return out

    const thresholdRules = await prisma.thresholdRule.groupBy({
      by: ['projectId'],
      where: { tenantId: ctx.tenantId, projectId: { in: index.projectIds } },
      _count: { _all: true },
    })
    const hasThreshold = new Set(thresholdRules.map(t => t.projectId))

    const apartmentsByProject = new Map<string, number>()
    for (const apt of index.apartments.values()) {
      apartmentsByProject.set(apt.projectId, (apartmentsByProject.get(apt.projectId) ?? 0) + 1)
    }
    const buildingsByProject = new Map<string, number>()
    for (const b of index.buildings.values()) {
      buildingsByProject.set(b.projectId, (buildingsByProject.get(b.projectId) ?? 0) + 1)
    }

    for (const p of index.projects.values()) {
      const label = `${p.code} — ${p.name}`
      const apartments = apartmentsByProject.get(p.id) ?? 0
      const buildings = buildingsByProject.get(p.id) ?? 0

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
          entityType: 'PROJECT', entityId: p.id, entityLabel: label,
          projectId: p.id, title, description, impact, recommendation,
          deepLink: links.project(p.id), metadata,
        })

      if (buildings === 0) {
        push('PROJECT_NO_STRUCTURE', 'HIGH', 'INTEGRITY',
          'לפרויקט אין מבנים',
          `לפרויקט ${label} לא משויך אף בניין.`,
          'ללא מבנים לא ניתן לחשב יחידות, חתימות או סף הסכמה — הפרויקט למעשה ריק.',
          'הגדירו מתחם ובניינים וייבאו את רשימת הדירות.')
      } else if (p.totalUnits > 0 && apartments > 0 && p.totalUnits !== apartments) {
        push('PROJECT_UNIT_COUNT_MISMATCH', 'MEDIUM', 'CONSISTENCY',
          'אי-התאמה במספר היחידות בפרויקט',
          `בפרויקט ${label} רשומות ${p.totalUnits} יחידות בכותרת, אך בפועל קיימות ${apartments} דירות.`,
          'אחוז החתימות מחושב מול מספר היחידות; אי-התאמה מייצרת דיווח סף שגוי להנהלה ולרשות.',
          'סנכרנו את מספר היחידות בכותרת הפרויקט עם מלאי הדירות בפועל.',
          { declaredUnits: p.totalUnits, actualApartments: apartments })
      }

      if (p.signedUnits > p.totalUnits && p.totalUnits > 0) {
        push('PROJECT_SIGNED_EXCEEDS_TOTAL', 'HIGH', 'ACCURACY',
          'מספר היחידות החתומות גדול מסך היחידות',
          `בפרויקט ${label} רשומות ${p.signedUnits} יחידות חתומות מתוך ${p.totalUnits} בלבד.`,
          'נתון בלתי אפשרי שמייצר אחוז חתימות מעל 100% בדוחות ההנהלה.',
          'בדקו את ספירת החתימות ואת מספר היחידות ותקנו.',
          { signedUnits: p.signedUnits, totalUnits: p.totalUnits })
      }

      if (!p.projectManagerId && OPEN_STATUSES.has(p.status)) {
        push('PROJECT_MISSING_MANAGER', 'MEDIUM', 'COMPLETENESS',
          'לפרויקט פעיל אין מנהל פרויקט',
          `לפרויקט ${label} לא הוגדר מנהל פרויקט.`,
          'ללא אחראי מוגדר משימות ותזכורות אינן מנותבות ואין בעלות על התקדמות.',
          'שייכו מנהל פרויקט בכרטיס הפרויקט.')
      }

      if (p.startDate && p.targetEndDate && p.startDate > p.targetEndDate) {
        push('PROJECT_INVALID_DATE_RANGE', 'MEDIUM', 'ACCURACY',
          'תאריך התחלה מאוחר מתאריך היעד',
          `בפרויקט ${label} תאריך ההתחלה מאוחר מתאריך היעד לסיום.`,
          'לוח הזמנים והתחזיות מחושבים מטווח התאריכים — טווח הפוך משבש כל תחזית.',
          'תקנו את תאריכי הפרויקט.')
      } else if (
        p.targetEndDate && p.targetEndDate < now && OPEN_STATUSES.has(p.status)
      ) {
        push('PROJECT_TARGET_DATE_PASSED', 'MEDIUM', 'TIMELINESS',
          'תאריך היעד של הפרויקט חלף',
          `תאריך היעד של ${label} חלף והפרויקט עדיין בסטטוס ${p.status}.`,
          'יעד שחלף ללא עדכון מעוות דוחות עמידה בלוחות זמנים.',
          'עדכנו תאריך יעד חדש או שנו את סטטוס הפרויקט.',
          { targetEndDate: p.targetEndDate.toISOString() })
      }

      if (THRESHOLD_REQUIRED_STAGES.has(p.stage) && !hasThreshold.has(p.id)) {
        push('PROJECT_MISSING_THRESHOLD_RULE', 'HIGH', 'COMPLIANCE',
          'לא הוגדר כלל סף חתימות',
          `הפרויקט ${label} נמצא בשלב ${p.stage} אך לא הוגדר לו כלל סף חתימות.`,
          'ללא כלל סף לא ניתן לקבוע אם הושג הרוב הנדרש על פי חוק — סיכון משפטי ישיר.',
          'הגדירו כלל סף (אחוז נדרש ובסיס חישוב: חלקי בעלות או יחידות).')
      }
    }

    return out
  }
}
