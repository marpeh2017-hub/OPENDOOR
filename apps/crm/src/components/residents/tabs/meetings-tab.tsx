import { Calendar, Clock, MapPin, CheckCircle2, Circle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const mockMeetings = [
  {
    id: '1',
    title: 'פגישת היכרות ראשונית',
    date: '15.01.2024',
    time: '17:00',
    location: 'משרדי החברה, תל אביב',
    attendees: ['אבי שמואלי', 'שרה מזרחי'],
    summary: 'הוצגה תוכנית הפינוי-בינוי. הדייר הביע עניין ראשוני וביקש לקחת זמן לעיין בחומרים.',
    completed: true,
  },
  {
    id: '2',
    title: 'הצגת טיוטת הסכם',
    date: '20.02.2024',
    time: '18:30',
    location: 'בבית הדייר',
    attendees: ['אבי שמואלי', 'עו"ד שרה לוי'],
    summary: 'נדונו תנאי ההסכם, דייר הציג מספר שאלות. עו"ד לוי הסבירה את הסעיפים העיקריים.',
    completed: true,
  },
  {
    id: '3',
    title: 'חתימה על ההסכם',
    date: '15.03.2024',
    time: '10:00',
    location: 'משרד נוטריון לוי, רמת גן',
    attendees: ['אבי שמואלי', 'עו"ד שרה לוי', 'נוטריון'],
    summary: 'ההסכם נחתם בהצלחה בנוכחות נוטריון.',
    completed: true,
  },
  {
    id: '4',
    title: 'עדכון התקדמות פרויקט',
    date: '20.07.2024',
    time: '16:00',
    location: 'זום',
    attendees: ['שרה מזרחי'],
    summary: null,
    completed: false,
  },
]

export function ResidentMeetingsTab({ residentId }: { residentId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-2 h-8">
          <Plus size={13} /> קביעת פגישה
        </Button>
      </div>

      <div className="space-y-3">
        {mockMeetings.map(meeting => (
          <div key={meeting.id} className={cn(
            'card-surface p-4 space-y-3',
            !meeting.completed && 'border-primary/30 bg-primary/5'
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                {meeting.completed
                  ? <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                  : <Circle size={16} className="text-primary flex-shrink-0" />
                }
                <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
              </div>
              {!meeting.completed && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  מתוכנן
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pe-6">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} />
                {meeting.date}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} />
                {meeting.time}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={12} />
                {meeting.location}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {meeting.attendees.map(a => (
                <span key={a} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {a}
                </span>
              ))}
            </div>

            {meeting.summary && (
              <p className="text-xs text-muted-foreground border-t border-border pt-2 leading-relaxed">
                {meeting.summary}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
