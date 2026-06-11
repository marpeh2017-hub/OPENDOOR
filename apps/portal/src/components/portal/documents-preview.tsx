import { FileText, ChevronLeft } from 'lucide-react'

const docs = [
  { name: 'הסכם פינוי-בינוי', date: '15.03.2025', signed: true },
  { name: 'ייפוי כוח',        date: '10.01.2025', signed: true },
  { name: 'תוכנית קומה',      date: '01.06.2025', signed: false },
]

export function DocumentsPreview() {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">מסמכים</h3>
        <a href="/documents" className="flex items-center gap-1 text-xs text-teal-500 hover:text-teal-600">
          הכל <ChevronLeft size={12} />
        </a>
      </div>
      <ul className="space-y-2">
        {docs.map((doc) => (
          <li key={doc.name} className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5">
            <FileText size={16} className="flex-shrink-0 text-teal-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-700">{doc.name}</p>
              <p className="text-xs text-gray-400">{doc.date}</p>
            </div>
            {doc.signed && (
              <span className="flex-shrink-0 text-xs text-success-600 font-medium">✓</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
