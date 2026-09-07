export default function SiteSettingsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">הגדרות האתר</h1>
      <p className="text-gray-700">
        פרטי האתר שאושרו לפרסום. לעדכון שלהם יש לפנות למי שמתחזק את האתר.
      </p>
      <dl className="space-y-3 rounded-xl border bg-white p-6">
        <dt className="font-semibold">שם האתר</dt>
        <dd>OpenDoor Group</dd>
        <dt className="font-semibold">דומיין</dt>
        <dd dir="ltr" className="text-start">
          odg.co.il
        </dd>
        <dt className="font-semibold">טלפון</dt>
        <dd>
          <a href="tel:+972548018613" dir="ltr" className="inline-block py-2 underline">
            054-8018613
          </a>
        </dd>
        <dt className="font-semibold">דוא״ל</dt>
        <dd>
          <a href="mailto:info@odg.co.il" className="inline-block py-2 underline">
            info@odg.co.il
          </a>
        </dd>
      </dl>
      <p>הפניות מהאתר מתבצעות בטלפון ובדוא״ל. טופסי פנייה מקוונים אינם פעילים.</p>
    </div>
  )
}
