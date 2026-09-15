'use client'

import { FolderKanban, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/skeletons'
import { QueryError } from '@/components/ui/query-states'
import { useProjects } from '@/hooks/use-projects'

const SIGNATURE_STAGES = ['SIGNATURES', 'DEVELOPER_SELECTION']
const BUILD_STAGES     = ['CONSTRUCTION', 'EVACUATION']

export function ProjectsStats() {
  const { data, isLoading, isError, error, refetch } = useProjects({ limit: 200 })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    )
  }

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת סיכום הפרויקטים" error={error} onRetry={() => refetch()} />
  }

  const projects = data.data

  // "דורשים טיפול" = below the project's own signature goal (default 67%).
  const needsAttention = projects.filter(p => {
    if (p.status === 'ON_HOLD') return true
    if (p.totalUnits === 0) return false
    const pct = (p.signedUnits / p.totalUnits) * 100
    return pct < (p.signatureGoal ?? 67)
  }).length

  const stats = [
    { label: 'סה"כ פרויקטים', value: data.total,                                            icon: FolderKanban, color: 'text-primary',    bg: 'bg-primary/10' },
    { label: 'בשלב חתימות',   value: projects.filter(p => SIGNATURE_STAGES.includes(p.stage)).length, icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'בבנייה',        value: projects.filter(p => BUILD_STAGES.includes(p.stage)).length,     icon: Clock,        color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'דורשים טיפול',  value: needsAttention,                                        icon: AlertCircle,  color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(s => (
        <div key={s.label} className="kpi-card">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
            <s.icon size={20} className={s.color} />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{s.value}</p>
          <p className="text-sm text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  )
}
