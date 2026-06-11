import { FolderKanban, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

const stats = [
  { label: 'סה"כ פרויקטים', value: 24, icon: FolderKanban, color: 'text-primary', bg: 'bg-primary/10' },
  { label: 'בשלב חתימות',   value: 8,  icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
  { label: 'בבנייה',        value: 6,  icon: Clock,        color: 'text-green-600',  bg: 'bg-green-50' },
  { label: 'דורשים טיפול',  value: 3,  icon: AlertCircle,  color: 'text-orange-600', bg: 'bg-orange-50' },
]

export function ProjectsStats() {
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
