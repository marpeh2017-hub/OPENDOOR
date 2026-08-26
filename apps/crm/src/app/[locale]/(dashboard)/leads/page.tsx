'use client'

import { useMemo } from 'react'
import { Plus, LayoutGrid, List, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadsKanban } from '@/components/leads/leads-kanban'
import { useLeads } from '@/hooks/use-leads'

/** Stages that count as "still in the pipeline" (mirrors Prisma `LeadStatus`). */
const OPEN_STAGES = new Set(['NEW', 'CONTACTED', 'MEETING_SCHEDULED', 'INTERESTED', 'NEGOTIATION'])

export default function LeadsPage() {
  // Same query key/params as LeadsKanban, so this is served from cache — the
  // summary strip can never disagree with the board below it.
  const { data, isLoading } = useLeads({ limit: 200 })

  const stats = useMemo(() => {
    const leads = data?.data ?? []
    const open = leads.filter(l => OPEN_STAGES.has(l.status))
    const meetings = leads.filter(l => l.status === 'MEETING_SCHEDULED')
    const won = leads.filter(l => l.status === 'SIGNED')
    const avgScore = open.length
      ? Math.round(open.reduce((sum, l) => sum + (l.score ?? 0), 0) / open.length)
      : 0

    return [
      { label: 'לידים פעילים', value: String(open.length),     sub: 'בכל השלבים הפתוחים', cls: 'text-blue-600' },
      { label: 'ניקוד ממוצע',  value: String(avgScore),        sub: 'לידים פתוחים',       cls: 'text-green-600' },
      { label: 'פגישות שנקבעו', value: String(meetings.length), sub: 'ממתינות לביצוע',     cls: 'text-amber-600' },
      { label: 'לידים שנחתמו',  value: String(won.length),      sub: 'הומרו לפרויקט',      cls: 'text-primary' },
    ]
  }, [data])

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Header */}
      <div className="page-header flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">לידים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ניהול צינור הלידים וסטטוס כל פרויקט פוטנציאלי</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggles */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button variant="ghost" size="sm" className="rounded-none h-8 px-3 bg-primary/10 text-primary">
              <LayoutGrid size={14} />
            </Button>
            <Button variant="ghost" size="sm" className="rounded-none h-8 px-3 text-muted-foreground">
              <List size={14} />
            </Button>
          </div>
          <Button size="sm" className="gap-2">
            <Plus size={15} />
            ליד חדש
          </Button>
        </div>
      </div>

      {/* Pipeline summary strip — derived from the live lead list, never hardcoded. */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {stats.map(s => (
          <div key={s.label} className="kpi-card py-3.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className={s.cls} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.cls}`}>{isLoading ? '—' : s.value}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <LeadsKanban />
      </div>
    </div>
  )
}
