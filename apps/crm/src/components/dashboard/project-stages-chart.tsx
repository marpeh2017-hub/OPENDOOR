'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useDashboardStats } from '@/hooks/use-dashboard'

/** Roll the 12 pipeline stages up into 5 readable groups. */
const STAGE_GROUPS: { name: string; color: string; stages: string[] }[] = [
  { name: 'גילוי / היתכנות', color: '#94a3b8', stages: ['DISCOVERY', 'FEASIBILITY', 'RESIDENT_ORGANIZATION'] },
  { name: 'חתימות',          color: '#a78bfa', stages: ['SIGNATURES', 'DEVELOPER_SELECTION'] },
  { name: 'תכנון / אישורים', color: '#60a5fa', stages: ['PLANNING', 'MUNICIPAL_APPROVAL', 'PERMIT'] },
  { name: 'פינוי / בנייה',   color: '#2F9DA0', stages: ['EVACUATION', 'CONSTRUCTION'] },
  { name: 'מסירה',           color: '#34d399', stages: ['DELIVERY', 'POST_DELIVERY'] },
]

export function ProjectStagesChart() {
  const { data: stats, isLoading, isError, error, refetch } = useDashboardStats()

  if (isLoading) {
    return (
      <div className="card-surface p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">פרויקטים לפי שלב</h3>
        </div>
        <RowsSkeleton rows={4} />
      </div>
    )
  }

  if (isError || !stats) {
    return <QueryError message="שגיאה בטעינת שלבי הפרויקטים" error={error} onRetry={() => refetch()} />
  }

  const projects = stats.activeProjects
  const data = STAGE_GROUPS
    .map(g => ({
      name:  g.name,
      color: g.color,
      value: projects.filter(p => g.stages.includes(p.stage)).length,
    }))
    .filter(d => d.value > 0)

  return (
    <div className="card-surface p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">פרויקטים לפי שלב</h3>
        <p className="text-sm text-muted-foreground">
          {stats.kpis.activeProjects} פרויקטים פעילים
        </p>
      </div>
      {data.length === 0 ? (
        <EmptyState message="אין פרויקטים פעילים להצגה" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #eaecee', fontSize: 12 }}
              formatter={(val: number, name: string) => [`${val} פרויקטים`, name]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ fontSize: 11, color: '#6D7378' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
