import { redirect } from 'next/navigation'
import { FileText, Download, CheckCircle2, Clock, PenLine } from 'lucide-react'
import { apiGet, NotAuthenticated } from '@/lib/api'
import { formatDate } from '@/lib/dashboard'
import { formatFileSize, type PortalDocuments } from '@/lib/documents'

/**
 * The resident's documents.
 *
 * ── WHAT THIS PAGE NO LONGER CLAIMS ─────────────────────────────────────────
 *
 * The mock listed six invented documents across three invented categories, and
 * marked some of them "נדרש" with an "העלה" button. That implied two features
 * the product does not have: a checklist of documents the resident still owes,
 * and resident upload. Neither exists in the schema — nothing records what a
 * resident is expected to provide, and `Document.createdById` is a `User`
 * foreign key, so a resident cannot author one.
 *
 * Showing those rows anyway would be worse than showing nothing: a resident
 * would see "נדרש: חשבון ארנונה" and go looking for a way to send it that does
 * not exist. So the page shows what is genuinely there and says plainly when
 * that is nothing.
 */
export const dynamic = 'force-dynamic'

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  let data: PortalDocuments
  try {
    data = await apiGet<PortalDocuments>('portal/documents')
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      redirect(`/${locale}/login${err.code ? `?reason=${err.code}` : ''}`)
    }
    throw err
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-800">המסמכים שלי</h1>
        <p className="text-sm text-gray-500">
          מסמכים שצורפו לתיק שלך או נשלחו אליך לחתימה
        </p>
      </div>

      {data.counts.total > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {data.counts.total} מסמכים
          </span>
          {data.counts.signed > 0 && (
            <span className="rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700">
              {data.counts.signed} נחתמו
            </span>
          )}
          {data.counts.awaitingSignature > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              {data.counts.awaitingSignature} ממתינים לחתימתך
            </span>
          )}
        </div>
      )}

      {data.categories.length === 0 ? (
        <div className="card-surface p-8 text-center">
          <FileText size={28} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">אין עדיין מסמכים בתיק שלך</p>
          <p className="mt-1 text-xs text-gray-500">
            כשצוות הפרויקט יצרף מסמך או ישלח לך מסמך לחתימה, הוא יופיע כאן.
          </p>
        </div>
      ) : (
        data.categories.map((group) => (
          <div key={group.category} className="card-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-gray-50/50">
              <h2 className="text-sm font-semibold text-gray-700">{group.label}</h2>
            </div>
            <div className="divide-y divide-border">
              {group.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText size={16} className="text-blue-600" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{doc.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      {doc.signature?.signed ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-success-600">
                          <CheckCircle2 size={11} />
                          נחתם {doc.signature.signedAt && formatDate(doc.signature.signedAt)}
                        </span>
                      ) : doc.signature?.required ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                          <Clock size={11} />
                          ממתין לחתימתך
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{formatDate(doc.sharedAt)}</span>
                      )}
                      {doc.fileSize > 0 && (
                        <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
                      )}
                      {/* Says how they came to have it, which answers "why am I
                          seeing this?" without a support call. */}
                      {doc.sources.includes('SIGNATURE') && !doc.signature?.signed && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <PenLine size={11} />
                          נשלח לחתימה
                        </span>
                      )}
                    </div>
                  </div>

                  {doc.downloadable ? (
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      title={`הורדת ${doc.fileName}`}
                      aria-label={`הורדת ${doc.fileName}`}
                    >
                      <Download size={14} />
                    </a>
                  ) : (
                    // A metadata-only record: the project registered the
                    // document before the file existed. Better a plain note
                    // than a download button that returns an error.
                    <span className="flex-shrink-0 text-xs text-gray-400">טרם הועלה</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
