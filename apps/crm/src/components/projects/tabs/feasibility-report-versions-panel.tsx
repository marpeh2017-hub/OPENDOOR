'use client'

import { FormEvent, useState } from 'react'
import { Download, FileCheck2, FileText, Loader2, LockKeyhole, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { download } from '@/lib/api-client'
import {
  type FeasibilityScenario,
  useCreateFeasibilityReportVersion,
  useCreateFeasibilitySnapshot,
  useFeasibilityReportVersion,
  useFeasibilityReportVersions,
  useFeasibilitySnapshots,
  useTransitionFeasibilityReportVersion,
} from '@/hooks/use-feasibility'

const STATUS_LABEL: Record<string, string> = { DRAFT: 'טיוטה', REVIEW: 'בביקורת', APPROVED: 'מאושר', LOCKED: 'נעול' }

function errorText(error: unknown) { return error instanceof Error ? error.message : 'הפעולה נכשלה. נסו שוב.' }
function frozenAppendices(input: unknown): Array<{ title: string; version: number }> {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { sources?: unknown }).sources)) return []
  return (input as { sources: Array<{ appendix?: unknown }> }).sources.flatMap((source) => {
    const appendix = source.appendix
    return appendix && typeof appendix === 'object' && typeof (appendix as { title?: unknown }).title === 'string' && typeof (appendix as { version?: unknown }).version === 'number'
      ? [{ title: (appendix as { title: string }).title, version: (appendix as { version: number }).version }]
      : []
  })
}

export function FeasibilityReportVersionsPanel({ projectId, scenarios, canEdit, canTransition }: { projectId: string; scenarios: FeasibilityScenario[]; canEdit: boolean; canTransition: boolean }) {
  const snapshots = useFeasibilitySnapshots(projectId)
  const reports = useFeasibilityReportVersions(projectId)
  const createSnapshot = useCreateFeasibilitySnapshot(projectId)
  const createReport = useCreateFeasibilityReportVersion(projectId)
  const transition = useTransitionFeasibilityReportVersion(projectId)
  const [scenarioId, setScenarioId] = useState(scenarios.find((scenario) => scenario.isBaseline)?.id ?? scenarios[0]?.id ?? '')
  const [snapshotId, setSnapshotId] = useState('')
  const [title, setTitle] = useState('דוח אפס')
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const selectedReport = useFeasibilityReportVersion(projectId, selectedReportId)

  const freeze = () => {
    if (!scenarioId) return
    createSnapshot.mutate({ scenarioId }, { onSuccess: (snapshot) => setSnapshotId(snapshot.id) })
  }
  const makeReport = (event: FormEvent) => {
    event.preventDefault()
    if (snapshotId && title.trim()) createReport.mutate({ snapshotId, title: title.trim() })
  }
  const saveFile = async (reportId: string, extension: 'pdf' | 'excel') => {
    setDownloadError(null); setDownloading(`${reportId}:${extension}`)
    try {
      const result = await download(`/projects/${projectId}/feasibility/reports/${reportId}/export/${extension}`)
      const objectUrl = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = objectUrl; link.download = result.fileName; link.click()
      URL.revokeObjectURL(objectUrl)
    } catch (error) { setDownloadError(errorText(error)) } finally { setDownloading(null) }
  }

  return <section className="card-surface p-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><FileText size={17} />גרסאות דוח וייצוא</h3><p className="mt-1 text-xs text-muted-foreground">צילום חישוב קופא לפני יצירת גרסת דוח. רק גרסה נעולה ניתנת לייצוא.</p></div><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{reports.data?.length ?? 0} גרסאות</span></div>
    {canEdit && <div className="mt-4 grid gap-3 border-t pt-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end"><label className="grid gap-1.5 text-sm font-medium"><span>תרחיש לצילום</span><select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}{scenario.isBaseline ? ' · בסיס' : ''}</option>)}</select></label><Button type="button" variant="outline" disabled={!scenarioId || createSnapshot.isPending} onClick={freeze}>{createSnapshot.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="ml-2 h-4 w-4" />}יצירת צילום</Button><form onSubmit={makeReport} className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input required placeholder="שם גרסת הדוח" value={title} onChange={(event) => setTitle(event.target.value)} /><Button disabled={!snapshotId || createReport.isPending}>{createReport.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}גרסת דוח</Button></form><p className="text-xs text-muted-foreground lg:col-span-3">{snapshotId ? 'נבחר צילום חישוב; ניתן ליצור ממנו גרסת דוח.' : 'התחילו ביצירת צילום חישוב. צילום כולל תשומות, תוצאות, בקרות וגרסת מנוע.'}</p>{(createSnapshot.isError || createReport.isError) && <p className="text-sm text-destructive" role="alert">{errorText(createSnapshot.error ?? createReport.error)}</p>}</div>}
    {reports.isLoading ? <p className="mt-4 text-sm text-muted-foreground">טוען גרסאות…</p> : reports.isError ? <p className="mt-4 text-sm text-destructive" role="alert">{errorText(reports.error)}</p> : reports.data?.length ? <ul className="mt-4 divide-y divide-border border-t">{reports.data.map((report) => {
      const next = report.status === 'DRAFT' ? 'REVIEW' : report.status === 'REVIEW' ? 'APPROVED' : report.status === 'APPROVED' ? 'LOCKED' : null
      return <li key={report.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-medium">v{report.version} · {report.title}</p><p className="mt-1 text-xs text-muted-foreground">{STATUS_LABEL[report.status] ?? report.status} · צילום {new Date(report.snapshot.createdAt).toLocaleDateString('he-IL')} · מנוע {report.snapshot.engineVersion}</p></div><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="ghost" onClick={() => setSelectedReportId(report.id)}>פרטים</Button>{next && canTransition && <Button size="sm" variant="outline" disabled={transition.isPending} onClick={() => transition.mutate({ reportId: report.id, status: next })}>{next === 'LOCKED' && <LockKeyhole className="ml-1 h-3.5 w-3.5" />}{next === 'REVIEW' ? 'לביקורת' : next === 'APPROVED' ? 'אישור' : 'נעילת גרסה'}</Button>}{report.status === 'LOCKED' && <><Button size="sm" variant="outline" disabled={Boolean(downloading)} onClick={() => saveFile(report.id, 'pdf')}>{downloading === `${report.id}:pdf` ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Download className="ml-1 h-3.5 w-3.5" />}PDF</Button><Button size="sm" variant="outline" disabled={Boolean(downloading)} onClick={() => saveFile(report.id, 'excel')}>{downloading === `${report.id}:excel` ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Download className="ml-1 h-3.5 w-3.5" />}Excel</Button></>}</div></li>
    })}</ul> : <p className="mt-4 text-sm text-muted-foreground">עדיין אין גרסאות דוח. גרסה נוצרת רק מצילום חישוב בלתי־משתנה.</p>}
    {selectedReportId && <div className="mt-4 rounded-md border border-border bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">צילום גרסת הדוח</h4><Button size="sm" variant="ghost" onClick={() => setSelectedReportId(null)}>סגירה</Button></div>{selectedReport.isLoading ? <p className="mt-3 text-sm text-muted-foreground">טוען צילום…</p> : selectedReport.isError ? <p className="mt-3 text-sm text-destructive" role="alert">{errorText(selectedReport.error)}</p> : selectedReport.data && <><div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm"><div><span className="block text-xs text-muted-foreground">הכנסות</span>₪{selectedReport.data.snapshot.outputSnapshot.revenue.total}</div><div><span className="block text-xs text-muted-foreground">עלויות</span>₪{selectedReport.data.snapshot.outputSnapshot.costs.total}</div><div><span className="block text-xs text-muted-foreground">רווח</span>₪{selectedReport.data.snapshot.outputSnapshot.profitability.profit}</div></div><p className="mt-3 text-xs text-muted-foreground">בקרות שננעלו בצילום: {selectedReport.data.snapshot.validationSnapshot.length}</p>{frozenAppendices(selectedReport.data.snapshot.inputSnapshot).length > 0 && <div className="mt-3 border-t pt-3"><p className="text-xs font-medium text-muted-foreground">נספחים שננעלו עם הגרסה</p><ul className="mt-1 list-inside list-disc text-sm">{frozenAppendices(selectedReport.data.snapshot.inputSnapshot).map((appendix, index) => <li key={`${appendix.title}-${index}`}>{appendix.title} · גרסה {appendix.version}</li>)}</ul></div>}</>}</div>}
    {(transition.isError || downloadError) && <p className="mt-3 text-sm text-destructive" role="alert">{downloadError ?? errorText(transition.error)}</p>}
  </section>
}
