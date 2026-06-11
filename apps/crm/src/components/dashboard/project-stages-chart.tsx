'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { name: 'גילוי / היתכנות', value: 5,  color: '#94a3b8' },
  { name: 'חתימות',           value: 8,  color: '#a78bfa' },
  { name: 'תכנון / אישורים',  value: 6,  color: '#60a5fa' },
  { name: 'פינוי / בנייה',   value: 3,  color: '#2F9DA0' },
  { name: 'מסירה',            value: 2,  color: '#34d399' },
]

export function ProjectStagesChart() {
  return (
    <div className="card-surface p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">פרויקטים לפי שלב</h3>
        <p className="text-sm text-muted-foreground">24 פרויקטים פעילים</p>
      </div>
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
    </div>
  )
}
