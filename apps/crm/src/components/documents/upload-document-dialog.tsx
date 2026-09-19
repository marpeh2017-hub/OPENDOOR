'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useUploadDocument } from '@/hooks/use-documents'
import { useProjects } from '@/hooks/use-projects'
import {
  DOCUMENT_ACCEPT_ATTR, formatBytes, validateDocumentFile,
} from '@/lib/document-upload'
import { CATEGORY_LABELS } from './documents-library'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selects (and locks) the project when opened from a project page. */
  defaultProjectId?: string
}

export function UploadDocumentDialog({ open, onOpenChange, defaultProjectId }: Props) {
  const [file, setFile]           = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [title, setTitle]         = useState('')
  const [category, setCategory]   = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId ?? '')
  const [description, setDescription] = useState('')
  const [dragging, setDragging]   = useState(false)
  const [progress, setProgress]   = useState<number | null>(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const { data: projects } = useProjects({ limit: 100 })
  const uploadDoc = useUploadDocument(setProgress)

  /**
   * Client-side validation mirrors the server allow-list purely for a fast
   * Hebrew error; the API rejects the same files with 400/413 regardless.
   */
  function pick(next: File | null) {
    setFileError(null)
    if (!next) { setFile(null); return }
    const err = validateDocumentFile(next)
    if (err) { setFile(null); setFileError(err); return }
    setFile(next)
    if (!title.trim()) setTitle(next.name.replace(/\.[^.]+$/, ''))
  }

  function reset() {
    setFile(null); setFileError(null); setTitle(''); setCategory('')
    setProjectId(defaultProjectId ?? ''); setDescription('')
    setProgress(0); setDragging(false)
    if (inputRef.current) inputRef.current.value = ''
    uploadDoc.reset()
  }

  const canSubmit =
    Boolean(file && title.trim() && category && projectId) && !uploadDoc.isPending

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !file) return
    setProgress(0)
    uploadDoc.mutate(
      {
        file,
        title: title.trim(),
        category,
        projectId,
        ...(description.trim() ? { description: description.trim() } : {}),
      },
      { onSuccess: () => { reset(); onOpenChange(false) } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">העלאת מסמך</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Drop zone — also a keyboard-reachable button that opens the picker. */}
          <div
            role="button"
            tabIndex={0}
            aria-label="בחירת קובץ להעלאה"
            data-testid="document-dropzone"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() }
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragging(false)
              pick(e.dataTransfer.files?.[0] ?? null)
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50'
            }`}
          >
            {file ? (
              <>
                <FileText size={22} className="text-primary" />
                <span className="text-sm font-medium break-all">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  aria-label="הסרת הקובץ"
                  onClick={(e) => { e.stopPropagation(); pick(null) }}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600"
                >
                  <X size={12} /> הסרה
                </button>
              </>
            ) : (
              <>
                <Upload size={22} className="text-muted-foreground" />
                <span className="text-sm">גררו קובץ לכאן או לחצו לבחירה</span>
                <span className="text-xs text-muted-foreground">
                  PDF, תמונות, Word, Excel, CSV או טקסט — עד 25MB
                </span>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            data-testid="document-file-input"
            accept={DOCUMENT_ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />

          {fileError && (
            <p className="text-sm text-red-600" role="alert" data-testid="document-file-error">
              {fileError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="doc-title">שם המסמך *</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              placeholder="לדוגמה: נסח טאבו — רחוב הרצל 12"
            />
          </div>

          <div className="space-y-1.5">
            <Label>פרויקט *</Label>
            <Select
              value={projectId}
              onValueChange={setProjectId}
              dir="rtl"
              disabled={Boolean(defaultProjectId)}
            >
              <SelectTrigger><SelectValue placeholder="בחרו פרויקט" /></SelectTrigger>
              <SelectContent>
                {projects?.data.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              כל מסמך משויך לפרויקט — כך הוא נשמר תחת ההרשאות הנכונות
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>קטגוריה *</Label>
            <Select value={category} onValueChange={setCategory} dir="rtl">
              <SelectTrigger><SelectValue placeholder="בחרו קטגוריה" /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-description">תיאור</Label>
            <textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="תיאור קצר (רשות)"
            />
          </div>

          {/* Visible progress — never a silent wait. */}
          {uploadDoc.isPending && (
            <div className="space-y-1" data-testid="document-upload-progress">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: progress === null ? '100%' : `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progress === null ? 'שומר את הקובץ...' : `מעלה... ${progress}%`}
              </p>
            </div>
          )}

          {/* Visible failure — never a silent failure. */}
          {uploadDoc.isError && (
            <p className="text-sm text-red-600" role="alert" data-testid="document-upload-error">
              {uploadDoc.error instanceof Error ? uploadDoc.error.message : 'העלאת המסמך נכשלה'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!canSubmit} data-testid="document-upload-submit">
              {uploadDoc.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              העלאה
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uploadDoc.isPending}
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
