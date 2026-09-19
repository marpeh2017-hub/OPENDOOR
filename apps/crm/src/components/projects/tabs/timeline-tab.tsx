'use client'

import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useProject } from '@/hooks/use-projects'

const STAGE_LABELS: Record<string, string> = {
  DISCOVERY: 'גילוי', FEASIBILITY: 'היתכנות', RESIDENT_ORGANIZATION: 'התארגנות',
  SIGNATURES: 'חתימות', DEVELOPER_SELECTION: 'בחירת יזם', PLANNING: 'תכנון',
  MUNICIPAL_APPROVAL: 'אישור עירוני', PERMIT: 'היתר', EVACUATION: 'פינוי',
  CONSTRUCTION: 'בנייה', DELIVERY: 'מסירה', POST_DELIVERY: 'לאחר מסירה',
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' }
  return {
    date: d.toLocaleDateString('he-IL'),
    time: d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
  }
}

export function ProjectTimelineTab({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError, error, refetch } = useProject(projectId)

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={5} /></div>

  if (isError || !project) {
    return <QueryError message="שגיאה בטעינת ציר הזמן" error={error} onRetry={() => refetch()} />
  }

  // Real stage history from ProjectStageHistory, newest first.
  const events = [...project.stages].sort(
    (a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime(),
  )

  if (events.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState
          message="אין היסטוריית שלבים לפרויקט"
          hint="אירועים יתועדו אוטומטית עם כל קידום שלב"
        />
      </div>
    )
  }

  return (
    <div className="card-surface p-6">
      <ol className="relative">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1
          const { date, time } = formatDateTime(event.enteredAt)
          return (
            <li key={event.id} className="flex gap-4 pb-6 last:pb-0">
              {/* Rail */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 size={15} className="text-green-600" />
                </div>
                {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
              </div>

              {/* Content */}
              <div className={cn('min-w-0 flex-1', !isLast && '-mt-0.5')}>
                <p className="text-sm font-medium text-foreground">
                  מעבר לשלב: {STAGE_LABELS[event.stage] ?? event.stage}
                </p>
                {event.notes && (
                  <p className="text-sm text-muted-foreground mt-0.5">{event.notes}</p>
                )}
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {date}{time && ` · ${time}`}
                  {event.exitedAt && ` · הסתיים ${formatDateTime(event.exitedAt).date}`}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
