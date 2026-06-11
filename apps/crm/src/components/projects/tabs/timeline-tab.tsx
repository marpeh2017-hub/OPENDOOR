import { CheckCircle2, Clock, FileText, Users, MessageSquare, AlertCircle, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type EventType = 'STAGE_CHANGE' | 'MEETING' | 'DOCUMENT' | 'SIGNATURE' | 'NOTE' | 'ALERT' | 'MILESTONE'

const EVENT_CFG: Record<EventType, { icon: React.ElementType; cls: string; bg: string }> = {
  STAGE_CHANGE: { icon: CheckCircle2,   cls: 'text-green-600',   bg: 'bg-green-100 dark:bg-green-900/30' },
  MEETING:      { icon: Users,          cls: 'text-blue-600',    bg: 'bg-blue-100 dark:bg-blue-900/30' },
  DOCUMENT:     { icon: FileText,       cls: 'text-purple-600',  bg: 'bg-purple-100 dark:bg-purple-900/30' },
  SIGNATURE:    { icon: CheckCircle2,   cls: 'text-teal-600',    bg: 'bg-teal-100 dark:bg-teal-900/30' },
  NOTE:         { icon: MessageSquare,  cls: 'text-gray-500',    bg: 'bg-gray-100 dark:bg-gray-800' },
  ALERT:        { icon: AlertCircle,    cls: 'text-red-600',     bg: 'bg-red-100 dark:bg-red-900/30' },
  MILESTONE:    { icon: Star,           cls: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
}

interface TimelineEvent {
  id: string
  type: EventType
  title: string
  description?: string
  date: string
  time?: string
  user?: string
}

const mockEvents: TimelineEvent[] = [
  {
    id: '1',
    type: 'MILESTONE',
    title: 'פרויקט נפתח במערכת',
    description: 'פרויקט רחוב הרצל 42 נוצר ושויך לצוות',
    date: '10.01.2024',
    time: '09:15',
    user: 'אבי שמואלי',
  },
  {
    id: '2',
    type: 'MEETING',
    title: 'פגישת היכרות עם נציגות הדיירים',
    description: 'נכחו 14 מתוך 24 בעלי דירות. הוצגה תוכנית הפינוי-בינוי',
    date: '22.01.2024',
    time: '18:00',
    user: 'שרה מזרחי',
  },
  {
    id: '3',
    type: 'STAGE_CHANGE',
    title: 'מעבר שלב: גיוס → היתכנות',
    description: 'הפרויקט עבר לשלב בדיקת היתכנות לאחר אישור ועד הבית',
    date: '05.02.2024',
    time: '11:30',
    user: 'אבי שמואלי',
  },
  {
    id: '4',
    type: 'DOCUMENT',
    title: 'נסח טאבו התקבל',
    description: 'נסח טאבו מעודכן עבור כל 24 יחידות הדיור התקבל ונשמר',
    date: '14.02.2024',
    time: '14:45',
    user: 'שרה מזרחי',
  },
  {
    id: '5',
    type: 'SIGNATURE',
    title: '8 חתימות התקבלו',
    description: 'מצב חתימות: 8/24 (33%) – הושגה רמת המינימום הראשונית',
    date: '01.03.2024',
    time: '16:00',
    user: 'מערכת',
  },
  {
    id: '6',
    type: 'ALERT',
    title: 'דייר מתנגד – רחל כהן, דירה 12',
    description: 'דיירת הביעה התנגדות פורמלית. נדרש טיפול על-ידי הצוות המשפטי',
    date: '08.03.2024',
    time: '10:20',
    user: 'אבי שמואלי',
  },
  {
    id: '7',
    type: 'MEETING',
    title: 'פגישה עם עו"ד לוי – ייעוץ משפטי',
    description: 'נדונו הסדרי פינוי, לוחות זמנים וחובות היזם',
    date: '20.03.2024',
    time: '09:00',
    user: 'שרה מזרחי',
  },
  {
    id: '8',
    type: 'NOTE',
    title: 'עדכון פנימי: עיריה אישרה תב"ע',
    description: 'קיבלנו אישור עקרוני מהעיריה לתוכנית הבנייה – מהווה מבוא לקידום הפרויקט',
    date: '02.04.2024',
    time: '13:00',
    user: 'אבי שמואלי',
  },
]

export function ProjectTimelineTab({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-1">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute right-[19px] top-0 bottom-0 w-px bg-border" />

        <div className="space-y-0">
          {mockEvents.map((event, idx) => {
            const cfg = EVENT_CFG[event.type]
            const Icon = cfg.icon
            const isLast = idx === mockEvents.length - 1

            return (
              <div key={event.id} className="relative flex gap-4 pb-6">
                {/* Icon bubble */}
                <div className={cn(
                  'relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border',
                  cfg.bg,
                )}>
                  <Icon size={16} className={cfg.cls} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{event.title}</p>
                    <div className="flex-shrink-0 text-left">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">{event.date}</p>
                      {event.time && (
                        <p className="text-xs text-muted-foreground/60 text-left">{event.time}</p>
                      )}
                    </div>
                  </div>

                  {event.description && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {event.description}
                    </p>
                  )}

                  {event.user && (
                    <p className="mt-1.5 text-xs text-muted-foreground/50">
                      {event.user}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
