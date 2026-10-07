import Link from 'next/link'
export default function SiteSeoPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">הופעה במנועי חיפוש</h1>
      <p className="text-gray-700">
        כותרת ותיאור לגוגל נערכים בתוך הפרויקט או כתבת מרכז הידע. השינויים מגיעים לאתר לאחר שמירה
        ופרסום.
      </p>
      <ul className="space-y-3 rounded-xl border bg-white p-6">
        <li>
          <Link href="/site/projects" className="inline-block py-2 text-teal-800 underline">
            הגדרות חיפוש של פרויקטים
          </Link>
        </li>
        <li>
          <Link href="/site/knowledge" className="inline-block py-2 text-teal-800 underline">
            מאמרי מרכז הידע
          </Link>
        </li>
      </ul>
      <p>
        הכותרות והתיאורים של העמודים הקבועים, כמו מי אנחנו או השירותים שלנו, נקבעים בתחזוקת האתר.
        תצוגות מקדימות ועמודים שלא פורסמו אינם מיועדים למנועי חיפוש.
      </p>
      <p className="text-gray-700">שינוי הגדרות כלליות ומפת האתר נעשה באמצעות תחזוקת האתר.</p>
    </div>
  )
}
