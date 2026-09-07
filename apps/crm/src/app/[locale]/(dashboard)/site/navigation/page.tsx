import Link from 'next/link'
const items = [
  ['מי אנחנו', 'about'],
  ['למה חברה מארגנת', 'why-organizer'],
  ['כך אנחנו עובדים', 'how-we-work'],
  ['פרויקטים', 'projects'],
  ['מרכז ידע', 'knowledge'],
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
      <p>יצירת קשר, שאלות ותשובות וחיפוש זמינים גם בתחתית האתר ובתפריט הנייד.</p>
      <Link href="/site/pages" className="inline-block py-2 text-teal-800 underline">
        לניהול תוכן העמודים
      </Link>
    </div>
  )
}
