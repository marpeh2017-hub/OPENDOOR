'use client'

import { useEffect, useState } from 'react'
import { FileSpreadsheet, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState, QueryError, RowsSkeleton } from '@/components/ui/query-states'
import { useProjects } from '@/hooks/use-projects'
import { useBuildings, useComplexes } from '@/hooks/use-buildings'
import { useForms } from '@/hooks/use-forms'
import {
  chosenFilters, exportReport, useReportTypes, useRunReport,
  type ReportFilterSpec, type ReportFilters, type ReportType, type ReportTypeInfo,
} from '@/hooks/use-reports'

/**
 * The report generator: choose a report, filter it, choose its columns,
 * preview the first rows, and export every row to Excel.
 *
 * Everything on it comes from the report engine (GET /reports/types): the
 * reports this user's role may run, each one's filters and columns, the
 * Hebrew labels. Adding a report there adds it here. The export buttons on
 * the owners, leads and form screens run the same reports.
 */
export function ReportBuilder() {
  const types = useReportTypes()
  const [type, setType] = useState<ReportType | null>(null)
  const report = types.data?.find((t) => t.type === type) ?? null

  // The first report the user may run is chosen by default.
  useEffect(() => {
    if (!type && types.data?.length) setType(types.data[0]!.type)
  }, [type, types.data])

  if (types.isLoading) return <div className="card-surface p-5"><RowsSkeleton rows={4} /></div>
  if (types.isError) return <div className="card-surface p-5"><QueryError message="שגיאה בטעינת הדוחות" error={types.error} onRetry={() => types.refetch()} /></div>
  if (!types.data?.length) return null

  return (
    <section aria-labelledby="report-builder-title" className="card-surface space-y-5 p-5">
      <div>
        <h2 id="report-builder-title" className="text-base font-semibold text-foreground">מחולל דוחות</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          בוחרים דוח, מסננים ובוחרים עמודות. ״הצגה״ מראה את השורות הראשונות, ״ייצוא לאקסל״ מוריד את כולן.
        </p>
      </div>

      <div role="radiogroup" aria-label="סוג הדוח" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {types.data.map((t) => (
          <button
            key={t.type}
            type="button"
            role="radio"
            aria-checked={t.type === type}
            onClick={() => setType(t.type)}
            className={`rounded-lg border-2 p-3 text-start transition-colors ${
              t.type === type ? 'border-teal-600 bg-teal-50' : 'border-border hover:border-teal-400'
            }`}
          >
            <span className="block text-sm font-semibold text-foreground">{t.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>
          </button>
        ))}
      </div>

      {/* Keyed by report, so its filters and columns start fresh on a switch. */}
      {report && <ReportForm key={report.type} report={report} />}
    </section>
  )
}

function ReportForm({ report }: { report: ReportTypeInfo }) {
  const [filters, setFilters] = useState<ReportFilters>({})
  const [columns, setColumns] = useState<string[]>(() => report.columns.filter((c) => c.default).map((c) => c.key))
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const preview = useRunReport()

  const missingRequired = report.filters.filter((f) => f.required && !filters[f.key])
  const request = { type: report.type, filters: chosenFilters(filters), columns }
  const ready = missingRequired.length === 0 && columns.length > 0

  function setFilter(key: string, value: string | boolean | undefined) {
    setFilters((current) => {
      const next = { ...current, [key]: value }
      // A narrower place belongs to the wider one chosen above it.
      if (key === 'projectId') { delete next.complexId; delete next.buildingId }
      if (key === 'complexId') delete next.buildingId
      return next
    })
    preview.reset()
  }

  function toggleColumn(key: string) {
    setColumns((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]))
    preview.reset()
  }

  async function download() {
    setExporting(true)
    setExportError(null)
    try {
      await exportReport(request)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'הייצוא נכשל')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      {report.filters.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">סינון</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.filters.map((spec) => (
              <FilterField key={spec.key} spec={spec} filters={filters} onChange={(value) => setFilter(spec.key, value)} />
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="flex flex-wrap items-center gap-3 text-sm font-semibold text-foreground">
          עמודות
          <button
            type="button"
            onClick={() => { setColumns(report.columns.filter((c) => c.default).map((c) => c.key)); preview.reset() }}
            className="text-xs font-normal text-teal-700 underline underline-offset-2"
          >
            ברירת המחדל
          </button>
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {report.columns.map((column) => (
            <label key={column.key} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={columns.includes(column.key)}
                onChange={() => toggleColumn(column.key)}
                className="h-4 w-4 accent-teal-600"
              />
              {column.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => preview.mutate(request)} disabled={!ready || preview.isPending}>
          {preview.isPending ? <Loader2 size={15} className="ml-1.5 animate-spin" /> : <Play size={15} className="ml-1.5" />}
          הצגה
        </Button>
        <Button type="button" variant="outline" onClick={download} disabled={!ready || exporting}>
          {exporting ? <Loader2 size={15} className="ml-1.5 animate-spin" /> : <FileSpreadsheet size={15} className="ml-1.5" />}
          ייצוא לאקסל
        </Button>
        {missingRequired.length > 0 && (
          <span className="text-sm text-muted-foreground">צריך לבחור {missingRequired.map((f) => f.label).join(', ')}</span>
        )}
        {columns.length === 0 && <span className="text-sm text-muted-foreground">צריך לבחור לפחות עמודה אחת</span>}
      </div>
      {exportError && <p role="alert" className="text-sm text-red-600">{exportError}</p>}
      {preview.isError && (
        <QueryError message="הפקת הדוח נכשלה" error={preview.error} onRetry={() => preview.mutate(request)} />
      )}

      {preview.data && (
        <div className="space-y-3">
          {preview.data.summary.length > 0 && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {preview.data.summary.map(([label, value]) => (
                <div key={label} className="flex gap-1.5">
                  <dt className="text-muted-foreground">{label}:</dt>
                  <dd className="font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {preview.data.rows.length === 0 ? (
            <EmptyState message="אין שורות שמתאימות לסינון" />
          ) : (
            <>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {preview.data.truncated
                  ? `מוצגות ${preview.data.rows.length} השורות הראשונות מתוך ${preview.data.total}. בקובץ יהיו כולן.`
                  : `${preview.data.total} שורות`}
              </p>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {preview.data.columns.map((c) => (
                        <TableHead key={c.key} className="whitespace-nowrap text-right font-semibold">{c.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.data.rows.map((row, index) => (
                      <TableRow key={index}>
                        {preview.data!.columns.map((c) => (
                          <TableCell key={c.key} className="max-w-xs truncate text-sm" title={String(row[c.key] ?? '')}>
                            {row[c.key] ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** One filter, drawn for its kind; places and forms come from their own lists. */
function FilterField({
  spec, filters, onChange,
}: {
  spec: ReportFilterSpec
  filters: ReportFilters
  onChange: (value: string | boolean | undefined) => void
}) {
  const value = filters[spec.key]
  const id = `report-filter-${spec.key}`
  const label = (
    <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
      {spec.label}{spec.required ? ' *' : ''}
    </label>
  )

  if (spec.kind === 'boolean') {
    return (
      <label className="flex min-h-10 items-center gap-2 self-end text-sm">
        <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-teal-600" />
        {spec.label}
      </label>
    )
  }
  if (spec.kind === 'text' || spec.kind === 'date') {
    return (
      <div>
        {label}
        <Input id={id} type={spec.kind === 'date' ? 'date' : 'text'} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    )
  }
  return (
    <div>
      {label}
      <ChoiceFilter id={id} spec={spec} filters={filters} value={typeof value === 'string' ? value : ''} onChange={onChange} />
    </div>
  )
}

type ChoiceProps = {
  id: string
  spec: ReportFilterSpec
  filters: ReportFilters
  value: string
  onChange: (value: string | undefined) => void
}

/** Each kind loads only its own list. */
function ChoiceFilter(props: ChoiceProps) {
  switch (props.spec.kind) {
    case 'project': return <ProjectChoices {...props} />
    case 'complex': return <ComplexChoices {...props} />
    case 'building': return <BuildingChoices {...props} />
    case 'form': return <FormChoices {...props} />
    default: return <ChoiceSelect {...props} choices={props.spec.options ?? []} />
  }
}

function ProjectChoices(props: ChoiceProps) {
  const projects = useProjects({ limit: 100 })
  return <ChoiceSelect {...props} choices={projects.data?.data.map((p) => ({ value: p.id, label: p.name })) ?? []} />
}

function ComplexChoices(props: ChoiceProps) {
  const projectId = typeof props.filters.projectId === 'string' ? props.filters.projectId : undefined
  const complexes = useComplexes(projectId)
  return <ChoiceSelect {...props} choices={complexes.data?.map((c) => ({ value: c.id, label: c.name })) ?? []} />
}

function BuildingChoices(props: ChoiceProps) {
  const projectId = typeof props.filters.projectId === 'string' ? props.filters.projectId : undefined
  const complexId = typeof props.filters.complexId === 'string' ? props.filters.complexId : undefined
  const buildings = useBuildings(projectId ? { projectId } : undefined)
  const choices = (buildings.data ?? [])
    .filter((b) => !complexId || b.complexId === complexId)
    .map((b) => ({ value: b.id, label: [b.address, b.streetNumber].filter(Boolean).join(' ') }))
  return <ChoiceSelect {...props} choices={choices} />
}

function FormChoices(props: ChoiceProps) {
  const forms = useForms()
  // A draft has nobody's status yet; the report refuses it.
  const choices = (forms.data ?? [])
    .filter((f) => f.status !== 'DRAFT')
    .map((f) => ({ value: f.id, label: f.project ? `${f.title} (${f.project.name})` : f.title }))
  return <ChoiceSelect {...props} choices={choices} />
}

function ChoiceSelect({ id, spec, value, onChange, choices }: ChoiceProps & { choices: { value: string; label: string }[] }) {
  const allLabel = spec.kind === 'project' ? 'כל הפרויקטים'
    : spec.kind === 'complex' ? 'כל המתחמים'
    : spec.kind === 'building' ? 'כל הבניינים'
    : 'הכל'

  return (
    <Select value={value || (spec.required ? undefined : 'ALL')} onValueChange={(v) => onChange(v === 'ALL' ? undefined : v)} dir="rtl">
      <SelectTrigger id={id}>
        <SelectValue placeholder={spec.required ? `בחרו ${spec.label}` : allLabel} />
      </SelectTrigger>
      <SelectContent>
        {!spec.required && <SelectItem value="ALL">{allLabel}</SelectItem>}
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>
        ))}
        {spec.required && choices.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted-foreground">{spec.kind === 'form' ? 'אין עדיין טפסים שנשלחו' : 'אין אפשרויות'}</div>
        )}
      </SelectContent>
    </Select>
  )
}
