import { FileText, ChevronLeft } from 'lucide-react'
import type { Dashboard } from '@/lib/dashboard'
import { formatDate } from '@/lib/dashboard'

/**
 * The documents attached to THIS resident.
 *
 * Not the project's document library — a resident sees what was attached to
 * them, which is the distinction the `ResidentDocument` join exists to make.
 */
export function DocumentsPreview({ documents }: { documents: Dashboard['documents'] }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">מסמכים</h3>
        {documents.length > 0 && (
          <a href="/documents" className="flex items-center gap-1 text-xs text-teal-500 hover:text-teal-600">
            הכל <ChevronLeft size={12} />
          </a>
        )}
      </div>

      {documents.length === 0 ? (
        // A real portal has residents with no documents yet. Saying so is
        // better than an empty box that looks like a loading failure.
        <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
          עדיין לא צורפו מסמכים לתיק שלך
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5">
              <FileText size={16} className="flex-shrink-0 text-teal-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-700">{doc.title}</p>
                <p className="text-xs text-gray-400">{formatDate(doc.addedAt)}</p>
              </div>
              {doc.signed && (
                <span
                  className="flex-shrink-0 text-xs text-success-600 font-medium"
                  title="נחתם"
                  aria-label="נחתם"
                >
                  ✓
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
