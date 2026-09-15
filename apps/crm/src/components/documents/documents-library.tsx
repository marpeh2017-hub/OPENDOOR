'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, FileText, History, Loader2, Trash2, Upload } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useDocuments, useDeleteDocument, fetchDownloadUrl } from '@/hooks/use-documents'
import { useProjects } from '@/hooks/use-projects'
import { useIsManager, useCanWriteDocuments } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { UploadDocumentDialog } from './upload-document-dialog'
import { DocumentVersionsDialog } from './document-versions-dialog'

/** Mirrors the DocumentCategory enum accepted by GET /documents?category=. */
export const CATEGORY_LABELS: Record<string, string> = {
  CONTRACT:          'חוזה',
  ID_DOCUMENT:       'מסמך זיהוי',
  LAND_REGISTRY:     'נסח טאבו',
  POWER_OF_ATTORNEY: 'ייפוי כוח',
  PLANNING:          'תכנון',
  ENGINEERING:       'הנדסה',
  FINANCIAL:         'פיננסי',
  MUNICIPALITY:      'עירייה',
  MARKETING:         'שיווק',
  MEETING_MINUTES:   'פרוטוקול',
  LEGAL:             'משפטי',
  PERMIT:            'היתר',
  OTHER:             'אחר',
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT:            { label: 'טיוטה',     cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  PENDING_REVIEW:   { label: 'בבדיקה',    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  APPROVED:         { label: 'מאושר',     cls: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED:         { label: 'נדחה',      cls: 'bg-red-100 text-red-700 border-red-200' },
  EXPIRED:          { label: 'פג תוקף',   cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  ARCHIVED:         { label: 'בארכיון',   cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('he-IL')
}

export function DocumentsLibrary() {
  const [projectId, setProjectId] = useState('ALL')
  const [category, setCategory]   = useState('ALL')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const filters = {
    ...(projectId !== 'ALL' ? { projectId } : {}),
    ...(category  !== 'ALL' ? { category }  : {}),
  }

  const { data, isLoading, isError, error, refetch } = useDocuments(filters)
  const { data: projects } = useProjects({ limit: 100 })
  const deleteDoc = useDeleteDocument()
  const canDelete = useIsManager() // mirrors MANAGER_ROLES on DELETE /documents/:id
  // Mirrors DOCUMENT_WRITE_ROLES on POST /documents/upload. Hiding the button
  // is convenience only — the endpoint returns 403 for other roles.
  const canUpload = useCanWriteDocuments()
  const [uploadOpen, setUploadOpen] = useState(false)
  /** The document whose version history is open, if any. */
  const [versionsFor, setVersionsFor] = useState<{ id: string; title: string } | null>(null)

  const projectName = useMemo(() => {
    const map = new Map<string, string>()
    projects?.data.forEach(p => map.set(p.id, p.name))
    return map
  }, [projects])

  /**
   * The document row never carries a storage key. Clicking "הורדה" asks the API
   * for a fresh 15-minute signed URL and opens it — the key stays server-side.
   */
  async function download(id: string) {
    setDownloadError(null)
    setDownloadingId(id)
    try {
      const url = await fetchDownloadUrl(id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'הורדת המסמך נכשלה')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={projectId} onValueChange={setProjectId} dir="rtl">
          <SelectTrigger className="w-52"><SelectValue placeholder="פרויקט" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הפרויקטים</SelectItem>
            {projects?.data.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={setCategory} dir="rtl">
          <SelectTrigger className="w-48"><SelectValue placeholder="קטגוריה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הקטגוריות</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />
        {data && <span className="text-sm text-muted-foreground">{data.length} מסמכים</span>}
        {canUpload && (
          <Button onClick={() => setUploadOpen(true)} data-testid="open-upload-dialog">
            <Upload size={15} className="ml-1.5" />
            העלאת מסמך
          </Button>
        )}
      </div>

      {canUpload && (
        <UploadDocumentDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          defaultProjectId={projectId !== 'ALL' ? projectId : undefined}
        />
      )}

      {downloadError && <QueryError message="הורדת המסמך נכשלה" error={new Error(downloadError)} />}

      <div className="card-surface overflow-hidden">
        {isLoading ? (
          <RowsSkeleton rows={6} />
        ) : isError || !data ? (
          <div className="p-4">
            <QueryError message="שגיאה בטעינת המסמכים" error={error} onRetry={() => refetch()} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            message="אין מסמכים להצגה"
            hint={canUpload ? 'לחצו על העלאת מסמך כדי להוסיף את המסמך הראשון' : 'מסמכים שיועלו לפרויקטים יופיעו כאן'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right font-semibold">מסמך</TableHead>
                <TableHead className="text-right font-semibold">קטגוריה</TableHead>
                <TableHead className="text-right font-semibold">פרויקט</TableHead>
                <TableHead className="text-right font-semibold">גודל</TableHead>
                <TableHead className="text-right font-semibold">גרסה</TableHead>
                <TableHead className="text-right font-semibold">נוצר</TableHead>
                <TableHead className="text-right font-semibold">סטטוס</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(doc => {
                const status = STATUS_LABELS[doc.status]
                  ?? { label: doc.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText size={15} className="flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium">{doc.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {CATEGORY_LABELS[doc.category] ?? doc.category}
                    </TableCell>
                    <TableCell className="text-sm">
                      {doc.projectId ? (
                        <Link href={`/projects/${doc.projectId}`} className="text-primary hover:underline">
                          {projectName.get(doc.projectId) ?? doc.projectId}
                        </Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatSize(doc.fileSize)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {/*
                        The list shows only the CURRENT version of each document
                        (the API filters on isLatest), so this number doubles as
                        "how many revisions have there been".
                      */}
                      v{doc.version}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`הורדת ${doc.title}`}
                          disabled={downloadingId === doc.id}
                          onClick={() => download(doc.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50"
                        >
                          {downloadingId === doc.id
                            ? <Loader2 size={15} className="animate-spin" />
                            : <Download size={15} />}
                        </button>
                        <button
                          type="button"
                          aria-label={`היסטוריית גרסאות של ${doc.title}`}
                          title="היסטוריית גרסאות"
                          onClick={() => setVersionsFor({ id: doc.id, title: doc.title })}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                        >
                          <History size={15} />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            aria-label={`מחיקת ${doc.title}`}
                            onClick={() => {
                              // On a versioned document the server deletes only
                              // the CURRENT version and promotes the previous
                              // one, so say so rather than implying the whole
                              // document disappears.
                              const message = doc.version > 1
                                ? `למחוק את גרסה ${doc.version} של "${doc.title}"? גרסה ${doc.version - 1} תחזור להיות הגרסה הנוכחית.`
                                : `למחוק את המסמך "${doc.title}"?`
                              if (window.confirm(message)) deleteDoc.mutate(doc.id)
                            }}
                            className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <DocumentVersionsDialog
        documentId={versionsFor?.id ?? null}
        documentTitle={versionsFor?.title}
        open={versionsFor !== null}
        onOpenChange={(next) => { if (!next) setVersionsFor(null) }}
      />

      {deleteDoc.isError && <QueryError message="מחיקת המסמך נכשלה" error={deleteDoc.error} />}
    </div>
  )
}
