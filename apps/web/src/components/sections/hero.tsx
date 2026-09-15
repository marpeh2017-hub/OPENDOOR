'use client'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(47,157,160,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-20 lg:py-32 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div className="text-right">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-6"
              style={{ background: 'rgba(47,157,160,0.1)', color: '#2F9DA0' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#2F9DA0' }} />
              פלטפורמה מובילה לפינוי-בינוי
            </div>

            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight text-gray-900 mb-6">
              פותחים את הדלת
              <br />
              <span style={{ color: '#2F9DA0' }}>להתחדשות עירונית</span>
              <br />
              בטוחה ושקופה
            </h1>

            <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-lg">
              ניהול מלא של פרויקטי פינוי-בינוי — בעלי דירות, חתימות דיגיטליות, דיירים וסטטוס חוקי —
              הכל בפלטפורמה אחת מאובטחת.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <a
                href="#contact"
                className="rounded-xl px-6 py-3.5 text-base font-semibold text-white text-center transition-all shadow-lg"
                style={{ background: '#2F9DA0' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#22797D')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2F9DA0')}
              >
                בקש הדגמה חינם
              </a>
              <a
                href="#product"
                className="rounded-xl px-6 py-3.5 text-base font-semibold text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-center transition-colors"
              >
                צפה במוצר ←
              </a>
            </div>

            {/* Trust signals */}
            <div className="flex items-center gap-6 mt-10 text-sm text-gray-500 justify-end">
              <span>✓ ללא כרטיס אשראי</span>
              <span>✓ הטמעה תוך 48 שעות</span>
              <span>✓ תמיכה בעברית</span>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="relative hidden lg:block">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

function DashboardMockup() {
  return (
    <div
      className="rounded-2xl border border-gray-200 shadow-2xl overflow-hidden"
      style={{ background: '#F5F7F8' }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-yellow-400" />
        <div className="h-3 w-3 rounded-full bg-green-400" />
        <span className="text-xs text-gray-400 mr-3">OpenDoor CRM — פרויקט רמת גן מרכז</span>
      </div>

      <div className="p-5">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'חתימות', value: '74%', sub: '148/200', color: '#2F9DA0' },
            { label: 'בעלים פעילים', value: '186', sub: 'מתוך 200', color: '#6D7378' },
            { label: 'ציון בריאות', value: '82', sub: '/100', color: '#22797D' },
          ].map(k => (
            <div key={k.label} className="rounded-xl bg-white border border-gray-100 p-3 text-right">
              <p className="text-xs text-gray-500 mb-1">{k.label}</p>
              <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
              <p className="text-xs text-gray-400">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 text-right">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium" style={{ color: '#2F9DA0' }}>74%</span>
            <span className="text-xs text-gray-700 font-medium">התקדמות חתימות</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: '74%', background: 'linear-gradient(90deg, #22797D, #2F9DA0)' }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">יעד: 67% — חוצה את הסף!</p>
        </div>

        {/* Residents list */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-right">
          <p className="text-xs font-semibold text-gray-700 mb-3">דיירים אחרונים</p>
          {[
            { name: 'דוד לוי', status: 'חתם', color: '#22797D', apt: 'דירה 12' },
            { name: 'שרה כהן', status: 'ממתין', color: '#F59E0B', apt: 'דירה 8' },
            { name: 'יוסף אברהם', status: 'טרם נוצר קשר', color: '#6D7378', apt: 'דירה 3' },
          ].map(r => (
            <div key={r.name} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-xs font-medium rounded-full px-2 py-0.5" style={{ background: `${r.color}18`, color: r.color }}>{r.status}</span>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-700">{r.name}</p>
                <p className="text-xs text-gray-400">{r.apt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
