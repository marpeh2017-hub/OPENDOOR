'use client'

import { Activity, Phone, FileSignature, MessageSquare, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useResident } from '@/hooks/use-residents'

const TYPE_CFG: Record<string, { icon: React.ElementType; cls: string; bg: string }> = {
  status_change: { icon: FileSignature,  cls: 'text-purple-600', bg: 'bg-purple-50' },
  call:          { icon: Phone,          cls: 'text-blue-600',   bg: 'bg-blue-50' },
  message:       { icon: MessageSquare,  cls: 'text-teal-600',   bg: 'bg-teal-50' },
  note:          { icon: StickyNote,     cls: 'text-amber-600',  bg: 'bg-amber-50' },
}

export function ResidentActivityTab({ residentId }: { residentId: string }) {
  const { data: r, isLoading, isError, error, refetch } = useResident(residentId)

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={5} /></div>

  if (isError || !r) {
    return <QueryError message="שגיאה בטעינת הפעילות" error={error} onRetry={() => refetch()} />
  }

  const events = r.activityLog ?? []

  if (events.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState message="אין פעילות רשומה לדייר" hint="שיחות, הודעות ושינויי סטטוס יופיעו כאן" />
      </div>
    )
  }

  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {events.map(e => {
        const cfg = TYPE_CFG[e.type] ?? { icon: Activity, cls: 'text-gray-500', bg: 'bg-gray-50' }
        const Icon = cfg.icon
        return (
          <div key={e.id} className="flex items-start gap-3 px-4 py-3.5">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0', cfg.bg)}>
              <Icon size={14} className={cfg.cls} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{e.title}</p>
              {e.note && <p className="text-sm text-muted-foreground mt-0.5">{e.note}</p>}
              <p className="text-xs text-muted-foreground/70 mt-1">
                {new Date(e.createdAt).toLocaleString('he-IL', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
