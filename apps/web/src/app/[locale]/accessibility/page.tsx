import type { Metadata } from 'next'
import { LegalPage, Section, Bullets, Placeholder } from '@/components/legal/legal-page'
import { company } from '@/lib/company'

export const metadata: Metadata = {
  title: 'הצהרת נגישות',
  description:
    'מצב הנגישות של האתר ושל משרדי החברה, ההתאמות שבוצעו, מה שטרם הונגש, ודרכי פנייה לרכז הנגישות.',
}

export default function AccessibilityPage() {
  return (
    <LegalPage
      title="הצהרת נגישות"
      intro="החברה רואה בהנגשת שירותיה חובה חוקית וערך מקצועי, ופועלת לאפשר לכל אדם, לרבות אנשים עם מוגבלות, לקבל את שירותיה באופן שוויוני, מכובד ועצמאי."
    >
      <Section title="1. המסגרת החוקית">
        <p>
          הצהרה זו ניתנת בהתאם ל<strong>חוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998</strong>{' '}
          ול<strong>תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013</strong>.
        </p>
        <p>
          תקנה 35 לתקנות מחילה על שירותי אינטרנט את הוראות התקן הישראלי{' '}
          <strong>ת"י 5568 "קווים מנחים לנגישות תכנים באינטרנט"</strong>, המבוסס על מסמך{' '}
          <span dir="ltr">WCAG 2.0</span> של ארגון <span dir="ltr">W3C</span>, ברמת התאמה{' '}
          <strong>AA</strong>. בבדיקת האתר יישמנו את הדרישות לפי <span dir="ltr">WCAG 2.1 AA</span>,
          המחמיר מהתקן הנדרש.
        </p>
      </Section>

      <Section title="2. רכז הנגישות">
        <p>
          בהתאם לתקנה 91 לתקנות, מונה בחברה רכז נגישות. ניתן לפנות אליו בכל בקשה, בעיית נגישות
          שנתקלת בה, או בקשה להתאמה:
        </p>
        <Bullets
          items={[
            <>
              <strong>שם:</strong> <Placeholder>{company.accessibilityCoordinator.name}</Placeholder>
            </>,
            <>
              <strong>טלפון:</strong>{' '}
              <Placeholder>{company.accessibilityCoordinator.phone}</Placeholder>
            </>,
            <>
              <strong>דוא"ל:</strong>{' '}
              <Placeholder>{company.accessibilityCoordinator.email}</Placeholder>
            </>,
          ]}
        />
        <p>
          נטפל בפנייתך בהקדם ונשיב לה בתוך זמן סביר. אם הפנייה אינה נפתרת לשביעות רצונך, באפשרותך
          לפנות לנציבות שוויון זכויות לאנשים עם מוגבלות במשרד המשפטים.
        </p>
      </Section>

      <Section title="3. מצב הנגישות באתר">
        <p>
          האתר נבדק ביום <Placeholder>{company.accessibilityAuditDate}</Placeholder> בבדיקה
          אוטומטית ובבדיקה ידנית, לרבות ניווט מלא באמצעות מקלדת. <strong>נכון למועד זה האתר
          אינו עומד באופן מלא בדרישות ת"י 5568 ברמה AA</strong>, ואנו פועלים להשלמת ההתאמות.
          מפורט להלן מצב מדויק, ולא הצהרת עמידה גורפת.
        </p>

        <p className="pt-2 font-semibold text-gray-800">התאמות שכבר קיימות באתר:</p>
        <Bullets
          items={[
            'ניווט מלא באמצעות מקלדת בכל רכיבי האתר, בסדר הגיוני ועקבי.',
            'סימון ברור וגלוי של הרכיב שבמוקד (focus) בעת ניווט במקלדת.',
            'מבנה כותרות היררכי ותקין המאפשר ניווט יעיל בקורא מסך.',
            'סימון אזורי תוכן (landmarks) — תוכן ראשי, ניווט וכותרת תחתונה.',
            'הגדרת שפת העמוד וכיוון הכתיבה מימין לשמאל, לקריאה תקינה בקורא מסך.',
            'טקסט קישורים וכפתורים תיאורי ומובן גם במנותק מהקשרו.',
            'שדות הטופס מקושרים לתוויות שלהם, והודעות שגיאה מוצגות בטקסט ומשויכות לשדה הרלוונטי.',
            'תצוגה תקינה במסכים קטנים, ללא צורך בגלילה אופקית.',
            'קישור "דילוג לתוכן המרכזי" בראש כל עמוד.',
          ]}
        />

        <p className="pt-2 font-semibold text-gray-800">מגבלות ידועות שטרם הושלמו:</p>
        <Bullets
          items={[
            <>
              <strong>ניגודיות צבעים:</strong> חלק מהטקסטים באתר אינם עומדים ביחס הניגודיות הנדרש
              (4.5:1). הליקוי בטיפול פעיל. <Placeholder>{TBD_CONTRAST}</Placeholder>
            </>,
            <>
              <strong>עמודי תוכן נוספים:</strong> חלק מעמודי האתר טרם נבנו. עם עלייתם הם ייבדקו
              ויונגשו באותו תקן.
            </>,
            <>
              <strong>מסמכים להורדה:</strong> ככל שיפורסמו באתר מסמכים בפורמט PDF, ייתכן שחלקם
              אינם נגישים במלואם. נשמח לספק כל מסמך בפורמט נגיש לפי פנייה לרכז הנגישות.
            </>,
          ]}
        />
      </Section>

      <Section title="4. נגישות המשרדים">
        <p>
          <Placeholder>{TBD_PREMISES}</Placeholder>
        </p>
        <p>כתובות המשרדים:</p>
        <Bullets
          items={company.offices.map((o) => (
            <>
              <strong>{o.label}:</strong> {o.address} · טלפון {o.phone}
            </>
          ))}
        />
      </Section>

      <Section title="5. דרכי פנייה חלופיות">
        <p>
          אם נתקלת בקושי בשימוש באתר, ניתן לפנות אלינו גם בטלפון {company.offices[0].phone} או
          בדוא"ל{' '}
          <a href={`mailto:${company.generalEmail}`} className="text-teal-600 underline">
            {company.generalEmail}
          </a>
          , ונשמח לסייע במסירת המידע או בביצוע הפנייה עבורך.
        </p>
      </Section>

      <Section title="6. עדכון ההצהרה">
        <p>
          הצהרה זו תעודכן עם השלמת ההתאמות ובכל שינוי מהותי באתר. תאריך העדכון האחרון מופיע בראש
          העמוד.
        </p>
      </Section>
    </LegalPage>
  )
}

const TBD_CONTRAST =
  '[[ לעדכן/למחוק סעיף זה לאחר השלמת תיקוני הניגודיות — להשלמה ]]'

const TBD_PREMISES =
  '[[ לתאר את מצב נגישות המשרדים בפועל: חניית נכים, גישה ללא מדרגות, מעלית, שירותי נכים, עמדת שירות נגישה. נדרשת בדיקה של מורשה נגישות מבנים ותשתיות — להשלמה ]]'
