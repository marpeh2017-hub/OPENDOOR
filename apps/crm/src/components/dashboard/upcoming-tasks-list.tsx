import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const mockTasks = [
  { id: '1', title: 'פגישה עם וועד בית ברחוב הרצל', due: 'היום 14:00', priority: 'HIGH', type: 'MEETING' },
  { id: '2', title: 'מעקב חתימות – בן גוריון 12', due: 'מחר 10:00', priority: 'URGENT', type: 'SIGNATURE_FOLLOWUP' },
  { id: '3', title: 'העלאת מסמכי קרקע לפרויקט ויצמן', due: 'מחרתיים', priority: 'MEDIUM', type: 'DOCUMENT_COLLECTION' },
  { id: '4', title: 'שיחה עם עו״ד שלמה כץ', due: 'יום ה׳', priority: 'LOW', type: 'CALL' },
]

const priorityConfig = {
  URGENT: { color: 'text-red-600',    bg: 'bg-red-50',    icon: AlertCircle },
  HIGH:   { color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock },
  MEDIUM: { color: 'text-teal-600',   bg: 'bg-teal-50',   icon: Clock },
  LOW:    { color: 'text-gray-500',   bg: 'bg-gray-50',   icon: Clock },
} as const

export async function UpcomingTasksList() {
  return (
    <div className="card-surface h-full">
      <div className="p-4 border-b border-border">
        <h3 className="text-base font-semibold text-gray-800">משימות קרובות</h3>
      </div>
      <ul className="divide-y divide-border">
        {mockTasks.map((task) => {
          const cfg = priorityConfig[task.priority as keyof typeof priorityConfig]
          const Icon = cfg.icon
          return (
            <li key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5', cfg.bg)}>
                <Icon size={14} className={cfg.color} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{task.due}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
