// Trust bar / Logos section

export function StatsSection() {
  const companies = [
    'קבוצת אשדר',
    'גינדי החזקות',
    'יובל גד',
    'אמות השקעות',
    'מבנה נדל"ן',
    'מצלאוי',
  ]

  return (
    <section className="border-y border-gray-100 py-10 bg-gray-50/60">
      <div className="mx-auto max-w-7xl px-4 lg:px-8 text-center">
        <p className="text-sm font-medium text-gray-500 mb-6">
          נבחר על ידי חברות פינוי-בינוי מובילות בישראל
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {companies.map(name => (
            <div
              key={name}
              className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
