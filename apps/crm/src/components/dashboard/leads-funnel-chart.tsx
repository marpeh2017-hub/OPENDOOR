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

const data = [
  { stage: 'חדש',        count: 24, fill: '#94a3b8' },
  { stage: 'נוצר קשר',  count: 18, fill: '#60a5fa' },
  { stage: 'מוכשר',      count: 12, fill: '#a78bfa' },
  { stage: 'הצעה',       count: 8,  fill: '#fb923c' },
  { stage: 'משא ומתן',   count: 5,  fill: '#f97316' },
  { stage: 'זכה',        count: 3,  fill: '#2F9DA0' },
]

export function LeadsFunnelChart() {
  return (
    <div className="card-surface p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">פאנל לידים</h3>
        <p className="text-sm text-muted-foreground">התפלגות לידים לפי שלב</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} />
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
    </div>
  )
}
