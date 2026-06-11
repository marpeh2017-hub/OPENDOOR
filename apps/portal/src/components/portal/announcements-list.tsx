import { Megaphone, ChevronLeft } from 'lucide-react'

const announcements = [
  { id: '1', title: 'פגישת דיירים – 20 ביוני', date: '05.06.2025', isNew: true },
  { id: '2', title: 'עדכון: אושר תקציב הפרויקט', date: '28.05.2025', isNew: false },
  { id: '3', title: 'מינוי ועד בית חדש',          date: '10.05.2025', isNew: false },
]

export function AnnouncementsList() {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">הודעות</h3>
        <a href="/announcements" className="flex items-center gap-1 text-xs text-teal-500 hover:text-teal-600">
          הכל <ChevronLeft size={12} />
        </a>
      </div>
      <ul className="space-y-2">
        {announcements.map((a) => (
          <li key={a.id} className="flex items-start gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
            <Megaphone size={15} className="flex-shrink-0 text-teal-400 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-700">
                {a.title}
                {a.isNew && <span className="me-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-teal-500 align-middle" />}
              </p>
              <p className="text-xs text-gray-400">{a.date}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
