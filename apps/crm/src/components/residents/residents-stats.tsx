'use client'

import { Users, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/skeletons'
import { QueryError } from '@/components/ui/query-states'
import { useResidents } from '@/hooks/use-residents'

const PENDING_STATUSES = ['INTERESTED', 'CONTACTED', 'UNDECIDED', 'NOT_CONTACTED', 'UNREACHABLE']

export function ResidentsStats() {
  // limit high enough to aggregate the whole tenant; `total` is authoritative.
  const { data, isLoading, isError, error, refetch } = useResidents({ limit: 500 })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    )
  }

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת סיכום הדיירים" error={error} onRetry={() => refetch()} />
  }

  const residents = data.data
  const total     = data.total
  const signed    = residents.filter(r => r.signatureStatus === 'SIGNED').length
  const pending   = residents.filter(r => PENDING_STATUSES.includes(r.signatureStatus)).length
  const objecting = residents.filter(r => r.signatureStatus === 'OBJECTING').length

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const projectCount = new Set(
    residents.map(r => r.apartment?.building?.complex?.project?.name).filter(Boolean),
  ).size

  const stats = [
    { label: 'סה"כ דיירים', value: total,     sub: `ב-${projectCount} פרויקטים`, icon: Users,         cls: 'text-blue-600',  bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'חתמו',        value: signed,    sub: `${pct(signed)}% מהסך הכולל`, icon: CheckCircle2,  cls: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'ממתינים',     value: pending,   sub: `${pct(pending)}% ממתינים`,   icon: Clock,         cls: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'מתנגדים',     value: objecting, sub: 'דורשים טיפול',               icon: AlertTriangle, cls: 'text-red-600',   bg: 'bg-red-50 dark:bg-red-900/20' },
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
