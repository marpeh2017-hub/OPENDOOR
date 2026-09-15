'use client'

import { Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useImportHistory, downloadErrorReport, type ImportJob } from '@/hooks/use-imports'
import { ENTITY_LABELS, MODE_LABELS, STATUS_LABELS, formatBytes } from '@/lib/excel-import'

const STATUS_TONE: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
  IMPORTING: 'bg-sky-50 text-sky-700 border-sky-200',
}

/**
 * Import history for a project.
 *
 * Read-only and open to all staff — anyone should be able to audit what was
 * loaded and when, even if they may not run an import themselves.
 */
export function ImportHistory({ projectId }: { projectId?: string }) {
  const { data, isLoading, isError, error, refetch } = useImportHistory({ projectId })

  if (isLoading) return <RowsSkeleton rows={4} />
  if (isError) {
    return (
      <QueryError message="טעינת היסטוריית הייבוא נכשלה" error={error} onRetry={() => refetch()} />
    )
  }
  if (!data?.length) {
    return (
      <EmptyState
        message="לא בוצעו ייבואים בפרויקט זה"
        hint="השתמשו בכפתור ״ייבוא בעלים/דיירים מאקסל״ כדי להתחיל"
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
          <tr>
            <th className="p-2 font-medium">קובץ</th>
            <th className="p-2 font-medium">סוג</th>
            <th className="p-2 font-medium">מצב</th>
            <th className="p-2 font-medium">סטטוס</th>
            <th className="p-2 font-medium">נוצרו</th>
            <th className="p-2 font-medium">עודכנו</th>
            <th className="p-2 font-medium">דולגו</th>
            <th className="p-2 font-medium">נכשלו</th>
            <th className="p-2 font-medium">מי ומתי</th>
            <th className="p-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {data.map((job: ImportJob) => (
            <tr key={job.id} className="border-t border-border align-top">
              <td className="p-2">
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet size={14} className="shrink-0 text-muted-foreground" />
                  <span className="font-medium">{job.fileName}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(job.fileSize)} · {job.totalRows} שורות
                </div>
              </td>
              <td className="p-2 text-xs">{ENTITY_LABELS[job.entityType] ?? job.entityType}</td>
              <td className="p-2 text-xs">{MODE_LABELS[job.mode] ?? job.mode}</td>
              <td className="p-2">
                <span
                  className={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${
                    STATUS_TONE[job.status] ?? 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {STATUS_LABELS[job.status] ?? job.status}
                </span>
                {job.failureReason && (
                  <div className="mt-1 max-w-xs text-[11px] text-red-700">{job.failureReason}</div>
                )}
              </td>
              <td className="p-2 text-emerald-700">{job.createdRows}</td>
              <td className="p-2 text-sky-700">{job.updatedRows}</td>
              <td className="p-2 text-muted-foreground">{job.skippedRows}</td>
              <td className="p-2 text-red-700">{job.failedRows}</td>
              <td className="p-2 text-xs text-muted-foreground">
                {job.createdBy
                  ? `${job.createdBy.firstName} ${job.createdBy.lastName}`
                  : '—'}
                <div>{new Date(job.createdAt).toLocaleString('he-IL')}</div>
              </td>
              <td className="p-2">
                {(job._count?.issues ?? 0) > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadErrorReport(job.id, `import-errors-${job.id}.csv`)
                    }
                  >
                    <Download size={13} className="ml-1" />
                    דוח
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
