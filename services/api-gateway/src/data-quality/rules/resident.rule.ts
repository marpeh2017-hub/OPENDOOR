import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { isBlank, isValidEmail, isValidPhone, links } from '../data-quality.helpers'

/** Contactability and consistency of resident records. */
@Injectable()
export class ResidentDataQualityRule implements DataQualityRule {
  readonly id = 'resident'
  readonly title = 'איכות נתוני דיירים'
  readonly category = 'COMPLETENESS' as const
  readonly severity = 'CRITICAL' as const
  readonly issueTypes = [
    'RESIDENT_NO_CONTACT',
    'RESIDENT_INVALID_PHONE',
    'RESIDENT_INVALID_EMAIL',
    'RESIDENT_INVALID_OWNERSHIP_PCT',
    'RESIDENT_ORPHAN_APARTMENT',
    'RESIDENT_OBJECTING_NO_REASON',
    'RESIDENT_DNC_NO_REASON',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, tenantId, index } = ctx
    const out: DetectedIssue[] = []

    const residents = await prisma.resident.findMany({
      where: {
        tenantId,
        ...(ctx.projectId ? { apartmentId: { in: index.apartmentIds } } : {}),
      },
      select: {
        id: true, firstName: true, lastName: true, apartmentId: true,
        phone: true, phone2: true, email: true,
        ownershipPercentage: true, isObjecting: true, objectionReason: true,
        doNotContact: true, doNotContactReason: true,
      },
    })

    for (const r of residents) {
      const label = `${r.firstName} ${r.lastName}`.trim() || `דייר ${r.id.slice(0, 8)}`
      const apt = index.apartments.get(r.apartmentId)
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
          entityType: 'RESIDENT', entityId: r.id, entityLabel: label,
          projectId: apt?.projectId ?? null,
          title, description, impact, recommendation,
          deepLink: links.resident(r.id), metadata,
        })

      if (!apt) {
        push('RESIDENT_ORPHAN_APARTMENT', 'CRITICAL', 'INTEGRITY',
          'דייר משויך לדירה שאינה קיימת',
          `הדייר ${label} משויך לדירה שאינה נמצאת באף פרויקט של הארגון.`,
          'הפניה שבורה או חוצת-ארגון — הדייר לא ייספר בשום דוח פרויקט.',
          'שייכו את הדייר לדירה הנכונה.')
      }

      if (isBlank(r.phone) && isBlank(r.phone2) && isBlank(r.email)) {
        push('RESIDENT_NO_CONTACT', 'HIGH', 'COMPLETENESS',
          'לדייר אין פרטי קשר',
          `לדייר ${label} אין טלפון ואין אימייל.`,
          'דייר בלתי ניתן ליצירת קשר לא יגיע לחתימה — פגיעה ישירה בסף ההסכמה.',
          'אתרו פרטי קשר בסיור בשטח או מול ועד הבית.')
      } else {
        if (!isBlank(r.phone) && !isValidPhone(r.phone)) {
          push('RESIDENT_INVALID_PHONE', 'MEDIUM', 'ACCURACY',
            'מספר טלפון בפורמט שגוי',
            `מספר הטלפון של ${label} אינו תואם פורמט ישראלי תקין.`,
            'הודעות SMS ו-WhatsApp ייכשלו.',
            'תקנו את המספר לפורמט 05XXXXXXXX.')
        }
        if (!isBlank(r.email) && !isValidEmail(r.email)) {
          push('RESIDENT_INVALID_EMAIL', 'LOW', 'ACCURACY',
            'כתובת אימייל בפורמט שגוי',
            `כתובת האימייל של ${label} אינה תקינה.`,
            'הודעות אימייל יחזרו כנכשלות.',
            'תקנו את כתובת האימייל.')
        }
      }

      if (r.ownershipPercentage <= 0 || r.ownershipPercentage > 100) {
        push('RESIDENT_INVALID_OWNERSHIP_PCT', 'MEDIUM', 'ACCURACY',
          'אחוז בעלות לא תקין',
          `לדייר ${label} רשום אחוז בעלות ${r.ownershipPercentage}%, מחוץ לטווח 0–100.`,
          'אחוז בעלות שגוי מעוות דוחות ופוגע באמינות הנתונים מול הבעלות הרשמית.',
          'תקנו את אחוז הבעלות לפי רישום הבעלות.',
          { ownershipPercentage: r.ownershipPercentage })
      }

      if (r.isObjecting && isBlank(r.objectionReason)) {
        push('RESIDENT_OBJECTING_NO_REASON', 'MEDIUM', 'COMPLETENESS',
          'התנגדות ללא סיבה מתועדת',
          `הדייר ${label} מסומן כמתנגד אך לא תועדה סיבת ההתנגדות.`,
          'ללא סיבה מתועדת לא ניתן לבנות מענה ממוקד ולהפוך התנגדות להסכמה.',
          'תעדו את סיבת ההתנגדות בכרטיס הדייר.')
      }

      if (r.doNotContact && isBlank(r.doNotContactReason)) {
        push('RESIDENT_DNC_NO_REASON', 'LOW', 'COMPLIANCE',
          'סימון "נא לא ליצור קשר" ללא נימוק',
          `הדייר ${label} מסומן כ"נא לא ליצור קשר" ללא נימוק מתועד.`,
          'הגבלת יצירת קשר ללא תיעוד עלולה להיות שגויה ולנתק דייר ללא הצדקה.',
          'תעדו את מקור ההגבלה או הסירו אותה.')
      }
    }

    return out
  }
}
