'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useDashboardStats } from '@/hooks/use-dashboard'

/** Lead status → Hebrew label + colour, in funnel order. */
const STATUS_CONFIG: { status: string; label: string; fill: string }[] = [
  { status: 'NEW',               label: 'חדש',       fill: '#94a3b8' },
  { status: 'CONTACTED',         label: 'נוצר קשר',  fill: '#60a5fa' },
  { status: 'MEETING_SCHEDULED', label: 'נקבעה פגישה', fill: '#818cf8' },
  { status: 'QUALIFIED',         label: 'מוכשר',     fill: '#a78bfa' },
  { status: 'INTERESTED',        label: 'מתעניין',   fill: '#c084fc' },
  { status: 'PROPOSAL',          label: 'הצעה',      fill: '#fb923c' },
  { status: 'NEGOTIATION',       label: 'משא ומתן',  fill: '#f97316' },
  { status: 'WON',               label: 'זכה',       fill: '#2F9DA0' },
  { status: 'LOST',              label: 'אבד',       fill: '#f87171' },
]

export function LeadsFunnelChart() {
  const { data: stats, isLoading, isError, error, refetch } = useDashboardStats()

  if (isLoading) {
    return (
      <div className="card-surface p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">פאנל לידים</h3>
        </div>
        <RowsSkeleton rows={4} />
      </div>
    )
  }

  if (isError || !stats) {
    return <QueryError message="שגיאה בטעינת פאנל הלידים" error={error} onRetry={() => refetch()} />
  }

  const counts = new Map(stats.leadsByStatus.map(l => [l.status, l.count]))
  const data = STATUS_CONFIG
    .map(c => ({ stage: c.label, count: counts.get(c.status) ?? 0, fill: c.fill }))
    .filter(d => d.count > 0)

  return (
    <div className="card-surface p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">פאנל לידים</h3>
        <p className="text-sm text-muted-foreground">התפלגות לידים לפי שלב</p>
      </div>
      {data.length === 0 ? (
        <EmptyState message="אין לידים להצגה" hint="לידים חדשים יופיעו כאן" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="stage"
              tick={{ fontSize: 12, fill: '#6D7378' }}
              axisLine={false}
              tickLine={false}
              width={65}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #eaecee', fontSize: 12 }}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} name="לידים">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
