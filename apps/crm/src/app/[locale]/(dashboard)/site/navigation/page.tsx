import Link from 'next/link'

/**
 * Read only. The website's menus are code (apps/website/src/lib/navigation.ts:
 * PRIMARY_NAV_KEYS, NAV_ITEMS and FOOTER_GROUPS); this screen says what they
 * hold, so an editor does not have to ask. When those menus change, change
 * this list with them.
 */
const items = [
  ['מי אנחנו', 'about'],
  ['למה חברה מארגנת', 'why-organizer'],
  ['כך אנחנו עובדים', 'how-we-work'],
  ['השירותים שלנו', 'services'],
  ['שאלות ותשובות', 'faq'],
]
export default function SiteNavigationPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">תפריטי האתר</h1>
      <p className="text-gray-700">
        התפריט הראשי מציג את העמודים הבאים, לפי הסדר. לשינוי הסדר או הכיתוב יש לפנות למי שמתחזק את
        האתר.
      </p>
      <ol className="list-decimal space-y-3 rounded-xl border bg-white p-6 ps-10">
        {items.map(([label, slug]) => (
          <li key={slug}>
            {label}{' '}
            <span dir="ltr" className="text-sm text-gray-600">
              /{slug}
            </span>
          </li>
        ))}
      </ol>
      <p>
        בתפריט הנייד מופיעים גם פרויקטים תקועים, טפסים, יצירת קשר וחיפוש. בתחתית האתר מופיעים גם
        שקיפות ואמון, פרויקטים ועמודי המידע המשפטי, ובקבוצה ״לבעלי דירות״: טפסים, שאלות ותשובות
        וחיפוש.
      </p>
      <p className="text-gray-700">
        פרויקט שמתפרסם מופיע בעמוד הפרויקטים, שמקושר מתחתית האתר. הוספת הפרויקטים לתפריט הראשי ולדף
        הבית נעשית בתחזוקת האתר.
      </p>
      <Link href="/site/pages" className="inline-block py-2 text-teal-800 underline">
        לניהול תוכן העמודים
      </Link>
    </div>
  )
}
