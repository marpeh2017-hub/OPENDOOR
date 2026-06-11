'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const data = [
  { month: 'ינו', signatures: 42, target: 60 },
  { month: 'פבר', signatures: 51, target: 60 },
  { month: 'מרץ', signatures: 58, target: 65 },
  { month: 'אפר', signatures: 61, target: 65 },
  { month: 'מאי', signatures: 67, target: 70 },
  { month: 'יונ', signatures: 73, target: 70 },
]

export function SignatureProgressChart() {
  return (
    <div className="card-surface p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-800">התקדמות חתימות</h3>
        <p className="text-sm text-gray-500">אחוז חתימות ממוצע לאורך זמן</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="signaturesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2F9DA0" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#2F9DA0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #eaecee', fontSize: 12 }}
            formatter={(val: number) => [`${val}%`]}
          />
          <Area
            type="monotone"
            dataKey="target"
            stroke="#e2e8f0"
            strokeWidth={2}
            strokeDasharray="4 2"
            fill="none"
            name="יעד"
          />
          <Area
            type="monotone"
            dataKey="signatures"
            stroke="#2F9DA0"
            strokeWidth={2.5}
            fill="url(#signaturesGradient)"
            name="חתימות"
            dot={{ fill: '#2F9DA0', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
