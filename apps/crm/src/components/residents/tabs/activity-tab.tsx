import { CheckCircle2, FileText, MessageSquare, Phone, Calendar, UserCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ActivityType = 'STATUS_CHANGE' | 'DOCUMENT' | 'MESSAGE' | 'CALL' | 'MEETING' | 'SIGNATURE' | 'ALERT'

const ACTIVITY_CFG: Record<ActivityType, { icon: React.ElementType; cls: string; bg: string }> = {
  STATUS_CHANGE: { icon: UserCheck,    cls: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
  DOCUMENT:      { icon: FileText,     cls: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  MESSAGE:       { icon: MessageSquare,cls: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30' },
  CALL:          { icon: Phone,        cls: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-900/30' },
  MEETING:       { icon: Calendar,     cls: 'text-teal-600',   bg: 'bg-teal-100 dark:bg-teal-900/30' },
  SIGNATURE:     { icon: CheckCircle2, cls: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30' },
  ALERT:         { icon: AlertTriangle,cls: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/30' },
}

const mockActivity = [
  { id: '1', type: 'SIGNATURE'     as ActivityType, text: 'חתם על הסכם פינוי-בינוי',              date: '15.03.2024', time: '10:30', user: 'אבי שמואלי' },
  { id: '2', type: 'MEETING'       as ActivityType, text: 'נפגש לצורך הצגת טיוטת הסכם',          date: '20.02.2024', time: '18:30', user: 'אבי שמואלי' },
  { id: '3', type: 'DOCUMENT'      as ActivityType, text: 'נסח טאבו התקבל ואומת',                 date: '14.02.2024', time: '14:45', user: 'שרה מזרחי' },
  { id: '4', type: 'CALL'          as ActivityType, text: 'שיחה טלפונית – דיון על תנאי ההסכם',   date: '25.02.2024', time: '10:45', user: 'שרה מזרחי' },
  { id: '5', type: 'STATUS_CHANGE' as ActivityType, text: 'שינוי סטטוס: מעוניין → חתם',           date: '15.03.2024', time: '10:31', user: 'מערכת' },
  { id: '6', type: 'MESSAGE'       as ActivityType, text: 'הודעת וואטסאפ נשלחה – הזמנה לפגישה',  date: '10.01.2024', time: '09:15', user: 'אבי שמואלי' },
  { id: '7', type: 'MEETING'       as ActivityType, text: 'פגישת היכרות ראשונית',                  date: '15.01.2024', time: '17:00', user: 'אבי שמואלי' },
]

export function ResidentActivityTab({ residentId }: { residentId: string }) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute right-[19px] top-0 bottom-0 w-px bg-border" />

      <div className="space-y-0">
        {mockActivity.map(item => {
          const cfg = ACTIVITY_CFG[item.type]
          const Icon = cfg.icon
          return (
            <div key={item.id} className="relative flex gap-4 pb-5">
              <div className={cn(
                'relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border',
                cfg.bg,
              )}>
                <Icon size={15} className={cfg.cls} />
              </div>

              <div className="flex-1 min-w-0 pt-2">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium leading-snug">{item.text}</p>
                  <div className="flex-shrink-0 text-left">
                    <p className="text-xs text-muted-foreground">{item.date}</p>
                    <p className="text-xs text-muted-foreground/60 text-left">{item.time}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{item.user}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
