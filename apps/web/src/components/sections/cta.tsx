// Security & Trust section + Resident Portal section + CTA banner
import { LeadForm } from './lead-form'

export function CtaSection() {
  return (
    <>
      {/* Security & Trust */}
      <SecuritySection />

      {/* Resident Portal */}
      <ResidentPortalSection />

      {/* CTA Banner */}
      <CtaBannerSection />
    </>
  )
}

function SecuritySection() {
  const pillars = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 3L4 7v8c0 5.523 4.477 10 10 10s10-4.477 10-10V7L14 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M10 14l2.5 2.5L18 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      title: 'הצפנת נתונים',
      description: 'כל הנתונים מוצפנים בהעברה ובמנוחה. תעודות זהות מוצפנות ברמת האפליקציה.',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="13" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10 13V10a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="14" cy="17.5" r="1" fill="currentColor"/>
        </svg>
      ),
      title: 'אימות OTP',
      description: 'כל חתימה מאומתת עם קוד SMS חד-פעמי. ניסיונות כושלים מוגבלים ומתועדים.',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 4v20M4 14h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="4" y="4" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
          <circle cx="19" cy="19" r="1.5" fill="currentColor"/>
        </svg>
      ),
      title: 'רישום ביקורת',
      description: 'כל פעולה רשומה: מי, מה, מתי ומאיפה. לוג ביקורת בלתי-ניתן לשינוי לצרכים משפטיים.',
    },
  ]

  return (
    <section id="security" className="py-24 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            אבטחה ברמה משפטית
          </h2>
          <p className="text-lg text-gray-500">
            בנוי לעמוד בדרישות האסדרה הישראלית לחתימות אלקטרוניות ואחסון מסמכים.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          {pillars.map(p => (
            <div key={p.title} className="text-center">
              <div
                className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-5"
                style={{ background: 'rgba(47,157,160,0.1)', color: '#2F9DA0' }}
              >
                {p.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">{p.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ResidentPortalSection() {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div className="text-right">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium mb-6"
              style={{ background: 'rgba(47,157,160,0.1)', color: '#2F9DA0' }}
            >
              פורטל הדיירים
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              מה הדייר רואה
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              הדייר מקבל לינק מאובטח לנייד, מאמת זהות עם OTP, צופה במסמכים ומחתים —
              ללא אפליקציה, ללא סיסמאות, ללא בלבול.
            </p>
            <ul className="space-y-3 text-right">
              {[
                'כניסה מאובטחת עם OTP ב-SMS',
                'צפייה במסמכי הפרויקט',
                'חתימה דיגיטלית מהנייד',
                'מעקב סטטוס בזמן אמת',
                'תמיכה בעברית, ערבית ורוסית',
              ].map(item => (
                <li key={item} className="flex items-center gap-3 justify-end">
                  <span className="text-gray-700 text-sm">{item}</span>
                  <span
                    className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-white text-xs"
                    style={{ background: '#2F9DA0' }}
                  >
                    ✓
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mobile mockup */}
          <div className="flex justify-center">
            <MobilePortalMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

function MobilePortalMockup() {
  return (
    <div
      className="relative w-64 rounded-3xl border-4 border-gray-800 shadow-2xl overflow-hidden"
      style={{ background: '#F5F7F8' }}
    >
      {/* Status bar */}
      <div className="bg-gray-800 h-7 flex items-center justify-between px-4">
        <span className="text-white text-xs">9:41</span>
        <span className="text-white text-xs">●●●</span>
      </div>

      {/* App content */}
      <div className="bg-white">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 text-right" style={{ background: 'linear-gradient(135deg, #22797D, #2F9DA0)' }}>
          <p className="text-white/80 text-xs mb-1">שלום,</p>
          <p className="text-white font-bold text-lg">דוד לוי</p>
          <p className="text-white/70 text-xs">דירה 12, רחוב הרצל 4</p>
        </div>

        <div className="p-4 space-y-3">
          {/* Document */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-right">
            <p className="text-xs text-gray-500 mb-1">לחתימה</p>
            <p className="text-sm font-bold text-gray-800">הסכם פינוי-בינוי</p>
            <p className="text-xs text-gray-400">גרסה 3 · 24 עמודים</p>
          </div>

          {/* Status */}
          <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-3 text-right">
            <p className="text-xs font-semibold text-orange-700 mb-1">ממתין לחתימתך</p>
            <p className="text-xs text-orange-600">תוקף עד 14.09.2026</p>
          </div>

          {/* CTA button */}
          <button
            className="w-full rounded-xl py-3 text-sm font-bold text-white"
            style={{ background: '#2F9DA0' }}
          >
            חתום עכשיו →
          </button>

          {/* OTP */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500 mb-2">קוד OTP נשלח ל-05*****78</p>
            <div className="flex justify-center gap-2">
              {['3', '8', '4', '1', '9', '2'].map((d, i) => (
                <div
                  key={i}
                  className="h-8 w-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-sm font-bold text-gray-800"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CtaBannerSection() {
  return (
    <section id="contact" className="py-24">
      <div className="mx-auto max-w-4xl px-4 lg:px-8">
        <div
          className="rounded-3xl p-8 lg:p-12 text-center text-white"
          style={{ background: 'linear-gradient(135deg, #1D6A6C 0%, #2F9DA0 50%, #3DB8BC 100%)' }}
        >
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            מוכנים להתחיל?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            השאירו פרטים ונציג יחזור אליכם תוך 24 שעות להדגמה אישית ללא התחייבות.
          </p>

          {/*
            Real lead capture. This form previously called preventDefault and
            discarded the submission; it now writes into the CRM's Lead model
            directly — the CRM is this site's backend.
          */}
          <div className="mx-auto max-w-2xl">
            <LeadForm />
          </div>
        </div>
      </div>
    </section>
  )
}
