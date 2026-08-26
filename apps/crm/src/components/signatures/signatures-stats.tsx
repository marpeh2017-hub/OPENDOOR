'use client'

import { FileSignature, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/skeletons'
import { QueryError } from '@/components/ui/query-states'
import { useSignaturePackages } from '@/hooks/use-signatures'

/**
 * Packages that are still moving through the lifecycle. Uses the real status
 * names from the schema — 'PENDING_APPROVAL' used to appear here but is not a
 * member of the documented lifecycle, so it never matched anything; the review
 * state is spelled INTERNAL_REVIEW.
 */
const IN_FLIGHT = ['SENT', 'PARTIALLY_SIGNED', 'APPROVED', 'INTERNAL_REVIEW']

export function SignaturesStats() {
  const { data, isLoading, isError, error, refetch } = useSignaturePackages()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    )
  }

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת סיכום החתימות" error={error} onRetry={() => refetch()} />
  }

  const total     = data.length
  const completed = data.filter(p => p.status === 'COMPLETED').length
  const pending   = data.filter(p => IN_FLIGHT.includes(p.status)).length
  const expired   = data.filter(p => p.status === 'EXPIRED').length

  const projectCount = new Set(data.map(p => p.projectId)).size
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const stats = [
    { label: 'סה"כ חבילות', value: total,     sub: `ב-${projectCount} פרויקטים`, icon: FileSignature, cls: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'הושלמו',      value: completed, sub: `${pct}% השלימו`,             icon: CheckCircle2,  cls: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'בתהליך',      value: pending,   sub: 'ממתינות לחתימה',             icon: Clock,         cls: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'פג תוקף',     value: expired,   sub: 'דורשות שליחה מחדש',          icon: AlertTriangle, cls: 'text-red-600',   bg: 'bg-red-50 dark:bg-red-900/20' },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map(s => {
        const Icon = s.icon
        return (
          <div key={s.label} className="kpi-card">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.bg}`}>
                <Icon size={18} className={s.cls} />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        )
      })}
    </div>
  )
}
