'use client'

import { useRef, useState } from 'react'
import {
  Loader2, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Download, ArrowLeft, X, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  useStartImport, useConfirmMapping, usePreviewImport, useCommitImport,
  useCancelImport, downloadErrorReport,
  type ImportEntityType, type ImportMode, type UploadImportResult,
  type PreviewResult, type ImportJob,
} from '@/hooks/use-imports'
import {
  IMPORT_ACCEPT_ATTR, validateImportFile, formatBytes,
  ENTITY_LABELS, MODE_LABELS, MODE_HINTS, OUTCOME_LABELS, OUTCOME_TONE,
  MATCH_REASON_LABELS,
} from '@/lib/excel-import'
import { ImportReviewStep } from './import-review-step'

type Step = 'upload' | 'mapping' | 'preview' | 'review' | 'result'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName?: string
}

/**
 * The import wizard: upload → mapping review → preview → confirm → result.
 *
 * Two deliberate behaviours worth naming:
 *
 *   1. NOTHING IS MAPPED SILENTLY. Every column the server proposed is listed
 *      with its confidence, and any suggestion flagged `needsConfirmation`
 *      blocks the "continue" button until the user has actively touched it.
 *      Low confidence is not a soft warning here — it is a gate.
 *   2. NO PII CROSSES THE WIRE. The server masks the national ID column in the
 *      sample and in every issue value, and preview rows carry only
 *      `hasNationalId`. There is no field in this component that could render
 *      a תעודת זהות, which is why the mapping table shows "•••" for that column
 *      rather than the cell contents.
 */
export function ImportWizardDialog({ open, onOpenChange, projectId, projectName }: Props) {
  const [step, setStep] = useState<Step>('upload')

  // Step 1
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [entityType, setEntityType] = useState<ImportEntityType>('OWNER')
  const [mode, setMode] = useState<ImportMode>('ADD_AND_UPDATE')
  const [progress, setProgress] = useState<number | null>(0)
  const [dragging, setDragging] = useState(false)

  // Step 2+
  const [uploaded, setUploaded] = useState<UploadImportResult | null>(null)
  /** field key → column index, or `null` for "do not import this field". */
  const [assignments, setAssignments] = useState<Record<string, number | null>>({})
  /** Fields the user has actively confirmed or changed. */
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [result, setResult] = useState<ImportJob | null>(null)
  /**
   * Rows in the resolution queue with no ruling yet. Reported up by the review
   * step so the footer can say what is still outstanding. An undecided row is
   * simply not imported — it never blocks the commit.
   */
  const [undecided, setUndecided] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)

  const start = useStartImport(setProgress)
  const confirmMapping = useConfirmMapping()
  const runPreview = usePreviewImport()
  const commit = useCommitImport()
  const cancel = useCancelImport()

  const busy =
    start.isPending || confirmMapping.isPending || runPreview.isPending || commit.isPending

  function reset() {
    setStep('upload')
    setFile(null); setFileError(null); setProgress(0); setDragging(false)
    setEntityType('OWNER'); setMode('ADD_AND_UPDATE')
    setUploaded(null); setAssignments({}); setTouched(new Set())
    setPreview(null); setResult(null); setUndecided(0)
    if (inputRef.current) inputRef.current.value = ''
    start.reset(); confirmMapping.reset(); runPreview.reset(); commit.reset()
  }

  function close(next: boolean) {
    if (!next) {
      // Abandoning before the commit deletes the stored workbook server-side —
      // an abandoned sheet of national IDs must not linger in the bucket.
      if (uploaded && step !== 'result') {
        cancel.mutate(uploaded.job.id)
      }
      reset()
    }
    onOpenChange(next)
  }

  function pick(next: File | null) {
    setFileError(null)
    if (!next) { setFile(null); return }
    const err = validateImportFile(next)
    if (err) { setFile(null); setFileError(err); return }
    setFile(next)
  }

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────
  function submitUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setProgress(0)
    start.mutate(
      { file, projectId, entityType, mode },
      {
        onSuccess: (data) => {
          setUploaded(data)
          const next: Record<string, number | null> = {}
          for (const f of data.fields) next[f.key] = null
          for (const m of data.mapping) {
            if (m.field) next[m.field] = m.index
          }
          setAssignments(next)
          setTouched(new Set())
          setStep('mapping')
        },
      },
    )
  }

  // ── Step 2 → 3 ──────────────────────────────────────────────────────────
  const suggestionFor = (fieldKey: string) =>
    uploaded?.mapping.find((m) => m.field === fieldKey)

  /** Fields whose auto-suggestion is not confident enough to accept silently. */
  const unconfirmed = (uploaded?.fields ?? []).filter((f) => {
    const s = suggestionFor(f.key)
    return s?.needsConfirmation && !touched.has(f.key)
  })

  const missingRequired = (uploaded?.fields ?? []).filter(
    (f) => f.required && assignments[f.key] == null,
  )

  const canContinueMapping =
    Boolean(uploaded) && missingRequired.length === 0 && unconfirmed.length === 0 && !busy

  function submitMapping() {
    if (!uploaded || !canContinueMapping) return
    const mapping = Object.entries(assignments)
      .filter(([, index]) => index != null)
      .map(([field, index]) => ({ field, index: index as number }))

    confirmMapping.mutate(
      { jobId: uploaded.job.id, mapping, mode },
      {
        onSuccess: () => {
          runPreview.mutate(
            { jobId: uploaded.job.id, pageSize: 200 },
            { onSuccess: (data) => { setPreview(data); setStep('preview') } },
          )
        },
      },
    )
  }

  // ── Step 3 → 4 ──────────────────────────────────────────────────────────
  function submitCommit() {
    if (!uploaded) return
    commit.mutate(
      { jobId: uploaded.job.id, mode },
      { onSuccess: (data) => { setResult(data.job); setStep('result') } },
    )
  }

  const error =
    start.error ?? confirmMapping.error ?? runPreview.error ?? commit.error

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-primary" />
            ייבוא בעלים/דיירים מאקסל
            {projectName && (
              <span className="text-sm font-normal text-muted-foreground">— {projectName}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <StepIndicator step={step} />

        <div className="flex-1 overflow-y-auto px-1">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error instanceof Error ? error.message : 'הפעולה נכשלה'}</span>
            </div>
          )}

          {step === 'upload' && (
            <form id="import-upload-form" onSubmit={submitUpload} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>סוג הרשומות</Label>
                  <Select
                    value={entityType}
                    onValueChange={(v) => setEntityType(v as ImportEntityType)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">{ENTITY_LABELS.OWNER}</SelectItem>
                      <SelectItem value="RESIDENT">{ENTITY_LABELS.RESIDENT}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    בעלים = בעלי הזכויות הרשומים בטאבו. דיירים = מי שגר בדירה בפועל. אלו
                    שתי רשומות נפרדות.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>מצב ייבוא</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['ADD_AND_UPDATE', 'ADD_ONLY', 'UPDATE_ONLY'] as ImportMode[]).map((m) => (
                        <SelectItem key={m} value={m}>{MODE_LABELS[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{MODE_HINTS[mode]}</p>
                </div>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragging(false)
                  pick(e.dataTransfer.files?.[0] ?? null)
                }}
                className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  dragging ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Upload className="mx-auto mb-3 text-muted-foreground" size={26} />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileSpreadsheet size={16} className="text-emerald-600" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">({formatBytes(file.size)})</span>
                    <button
                      type="button"
                      onClick={() => pick(null)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="הסרת הקובץ"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">גררו לכאן קובץ אקסל, או</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => inputRef.current?.click()}
                    >
                      בחרו קובץ
                    </Button>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept={IMPORT_ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => pick(e.target.files?.[0] ?? null)}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  קובץ xlsx. בלבד, עד 25MB. קבצי מאקרו (xlsm.) אינם נתמכים מטעמי אבטחה.
                </p>
              </div>

              {fileError && (
                <p role="alert" className="text-sm text-red-600">{fileError}</p>
              )}

              {start.isPending && (
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: progress == null ? '100%' : `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {progress == null ? 'מנתח את הקובץ…' : `מעלה… ${progress}%`}
                  </p>
                </div>
              )}
            </form>
          )}

          {step === 'mapping' && uploaded && (
            <MappingStep
              uploaded={uploaded}
              assignments={assignments}
              touched={touched}
              onAssign={(field, index) => {
                setAssignments((a) => ({ ...a, [field]: index }))
                setTouched((t) => new Set(t).add(field))
              }}
              onConfirm={(field) => setTouched((t) => new Set(t).add(field))}
              missingRequired={missingRequired.map((f) => f.label)}
              unconfirmed={unconfirmed.map((f) => f.label)}
            />
          )}

          {step === 'preview' && preview && (
            <PreviewStep preview={preview} entityType={uploaded?.job.entityType ?? 'OWNER'} />
          )}

          {step === 'review' && uploaded && (
            <ImportReviewStep
              jobId={uploaded.job.id}
              onResolvedCountChange={setUndecided}
            />
          )}

          {step === 'result' && result && (
            <ResultStep job={result} />
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-4">
          {step === 'upload' && (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)}>ביטול</Button>
              <Button type="submit" form="import-upload-form" disabled={!file || busy}>
                {start.isPending && <Loader2 className="ml-2 animate-spin" size={14} />}
                המשך למיפוי עמודות
              </Button>
            </>
          )}

          {step === 'mapping' && (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)}>ביטול</Button>
              <Button type="button" onClick={submitMapping} disabled={!canContinueMapping}>
                {busy && <Loader2 className="ml-2 animate-spin" size={14} />}
                בדיקת הנתונים
              </Button>
            </>
          )}

          {step === 'preview' && preview && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('mapping')}
                disabled={busy}
              >
                <ArrowLeft size={14} className="ml-1" />
                חזרה למיפוי
              </Button>
              {/*
                Offered only when there is something to rule on. An ambiguous
                row is EXCLUDED from the import until it is resolved, so this is
                the path to importing those rows rather than an optional detour.
              */}
              {preview.counts.needsReview > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('review')}
                  disabled={busy}
                >
                  <Users size={14} className="ml-1" />
                  הכרעת כפילויות ({preview.counts.needsReview})
                </Button>
              )}
              <Button
                type="button"
                onClick={submitCommit}
                disabled={busy || preview.counts.create + preview.counts.update === 0}
              >
                {commit.isPending && <Loader2 className="ml-2 animate-spin" size={14} />}
                ייבוא {preview.counts.create + preview.counts.update} שורות
              </Button>
            </>
          )}

          {step === 'review' && uploaded && (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)}>ביטול</Button>
              {undecided > 0 && (
                <span className="self-center text-xs text-muted-foreground">
                  {undecided} שורות ללא הכרעה לא ייובאו
                </span>
              )}
              {/*
                Returning to the preview RE-RUNS it, which is what applies the
                saved rulings: they are re-checked against live candidates on
                the server, so the counts shown next are the real ones.
              */}
              <Button
                type="button"
                onClick={() =>
                  runPreview.mutate(
                    { jobId: uploaded.job.id, pageSize: 200 },
                    { onSuccess: (data) => { setPreview(data); setStep('preview') } },
                  )
                }
                disabled={busy}
              >
                {runPreview.isPending && <Loader2 className="ml-2 animate-spin" size={14} />}
                חזרה לתצוגה מקדימה
              </Button>
            </>
          )}

          {step === 'result' && result && (
            <>
              {result.failedRows > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadErrorReport(result.id, `import-errors-${result.id}.csv`)
                  }
                >
                  <Download size={14} className="ml-1" />
                  הורדת דוח שגיאות
                </Button>
              )}
              <Button type="button" onClick={() => close(false)}>סגירה</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Steps ──────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'העלאה' },
    { key: 'mapping', label: 'מיפוי עמודות' },
    { key: 'preview', label: 'תצוגה מקדימה' },
    { key: 'review', label: 'הכרעת כפילויות' },
    { key: 'result', label: 'סיכום' },
  ]
  const activeIndex = steps.findIndex((s) => s.key === step)
  return (
    <ol className="flex items-center gap-2 border-b border-border pb-3 text-xs">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
              i < activeIndex
                ? 'bg-emerald-100 text-emerald-700'
                : i === activeIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}
          </span>
          <span className={i === activeIndex ? 'font-medium text-foreground' : 'text-muted-foreground'}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground/40">›</span>}
        </li>
      ))}
    </ol>
  )
}

function MappingStep({
  uploaded, assignments, touched, onAssign, onConfirm, missingRequired, unconfirmed,
}: {
  uploaded: UploadImportResult
  assignments: Record<string, number | null>
  touched: Set<string>
  onAssign: (field: string, index: number | null) => void
  onConfirm: (field: string) => void
  missingRequired: string[]
  unconfirmed: string[]
}) {
  const sensitiveIndexes = new Set(
    uploaded.fields
      .filter((f) => f.sensitive)
      .map((f) => assignments[f.key])
      .filter((i): i is number => i != null),
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        נמצאו {uploaded.sheet.headers.length} עמודות ו-{uploaded.sheet.totalRows} שורות
        בגיליון &quot;{uploaded.sheet.sheetName}&quot;. בדקו כל שיוך לפני שתמשיכו.
      </p>

      {(missingRequired.length > 0 || unconfirmed.length > 0) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {missingRequired.length > 0 && (
            <p>חובה לשייך עמודה לשדות: {missingRequired.join(', ')}</p>
          )}
          {unconfirmed.length > 0 && (
            <p>
              השיוך לשדות הבאים אינו ודאי ודורש אישור מפורש: {unconfirmed.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">שדה במערכת</th>
              <th className="p-2 font-medium">עמודה בקובץ</th>
              <th className="p-2 font-medium">ודאות</th>
              <th className="p-2 font-medium">פעולה</th>
            </tr>
          </thead>
          <tbody>
            {uploaded.fields.map((f) => {
              const suggestion = uploaded.mapping.find((m) => m.field === f.key)
              const needs = suggestion?.needsConfirmation && !touched.has(f.key)
              return (
                <tr key={f.key} className="border-t border-border">
                  <td className="p-2">
                    {f.label}
                    {f.required && <span className="text-red-600"> *</span>}
                    {f.sensitive && (
                      <span className="mr-1 text-[11px] text-muted-foreground">(מוסתר)</span>
                    )}
                  </td>
                  <td className="p-2">
                    <select
                      value={assignments[f.key] ?? ''}
                      onChange={(e) =>
                        onAssign(f.key, e.target.value === '' ? null : Number(e.target.value))
                      }
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                      aria-label={`עמודה עבור ${f.label}`}
                    >
                      <option value="">— לא לייבא —</option>
                      {uploaded.sheet.headers.map((h, i) => (
                        <option key={i} value={i}>{h}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-xs">
                    {assignments[f.key] == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : touched.has(f.key) ? (
                      <span className="text-emerald-700">אושר ידנית</span>
                    ) : suggestion ? (
                      <span className={needs ? 'text-amber-700' : 'text-emerald-700'}>
                        {Math.round(suggestion.confidence * 100)}%
                        {suggestion.alternatives.length > 0 && (
                          <span className="text-muted-foreground">
                            {' '}(גם: {suggestion.alternatives.map((a) => a.label).join(', ')})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    {needs && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onConfirm(f.key)}
                      >
                        אישור
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          דוגמה מהקובץ (תעודות זהות מוסתרות)
        </p>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-right text-muted-foreground">
              <tr>
                <th className="p-2">#</th>
                {uploaded.sheet.headers.map((h, i) => (
                  <th key={i} className="whitespace-nowrap p-2 font-medium">
                    {h}
                    {sensitiveIndexes.has(i) && ' 🔒'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uploaded.sample.map((row) => (
                <tr key={row.rowNumber} className="border-t border-border">
                  <td className="p-2 text-muted-foreground">{row.rowNumber}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="whitespace-nowrap p-2">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PreviewStep({
  preview,
}: {
  preview: PreviewResult
  entityType: string
}) {
  const c = preview.counts
  const tiles = [
    { label: 'ייווצרו', value: c.create, tone: 'text-emerald-700' },
    { label: 'יעודכנו', value: c.update, tone: 'text-sky-700' },
    { label: 'ידולגו', value: c.skipped, tone: 'text-muted-foreground' },
    { label: 'דורשות בדיקה', value: c.needsReview, tone: 'text-amber-700' },
    { label: 'שגויות', value: c.invalid, tone: 'text-red-700' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-md border border-border p-3 text-center">
            <div className={`text-xl font-semibold ${t.tone}`}>{t.value}</div>
            <div className="text-xs text-muted-foreground">{t.label}</div>
          </div>
        ))}
      </div>

      {c.invalid > 0 && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {c.invalid} שורות לא ייובאו בשל שגיאות. השורות התקינות ייובאו כרגיל — דוח
          מפורט יהיה זמין להורדה בסיום.
        </p>
      )}
      {c.needsReview > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {c.needsReview} שורות התאימו ליותר מרשומה קיימת אחת. הן לא ייובאו — המערכת
          לעולם לא ממזגת רשומות באופן אוטומטי כשהזיהוי אינו חד-משמעי.
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">שורה</th>
              <th className="p-2 font-medium">תוצאה</th>
              <th className="p-2 font-medium">שם</th>
              <th className="p-2 font-medium">דירה</th>
              <th className="p-2 font-medium">חלק</th>
              <th className="p-2 font-medium">התאמה קיימת</th>
              <th className="p-2 font-medium">הערות</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r) => (
              <tr key={r.rowNumber} className="border-t border-border align-top">
                <td className="p-2 text-muted-foreground">{r.rowNumber}</td>
                <td className="p-2">
                  <span
                    className={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${
                      OUTCOME_TONE[r.outcome] ?? ''
                    }`}
                  >
                    {OUTCOME_LABELS[r.outcome] ?? r.outcome}
                  </span>
                </td>
                <td className="p-2">
                  {r.imported.name || <span className="text-red-600">—</span>}
                  {r.imported.hasNationalId && (
                    <span className="mr-1 text-[11px] text-muted-foreground">ת.ז. ✓</span>
                  )}
                </td>
                <td className="p-2 text-xs">{r.apartmentLabel ?? '—'}</td>
                <td className="p-2 text-xs font-mono">{r.imported.share ?? '—'}</td>
                <td className="p-2 text-xs">
                  {r.match ? (
                    <div>
                      <div className="font-medium">{r.match.existing?.name ?? r.match.entityId}</div>
                      <div className="text-muted-foreground">
                        {MATCH_REASON_LABELS[r.match.reason] ?? r.match.reason}
                        {r.match.ambiguous && ` · ${r.match.candidateCount} מועמדים`}
                      </div>
                      <div className="text-muted-foreground">
                        מומלץ: {OUTCOME_LABELS[r.match.recommendedAction] ?? r.match.recommendedAction}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-2">
                  {r.issues.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <ul className="space-y-1">
                      {r.issues.map((i, k) => (
                        <li key={k} className="text-xs">
                          <span
                            className={
                              i.severity === 'ERROR' ? 'text-red-700' : 'text-amber-700'
                            }
                          >
                            {i.message}
                          </span>
                          {i.currentValue && (
                            <span className="text-muted-foreground"> ({i.currentValue})</span>
                          )}
                          {i.suggestion && (
                            <div className="text-muted-foreground">↳ {i.suggestion}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.totalRows > preview.rows.length && (
        <p className="text-xs text-muted-foreground">
          מוצגות {preview.rows.length} מתוך {preview.totalRows} שורות. הדוח המלא זמין
          להורדה בסיום.
        </p>
      )}
    </div>
  )
}

function ResultStep({ job }: { job: ImportJob }) {
  const ok = job.status === 'COMPLETED'
  return (
    <div className="space-y-4">
      <div
        className={`flex items-start gap-3 rounded-md border p-4 ${
          ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
        }`}
      >
        {ok ? (
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
        ) : (
          <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={20} />
        )}
        <div>
          <p className="font-medium">
            {ok ? 'הייבוא הושלם' : 'הייבוא נכשל — לא בוצע שום שינוי בנתונים'}
          </p>
          {job.failureReason && (
            <p className="mt-1 text-sm text-red-800">{job.failureReason}</p>
          )}
          {job.durationMs != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              משך: {(job.durationMs / 1000).toFixed(1)} שניות
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'נוצרו', value: job.createdRows },
          { label: 'עודכנו', value: job.updatedRows },
          { label: 'דולגו', value: job.skippedRows },
          { label: 'נכשלו', value: job.failedRows },
        ].map((t) => (
          <div key={t.label} className="rounded-md border border-border p-3 text-center">
            <div className="text-xl font-semibold">{t.value}</div>
            <div className="text-xs text-muted-foreground">{t.label}</div>
          </div>
        ))}
      </div>

      {job.errorSummary && job.errorSummary.length > 0 && (
        <div className="rounded-md border border-border">
          <p className="border-b border-border p-2 text-xs font-medium text-muted-foreground">
            סיכום שגיאות
          </p>
          <ul className="divide-y divide-border">
            {job.errorSummary.slice(0, 10).map((e) => (
              <li key={e.code} className="flex items-start justify-between gap-3 p-2 text-sm">
                <span>{e.message}</span>
                <span className="shrink-0 text-muted-foreground">{e.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
