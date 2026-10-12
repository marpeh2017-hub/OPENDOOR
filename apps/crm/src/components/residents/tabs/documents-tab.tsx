'use client'

import { useState } from 'react'
import { Download, FileText, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { EmptyState, QueryError, RowsSkeleton } from '@/components/ui/query-states'
import {
  fetchDownloadUrl, useDocuments, useShareDocument, useUnshareDocument,
} from '@/hooks/use-documents'
import { useResident } from '@/hooks/use-residents'
import { useCanShareDocuments } from '@/hooks/use-auth'
import { CATEGORY_LABELS } from '@/components/documents/documents-library'

/**
 * The documents shared with this resident: exactly what they see in their
 * personal area ("המסמכים שלי"). Staff who may share (RESIDENT_SHARE_ROLES)
 * can add one of the project's documents or stop sharing one; the documents
 * library shares a document with many residents at once.
 */
export function ResidentDocumentsTab({ residentId }: { residentId: string }) {
  const canShare = useCanShareDocuments()
  const { data: resident } = useResident(residentId)
  const projectId = resident?.apartment?.building?.complex?.project?.id
  const shared = useDocuments({ residentId })
  const projectDocs = useDocuments({ projectId }, { enabled: Boolean(projectId && canShare) })
  const share = useShareDocument()
  const unshare = useUnshareDocument()
  const [picked, setPicked] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sharedIds = new Set(shared.data?.map((d) => d.id))
  const available = (projectId ? projectDocs.data ?? [] : []).filter((d) => !sharedIds.has(d.id))

  async function run(key: string, action: () => Promise<unknown>, failure: string) {
    setError(null)
    setBusy(key)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : failure)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card-surface space-y-4 p-4">
      <p className="text-sm text-muted-foreground">
        אלה המסמכים שהדייר רואה באזור האישי שלו, ויכול להוריד.
      </p>

      {canShare && projectId && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={picked} onValueChange={setPicked} dir="rtl">
            <SelectTrigger className="w-72" aria-label="מסמך מהפרויקט לשיתוף">
              <SelectValue placeholder={available.length ? 'בחרו מסמך מהפרויקט' : 'כל מסמכי הפרויקט כבר משותפים'} />
            </SelectTrigger>
            <SelectContent>
              {available.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={!picked || busy !== null}
            onClick={() => run('share', async () => {
              await share.mutateAsync({ documentId: picked, residentId })
              setPicked('')
            }, 'השיתוף נכשל')}
          >
            {busy === 'share' && <Loader2 size={14} className="ml-1 animate-spin" />}
            שיתוף עם הדייר
          </Button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {shared.isLoading ? (
        <RowsSkeleton rows={3} />
      ) : shared.isError ? (
        <QueryError message="שגיאה בטעינת המסמכים" error={shared.error} onRetry={() => shared.refetch()} />
      ) : !shared.data?.length ? (
        <EmptyState
          message="עדיין לא שותפו מסמכים עם הדייר"
          hint={canShare ? 'בחרו מסמך מהפרויקט למעלה, או שתפו מספריית המסמכים.' : undefined}
        />
      ) : (
        <ul className="divide-y rounded-md border">
          {shared.data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2">
              <FileText size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{d.title}</span>
                <span className="block text-xs text-muted-foreground">{CATEGORY_LABELS[d.category] ?? d.category}</span>
              </span>
              <button
                type="button"
                aria-label={`הורדת ${d.title}`}
                disabled={busy !== null}
                onClick={() => run(`dl-${d.id}`, async () => {
                  window.open(await fetchDownloadUrl(d.id), '_blank', 'noopener,noreferrer')
                }, 'הורדת המסמך נכשלה')}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50"
              >
                {busy === `dl-${d.id}` ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              </button>
              {canShare && (
                <button
                  type="button"
                  aria-label={`הפסקת השיתוף של ${d.title}`}
                  title="הפסקת השיתוף"
                  disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm(`להפסיק לשתף את "${d.title}" עם הדייר? הוא לא יראה אותו יותר באזור האישי.`)) return
                    void run(`un-${d.id}`, () => unshare.mutateAsync({ documentId: d.id, residentId }), 'הפסקת השיתוף נכשלה')
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {busy === `un-${d.id}` ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
