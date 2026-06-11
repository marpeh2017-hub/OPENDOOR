import { Users, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

const stats = [
  { label: 'סה"כ דיירים',   value: '312', sub: 'ב-8 פרויקטים',   icon: Users,         cls: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { label: 'חתמו',           value: '187', sub: '60% מהסך הכולל', icon: CheckCircle2,  cls: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  { label: 'ממתינים',        value: '98',  sub: '31% ממתינים',    icon: Clock,         cls: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { label: 'מתנגדים',        value: '27',  sub: 'דורשים טיפול',   icon: AlertTriangle, cls: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
]

export function ResidentsStats() {
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
