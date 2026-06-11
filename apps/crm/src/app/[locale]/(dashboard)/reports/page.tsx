'use client'

import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

const signaturesOverTime = [
  { month: 'ינו', signed: 42, target: 60 },
  { month: 'פבר', signed: 51, target: 60 },
  { month: 'מרץ', signed: 58, target: 65 },
  { month: 'אפר', signed: 61, target: 65 },
  { month: 'מאי', signed: 67, target: 70 },
  { month: 'יונ', signed: 73, target: 70 },
  { month: 'יול', signed: 78, target: 75 },
  { month: 'אוג', signed: 82, target: 75 },
]

const leadsMonthly = [
  { month: 'ינו', new: 18, won: 1, lost: 3 },
  { month: 'פבר', new: 24, won: 2, lost: 4 },
  { month: 'מרץ', new: 31, won: 1, lost: 5 },
  { month: 'אפר', new: 27, won: 3, lost: 2 },
  { month: 'מאי', new: 22, won: 2, lost: 3 },
  { month: 'יונ', new: 35, won: 4, lost: 6 },
  { month: 'יול', new: 28, won: 2, lost: 4 },
  { month: 'אוג', new: 41, won: 5, lost: 3 },
]

const stageDistribution = [
  { name: 'גילוי / היתכנות', value: 5,  color: '#94a3b8' },
  { name: 'חתימות',           value: 8,  color: '#a78bfa' },
  { name: 'תכנון / אישורים',  value: 6,  color: '#60a5fa' },
  { name: 'פינוי / בנייה',   value: 3,  color: '#2F9DA0' },
  { name: 'מסירה',            value: 2,  color: '#34d399' },
]

const topProjects = [
  { name: 'הרצל 45, ת"א',     signed: 87, total: 48, revenue: '₪12M' },
  { name: 'רמב"ם 3, רחובות',  signed: 100, total: 40, revenue: '₪10M' },
  { name: 'ביאליק 12, ר"ג',   signed: 71, total: 65, revenue: '₪8M' },
  { name: 'בן יהודה 88, ת"א', signed: 64, total: 90, revenue: '₪15M' },
  { name: 'בן גוריון 12, חיפה',signed: 94, total: 120, revenue: '₪22M' },
]

function KpiTile({ label, value, change, positive }: { label: string; value: string; change: string; positive: boolean }) {
  return (
    <div className="kpi-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <div className={`flex items-center gap-1 text-xs font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
        {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {change}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">דוחות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ניתוח ביצועים ומגמות</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download size={15} /> ייצוא Excel
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile label="חתימות ממוצע"       value="73.2%"  change="+6.4% מהרבעון"      positive={true} />
        <KpiTile label="פרויקטים פעילים"    value="24"     change="+3 החודש"            positive={true} />
        <KpiTile label="לידים חדשים (שנה)"  value="286"    change="+18% לעומת אשתקד"   positive={true} />
        <KpiTile label="שיעור סגירה לידים"  value="18.5%"  change="-1.2% מהרבעון"      positive={false} />
      </div>

      {/* Signatures trend */}
      <div className="card-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">מגמת חתימות לאורך זמן</h3>
            <p className="text-sm text-muted-foreground">אחוז חתימות ממוצע vs. יעד</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={signaturesOverTime} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="sigGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2F9DA0" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2F9DA0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #eaecee', fontSize: 12 }}
              formatter={(v: number) => [`${v}%`]} />
            <Area type="monotone" dataKey="target" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="4 2" fill="none" name="יעד" />
            <Area type="monotone" dataKey="signed" stroke="#2F9DA0" strokeWidth={2.5} fill="url(#sigGrad)" name="ממוצע בפועל"
              dot={{ fill: '#2F9DA0', r: 4 }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 2-col row: leads + stages */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Leads monthly */}
        <div className="card-surface p-6">
          <h3 className="text-base font-semibold text-foreground mb-1">לידים חדשים לפי חודש</h3>
          <p className="text-sm text-muted-foreground mb-4">פתיחות, זכיות, הפסדים</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={leadsMonthly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6D7378' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #eaecee', fontSize: 12 }} />
              <Bar dataKey="new"  fill="#60a5fa" radius={[4,4,0,0]} name="חדשים" />
              <Bar dataKey="won"  fill="#2F9DA0" radius={[4,4,0,0]} name="זכיות" />
              <Bar dataKey="lost" fill="#f87171" radius={[4,4,0,0]} name="הפסדים" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stage distribution */}
        <div className="card-surface p-6">
          <h3 className="text-base font-semibold text-foreground mb-1">פרויקטים לפי שלב</h3>
          <p className="text-sm text-muted-foreground mb-4">24 פרויקטים פעילים</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stageDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
                paddingAngle={3} dataKey="value">
                {stageDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #eaecee', fontSize: 12 }}
                formatter={(v: number, n: string) => [`${v} פרויקטים`, n]} />
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span style={{ fontSize: 11, color: '#6D7378' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top projects table */}
      <div className="card-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">פרויקטים מובילים</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['פרויקט', 'חתימות', 'דיירים', 'הכנסה משוערת'].map(h => (
                <th key={h} className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {topProjects.map(p => (
              <tr key={p.name} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5 font-medium text-foreground">{p.name}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${p.signed}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{p.signed}%</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{p.total}</td>
                <td className="px-5 py-3.5 font-semibold text-primary">{p.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
