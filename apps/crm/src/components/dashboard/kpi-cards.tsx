import { TrendingUp, TrendingDown, Users, FolderKanban, FileSignature, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  iconBg: string
}

function KpiCard({ title, value, change, changeLabel, icon, iconBg }: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', iconBg)}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-500')}>
            {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{title}</p>
        {changeLabel && (
          <p className="text-xs text-gray-400 mt-1">{changeLabel}</p>
        )}
      </div>
    </div>
  )
}

export async function KpiCards() {
  // In production this would fetch from the API
  const kpis = [
    {
      title: 'פרויקטים פעילים',
      value: 24,
      change: 12,
      changeLabel: 'לעומת החודש שעבר',
      icon: <FolderKanban size={22} className="text-teal-600" />,
      iconBg: 'bg-teal-50',
    },
    {
      title: 'דיירים פעילים',
      value: '4,821',
      change: 8,
      changeLabel: 'לעומת החודש שעבר',
      icon: <Users size={22} className="text-blue-600" />,
      iconBg: 'bg-blue-50',
    },
    {
      title: 'אחוז חתימות',
      value: '67.3%',
      change: 3.2,
      changeLabel: 'ממוצע על כל הפרויקטים',
      icon: <FileSignature size={22} className="text-purple-600" />,
      iconBg: 'bg-purple-50',
    },
    {
      title: 'לידים חדשים החודש',
      value: 143,
      change: -4,
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
