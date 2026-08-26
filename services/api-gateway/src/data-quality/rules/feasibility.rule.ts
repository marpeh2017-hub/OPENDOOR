import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { links } from '../data-quality.helpers'

/**
 * Makes the financial-model readiness visible in the platform-wide Data
 * Quality Center. It deliberately scans only projects that have opted into a
 * feasibility profile: a project without a report model is not silently
 * labelled as financially incomplete.
 */
@Injectable()
export class FeasibilityDataQualityRule implements DataQualityRule {
  readonly id = 'feasibility'
  readonly title = 'מוכנות נתוני דוח אפס'
  readonly category = 'COMPLETENESS' as const
  readonly severity = 'HIGH' as const
  readonly issueTypes = [
    'FEASIBILITY_BASE_SCENARIO_MISSING',
    'FEASIBILITY_PROGRAM_MISSING',
    'FEASIBILITY_REVENUE_MISSING',
    'FEASIBILITY_CONSTRUCTION_COST_MISSING',
    'FEASIBILITY_FINANCING_MISSING',
    'FEASIBILITY_DISCOUNT_RATE_MISSING',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    if (!ctx.index.projectIds.length) return []
    const profiles = await ctx.prisma.feasibilityProfile.findMany({
      where: { tenantId: ctx.tenantId, projectId: { in: ctx.index.projectIds } },
      select: {
        projectId: true,
        assumptions: { select: { key: true, value: true } },
        scenarios: {
          select: {
            isBaseline: true,
            unitMix: { select: { id: true } },
            revenueLines: { select: { id: true } },
            costLines: { select: { category: true } },
            financing: { select: { annualInterestRate: true } },
          },
        },
      },
    })
    const issues: DetectedIssue[] = []
    for (const profile of profiles) {
      const project = ctx.index.projects.get(profile.projectId)
      if (!project) continue
      const label = `${project.code} — ${project.name}`
      const base = profile.scenarios.find((scenario) => scenario.isBaseline)
      const add = (issueType: string, severity: DetectedIssue['severity'], title: string, description: string, recommendation: string) => issues.push({
        issueType,
        category: 'COMPLETENESS',
        severity,
        entityType: 'PROJECT',
        entityId: project.id,
        entityLabel: label,
        projectId: project.id,
        title,
        description,
        impact: 'דוח אפס אינו יכול לשקף מסקנת כדאיות מקצועית כאשר אחד מרכיבי המודל חסר.',
        recommendation,
        deepLink: links.project(project.id),
      })
      if (!base) {
        add('FEASIBILITY_BASE_SCENARIO_MISSING', 'HIGH', 'חסר תרחיש בסיס לדוח אפס', `לפרויקט ${label} נפתח פרופיל דוח אפס, אך לא נוצר תרחיש בסיס.`, 'צרו תרחיש בסיס והזינו בו פרוגרמה, הכנסות, עלויות ומימון.')
        continue
      }
      if (!base.unitMix.length) add('FEASIBILITY_PROGRAM_MISSING', 'HIGH', 'חסרה פרוגרמת יחידות בתרחיש הבסיס', `בתרחיש הבסיס של ${label} לא הוזן תמהיל יחידות.`, 'הזינו תמהיל יחידות ושטחי מכירה לתרחיש הבסיס.')
      if (!base.revenueLines.length && !base.unitMix.length) add('FEASIBILITY_REVENUE_MISSING', 'CRITICAL', 'חסרות הנחות הכנסה בתרחיש הבסיס', `אין בתרחיש הבסיס של ${label} שורת הכנסה או תמהיל מתומחר.`, 'הזינו מחיר ומכירה לכל תמהיל, או הוסיפו שורות הכנסה מתועדות.')
      if (!base.costLines.some((line) => line.category === 'CONSTRUCTION')) add('FEASIBILITY_CONSTRUCTION_COST_MISSING', 'CRITICAL', 'חסרה עלות בנייה בתרחיש הבסיס', `בתרחיש הבסיס של ${label} אין שורת עלות בקטגוריית בנייה.`, 'הזינו עלות בנייה לפי מ״ר או לפי רכיבים, עם מקור והנחת מע״מ מפורשת.')
      if (!base.financing?.annualInterestRate) add('FEASIBILITY_FINANCING_MISSING', 'MEDIUM', 'חסרה הנחת מימון בתרחיש הבסיס', `לא הוגדרה ריבית מימון לתרחיש הבסיס של ${label}.`, 'הזינו הנחות מימון ותזרים משיכות/החזרים לפני אישור הדוח.')
      const discountRate = profile.assumptions.find((assumption) => assumption.key === 'annual-discount-rate')?.value
      if (!discountRate) add('FEASIBILITY_DISCOUNT_RATE_MISSING', 'MEDIUM', 'חסר שיעור היוון לחישוב NPV', `לא הוגדרה הנחת annual-discount-rate לפרויקט ${label}.`, 'הוסיפו שיעור היוון שנתי למרשם ההנחות, עם מקור ותוקף.')
    }
    return issues
  }
}
