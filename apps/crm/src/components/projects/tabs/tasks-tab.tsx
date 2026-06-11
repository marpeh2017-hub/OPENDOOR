import { Plus, CheckCircle2, Clock, AlertCircle, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const PRIORITY_CFG = {
  URGENT: { cls: 'text-red-600',    icon: AlertCircle },
  HIGH:   { cls: 'text-orange-500', icon: AlertCircle },
  MEDIUM: { cls: 'text-yellow-500', icon: Clock },
  LOW:    { cls: 'text-gray-400',   icon: Circle },
} as const

const STATUS_CFG = {
  PENDING:     { cls: 'text-muted-foreground',  icon: Circle },
  IN_PROGRESS: { cls: 'text-blue-600',          icon: Clock },
  COMPLETED:   { cls: 'text-green-600',         icon: CheckCircle2 },
} as const

const TYPE_LABEL: Record<string, string> = {
  CALL:               'שיחה',
  MEETING:            'פגישה',
  SIGNATURE_FOLLOWUP: 'מעקב חתימות',
  DOCUMENT_COLLECTION:'איסוף מסמכים',
  SITE_VISIT:         'ביקור שטח',
  LEGAL_REVIEW:       'בדיקה משפטית',
  GENERAL:            'כללי',
}

const mockTasks = [
  { id: '1', title: 'פגישת דיירים – הצגת תוכנית',  type: 'MEETING',            priority: 'HIGH',   status: 'IN_PROGRESS', due: 'היום 14:00',  assignee: 'אבי ש׳' },
  { id: '2', title: 'מעקב חתימות – דוד לוי',       type: 'SIGNATURE_FOLLOWUP', priority: 'URGENT', status: 'PENDING',     due: 'מחר',         assignee: 'שרה מ׳' },
  { id: '3', title: 'קבלת נסח טאבו מעודכן',        type: 'DOCUMENT_COLLECTION',priority: 'MEDIUM', status: 'PENDING',     due: 'עוד 3 ימים',  assignee: 'אבי ש׳' },
  { id: '4', title: 'שיחה עם עו"ד לוי',            type: 'CALL',               priority: 'LOW',    status: 'COMPLETED',   due: 'אתמול',       assignee: 'שרה מ׳' },
]

export function ProjectTasksTab({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{mockTasks.length} משימות</p>
        <Button size="sm" variant="outline" className="gap-2 h-8">
          <Plus size={13} /> משימה חדשה
        </Button>
      </div>

      <div className="card-surface divide-y divide-border overflow-hidden">
        {mockTasks.map(task => {
          const priority = PRIORITY_CFG[task.priority as keyof typeof PRIORITY_CFG]
          const status = STATUS_CFG[task.status as keyof typeof STATUS_CFG]
          const StatusIcon = status.icon
          const PriorityIcon = priority.icon
          return (
            <div key={task.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20">
              <StatusIcon size={16} className={cn('flex-shrink-0 mt-0.5', status.cls)} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', task.status === 'COMPLETED' && 'line-through text-muted-foreground')}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{TYPE_LABEL[task.type]}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className={cn('text-xs', task.status === 'COMPLETED' ? 'text-muted-foreground' : 'text-foreground/70')}>
                    {task.due}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <PriorityIcon size={13} className={priority.cls} />
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {task.assignee.slice(0,2)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
