import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { isBlank, isValidEmail, isValidPhone, links } from '../data-quality.helpers'

/**
 * Completeness / accuracy of the ownership registry's people records.
 * Owners drive signature validity, so their contactability is business-critical.
 */
@Injectable()
export class OwnerDataQualityRule implements DataQualityRule {
  readonly id = 'owner'
  readonly title = 'איכות נתוני בעלים'
  readonly category = 'COMPLETENESS' as const
  readonly severity = 'HIGH' as const
  readonly issueTypes = [
    'OWNER_MISSING_NAME',
    'OWNER_MISSING_PHONE',
    'OWNER_MISSING_EMAIL',
    'OWNER_MISSING_NATIONAL_ID',
    'OWNER_INVALID_PHONE',
    'OWNER_INVALID_EMAIL',
    'OWNER_ESTATE_NO_GUARDIAN',
    'OWNER_NO_HOLDINGS',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, tenantId, index } = ctx
    const out: DetectedIssue[] = []

    const owners = await prisma.owner.findMany({
      where: {
        tenantId,
        ...(ctx.projectId
          ? { holdings: { some: { apartmentId: { in: index.apartmentIds } } } }
          : {}),
      },
      select: {
        id: true, fullName: true, nationalId: true, phone: true, email: true,
        isEstate: true, guardianContact: true,
        holdings: { select: { apartmentId: true } },
      },
    })

    for (const o of owners) {
      const label = isBlank(o.fullName) ? `בעלים ${o.id.slice(0, 8)}` : o.fullName
      const projectId =
        o.holdings.map(h => index.apartments.get(h.apartmentId)?.projectId).find(Boolean) ?? null
      const link = links.owner(o.id)

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
          entityType: 'OWNER', entityId: o.id, entityLabel: label,
          projectId, title, description, impact, recommendation, deepLink: link,
        })

      if (isBlank(o.fullName)) {
        push('OWNER_MISSING_NAME', 'HIGH', 'COMPLETENESS',
          'לבעלים אין שם',
          'רשומת בעלים נשמרה ללא שם מלא.',
          'לא ניתן להפיק כתב הסכמה או חבילת חתימה ללא שם בעלים מלא.',
          'השלימו את שם הבעלים מתוך נסח הטאבו.')
      }

      if (isBlank(o.phone)) {
        push('OWNER_MISSING_PHONE', 'MEDIUM', 'COMPLETENESS',
          'לבעלים אין מספר טלפון',
          `לבעלים ${label} לא רשום מספר טלפון.`,
          'ללא טלפון לא ניתן לשלוח OTP לחתימה דיגיטלית ולא לבצע מעקב טלפוני.',
          'אתרו מספר טלפון והשלימו בכרטיס הבעלים.')
      } else if (!isValidPhone(o.phone)) {
        push('OWNER_INVALID_PHONE', 'MEDIUM', 'ACCURACY',
          'מספר טלפון בפורמט שגוי',
          `מספר הטלפון של ${label} אינו תואם פורמט ישראלי תקין.`,
          'שליחת SMS/WhatsApp תיכשל ותיצור עיכוב בתהליך החתימות.',
          'תקנו את המספר לפורמט 05XXXXXXXX או ‎+9725XXXXXXXX.')
      }

      if (isBlank(o.email)) {
        push('OWNER_MISSING_EMAIL', 'LOW', 'COMPLETENESS',
          'לבעלים אין כתובת אימייל',
          `לבעלים ${label} לא רשומה כתובת אימייל.`,
          'ערוץ גיבוי לשליחת מסמכים חסר.',
          'השלימו כתובת אימייל בכרטיס הבעלים.')
      } else if (!isValidEmail(o.email)) {
        push('OWNER_INVALID_EMAIL', 'LOW', 'ACCURACY',
          'כתובת אימייל בפורמט שגוי',
          `כתובת האימייל של ${label} אינה תקינה.`,
          'הודעות אימייל יחזרו כנכשלות.',
          'תקנו את כתובת האימייל.')
      }

      if (isBlank(o.nationalId) && !o.isEstate) {
        push('OWNER_MISSING_NATIONAL_ID', 'HIGH', 'COMPLETENESS',
          'לבעלים חסרה תעודת זהות',
          `לבעלים ${label} לא רשום מספר זהות.`,
          'תעודת זהות נדרשת לאימות זהות חותם ולתוקף משפטי של החתימה.',
          'השלימו תעודת זהות מתוך נסח הטאבו או ממסמכי הזיהוי.')
      }

      if (o.isEstate && isBlank(o.guardianContact)) {
        push('OWNER_ESTATE_NO_GUARDIAN', 'HIGH', 'COMPLIANCE',
          'עיזבון ללא איש קשר מוסמך',
          `הבעלים ${label} מסומן כעיזבון אך אין פרטי מיופה כוח / אפוטרופוס.`,
          'לא ניתן להחתים עיזבון ללא בעל סמכות חתימה מזוהה — חתימה כזו עלולה להיפסל.',
          'הזינו את פרטי מיופה הכוח או צו קיום הצוואה בכרטיס הבעלים.')
      }

      if (o.holdings.length === 0) {
        push('OWNER_NO_HOLDINGS', 'MEDIUM', 'INTEGRITY',
          'בעלים ללא אחזקות',
          `לבעלים ${label} אין אף דירה משויכת.`,
          'בעלים ללא אחזקה אינו נספר בחישוב רוב החתימות ועלול להעיד על ייבוא חלקי.',
          'שייכו את הבעלים לדירה או מחקו את הרשומה הכפולה.')
      }
    }

    return out
  }
}
