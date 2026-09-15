import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { isBlank, links } from '../data-quality.helpers'

const STUCK_QUEUE_HOURS = 24
const HOUR_MS = 60 * 60 * 1000
/** Only recent traffic is scanned — historical failures are not actionable. */
const LOOKBACK_DAYS = 90

/**
 * Deliverability of outbound communications (model: `Message`).
 * Scoped to the last 90 days so the rule stays bounded on high-volume tenants.
 */
@Injectable()
export class CommunicationDataQualityRule implements DataQualityRule {
  readonly id = 'communication'
  readonly title = 'איכות התקשורת היוצאת'
  readonly category = 'ACCURACY' as const
  readonly severity = 'HIGH' as const
  readonly issueTypes = [
    'MESSAGE_MISSING_RECIPIENT',
    'MESSAGE_DELIVERY_FAILED',
    'MESSAGE_STUCK_IN_QUEUE',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, tenantId, now } = ctx
    const out: DetectedIssue[] = []

    const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * HOUR_MS)

    // Project scoping goes through the resident → apartment → building chain.
    const residentFilter = ctx.projectId
      ? { resident: { apartment: { building: { complex: { projectId: ctx.projectId } } } } }
      : {}

    const messages = await prisma.message.findMany({
      where: {
        tenantId,
        createdAt: { gte: since },
        ...residentFilter,
        OR: [
          { status: 'FAILED' },
          { status: 'QUEUED' },
          { AND: [{ residentId: null }, { toPhone: null }, { toEmail: null }] },
        ],
      },
      select: {
        id: true, channel: true, status: true, direction: true,
        residentId: true, toPhone: true, toEmail: true,
        failureReason: true, createdAt: true, subject: true,
      },
    })

    for (const m of messages) {
      const label = `${m.channel} · ${m.subject ?? m.id.slice(0, 8)}`
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
          entityType: 'MESSAGE', entityId: m.id, entityLabel: label,
          projectId: ctx.projectId ?? null,
          title, description, impact, recommendation,
          deepLink: links.message(m.id), metadata,
        })

      if (!m.residentId && isBlank(m.toPhone) && isBlank(m.toEmail)) {
        push('MESSAGE_MISSING_RECIPIENT', 'HIGH', 'INTEGRITY',
          'הודעה ללא נמען',
          'נשמרה הודעה ללא דייר משויך וללא טלפון או אימייל.',
          'ההודעה לעולם לא תישלח ומנפחת את מדדי התקשורת.',
          'השלימו נמען או מחקו את ההודעה.')
      }

      if (m.status === 'FAILED') {
        push('MESSAGE_DELIVERY_FAILED', 'MEDIUM', 'ACCURACY',
          'שליחת הודעה נכשלה',
          `שליחת הודעה בערוץ ${m.channel} נכשלה${m.failureReason ? ` (${m.failureReason})` : ''}.`,
          'דייר לא קיבל מידע מהותי — פגיעה במעורבות ובקצב ההחתמה.',
          'בדקו את פרטי הקשר של הנמען ושלחו מחדש.',
          { channel: m.channel })
      }

      if (m.status === 'QUEUED' && now.getTime() - m.createdAt.getTime() > STUCK_QUEUE_HOURS * HOUR_MS) {
        push('MESSAGE_STUCK_IN_QUEUE', 'MEDIUM', 'TIMELINESS',
          'הודעה תקועה בתור השליחה',
          `הודעה בערוץ ${m.channel} ממתינה בתור מעל ${STUCK_QUEUE_HOURS} שעות.`,
          'תקלה בתשתית השליחה — ייתכן שכל התור מושבת.',
          'בדקו את שירות השליחה ואת תור העבודות.',
          { channel: m.channel })
      }
    }

    return out
  }
}
