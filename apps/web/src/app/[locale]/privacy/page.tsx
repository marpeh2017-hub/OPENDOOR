import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'מדיניות פרטיות',
  description: 'מדיניות הפרטיות של OpenDoor התחדשות עירונית',
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="bg-white min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-16 lg:px-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500 mb-8 text-right">
            <Link href="/" className="hover:text-teal-600">ראשי</Link>
            <span className="mx-2">›</span>
            <span>מדיניות פרטיות</span>
          </nav>

          <div className="text-right">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">מדיניות פרטיות</h1>
            <p className="text-gray-500 mb-10">עדכון אחרון: אוגוסט 2026</p>

            <Section title="1. מבוא">
              <p>
                OpenDoor התחדשות עירונית ("החברה", "אנחנו") מחויבת להגן על פרטיות המשתמשים בפלטפורמה שלנו.
                מדיניות זו מסבירה כיצד אנו אוספים, משתמשים ומגינים על המידע האישי שלכם בהתאם לחוק הגנת הפרטיות,
                התשמ"א-1981 ותיקוניו.
              </p>
            </Section>

            <Section title="2. מידע שאנו אוספים">
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>פרטי זיהוי: שם מלא, תעודת זהות, טלפון, אימייל</li>
                <li>נתוני בעלות: פרטי דירה, שיעורי בעלות, מסמכים רלוונטיים</li>
                <li>נתוני חתימה: מועד חתימה, כתובת IP, User-Agent, קוד OTP</li>
                <li>נתוני שימוש: פעולות במערכת, ביקורת ולוגים</li>
                <li>תקשורת: הודעות WhatsApp, SMS ואימייל שנשלחו דרך המערכת</li>
              </ul>
            </Section>

            <Section title="3. שימוש במידע">
              <p className="mb-3">אנו משתמשים במידע לצרכים הבאים:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>ניהול תהליך פינוי-בינוי וחתימות דיגיטליות</li>
                <li>אימות זהות לצרכים משפטיים</li>
                <li>תקשורת עם בעלי דירות ודיירים</li>
                <li>עמידה בדרישות חוקיות ורגולטוריות</li>
                <li>שיפור הפלטפורמה וניתוח נתוני שימוש</li>
              </ul>
            </Section>

            <Section title="4. אבטחת מידע">
              <p>
                כל הנתונים מוצפנים בהעברה (TLS 1.3) ובמנוחה (AES-256). תעודות זהות מוצפנות ברמת האפליקציה
                לפני שמירה במסד הנתונים. גישה למידע רגיש מוגבלת לצוותים מורשים בלבד.
              </p>
            </Section>

            <Section title="5. שיתוף מידע">
              <p>
                אנו לא מוכרים, משכירים או מעבירים מידע אישי לצדדים שלישיים, למעט:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 mt-3">
                <li>ספקי שירות הכרחיים (SMS, שרתי ענן) תחת הסכמי עיבוד נתונים</li>
                <li>כשנדרש על-פי חוק, צו שיפוטי או רשות מוסמכת</li>
                <li>עורכי דין ואדריכלים של הפרויקט, בהסכמת בעלי הדירות</li>
              </ul>
            </Section>

            <Section title="6. זכויות המשתמש">
              <p className="mb-3">בהתאם לחוק, יש לכם זכות לבקש:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>עיון במידע האישי שנשמר עליכם</li>
                <li>תיקון מידע שגוי</li>
                <li>מחיקת מידע (בכפוף לחובות שמירה חוקיות)</li>
                <li>קבלת עותק מהמידע בפורמט נגיש</li>
              </ul>
            </Section>

            <Section title="7. קשר">
              <p>
                לכל שאלה הקשורה לפרטיות:{' '}
                <a href="mailto:privacy@opendoor.co.il" className="underline" style={{ color: '#2F9DA0' }}>
                  privacy@opendoor.co.il
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
