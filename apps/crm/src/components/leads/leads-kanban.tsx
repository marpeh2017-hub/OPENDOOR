'use client'

import { useState } from 'react'
import { AlertTriangle, MapPin, Phone, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useLeads, useMoveLead, type Lead } from '@/hooks/use-leads'

/** Drag payload MIME type. Namespaced so unrelated drops are ignored. */
const DND_TYPE = 'application/x-opendoor-lead'

/** Columns mirror the Lead.status values the API actually emits. */
const COLUMNS: { stage: string; label: string; cls: string; dot: string }[] = [
  { stage: 'NEW',               label: 'ליד חדש',      cls: 'border-t-gray-400',   dot: 'bg-gray-400' },
  { stage: 'CONTACTED',         label: 'נוצר קשר',     cls: 'border-t-blue-500',   dot: 'bg-blue-500' },
  { stage: 'MEETING_SCHEDULED', label: 'נקבעה פגישה',  cls: 'border-t-indigo-500', dot: 'bg-indigo-500' },
  { stage: 'INTERESTED',        label: 'מתעניין',      cls: 'border-t-purple-500', dot: 'bg-purple-500' },
  { stage: 'NEGOTIATION',       label: 'משא ומתן',      cls: 'border-t-orange-500', dot: 'bg-orange-500' },
  // NOTE: the Prisma `LeadStatus` enum spells this SIGNED — there is no `WON`
  // member. Using 'WON' here made the column permanently unreachable (any drop
  // onto it was rejected upstream with a 400).
  { stage: 'SIGNED',            label: 'נחתם',          cls: 'border-t-green-500',  dot: 'bg-green-500' },
  { stage: 'LOST',              label: 'אבד',           cls: 'border-t-red-400',    dot: 'bg-red-400' },
]

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE:      'אתר',
  REFERRAL:     'הפניה',
  SOCIAL_MEDIA: 'רשתות חברתיות',
  WHATSAPP:     'וואטסאפ',
  PHONE:        'טלפון',
  EVENT:        'אירוע',
  OTHER:        'אחר',
}

function scoreTone(score: number): string {
  if (score >= 70) return 'text-green-600 bg-green-50 border-green-200'
  if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-gray-500 bg-gray-50 border-gray-200'
}

function LeadCard({ lead, isMoving }: { lead: Lead; isMoving: boolean }) {
  return (
    <div
      draggable
      data-lead-id={lead.id}
      onDragStart={e => {
        e.dataTransfer.setData(DND_TYPE, lead.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'card-surface p-3 space-y-2 hover:shadow-sm transition-shadow cursor-grab active:cursor-grabbing',
        isMoving && 'opacity-50 pointer-events-none',
      )}
    >
      <p className="text-sm font-semibold text-foreground">
        {lead.firstName} {lead.lastName}
      </p>

      {lead.possibleDuplicateOfId && (
        <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
          <AlertTriangle size={11} aria-hidden="true" />
          כפילות אפשרית
        </span>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {(lead.address || lead.city) && (
          <div className="flex items-center gap-1">
            <MapPin size={11} aria-hidden="true" />
            <span>{[lead.address, lead.city].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1">
            <Phone size={11} />
            <span className="font-mono" dir="ltr">{lead.phone}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        <span className="text-xs text-muted-foreground">
          {lead.source ? (SOURCE_LABELS[lead.source] ?? lead.source) : '—'}
        </span>
        <span className={cn(
          'inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border',
          scoreTone(lead.score),
        )}>
          <Star size={10} />
          {lead.score}
        </span>
      </div>
    </div>
  )
}

function KanbanColumn({ stage, label, cls, dot, leads, onDropLead, movingId }: {
  stage: string; label: string; cls: string; dot: string; leads: Lead[]
  onDropLead: (leadId: string, stage: string) => void
  movingId: string | null
}) {
  const [isOver, setIsOver] = useState(false)

  return (
    <div
      className="flex flex-col min-w-72 max-w-72"
      data-stage={stage}
      onDragOver={e => {
        // Only claim the drop if this drag actually carries a lead.
        if (!e.dataTransfer.types.includes(DND_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => {
        const id = e.dataTransfer.getData(DND_TYPE)
        setIsOver(false)
        if (!id) return
        e.preventDefault()
        // No-op when the card is dropped back on the column it came from.
        if (leads.some(l => l.id === id)) return
        onDropLead(id, stage)
      }}
    >
      <div className={cn(
        'card-surface border-t-[3px] p-3 mb-3 transition-colors',
        cls,
        isOver && 'ring-2 ring-primary/50',
      )}>
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', dot)} />
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
            {leads.length}
          </span>
        </div>
      </div>

      <div className={cn(
        'flex-1 space-y-2.5 min-h-32 rounded-lg transition-colors',
        isOver && 'bg-primary/5',
      )}>
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} isMoving={movingId === lead.id} />
        ))}
      </div>
    </div>
  )
}

export function LeadsKanban({ search, source }: { search?: string; source?: string }) {
  const { data, isLoading, isError, error, refetch } = useLeads({
    limit: 200,
    ...(search ? { search } : {}),
    ...(source ? { source } : {}),
  })
  const moveLead = useMoveLead()
  const [movingId, setMovingId] = useState<string | null>(null)

  const handleDropLead = (leadId: string, stage: string) => {
    setMovingId(leadId)
    moveLead.mutate(
      { id: leadId, status: stage },
      { onSettled: () => setMovingId(null) },
    )
  }

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={5} /></div>

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת הלידים" error={error} onRetry={() => refetch()} />
  }

  if (data.data.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState message="אין לידים" hint="לידים חדשים יופיעו כאן" />
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {COLUMNS.map(col => (
        <KanbanColumn
          key={col.stage}
          {...col}
          leads={data.data.filter(l => l.status === col.stage)}
          onDropLead={handleDropLead}
          movingId={movingId}
        />
      ))}
    </div>
  )
}
