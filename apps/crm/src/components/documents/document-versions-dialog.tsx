'use client'

import { useRef, useState } from 'react'
import { Download, History, Loader2, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  useDocumentVersions, useUploadDocumentVersion, fetchDownloadUrl,
} from '@/hooks/use-documents'
import { useCanWriteDocuments } from '@/hooks/use-auth'
import { validateDocumentFile, DOCUMENT_ACCEPT_ATTR, formatBytes } from '@/lib/document-upload'

/**
 * Version history for one document, with the "upload a replacement" action.
 *
 * WHAT THE SERVER GUARANTEES, restated here because the UI depends on it:
 *   - uploading a replacement never overwrites the previous file. Each version
 *     keeps its own stored object, which is why every row below has a working
 *     download button and not just the current one;
 *   - exactly one version is `isLatest`;
 *   - a version cannot change the document's project or category, so nothing in
 *     this dialog offers to.
 *
 * Downloads go through `fetchDownloadUrl(version.id)` — the same signed-URL
 * route the library uses. No storage key is ever sent to the browser.
 */
export function DocumentVersionsDialog({
  documentId,
  documentTitle,
  open,
  onOpenChange,
}: {
  documentId: string | null
  documentTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading, isError } = useDocumentVersions(open ? documentId : null)
  const canUpload = useCanWriteDocuments()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadVersion = useUploadDocumentVersion(setProgress)

  const reset = () => {
    setFile(null); setFileError(null); setProgress(null); setActionError(null)
    if (inputRef.current) inputRef.current.value = ''
    uploadVersion.reset()
  }

  const pick = (f: File | null) => {
    setActionError(null)
    if (!f) { setFile(null); setFileError(null); return }
    // Client-side pre-check only. The server also validates the file's actual
    // byte signature, which the browser cannot do — a file that passes here can
    // still be refused as disguised.
    const err = validateDocumentFile(f)
    setFileError(err)
    setFile(err ? null : f)
  }

  const submit = () => {
    if (!file || !documentId) return
    uploadVersion.mutate(
      { documentId, file },
      {
        onSuccess: () => reset(),
        onError: (e) => setActionError(e instanceof Error ? e.message : 'העלאת הגרסה נכשלה'),
      },
    )
  }

  const download = async (versionId: string) => {
    setActionError(null)
    setDownloadingId(versionId)
    try {
      const url = await fetchDownloadUrl(versionId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'הורדת המסמך נכשלה')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={18} className="text-primary" />
            היסטוריית גרסאות
            {documentTitle && (
              <span className="text-sm font-normal text-muted-foreground">— {documentTitle}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-2 overflow-y-auto py-2">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="animate-spin" size={16} />
              טוען היסטוריה…
            </div>
          )}

          {isError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              לא ניתן לטעון את היסטוריית הגרסאות.
            </p>
          )}

          {data?.versions.map((v) => (
            <div
              key={v.id}
              className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                v.isLatest ? 'border-emerald-200 bg-emerald-50/40' : 'border-border'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">גרסה {v.version}</span>
                  {v.isLatest && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      <CheckCircle2 size={11} />
                      נוכחית
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[
                    v.fileName,
                    v.fileSize ? formatBytes(v.fileSize) : null,
                    // Who uploaded this version, and when.
                    v.createdBy ? `${v.createdBy.firstName} ${v.createdBy.lastName}` : null,
                    new Date(v.createdAt).toLocaleString('he-IL'),
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => download(v.id)}
                disabled={downloadingId === v.id}
              >
                {downloadingId === v.id
                  ? <Loader2 size={13} className="ml-1 animate-spin" />
                  : <Download size={13} className="ml-1" />}
                הורדה
              </Button>
            </div>
          ))}

          {actionError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {actionError}
            </p>
          )}
        </div>

        {canUpload && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium">העלאת גרסה חדשה</p>
            <p className="text-xs text-muted-foreground">
              הגרסה הקודמת נשמרת ותישאר זמינה להורדה. הפרויקט והקטגוריה נשמרים.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={DOCUMENT_ACCEPT_ATTR}
              className="block w-full text-sm"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            {fileError && <p className="text-xs text-red-600">{fileError}</p>}
            {progress !== null && (
              <p className="text-xs text-muted-foreground">מעלה… {progress}%</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            סגירה
          </Button>
          {canUpload && (
            <Button type="button" onClick={submit} disabled={!file || uploadVersion.isPending}>
              {uploadVersion.isPending
                ? <Loader2 size={14} className="ml-2 animate-spin" />
                : <Upload size={14} className="ml-1" />}
              העלאת גרסה
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
