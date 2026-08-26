// Problem / Solution section

export function BenefitsSection() {
  return (
    <section id="solutions" className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            למה פינוי-בינוי צריך פלטפורמה ייעודית?
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            ניהול פרויקט פינוי-בינוי במאות בעלי דירות הוא מורכבות שאקסל ו-WhatsApp לא יכולים לפתור.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Problem */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-8 text-right">
            <div className="flex items-center gap-3 mb-6 justify-end">
              <h3 className="text-xl font-bold text-gray-900">האתגר</h3>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 3v8M10 14v1" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="8" stroke="#EF4444" strokeWidth="1.5"/>
                </svg>
              </div>
            </div>
            <ul className="space-y-4">
              {[
                'עשרות גיליונות אקסל שמתנגשים זה עם זה',
                'מעקב חתימות ב-WhatsApp — ללא תיעוד משפטי',
                'אין ידיעה מיהו הבעלים האמיתי מול הדייר',
                'מסמכים פזורים בין עורכי דין, אדריכלים ומנהלי פרויקט',
                'אין יכולת לדעת בזמן אמת מה אחוז החתימות',
                'טעויות נתונים שמתגלות רק בשלב חתימת החוזה',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 justify-end">
                  <span className="text-gray-700">{item}</span>
                  <span className="mt-0.5 shrink-0 text-red-400">✕</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div
            className="rounded-2xl p-8 text-right text-white"
            style={{ background: 'linear-gradient(135deg, #22797D 0%, #2F9DA0 100%)' }}
          >
            <div className="flex items-center gap-3 mb-6 justify-end">
              <h3 className="text-xl font-bold">הפתרון — OpenDoor</h3>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 10l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <ul className="space-y-4">
              {[
                'מרשם בעלים מדויק עם שיעורי בעלות כולל חלקים',
                'חתימות דיגיטליות עם OTP, מעקב בזמן אמת וראיות משפטיות',
                'קישור אוטומטי בין בעלים לדיירים לדירה לבניין',
                'ניהול מסמכים מרכזי עם גרסאות ושמירת היסטוריה',
                'דשבורד חי עם ציון חתימות, ציון בריאות, ו-NBA',
                'מרכז איכות נתונים שמזהה בעיות לפני שהן הופכות לבעיה',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 justify-end">
                  <span className="text-white/90">{item}</span>
                  <span className="mt-0.5 shrink-0 text-white">✓</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
