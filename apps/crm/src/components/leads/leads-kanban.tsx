import { MapPin, Phone, Calendar, Building2, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST'

const COLUMNS: { stage: LeadStage; label: string; cls: string; dot: string }[] = [
  { stage: 'NEW',         label: 'ליד חדש',     cls: 'border-t-gray-400',   dot: 'bg-gray-400' },
  { stage: 'CONTACTED',   label: 'נוצר קשר',    cls: 'border-t-blue-500',   dot: 'bg-blue-500' },
  { stage: 'QUALIFIED',   label: 'מוכשר',        cls: 'border-t-purple-500', dot: 'bg-purple-500' },
  { stage: 'PROPOSAL',    label: 'הצעה נשלחה',  cls: 'border-t-amber-500',  dot: 'bg-amber-500' },
  { stage: 'NEGOTIATION', label: 'משא ומתן',     cls: 'border-t-orange-500', dot: 'bg-orange-500' },
  { stage: 'WON',         label: 'זכה',          cls: 'border-t-green-500',  dot: 'bg-green-500' },
  { stage: 'LOST',        label: 'אבד',          cls: 'border-t-red-400',    dot: 'bg-red-400' },
]

type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'
const PRIORITY_CLS: Record<Priority, string> = {
  URGENT: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400',
  HIGH:   'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400',
  MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
  LOW:    'text-gray-500 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
}
const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: 'דחוף', HIGH: 'גבוה', MEDIUM: 'בינוני', LOW: 'נמוך',
}

interface Lead {
  id: string
  name: string
  address: string
  city: string
  units: number
  source: string
  priority: Priority
  stage: LeadStage
  assignee: string
  nextAction?: string
  nextDate?: string
  value?: string
}

const mockLeads: Lead[] = [
  { id: 'l1',  name: 'פרויקט ויצמן 12',    address: 'ויצמן 12',   city: 'תל אביב',   units: 32, source: 'הפניה',  priority: 'HIGH',   stage: 'NEW',         assignee: 'אבי ש׳',  nextAction: 'שיחת היכרות',  nextDate: 'היום' },
  { id: 'l2',  name: 'פרויקט רוטשילד 5',   address: 'רוטשילד 5',  city: 'רמת גן',    units: 18, source: 'אתר',    priority: 'MEDIUM', stage: 'NEW',         assignee: 'שרה מ׳' },
  { id: 'l3',  name: 'גורדון 29',           address: 'גורדון 29',  city: 'תל אביב',   units: 45, source: 'הפניה',  priority: 'URGENT', stage: 'CONTACTED',   assignee: 'אבי ש׳',  nextAction: 'שליחת מצגת',  nextDate: 'מחר' },
  { id: 'l4',  name: 'קפלן 7',              address: 'קפלן 7',     city: 'פתח תקווה', units: 24, source: 'קמפיין', priority: 'LOW',    stage: 'CONTACTED',   assignee: 'שרה מ׳' },
  { id: 'l5',  name: 'דיזנגוף 100',         address: 'דיזנגוף 100',city: 'תל אביב',   units: 60, source: 'הפניה',  priority: 'HIGH',   stage: 'QUALIFIED',   assignee: 'אבי ש׳',  nextAction: 'פגישה',        nextDate: 'עוד 3 ימים',  value: '₪12M' },
  { id: 'l6',  name: 'שינקין 18',           address: 'שינקין 18',  city: 'תל אביב',   units: 22, source: 'פנייה',  priority: 'MEDIUM', stage: 'QUALIFIED',   assignee: 'שרה מ׳',  value: '₪5M' },
  { id: 'l7',  name: 'הרצל 120',            address: 'הרצל 120',   city: 'ראשל"צ',    units: 36, source: 'אתר',    priority: 'HIGH',   stage: 'PROPOSAL',    assignee: 'אבי ש׳',  nextAction: 'מענה על שאלות', nextDate: 'אתמול', value: '₪8M' },
  { id: 'l8',  name: 'אלנבי 55',            address: 'אלנבי 55',   city: 'תל אביב',   units: 28, source: 'הפניה',  priority: 'URGENT', stage: 'NEGOTIATION', assignee: 'אבי ש׳',  nextAction: 'חתימת מסגרת', nextDate: 'הישבוע', value: '₪9M' },
  { id: 'l9',  name: 'בן גוריון 14',        address: 'בן גוריון 14',city: 'חולון',    units: 16, source: 'קמפיין', priority: 'LOW',    stage: 'NEGOTIATION', assignee: 'שרה מ׳',  value: '₪3M' },
  { id: 'l10', name: 'רמב"ם 3',             address: 'רמב"ם 3',    city: 'רחובות',    units: 40, source: 'הפניה',  priority: 'HIGH',   stage: 'WON',         assignee: 'אבי ש׳',  value: '₪10M' },
  { id: 'l11', name: 'אחד העם 8',           address: 'אחד העם 8',  city: 'תל אביב',   units: 12, source: 'אתר',    priority: 'LOW',    stage: 'LOST',        assignee: 'שרה מ׳' },
]

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing group space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{lead.name}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted-foreground hover:text-foreground">
              <MoreHorizontal size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>צפייה בליד</DropdownMenuItem>
            <DropdownMenuItem>עדכון שלב</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">סמן כאבד</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Location + units */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <MapPin size={11} />
          <span>{lead.city}</span>
        </div>
        <div className="flex items-center gap-1">
          <Building2 size={11} />
          <span>{lead.units} יח׳</span>
        </div>
      </div>

      {/* Next action */}
      {lead.nextAction && (
        <div className="text-xs bg-muted rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <Calendar size={10} className="text-primary flex-shrink-0" />
          <span className="text-foreground/70">{lead.nextAction}</span>
          {lead.nextDate && <span className="text-primary font-medium me-auto">{lead.nextDate}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded border', PRIORITY_CLS[lead.priority])}>
            {PRIORITY_LABEL[lead.priority]}
          </span>
          {lead.value && (
            <span className="text-xs text-muted-foreground font-medium">{lead.value}</span>
          )}
        </div>
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {lead.assignee.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  )
}

function KanbanColumn({ stage, label, cls, dot, leads }: typeof COLUMNS[number] & { leads: Lead[] }) {
  return (
    <div className="flex flex-col min-w-72 max-w-72">
      {/* Column header */}
      <div className={cn('card-surface border-t-[3px] p-3 mb-3', cls)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full', dot)} />
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
              {leads.length}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
            <Plus size={13} />
          </Button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2.5 min-h-32">
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  )
}

export function LeadsKanban() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {COLUMNS.map(col => {
        const leads = mockLeads.filter(l => l.stage === col.stage)
        return (
          <KanbanColumn key={col.stage} {...col} leads={leads} />
        )
      })}
    </div>
  )
}
