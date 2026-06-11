import { Plus, LayoutGrid, List, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadsKanban } from '@/components/leads/leads-kanban'

export default function LeadsPage() {
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

      {/* Pipeline summary strip */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: 'לידים פעילים',  value: '11', sub: 'בכל השלבים',   cls: 'text-blue-600' },
          { label: 'שווי משוער',    value: '₪47M', sub: 'פוטנציאל צינור', cls: 'text-green-600' },
          { label: 'פגישות הישבוע', value: '3',  sub: 'מתוכננות',     cls: 'text-amber-600' },
          { label: 'זכו השנה',      value: '1',  sub: 'רמב"ם 3, רחובות', cls: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="kpi-card py-3.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className={s.cls} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
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
