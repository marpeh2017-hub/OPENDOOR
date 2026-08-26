'use client'

import { TrendingUp, TrendingDown, Users, FolderKanban, FileSignature, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CardSkeleton } from '@/components/ui/skeletons'
import { QueryError } from '@/components/ui/query-states'
import { useDashboardStats } from '@/hooks/use-dashboard'

interface KpiCardProps {
  title: string
  value: string | number
  /**
   * Month-over-month change.
   *
   * NULL means there is no baseline to compare against — the previous period
   * was zero. That is rendered as "חדש", not as a percentage: the server used
   * to send 100 for this case and "+100%" reads as "we doubled", which is not
   * what going from nothing to something means.
   */
  change?: number | null
  changeLabel?: string
  icon: React.ReactNode
  iconBg: string
}

function KpiCard({ title, value, change, changeLabel, icon, iconBg }: KpiCardProps) {
  const hasBaseline = change !== undefined && change !== null
  const isPositive = hasBaseline && change >= 0
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', iconBg)}>
          {icon}
        </div>
        {hasBaseline && (
          <div className={cn('flex items-center gap-1 text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-500')}>
            {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(change)}%
          </div>
        )}
        {change === null && (
          <span className="text-xs font-medium text-teal-600">חדש</span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{title}</p>
        {changeLabel && (
          <p className="text-xs text-gray-400 mt-1">
            {/* With no baseline there was no comparison, so the caller's
                "לעומת החודש שעבר" would be claiming one that never happened. */}
            {change === null ? 'אין נתוני השוואה לחודש קודם' : changeLabel}
          </p>
        )}
      </div>
    </div>
  )
}

export function KpiCards() {
  const { data, isLoading, isError, error, refetch } = useDashboardStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    )
  }

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת נתוני לוח הבקרה" error={error} onRetry={() => refetch()} />
  }

  const k = data.kpis
  const kpis = [
    {
      title: 'פרויקטים פעילים',
      value: k.activeProjects,
      change: k.projectsChange,
      changeLabel: 'לעומת החודש שעבר',
      icon: <FolderKanban size={22} className="text-teal-600" />,
      iconBg: 'bg-teal-50',
    },
    {
      title: 'דיירים פעילים',
      value: k.activeResidents.toLocaleString('he-IL'),
      change: k.residentsChange,
      changeLabel: 'לעומת החודש שעבר',
      icon: <Users size={22} className="text-blue-600" />,
      iconBg: 'bg-blue-50',
    },
    {
      title: 'אחוז חתימות',
      value: `${k.avgSignaturePct}%`,
      change: k.signaturesChange,
      changeLabel: 'ממוצע על כל הפרויקטים',
      icon: <FileSignature size={22} className="text-purple-600" />,
      iconBg: 'bg-purple-50',
    },
    {
      title: 'לידים חדשים החודש',
      value: k.newLeadsThisMonth,
      change: k.leadsChange,
      changeLabel: 'לעומת החודש שעבר',
      icon: <UserPlus size={22} className="text-orange-600" />,
      iconBg: 'bg-orange-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  )
}
