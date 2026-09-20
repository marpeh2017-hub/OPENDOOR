'use client'

import { FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useDocuments } from '@/hooks/use-documents'

const CATEGORY_LABELS: Record<string, string> = {
  CONTRACT:          'חוזה',
  LAND_REGISTRY:     'רישום קרקע',
  PLANNING:          'תכנון',
  ENGINEERING:       'הנדסה',
  MUNICIPALITY:      'עירייה',
  LEGAL:             'משפטי',
  POWER_OF_ATTORNEY: 'ייפוי כוח',
  MEETING_MINUTES:   'פרוטוקול',
}

const STATUS_CLS: Record<string, string> = {
  APPROVED:       'text-green-700 bg-green-50 border-green-200',
  PENDING_REVIEW: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  DRAFT:          'text-gray-600 bg-gray-50 border-gray-200',
  REJECTED:       'text-red-700 bg-red-50 border-red-200',
}
const STATUS_LABEL: Record<string, string> = {
  APPROVED:       'מאושר',
  PENDING_REVIEW: 'בבדיקה',
  DRAFT:          'טיוטה',
  REJECTED:       'נדחה',
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ProjectDocumentsTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useDocuments({ projectId })

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={4} /></div>

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת המסמכים" error={error} onRetry={() => refetch()} />
  }

  if (data.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState message="אין מסמכים בפרויקט" hint="מסמכים שיועלו יופיעו כאן" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{data.length} מסמכים</p>

      <div className="card-surface divide-y divide-border overflow-hidden">
        {data.map(doc => (
          <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <FileText size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[doc.category] ?? doc.category}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(doc.createdAt).toLocaleDateString('he-IL')}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">{formatSize(doc.fileSize)}</span>
              </div>
            </div>
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full border',
              STATUS_CLS[doc.status] ?? 'text-gray-600 bg-gray-50 border-gray-200',
            )}>
              {STATUS_LABEL[doc.status] ?? doc.status}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Downloads go through the API's signed-URL endpoint; no storage key is exposed. */}
              <Button variant="ghost" size="icon" className="h-7 w-7" title="הורד" asChild>
                <a href={`/api/proxy/documents/${doc.id}/download`}>
                  <Download size={13} />
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
