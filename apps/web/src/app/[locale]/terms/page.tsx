import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'תנאי שימוש',
  description: 'תנאי השימוש של OpenDoor התחדשות עירונית',
}

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="bg-white min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-16 lg:px-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500 mb-8 text-right">
            <Link href="/" className="hover:text-teal-600">ראשי</Link>
            <span className="mx-2">›</span>
            <span>תנאי שימוש</span>
          </nav>

          <div className="text-right">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">תנאי שימוש</h1>
            <p className="text-gray-500 mb-10">עדכון אחרון: אוגוסט 2026</p>

            <Section title="1. הסכמה לתנאים">
              <p>
                השימוש בפלטפורמת OpenDoor מהווה הסכמה לתנאי השימוש שלהלן. אם אינכם מסכימים לתנאים אלה,
                אנא הפסיקו את השימוש בשירות. תנאים אלה כפופים לדין הישראלי.
              </p>
            </Section>

            <Section title="2. הגדרות">
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li><strong>פלטפורמה</strong> — מערכת OpenDoor CRM, פורטל הדיירים, ו-API הקשורים</li>
                <li><strong>לקוח</strong> — חברת פינוי-בינוי או נציגיה המנויים על הפלטפורמה</li>
                <li><strong>משתמש קצה</strong> — בעל דירה או דייר הניגש לפורטל</li>
                <li><strong>תוכן</strong> — נתונים, מסמכים וחתימות שנשמרים בפלטפורמה</li>
              </ul>
            </Section>

            <Section title="3. השירות">
              <p>
                OpenDoor מספקת פלטפורמת SaaS לניהול פרויקטי פינוי-בינוי. השירות כולל ניהול בעלים,
                חתימות דיגיטליות, דשבורד פרויקט ופורטל דיירים. אנו שומרים את הזכות לשנות או להפסיק
                חלקים מהשירות עם הודעה מראש.
              </p>
            </Section>

            <Section title="4. חשבון ואחריות">
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>הלקוח אחראי לנכונות הנתונים שהועלו לפלטפורמה</li>
                <li>הלקוח אחראי לנהל הרשאות גישה של המשתמשים בארגון</li>
                <li>חל איסור על שיתוף פרטי גישה או העברת חשבון לצד שלישי</li>
                <li>הלקוח אחראי לקבל הסכמות נדרשות מבעלי הדירות בהתאם לחוק</li>
              </ul>
            </Section>

            <Section title="5. תשלום ורישיון">
              <p>
                השימוש בפלטפורמה כפוף לתנאי ההסכם המסחרי החתום בין הלקוח לחברה. לרישיון ניתן מנוי
                לא-בלעדי, ניתן להעברה, לשימוש בפלטפורמה בלבד למטרות תהליך הפינוי-בינוי.
              </p>
            </Section>

            <Section title="6. קניין רוחני">
              <p>
                כל הזכויות בפלטפורמה, כולל קוד המקור, עיצוב, מותג ופטנטים, שייכות לחברה.
                נתוני הלקוח שייכים ללקוח ואנו מעבדים אותם כמעבד נתונים בלבד.
              </p>
            </Section>

            <Section title="7. הגבלת אחריות">
              <p>
                הפלטפורמה מסופקת "כמות שהיא" (as-is). החברה לא תהיה אחראית לנזקים עקיפים, מיוחדים
                או תוצאתיים. האחריות הכוללת של החברה מוגבלת לגובה הסכום ששולם ב-12 החודשים האחרונים.
              </p>
            </Section>

            <Section title="8. דין ושיפוט">
              <p>
                תנאי שימוש אלה כפופים לדין הישראלי. כל סכסוך ידון בבתי המשפט המוסמכים במחוז תל-אביב.
              </p>
            </Section>

            <Section title="9. יצירת קשר">
              <p>
                לכל שאלה:{' '}
                <a href="mailto:legal@opendoor.co.il" className="underline" style={{ color: '#2F9DA0' }}>
                  legal@opendoor.co.il
                </a>
              </p>
            </Section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="text-gray-600 leading-relaxed">{children}</div>
    </div>
  )
}
