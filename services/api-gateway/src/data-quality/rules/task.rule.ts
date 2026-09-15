import { Injectable } from '@nestjs/common'
import type { DataQualityRule, DetectedIssue, ScanContext } from '../data-quality.types'
import { links } from '../data-quality.helpers'

const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS', 'OVERDUE'] as const
const DAY_MS = 24 * 60 * 60 * 1000

/** Operational hygiene of the task backlog. */
@Injectable()
export class TaskDataQualityRule implements DataQualityRule {
  readonly id = 'task'
  readonly title = 'היגיינת משימות'
  readonly category = 'TIMELINESS' as const
  readonly severity = 'MEDIUM' as const
  readonly issueTypes = [
    'TASK_OVERDUE',
    'TASK_NO_ASSIGNEE',
    'TASK_NO_DUE_DATE',
    'TASK_COMPLETED_WITHOUT_TIMESTAMP',
    'TASK_ORPHAN_PROJECT',
    'TASK_STATUS_STALE_OVERDUE',
  ] as const

  async run(ctx: ScanContext): Promise<DetectedIssue[]> {
    const { prisma, tenantId, index, now } = ctx
    const out: DetectedIssue[] = []

    const tasks = await prisma.task.findMany({
      where: { tenantId, ...(ctx.projectId ? { projectId: ctx.projectId } : {}) },
      select: {
        id: true, title: true, status: true, priority: true,
        dueDate: true, completedAt: true, assigneeId: true, projectId: true,
      },
    })

    for (const t of tasks) {
      const label = t.title
      const isOpen = (OPEN_STATUSES as readonly string[]).includes(t.status)
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
          entityType: 'TASK', entityId: t.id, entityLabel: label,
          projectId: t.projectId, title, description, impact, recommendation,
          deepLink: links.task(t.id), metadata,
        })

      if (isOpen && t.dueDate && t.dueDate < now) {
        const daysLate = Math.floor((now.getTime() - t.dueDate.getTime()) / DAY_MS)
        push('TASK_OVERDUE',
          daysLate > 30 ? 'HIGH' : 'MEDIUM', 'TIMELINESS',
          'משימה באיחור',
          `המשימה "${label}" באיחור של ${daysLate} ימים (סטטוס ${t.status}).`,
          'משימות באיחור מעכבות אבני דרך בפרויקט ומעידות על חוסר מעקב.',
          'עדכנו סטטוס, הזיזו תאריך יעד או סגרו את המשימה.',
          { daysLate })

        if (t.status !== 'OVERDUE') {
          push('TASK_STATUS_STALE_OVERDUE', 'LOW', 'CONSISTENCY',
            'סטטוס המשימה לא עודכן לאיחור',
            `תאריך היעד של "${label}" חלף אך הסטטוס עדיין ${t.status}.`,
            'דוחות איחורים מבוססי סטטוס מציגים תמונה אופטימית מדי.',
            'עדכנו את סטטוס המשימה ל-OVERDUE או שנו את תאריך היעד.')
        }
      }

      if (isOpen && !t.assigneeId) {
        push('TASK_NO_ASSIGNEE', 'MEDIUM', 'COMPLETENESS',
          'משימה פתוחה ללא אחראי',
          `למשימה "${label}" לא שויך אחראי.`,
          'משימה ללא אחראי לא תבוצע ולא תופיע ברשימת אף עובד.',
          'שייכו אחראי למשימה.')
      }

      if (isOpen && !t.dueDate) {
        push('TASK_NO_DUE_DATE', 'LOW', 'COMPLETENESS',
          'משימה פתוחה ללא תאריך יעד',
          `למשימה "${label}" לא נקבע תאריך יעד.`,
          'ללא תאריך יעד המשימה לא נכללת במעקב איחורים ובתזכורות.',
          'קבעו תאריך יעד ריאלי.')
      }

      if (t.status === 'COMPLETED' && !t.completedAt) {
        push('TASK_COMPLETED_WITHOUT_TIMESTAMP', 'LOW', 'CONSISTENCY',
          'משימה שהושלמה ללא תאריך השלמה',
          `המשימה "${label}" מסומנת כהושלמה אך אין לה תאריך השלמה.`,
          'מדדי זמן מחזור (cycle time) וביצועי צוות מחושבים שגוי.',
          'השלימו את תאריך ההשלמה.')
      }

      if (t.projectId && !index.projects.has(t.projectId)) {
        push('TASK_ORPHAN_PROJECT', 'HIGH', 'INTEGRITY',
          'משימה משויכת לפרויקט שאינו קיים',
          `המשימה "${label}" משויכת לפרויקט שאינו קיים בארגון.`,
          'המשימה לא תופיע בלוח הפרויקט ותיעלם ממעקב.',
          'שייכו את המשימה לפרויקט הנכון.')
      }
    }

    return out
  }
}
