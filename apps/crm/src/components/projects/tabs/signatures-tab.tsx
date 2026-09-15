'use client'

import { Eye, CheckCircle2, XCircle, Clock, HelpCircle, PhoneOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useSignatureReport } from '@/hooks/use-signatures'

const STATUS_CONFIG = {
  SIGNED:        { label: 'חתם',          icon: CheckCircle2, cls: 'text-green-600 bg-green-50' },
  INTERESTED:    { label: 'מעוניין',       icon: Eye,          cls: 'text-blue-600 bg-blue-50' },
  CONTACTED:     { label: 'נוצר קשר',     icon: Eye,          cls: 'text-teal-600 bg-teal-50' },
  UNDECIDED:     { label: 'מתלבט',        icon: HelpCircle,   cls: 'text-yellow-600 bg-yellow-50' },
  OBJECTING:     { label: 'מתנגד',        icon: XCircle,      cls: 'text-red-600 bg-red-50' },
  NOT_CONTACTED: { label: 'לא נוצר קשר', icon: Clock,        cls: 'text-gray-500 bg-gray-50' },
  UNREACHABLE:   { label: 'לא זמין',      icon: PhoneOff,     cls: 'text-orange-600 bg-orange-50' },
} as const

const SIGNED_STATUSES  = ['SIGNED']
const PENDING_STATUSES = ['INTERESTED', 'CONTACTED', 'UNDECIDED']

export function ProjectSignaturesTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useSignatureReport(projectId)

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={6} /></div>

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת דוח החתימות" error={error} onRetry={() => refetch()} />
  }

  const residents = data.residents ?? []
  const counts = {
    signed:    residents.filter(r => SIGNED_STATUSES.includes(r.signatureStatus)).length,
    pending:   residents.filter(r => PENDING_STATUSES.includes(r.signatureStatus)).length,
    objecting: residents.filter(r => r.signatureStatus === 'OBJECTING').length,
  }

  return (
    <div className="space-y-4">
      {/* Stats — real figures from the signature report */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-surface p-4 text-center">
          <p className="text-2xl font-black text-green-600">{counts.signed}</p>
          <p className="text-xs text-muted-foreground mt-1">חתמו</p>
        </div>
        <div className="card-surface p-4 text-center">
          <p className="text-2xl font-black text-teal-600">{counts.pending}</p>
          <p className="text-xs text-muted-foreground mt-1">בתהליך</p>
        </div>
        <div className="card-surface p-4 text-center">
          <p className="text-2xl font-black text-red-600">{counts.objecting}</p>
          <p className="text-xs text-muted-foreground mt-1">מתנגדים</p>
        </div>
      </div>

      {/* Per-resident status */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">מעקב חתימות</h3>
          <p className="text-xs text-muted-foreground">
            {data.signedUnits} מתוך {data.totalUnits} יחידות · {data.percentage}%
          </p>
        </div>

        {residents.length === 0 ? (
          <EmptyState message="אין דיירים לדיווח" hint="דוח החתימות יתמלא לאחר שיוך דיירים" />
        ) : (
          <div className="divide-y divide-border">
            {residents.map(r => {
              const cfg = STATUS_CONFIG[r.signatureStatus as keyof typeof STATUS_CONFIG]
                ?? { label: r.signatureStatus, icon: Clock, cls: 'text-gray-500 bg-gray-50' }
              const Icon = cfg.icon
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0', cfg.cls)}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.firstName} {r.lastName}</p>
                    {r.phone && (
                      <p className="text-xs text-muted-foreground font-mono" dir="ltr">{r.phone}</p>
                    )}
                  </div>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
