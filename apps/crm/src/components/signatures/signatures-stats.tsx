import { FileSignature, CheckCircle2, Clock, Send, AlertTriangle } from 'lucide-react'

const stats = [
  { label: 'סה"כ בקשות',   value: '48',  sub: 'ב-8 פרויקטים',     icon: FileSignature, cls: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { label: 'חתמו',          value: '29',  sub: '60% השלימו',        icon: CheckCircle2,  cls: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  { label: 'ממתינים',       value: '14',  sub: 'בקשה נשלחה',        icon: Clock,         cls: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { label: 'פג תוקף',       value: '5',   sub: 'דורשים שליחה מחדש', icon: AlertTriangle, cls: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
]

export function SignaturesStats() {
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
