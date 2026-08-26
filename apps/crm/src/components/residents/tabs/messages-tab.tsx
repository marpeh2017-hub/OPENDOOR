'use client'

import { MessageSquare, Mail, Phone, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useCommunications } from '@/hooks/use-communications'

const CHANNEL_CFG: Record<string, { icon: React.ElementType; label: string; cls: string; bg: string }> = {
  WHATSAPP: { icon: MessageSquare, label: 'וואטסאפ', cls: 'text-green-600', bg: 'bg-green-50' },
  SMS:      { icon: Send,          label: 'SMS',     cls: 'text-blue-600',  bg: 'bg-blue-50' },
  EMAIL:    { icon: Mail,          label: 'אימייל',  cls: 'text-purple-600', bg: 'bg-purple-50' },
  PHONE:    { icon: Phone,         label: 'טלפון',   cls: 'text-teal-600',  bg: 'bg-teal-50' },
}

export function ResidentMessagesTab({ residentId }: { residentId: string }) {
  const { data, isLoading, isError, error, refetch } = useCommunications({ residentId })

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={4} /></div>

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת התקשורת" error={error} onRetry={() => refetch()} />
  }

  if (data.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState message="אין תקשורת רשומה עם הדייר" hint="הודעות שיישלחו יתועדו כאן" />
      </div>
    )
  }

  return (
    <div className="card-surface divide-y divide-border overflow-hidden">
      {data.map(c => {
        const cfg = CHANNEL_CFG[c.channel]
          ?? { icon: MessageSquare, label: c.channel, cls: 'text-gray-500', bg: 'bg-gray-50' }
        const Icon = cfg.icon
        // Message.body is non-nullable in the schema; there is no `content` column.
        const text = c.body ?? ''
        const when = c.sentAt ?? c.createdAt
        return (
          <div key={c.id} className="flex items-start gap-3 px-4 py-3.5">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0', cfg.bg)}>
              <Icon size={14} className={cfg.cls} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{cfg.label}</span>
                {c.direction && (
                  <span className="text-xs text-muted-foreground">
                    {c.direction === 'OUTBOUND' ? 'יוצא' : 'נכנס'}
                  </span>
                )}
              </div>
              {c.subject && <p className="text-sm font-medium text-foreground mt-0.5">{c.subject}</p>}
              {text && <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{text}</p>}
              <p className="text-xs text-muted-foreground/70 mt-1">
                {new Date(when).toLocaleString('he-IL', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
                {c.status && ` · ${c.status}`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
