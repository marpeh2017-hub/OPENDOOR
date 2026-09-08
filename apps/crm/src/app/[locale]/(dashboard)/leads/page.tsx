'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Search, TrendingUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { LeadsKanban } from '@/components/leads/leads-kanban'
import { useLeads } from '@/hooks/use-leads'

/** Stages that count as "still in the pipeline" (mirrors Prisma `LeadStatus`). */
const OPEN_STAGES = new Set(['NEW', 'CONTACTED', 'MEETING_SCHEDULED', 'INTERESTED', 'NEGOTIATION'])

export default function LeadsPage() {
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const deferredSearch = useDeferredValue(search.trim())

  // Same query key/params as LeadsKanban, so this is served from cache — the
  // summary strip can never disagree with the board below it.
  const query = {
    limit: 200,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(source ? { source } : {}),
  }
  const { data, isLoading } = useLeads(query)

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
      <div className="page-header flex-shrink-0 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">לידים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ניהול צינור הלידים וסטטוס כל פרויקט פוטנציאלי</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="relative min-w-64">
            <span className="sr-only">חיפוש לידים</span>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="שם, טלפון, אימייל או כתובת"
              className="ps-9"
            />
          </label>
          <label>
            <span className="sr-only">סינון לפי מקור</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-36"
            >
              <option value="">כל המקורות</option>
              <option value="WEBSITE">אתר</option>
              <option value="PHONE">טלפון</option>
              <option value="WHATSAPP">וואטסאפ</option>
              <option value="REFERRAL">הפניה</option>
              <option value="EVENT">אירוע</option>
              <option value="OTHER">אחר</option>
            </select>
          </label>
        </div>
      </div>

      {/* Pipeline summary strip — derived from the live lead list, never hardcoded. */}
      <div className="grid grid-cols-2 gap-3 flex-shrink-0 lg:grid-cols-4">
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
        <LeadsKanban search={deferredSearch} source={source} />
      </div>
    </div>
  )
}
