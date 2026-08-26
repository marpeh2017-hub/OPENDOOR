'use client'

import { Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useDashboardStats } from '@/hooks/use-dashboard'

const priorityConfig = {
  URGENT: { color: 'text-red-600',    bg: 'bg-red-50',    icon: AlertCircle },
  HIGH:   { color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock },
  MEDIUM: { color: 'text-teal-600',   bg: 'bg-teal-50',   icon: Clock },
  LOW:    { color: 'text-gray-500',   bg: 'bg-gray-50',   icon: Clock },
} as const

function formatDue(iso: string | null): string {
  if (!iso) return 'ללא תאריך יעד'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'ללא תאריך יעד'
  return date.toLocaleDateString('he-IL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function UpcomingTasksList() {
  const { data, isLoading, isError, error, refetch } = useDashboardStats()

  return (
    <div className="card-surface h-full">
      <div className="p-4 border-b border-border">
        <h3 className="text-base font-semibold text-gray-800">משימות קרובות</h3>
      </div>

      {isLoading && <RowsSkeleton rows={4} />}

      {!isLoading && (isError || !data) && (
        <QueryError message="שגיאה בטעינת המשימות" error={error} onRetry={() => refetch()} />
      )}

      {!isLoading && data && data.upcomingTasks.length === 0 && (
        <EmptyState message="אין משימות פתוחות" hint="משימות חדשות יופיעו כאן" />
      )}

      {!isLoading && data && data.upcomingTasks.length > 0 && (
        <ul className="divide-y divide-border">
          {data.upcomingTasks.map((task) => {
            const cfg = priorityConfig[task.priority as keyof typeof priorityConfig] ?? priorityConfig.MEDIUM
            const Icon = cfg.icon
            return (
              <li key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5', cfg.bg)}>
                  <Icon size={14} className={cfg.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDue(task.dueDate)}
                    {task.assignee && <span> · {task.assignee}</span>}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
