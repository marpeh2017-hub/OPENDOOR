'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownLeft, ArrowUpRight, Mail, MessageCircle, Smartphone, Bell, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { cn } from '@/lib/utils'
import { useCommunications } from '@/hooks/use-communications'
import { NewMessageDialog } from './new-message-dialog'

/** Mirrors the MessageChannel enum. */
export const CHANNEL_CFG: Record<string, { label: string; icon: typeof Mail }> = {
  WHATSAPP: { label: 'וואטסאפ', icon: MessageCircle },
  SMS:      { label: 'SMS',     icon: Smartphone },
  EMAIL:    { label: 'אימייל',  icon: Mail },
  PUSH:     { label: 'התראה',   icon: Bell },
  IN_APP:   { label: 'באפליקציה', icon: Bell },
  PORTAL:   { label: 'פורטל',   icon: Bell },
}

/** Mirrors the MessageStatus enum, including the dispatcher's new states. */
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  QUEUED:     { label: 'בתור',     cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  PROCESSING: { label: 'בשליחה',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  SENT:       { label: 'נשלח',     cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  DELIVERED:  { label: 'נמסר',     cls: 'bg-teal-100 text-teal-700 border-teal-200' },
  READ:       { label: 'נקרא',     cls: 'bg-green-100 text-green-700 border-green-200' },
  FAILED:     { label: 'נכשל',     cls: 'bg-red-100 text-red-700 border-red-200' },
  CANCELLED:  { label: 'בוטלה',    cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function CommunicationsLog() {
  const [channel, setChannel] = useState('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading, isError, error, refetch } = useCommunications(
    channel === 'ALL' ? {} : { channel },
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={channel} onValueChange={setChannel} dir="rtl">
          <SelectTrigger className="w-48"><SelectValue placeholder="ערוץ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הערוצים</SelectItem>
            {Object.entries(CHANNEL_CFG).map(([v, c]) => (
              <SelectItem key={v} value={v}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />
        {data && <span className="text-sm text-muted-foreground">{data.length} הודעות</span>}
        <Button onClick={() => setDialogOpen(true)}>הודעה חדשה</Button>
      </div>

      <div className="card-surface overflow-hidden">
        {isLoading ? (
          <RowsSkeleton rows={6} />
        ) : isError || !data ? (
          <div className="p-4">
            <QueryError message="שגיאה בטעינת התקשורת" error={error} onRetry={() => refetch()} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            message="אין הודעות להצגה"
            hint="הודעות שיישלחו לדיירים יופיעו כאן"
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.map(msg => {
              const chan   = CHANNEL_CFG[msg.channel] ?? { label: msg.channel, icon: Mail }
              const status = STATUS_CFG[msg.status]
                ?? { label: msg.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
              const ChannelIcon  = chan.icon
              const outbound     = msg.direction === 'OUTBOUND'
              const DirectionIcon = outbound ? ArrowUpRight : ArrowDownLeft

              return (
                <li key={msg.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20">
                  <div className={cn(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
                    outbound ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    <ChannelIcon size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <DirectionIcon
                        size={13}
                        className={cn('flex-shrink-0', outbound ? 'text-primary' : 'text-muted-foreground')}
                      />
                      <span className="text-xs font-medium text-muted-foreground">{chan.label}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">{formatWhen(msg.sentAt ?? msg.createdAt)}</span>
                      {msg.residentId && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <Link
                            href={`/residents/${msg.residentId}`}
                            className="text-xs text-primary hover:underline"
                          >
                            לדייר
                          </Link>
                        </>
                      )}
                    </div>

                    {msg.subject && (
                      <p className="mt-1 text-sm font-medium text-foreground">{msg.subject}</p>
                    )}
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/80">{msg.body}</p>

                    {msg.failureReason && (
                      <p className="mt-1 text-xs text-red-600">{msg.failureReason}</p>
                    )}

                    {/*
                      A SIMULATED send is not a send. In development the dev/no-op
                      provider records what WOULD have gone out and transmits
                      nothing — and the single worst failure mode for this whole
                      feature is a staff member believing a resident was contacted
                      when they were not. So this is a loud, unmissable badge on
                      the row itself, driven by a database column, not a subtle
                      styling difference and not a log line.
                    */}
                    {msg.isSimulated && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        סימולציה — ההודעה לא נשלחה בפועל
                      </p>
                    )}

                    {/* A retry is pending: attempts used, and when the next one is due. */}
                    {msg.status === 'QUEUED' && msg.attemptCount > 0 && (
                      <p className="mt-1 text-xs text-amber-700">
                        ניסיון {msg.attemptCount} מתוך {msg.maxAttempts} נכשל — תתבצע שליחה חוזרת
                      </p>
                    )}
                  </div>

                  <span className={cn(
                    'flex-shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    status.cls,
                  )}>
                    {status.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <NewMessageDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
