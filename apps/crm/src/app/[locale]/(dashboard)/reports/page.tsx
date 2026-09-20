'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useDashboardStats } from '@/hooks/use-dashboard'
import { useProjects, type Project } from '@/hooks/use-projects'

/**
 * Reports.
 *
 * Every figure on this screen is derived from live API data:
 *   - KPIs and the signature trend come from GET /dashboard/stats.
 *   - Lead distribution comes from `leadsByStatus` on the same payload.
 *   - Stage distribution and the project table are aggregated from
 *     GET /projects.
 *
 * NOT IMPLEMENTED, deliberately left out rather than faked:
 *   - Monthly new/won/lost lead history — needs a lead time-series endpoint
 *     (e.g. GET /reports/leads/monthly); the API only exposes current status
 *     counts.
 *   - Estimated revenue per project — `Project.estimatedBudget` exists in the
 *     schema but is not exposed by GET /projects.
 *   - Excel export — needs GET /reports/export.
 */

const STAGE_LABELS: Record<string, string> = {
  DISCOVERY:             'גילוי',
  FEASIBILITY:           'היתכנות',
  RESIDENT_ORGANIZATION: 'התארגנות',
  SIGNATURES:            'חתימות',
  DEVELOPER_SELECTION:   'בחירת יזם',
  PLANNING:              'תכנון',
  MUNICIPAL_APPROVAL:    'אישור עירוני',
  PERMIT:                'היתר',
  EVACUATION:            'פינוי',
  CONSTRUCTION:          'בנייה',
  DELIVERY:              'מסירה',
  POST_DELIVERY:         'לאחר מסירה',
}

const STAGE_COLORS = [
  '#94a3b8', '#a78bfa', '#60a5fa', '#2F9DA0', '#34d399',
  '#fbbf24', '#fb923c', '#f87171', '#c084fc', '#818cf8',
  '#4ade80', '#38bdf8',
]

const LEAD_STATUS_CONFIG: { status: string; label: string; fill: string }[] = [
  { status: 'NEW',               label: 'חדש',         fill: '#94a3b8' },
  { status: 'CONTACTED',         label: 'נוצר קשר',    fill: '#60a5fa' },
  { status: 'MEETING_SCHEDULED', label: 'נקבעה פגישה', fill: '#818cf8' },
  { status: 'QUALIFIED',         label: 'מוכשר',       fill: '#a78bfa' },
  { status: 'INTERESTED',        label: 'מתעניין',     fill: '#c084fc' },
  { status: 'PROPOSAL',          label: 'הצעה',        fill: '#fb923c' },
  { status: 'NEGOTIATION',       label: 'משא ומתן',    fill: '#f97316' },
  { status: 'WON',               label: 'זכה',         fill: '#2F9DA0' },
  { status: 'LOST',              label: 'אבד',         fill: '#f87171' },
]

function formatChange(value: number, suffix: string) {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`
}

function KpiTile({
  label,
  value,
  change,
}: {
  label: string
  value: string
  change: number | null
  changeSuffix?: string
}) {
  const positive = (change ?? 0) >= 0
  return (
    <div className="kpi-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {change === null ? (
        // No baseline: the previous period was zero, so there is no percentage
        // to state. "חדש" says that; a dash left the reader guessing whether
        // the number was missing or the metric was broken.
        <span className="text-xs font-medium text-teal-600">חדש</span>
      ) : (
        <div
          className={`flex items-center gap-1 text-xs font-medium ${
            positive ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {formatChange(change, '%')}
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  const stats    = useDashboardStats()
  const projects = useProjects({ limit: 100 })

  const projectRows: Project[] = projects.data?.data ?? []

  const stageDistribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of projectRows) {
      counts.set(p.stage, (counts.get(p.stage) ?? 0) + 1)
    }
    return [...counts.entries()].map(([stage, value], i) => ({
      name:  STAGE_LABELS[stage] ?? stage,
      value,
      color: STAGE_COLORS[i % STAGE_COLORS.length],
    }))
  }, [projectRows])

  const topProjects = useMemo(
    () =>
      [...projectRows]
        .map((p) => ({
          id:      p.id,
          name:    p.name,
          city:    p.city,
          total:   p.totalUnits,
          signed:  p.totalUnits > 0 ? Math.round((p.signedUnits / p.totalUnits) * 100) : 0,
          signedUnits: p.signedUnits,
        }))
        .sort((a, b) => b.signed - a.signed || b.total - a.total)
        .slice(0, 10),
    [projectRows],
  )

  const leadsByStatus = useMemo(() => {
    const counts = new Map(
      (stats.data?.leadsByStatus ?? []).map((l) => [l.status, l.count]),
    )
    return LEAD_STATUS_CONFIG
      .map((c) => ({ ...c, count: counts.get(c.status) ?? 0 }))
      .filter((c) => c.count > 0)
  }, [stats.data])

  if (stats.isLoading || projects.isLoading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="text-2xl font-bold text-foreground">דוחות</h1>
            <p className="text-sm text-muted-foreground mt-0.5">ניתוח ביצועים ומגמות</p>
          </div>
        </div>
        <div className="card-surface"><RowsSkeleton rows={8} /></div>
      </div>
    )
  }

  if (stats.isError || !stats.data) {
    return (
      <QueryError
        message="שגיאה בטעינת הדוחות"
        error={stats.error}
        onRetry={() => stats.refetch()}
      />
    )
  }

  const { kpis, signatureTrend } = stats.data

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">דוחות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ניתוח ביצועים ומגמות — מבוסס על נתוני המערכת
          </p>
        </div>
      </div>

      {/* KPI Row — live from /dashboard/stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile
          label="חתימות ממוצע"
          value={`${Math.round(kpis.avgSignaturePct * 10) / 10}%`}
          change={kpis.signaturesChange}
        />
        <KpiTile
          label="פרויקטים פעילים"
          value={String(kpis.activeProjects)}
          change={kpis.projectsChange}
        />
        <KpiTile
          label="דיירים פעילים"
          value={String(kpis.activeResidents)}
          change={kpis.residentsChange}
        />
        <KpiTile
          label="לידים חדשים החודש"
          value={String(kpis.newLeadsThisMonth)}
          change={kpis.leadsChange}
        />
      </div>

      {/* Signatures trend */}
      <div className="card-surface p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">מגמת חתימות לאורך זמן</h3>
          <p className="text-sm text-muted-foreground">אחוז חתימות ממוצע מול יעד</p>
        </div>
        {signatureTrend.length === 0 ? (
          <EmptyState message="אין עדיין נתוני מגמה" hint="הנתונים יופיעו לאחר צבירת היסטוריית חתימות" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={signatureTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="sigGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2F9DA0" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2F9DA0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #eaecee', fontSize: 12 }}
                formatter={(v: number) => [`${v}%`]}
              />
              <Area type="monotone" dataKey="target" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="4 2" fill="none" name="יעד" />
              <Area
                type="monotone" dataKey="signatures" stroke="#2F9DA0" strokeWidth={2.5}
                fill="url(#sigGrad)" name="ממוצע בפועל"
                dot={{ fill: '#2F9DA0', r: 4 }} activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 2-col row: leads by status + stage distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-surface p-6">
          <h3 className="text-base font-semibold text-foreground mb-1">לידים לפי סטטוס</h3>
          <p className="text-sm text-muted-foreground mb-4">התפלגות נוכחית בצינור</p>
          {leadsByStatus.length === 0 ? (
            <EmptyState message="אין לידים רשומים" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsByStatus} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6D7378' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #eaecee', fontSize: 12 }}
                  formatter={(v: number) => [`${v} לידים`, 'כמות']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="כמות">
                  {leadsByStatus.map((e) => <Cell key={e.status} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card-surface p-6">
          <h3 className="text-base font-semibold text-foreground mb-1">פרויקטים לפי שלב</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {projects.data?.total ?? projectRows.length} פרויקטים
          </p>
          {stageDistribution.length === 0 ? (
            <EmptyState message="אין פרויקטים רשומים" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stageDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
                  paddingAngle={3} dataKey="value"
                >
                  {stageDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #eaecee', fontSize: 12 }}
                  formatter={(v: number, n: string) => [`${v} פרויקטים`, n]}
                />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ fontSize: 11, color: '#6D7378' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Projects by signature progress */}
      <div className="card-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">פרויקטים לפי התקדמות חתימות</h3>
        </div>
        {topProjects.length === 0 ? (
          <EmptyState message="אין פרויקטים רשומים" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['פרויקט', 'עיר', 'חתימות', 'יחידות'].map((h) => (
                    <th key={h} className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">
                      <Link href={`/projects/${p.id}`} className="hover:text-teal-600">{p.name}</Link>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{p.city}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${p.signed}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">{p.signed}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground tabular-nums">
                      {p.signedUnits} / {p.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
