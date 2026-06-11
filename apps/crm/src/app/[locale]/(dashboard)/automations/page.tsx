'use client'

import { useState } from 'react'
import { Plus, Zap, Bell, MessageSquare, Mail, Clock, CheckCircle2, XCircle, MoreHorizontal, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type ActionType = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'TASK' | 'NOTIFICATION'
type TriggerType = 'SIGNATURE_PENDING' | 'STAGE_CHANGE' | 'DOCUMENT_MISSING' | 'MEETING_SCHEDULED' | 'LEAD_CREATED'

const ACTION_CFG: Record<ActionType, { icon: React.ElementType; label: string; cls: string; bg: string }> = {
  WHATSAPP:     { icon: MessageSquare, label: 'וואטסאפ',   cls: 'text-green-600',  bg: 'bg-green-100' },
  EMAIL:        { icon: Mail,          label: 'אימייל',     cls: 'text-blue-600',   bg: 'bg-blue-100' },
  SMS:          { icon: MessageSquare, label: 'SMS',        cls: 'text-purple-600', bg: 'bg-purple-100' },
  TASK:         { icon: CheckCircle2,  label: 'משימה',      cls: 'text-teal-600',   bg: 'bg-teal-100' },
  NOTIFICATION: { icon: Bell,          label: 'התראה',      cls: 'text-amber-600',  bg: 'bg-amber-100' },
}

const TRIGGER_CFG: Record<TriggerType, { label: string }> = {
  SIGNATURE_PENDING:  { label: 'חתימה ממתינה' },
  STAGE_CHANGE:       { label: 'שינוי שלב' },
  DOCUMENT_MISSING:   { label: 'מסמך חסר' },
  MEETING_SCHEDULED:  { label: 'פגישה נקבעה' },
  LEAD_CREATED:       { label: 'ליד חדש' },
}

interface Automation {
  id: string
  name: string
  description: string
  trigger: TriggerType
  action: ActionType
  active: boolean
  runs: number
  lastRun?: string
}

const initialAutomations: Automation[] = [
  { id: '1', name: 'תזכורת חתימה – 3 ימים', description: 'שלח וואטסאפ לדייר שלא חתם לאחר 3 ימים', trigger: 'SIGNATURE_PENDING',  action: 'WHATSAPP',     active: true,  runs: 142, lastRun: 'לפני שעה' },
  { id: '2', name: 'תזכורת חתימה – 7 ימים', description: 'שלח SMS לדייר שלא חתם לאחר שבוע',       trigger: 'SIGNATURE_PENDING',  action: 'SMS',          active: true,  runs: 87,  lastRun: 'אתמול' },
  { id: '3', name: 'עדכון מעבר שלב',          description: 'שלח אימייל לכל צוות בשינוי שלב פרויקט', trigger: 'STAGE_CHANGE',        action: 'EMAIL',        active: true,  runs: 23,  lastRun: 'לפני 3 ימים' },
  { id: '4', name: 'בקשת מסמך חסר',           description: 'שלח וואטסאפ לדייר עם מסמך שלא הועלה',  trigger: 'DOCUMENT_MISSING',   action: 'WHATSAPP',     active: false, runs: 0,   lastRun: undefined },
  { id: '5', name: 'תזכורת פגישה – יום לפני', description: 'שלח SMS תזכורת יום לפני פגישה',          trigger: 'MEETING_SCHEDULED',  action: 'SMS',          active: true,  runs: 58,  lastRun: 'לפני 2 ימים' },
  { id: '6', name: 'ליד חדש – הקצאת משימה',  description: 'צור משימה "פנייה ראשונית" למנהל פרויקט', trigger: 'LEAD_CREATED',        action: 'TASK',         active: true,  runs: 31,  lastRun: 'היום' },
]

export default function AutomationsPage() {
  const [automations, setAutomations] = useState(initialAutomations)

  function toggleActive(id: string) {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a))
  }

  const activeCount = automations.filter(a => a.active).length
  const totalRuns = automations.reduce((s, a) => s + a.runs, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">אוטומציות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">הגדר תהליכים אוטומטיים לחיסכון בזמן</p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus size={15} /> אוטומציה חדשה
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'פעילות',    value: activeCount,              icon: Play,  cls: 'text-green-600', bg: 'bg-green-50' },
          { label: 'כבויות',   value: automations.length - activeCount, icon: Pause, cls: 'text-gray-400',  bg: 'bg-gray-50' },
          { label: 'ריצות כוללות', value: totalRuns,            icon: Zap,   cls: 'text-teal-600',  bg: 'bg-teal-50' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="kpi-card py-4">
              <div className="flex items-center gap-3">
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', s.bg)}>
                  <Icon size={17} className={s.cls} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Automations list */}
      <div className="card-surface divide-y divide-border overflow-hidden">
        {automations.map(auto => {
          const action = ACTION_CFG[auto.action]
          const ActionIcon = action.icon
          const trigger = TRIGGER_CFG[auto.trigger]

          return (
            <div key={auto.id} className={cn(
              'flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors',
              !auto.active && 'opacity-60'
            )}>
              {/* Action icon */}
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', action.bg)}>
                <ActionIcon size={18} className={action.cls} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-foreground">{auto.name}</p>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {trigger.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{auto.description}</p>
              </div>

              {/* Stats */}
              <div className="hidden md:flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">{auto.runs.toLocaleString()} ריצות</p>
                {auto.lastRun
                  ? <p className="text-xs text-muted-foreground">אחרונה: {auto.lastRun}</p>
                  : <p className="text-xs text-muted-foreground/50">לא רצה עדיין</p>
                }
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggleActive(auto.id)}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors flex-shrink-0',
                  auto.active ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span className={cn(
                  'absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  auto.active ? 'translate-x-5' : 'translate-x-1'
                )} />
              </button>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0">
                    <MoreHorizontal size={15} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>ערוך</DropdownMenuItem>
                  <DropdownMenuItem>הצג היסטוריית ריצות</DropdownMenuItem>
                  <DropdownMenuItem>שכפל</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">מחק</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>
    </div>
  )
}
