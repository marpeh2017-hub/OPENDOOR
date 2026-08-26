'use client'

import { CheckCircle2, Clock, AlertCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useTasks } from '@/hooks/use-tasks'

const PRIORITY_CFG = {
  URGENT: { cls: 'text-red-600',    icon: AlertCircle },
  HIGH:   { cls: 'text-orange-500', icon: AlertCircle },
  MEDIUM: { cls: 'text-yellow-500', icon: Clock },
  LOW:    { cls: 'text-gray-400',   icon: Circle },
} as const

const STATUS_CFG = {
  PENDING:     { cls: 'text-muted-foreground',  icon: Circle },
  IN_PROGRESS: { cls: 'text-blue-600',          icon: Clock },
  COMPLETED:   { cls: 'text-green-600',         icon: CheckCircle2 },
  CANCELLED:   { cls: 'text-muted-foreground',  icon: Circle },
} as const

const TYPE_LABEL: Record<string, string> = {
  CALL:               'שיחה',
  MEETING:            'פגישה',
  SIGNATURE_FOLLOWUP: 'מעקב חתימות',
  DOCUMENT_COLLECTION:'איסוף מסמכים',
  SITE_VISIT:         'ביקור שטח',
  LEGAL_REVIEW:       'בדיקה משפטית',
  GENERAL:            'כללי',
}

function formatDue(iso: string | null): string {
  if (!iso) return 'ללא תאריך יעד'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? 'ללא תאריך יעד'
    : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ProjectTasksTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useTasks({ projectId })

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={4} /></div>

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת המשימות" error={error} onRetry={() => refetch()} />
  }

  if (data.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState message="אין משימות בפרויקט" hint="משימות שייווצרו יופיעו כאן" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{data.length} משימות</p>

      <div className="card-surface divide-y divide-border overflow-hidden">
        {data.map(task => {
          const priority = PRIORITY_CFG[task.priority as keyof typeof PRIORITY_CFG] ?? PRIORITY_CFG.MEDIUM
          const status   = STATUS_CFG[task.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.PENDING
          const StatusIcon = status.icon
          const PriorityIcon = priority.icon
          const assigneeName = task.assignee
            ? `${task.assignee.firstName} ${task.assignee.lastName}`
            : null
          return (
            <div key={task.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20">
              <StatusIcon size={16} className={cn('flex-shrink-0 mt-0.5', status.cls)} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', task.status === 'COMPLETED' && 'line-through text-muted-foreground')}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{TYPE_LABEL[task.type] ?? task.type}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className={cn('text-xs', task.status === 'COMPLETED' ? 'text-muted-foreground' : 'text-foreground/70')}>
                    {formatDue(task.dueDate)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <PriorityIcon size={13} className={priority.cls} />
                {assigneeName && (
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {task.assignee!.firstName.slice(0, 1)}{task.assignee!.lastName.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
