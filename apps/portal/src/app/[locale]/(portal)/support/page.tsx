'use client'

import { useState } from 'react'
import { Phone, MessageSquare, Mail, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

const FAQ = [
  { q: 'מתי אתחיל לקבל דירה חדשה?', a: 'על פי לוח הזמנים הנוכחי, צפויה מסירת הדירות החדשות בסוף 2027. אנו מתחייבים לעדכן אותך בכל שינוי.' },
  { q: 'האם אוכל להמשיך לגור בדירה במהלך הבנייה?', a: 'לא. בשלב הפינוי תעברו לדיור חלופי שיסופק על ידי היזם על חשבונו, עד לסיום הבנייה ומסירת הדירה החדשה.' },
  { q: 'מה קורה אם אני לא חתמתי?', a: 'אם 80% מהדיירים חתמו, ניתן לפנות לבית המשפט לחיוב הדיירים שלא חתמו. אנו ממליצים לפנות אלינו לבירור כל חשש.' },
  { q: 'מה גודל הדירה החדשה שאקבל?', a: 'על פי ההסכם, הדירה החדשה תהיה לפחות בגודל הדירה הנוכחית ובתוספת של לפחות 25% שטח.' },
  { q: 'מי אחראי על הוצאות הפינוי?', a: 'היזם נושא בכל עלויות הפינוי, הדיור החלופי, האחסון ועלויות המעבר.' },
]

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [ticket, setTicket] = useState({ subject: '', body: '' })
  const [sent, setSent] = useState(false)

  function submit() {
    if (ticket.subject && ticket.body) {
      setSent(true)
      setTicket({ subject: '', body: '' })
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-800">תמיכה ועזרה</h1>
        <p className="text-sm text-gray-500">פנה אלינו בכל שאלה</p>
      </div>

      {/* Contact options */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Phone,          label: 'התקשר',       sub: '03-600-1234',  cls: 'text-teal-600',   bg: 'bg-teal-50' },
          { icon: MessageSquare,  label: 'וואטסאפ',     sub: 'מיידי',        cls: 'text-green-600',  bg: 'bg-green-50' },
          { icon: Mail,           label: 'אימייל',       sub: 'תוך 24 ש׳',   cls: 'text-blue-600',   bg: 'bg-blue-50' },
        ].map(c => {
          const Icon = c.icon
          return (
            <button key={c.label} className="card-surface p-4 flex flex-col items-center gap-2 hover:border-teal-200 transition-colors">
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', c.bg)}>
                <Icon size={20} className={c.cls} />
              </div>
              <p className="text-sm font-semibold text-gray-700">{c.label}</p>
              <p className="text-xs text-gray-400">{c.sub}</p>
            </button>
          )
        })}
      </div>

      {/* Open ticket */}
      <div className="card-surface p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">פתח פנייה חדשה</h2>

        {sent
          ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-green-700">✓ הפנייה נשלחה בהצלחה!</p>
              <p className="text-xs text-green-600 mt-1">נחזור אליך בתוך 24 שעות</p>
              <button onClick={() => setSent(false)} className="text-xs text-green-600 underline mt-2">פנייה חדשה</button>
            </div>
          )
          : (
            <div className="space-y-3">
              <input
                value={ticket.subject}
                onChange={e => setTicket(t => ({ ...t, subject: e.target.value }))}
                placeholder="נושא הפנייה"
                dir="rtl"
                className="w-full rounded-lg border border-gray-200 bg-background px-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <textarea
                value={ticket.body}
                onChange={e => setTicket(t => ({ ...t, body: e.target.value }))}
                placeholder="תאר את שאלתך או הבעיה..."
                rows={4}
                dir="rtl"
                className="w-full rounded-lg border border-gray-200 bg-background px-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
              <button
                onClick={submit}
                disabled={!ticket.subject || !ticket.body}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 text-white text-sm font-medium h-10 rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-40"
              >
                <Send size={14} /> שלח פנייה
              </button>
            </div>
          )
        }
      </div>

      {/* FAQ */}
      <div className="card-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700">שאלות נפוצות</h2>
        </div>
        <div className="divide-y divide-border">
          {FAQ.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-start justify-between gap-3 px-4 py-4 text-right hover:bg-gray-50/50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-800 flex-1">{item.q}</p>
                {openFaq === i ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />}
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
