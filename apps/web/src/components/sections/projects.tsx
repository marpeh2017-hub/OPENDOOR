'use client'

import { useState } from 'react'

const tabs = [
  {
    id: 'owners',
    label: 'ניהול בעלים',
    description: 'מרשם בעלים מדויק עם שיעורי בעלות, תעודות זהות, קישור לדיירים ומעקב עיזבונות.',
    mockup: <OwnersMockup />,
  },
  {
    id: 'signatures',
    label: 'חתימות דיגיטליות',
    description: 'מנוע חתימות עם אימות OTP, מעקב סטטוס בזמן אמת, היסטוריית אירועים ותמיכה בחתימה רטובה.',
    mockup: <SignaturesMockup />,
  },
  {
    id: 'dashboard',
    label: 'דשבורד פרויקט',
    description: 'ציון בריאות הפרויקט עם 5 מדדים, המלצות הפעולה הבאה הטובה ביותר ופורטפוליו מושלם.',
    mockup: <DashboardMockup />,
  },
]

export function ProjectsSection() {
  const [active, setActive] = useState('owners')
  const tab = tabs.find(t => t.id === active)!

  return (
    <section id="product" className="py-24 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            פלטפורמה אחת לכל מחזור חיי הפרויקט
          </h2>
          <p className="text-lg text-gray-500">
            מהתארגנות ועד קבלת מפתח — OpenDoor מלווה אתכם בכל שלב.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-10 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
              style={
                active === t.id
                  ? { background: '#2F9DA0', color: 'white', boxShadow: '0 4px 12px rgba(47,157,160,0.3)' }
                  : { background: 'white', color: '#6D7378', border: '1px solid #e5e7eb' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-right order-2 lg:order-1">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">{tab.label}</h3>
            <p className="text-gray-600 leading-relaxed mb-6">{tab.description}</p>
            <a
              href="#contact"
              className="inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white"
              style={{ background: '#2F9DA0' }}
            >
              בקש הדגמה אישית
            </a>
          </div>
          <div className="order-1 lg:order-2">
            {tab.mockup}
          </div>
        </div>
      </div>
    </section>
  )
}

function OwnersMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: '#2F9DA0' }}>3 בעלים רשומים</span>
        <span className="text-xs text-gray-500">דירה 12, רחוב הרצל 4</span>
      </div>
      <div className="p-4">
        {[
          { name: 'דוד לוי', share: '50%', id: '123456789', status: 'חתם', statusColor: '#22797D' },
          { name: 'מרים לוי', share: '25%', id: '987654321', status: 'ממתין', statusColor: '#F59E0B' },
          { name: 'עיזבון לוי', share: '25%', id: '—', status: 'ב-POA', statusColor: '#6D7378', isEstate: true },
        ].map(o => (
          <div key={o.name} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <span
              className="text-xs font-medium rounded-full px-2.5 py-1"
              style={{ background: `${o.statusColor}18`, color: o.statusColor }}
            >
              {o.status}
            </span>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                {o.isEstate && (
                  <span className="text-xs bg-orange-50 text-orange-600 rounded px-1.5 py-0.5">עיזבון</span>
                )}
                <span className="text-sm font-semibold text-gray-800">{o.name}</span>
              </div>
              <p className="text-xs text-gray-400">ח.ז: {o.id} · חלק: {o.share}</p>
            </div>
          </div>
        ))}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-green-600">✓ סכום חלקים = 100%</span>
          <span className="text-gray-400">OwnerApartment</span>
        </div>
      </div>
    </div>
  )
}

function SignaturesMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: '#2F9DA0' }}>חבילת חתימות פעילה</span>
        <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">PARTIALLY_SIGNED</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="text-right">
          <p className="text-sm font-bold text-gray-800">הסכם פינוי-בינוי — גרסה 3</p>
          <p className="text-xs text-gray-400">נשלח 14.08.2026 · פג תוקף 14.09.2026</p>
        </div>
        <div className="space-y-2">
          {[
            { name: 'דוד לוי', when: 'חתם 15.08 14:32', color: '#22797D', icon: '✓' },
            { name: 'שרה כהן', when: 'OTP נשלח, ממתין', color: '#F59E0B', icon: '⏳' },
            { name: 'יוסף בן-דוד', when: 'טרם נפתח', color: '#6D7378', icon: '—' },
          ].map(r => (
            <div key={r.name} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
              <span className="text-sm" style={{ color: r.color }}>{r.icon}</span>
              <div className="flex-1 text-right">
                <p className="text-xs font-semibold text-gray-700">{r.name}</p>
                <p className="text-xs text-gray-400">{r.when}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-gray-100">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span style={{ color: '#2F9DA0' }}>1/3 חתמו</span>
            <span>התקדמות</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '33%', background: '#2F9DA0' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
        <span className="text-xs font-semibold text-gray-700">ציון בריאות פרויקט — רמת גן מרכז</span>
      </div>
      <div className="p-4">
        {/* Score */}
        <div className="flex items-center gap-4 mb-4 p-3 rounded-xl" style={{ background: 'rgba(47,157,160,0.06)' }}>
          <div className="text-right flex-1">
            <p className="text-xs text-gray-500">ציון כולל</p>
            <p className="text-3xl font-bold" style={{ color: '#2F9DA0' }}>82</p>
            <p className="text-xs text-gray-400">/100</p>
          </div>
          <div className="relative h-16 w-16">
            <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
              <circle cx="18" cy="18" r="14" fill="none" stroke="#2F9DA0" strokeWidth="3"
                strokeDasharray={`${82 * 0.88} 88`} strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Dimensions */}
        {[
          { name: 'חתימות', score: 27, max: 30 },
          { name: 'איכות נתונים', score: 16, max: 20 },
          { name: 'מעורבות דיירים', score: 15, max: 20 },
          { name: 'משימות', score: 12, max: 15 },
          { name: 'פעילות אחרונה', score: 12, max: 15 },
        ].map(d => (
          <div key={d.name} className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 w-16 text-left">{d.score}/{d.max}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(d.score/d.max)*100}%`, background: '#2F9DA0' }} />
            </div>
            <span className="text-xs text-gray-600 text-right w-24">{d.name}</span>
          </div>
        ))}

        {/* NBA */}
        <div className="mt-4 p-3 rounded-xl border border-orange-100 bg-orange-50/50">
          <p className="text-xs font-semibold text-orange-700 text-right mb-1">⚡ הפעולה הבאה הטובה ביותר</p>
          <p className="text-xs text-orange-600 text-right">דרושות עוד 12 חתימות להגיע ל-67% — שלח תזכורות</p>
        </div>
      </div>
    </div>
  )
}
