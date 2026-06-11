const stats = [
  { value: '50+',    label: 'פרויקטים פעילים',      desc: 'ברחבי ישראל' },
  { value: '10,000+', label: 'דיירים מרוצים',        desc: 'מוסרו מפתחות' },
  { value: '94%',    label: 'שביעות רצון',           desc: 'ממשוב דיירים' },
  { value: '15+',    label: 'שנות ניסיון',           desc: 'בהתחדשות עירונית' },
]

export function StatsSection() {
  return (
    <section className="border-y border-border bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-black text-teal-500 mb-1">{s.value}</p>
              <p className="text-base font-semibold text-gray-800">{s.label}</p>
              <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
