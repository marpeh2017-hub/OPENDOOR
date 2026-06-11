import { FileSignature, MessageSquare, UserPlus, CheckCircle2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const activities = [
  { id: '1', type: 'SIGNATURE',  user: 'רחל לוי',     action: 'חתמה על הסכם',         project: 'הרצל 45',   time: 'לפני 5 ד׳' },
  { id: '2', type: 'MESSAGE',    user: 'יוסי כהן',    action: 'שלח הודעת WhatsApp',    project: 'בן גוריון', time: 'לפני 12 ד׳' },
  { id: '3', type: 'LEAD',       user: 'מיכל דוד',    action: 'ליד חדש נוסף',          project: '',           time: 'לפני 23 ד׳' },
  { id: '4', type: 'TASK',       user: 'אבי שפירא',   action: 'השלים פגישת דיירים',   project: 'ויצמן 8',   time: 'לפני 1 ש׳' },
  { id: '5', type: 'DOCUMENT',   user: 'נועה ברק',    action: 'העלתה מסמך תב״ע',      project: 'הנביאים 22', time: 'לפני 2 ש׳' },
]

const typeConfig = {
  SIGNATURE: { icon: FileSignature, color: 'text-purple-600', bg: 'bg-purple-50' },
  MESSAGE:   { icon: MessageSquare, color: 'text-blue-600',   bg: 'bg-blue-50' },
  LEAD:      { icon: UserPlus,      color: 'text-teal-600',   bg: 'bg-teal-50' },
  TASK:      { icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50' },
  DOCUMENT:  { icon: Upload,        color: 'text-orange-600', bg: 'bg-orange-50' },
} as const

export async function RecentActivityFeed() {
  return (
    <div className="card-surface h-full">
      <div className="p-4 border-b border-border">
        <h3 className="text-base font-semibold text-gray-800">פעילות אחרונה</h3>
      </div>
      <ul className="divide-y divide-border">
        {activities.map((a) => {
          const cfg = typeConfig[a.type as keyof typeof typeConfig]
          const Icon = cfg.icon
          return (
            <li key={a.id} className="flex items-start gap-3 px-4 py-3">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0', cfg.bg)}>
                <Icon size={15} className={cfg.color} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{a.user}</span>
                  {' '}{a.action}
                  {a.project && <span className="text-teal-600"> · {a.project}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
