'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  useCanManageDq, useDqIssues, useDqRules, useRunDqScan,
  type DqIssueFilters,
} from '@/hooks/use-data-quality'
import { useProjects } from '@/hooks/use-projects'
import {
  CATEGORY_LABEL, ENTITY_LABEL, SEVERITY_CFG, STATUS_CFG, daysSince, formatDate,
} from './dq-constants'

const PAGE_SIZE = 25

export function DqIssuesPanel() {
  const [filters, setFilters] = useState<DqIssueFilters>({
    status: 'OPEN',
    sort: 'severity',
    take: PAGE_SIZE,
    skip: 0,
  })
  const [searchDraft, setSearchDraft] = useState('')

  const { data, isLoading, isError, error, refetch, isFetching } = useDqIssues(filters)
  const { data: rules } = useDqRules()
  const { data: projectsResp } = useProjects()
  const canManage = useCanManageDq()
  const runScan = useRunDqScan()

  const projects = useMemo(() => {
    const raw = projectsResp as unknown
    if (Array.isArray(raw)) return raw as { id: string; name: string; code?: string }[]
    if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
      return (raw as { data: { id: string; name: string; code?: string }[] }).data
    }
    return []
  }, [projectsResp])

  const issueTypes = useMemo(
    () => [...new Set((rules ?? []).flatMap(r => r.issueTypes))].sort(),
    [rules],
  )

  const set = (patch: Partial<DqIssueFilters>) =>
    setFilters(f => ({ ...f, ...patch, skip: patch.skip ?? 0 }))

  const total = data?.total ?? 0
  const page = Math.floor((filters.skip ?? 0) / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="card-surface overflow-hidden">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 border-b border-border">
        <form
          className="relative flex-1 min-w-52"
          onSubmit={e => { e.preventDefault(); set({ search: searchDraft || undefined }) }}
        >
          <Search size={15} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
            placeholder="חיפוש לפי כותרת, תיאור או רשומה..."
            className="pe-9 h-9 text-sm"
            dir="rtl"
            aria-label="חיפוש בעיות"
          />
        </form>

        <Select value={filters.projectId ?? 'all'} onValueChange={v => set({ projectId: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="פרויקט" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הפרויקטים</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} — ${p.name}` : p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.severity ?? 'all'} onValueChange={v => set({ severity: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="חומרה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל החומרות</SelectItem>
            {Object.entries(SEVERITY_CFG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status ?? 'all'} onValueChange={v => set({ status: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.category ?? 'all'} onValueChange={v => set({ category: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="קטגוריה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הקטגוריות</SelectItem>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.entityType ?? 'all'} onValueChange={v => set({ entityType: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="סוג רשומה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            {Object.entries(ENTITY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.issueType ?? 'all'} onValueChange={v => set({ issueType: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-52 text-sm"><SelectValue placeholder="סוג בעיה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל סוגי הבעיות</SelectItem>
            {issueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.sort ?? 'severity'} onValueChange={v => set({ sort: v })}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="מיון" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="severity">לפי חומרה</SelectItem>
            <SelectItem value="age">לפי ותק</SelectItem>
            <SelectItem value="project">לפי פרויקט</SelectItem>
            <SelectItem value="entity">לפי סוג רשומה</SelectItem>
            <SelectItem value="status">לפי סטטוס</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 ms-auto">
          <Button size="sm" variant="outline" className="h-9 gap-2" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            רענון
          </Button>
          {canManage && (
            <Button
              size="sm"
              className="h-9 gap-2"
              onClick={() => runScan.mutate(filters.projectId)}
              disabled={runScan.isPending}
            >
              <ShieldCheck size={14} className={runScan.isPending ? 'animate-pulse' : ''} />
              {runScan.isPending ? 'סורק...' : 'הרצת סריקה'}
            </Button>
          )}
        </div>
      </div>

      {runScan.isError && (
        <p className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100" role="alert">
          הסריקה נכשלה: {runScan.error instanceof Error ? runScan.error.message : 'שגיאה לא ידועה'}
        </p>
      )}
      {runScan.isSuccess && (
        <p className="px-4 py-2 text-xs text-green-700 bg-green-50 border-b border-green-100">
          הסריקה הושלמה — {runScan.data.issuesFound} בעיות אותרו, {runScan.data.issuesNew} חדשות, {runScan.data.issuesResolved} נסגרו אוטומטית.
        </p>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">טוען בעיות איכות נתונים...</div>
      ) : isError ? (
        <div className="p-8 text-center space-y-2" role="alert">
          <AlertTriangle className="mx-auto text-red-600" size={20} />
          <p className="text-sm text-foreground">שגיאה בטעינת רשימת הבעיות</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'נסו שוב מאוחר יותר'}
          </p>
          <button onClick={() => refetch()} className="text-sm text-teal-600 hover:underline">נסו שוב</button>
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="p-10 text-center space-y-2">
          <ShieldCheck className="mx-auto text-green-600" size={24} />
          <p className="text-sm font-medium text-foreground">לא נמצאו בעיות התואמות לסינון</p>
          <p className="text-xs text-muted-foreground">נסו לשנות את הסינון או להריץ סריקה חדשה.</p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right font-semibold">חומרה</TableHead>
                <TableHead className="text-right font-semibold">הבעיה</TableHead>
                <TableHead className="text-right font-semibold">רשומה</TableHead>
                <TableHead className="text-right font-semibold">פרויקט</TableHead>
                <TableHead className="text-right font-semibold">קטגוריה</TableHead>
                <TableHead className="text-right font-semibold">סטטוס</TableHead>
                <TableHead className="text-right font-semibold">אותרה</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.items.map(issue => {
                const sev = SEVERITY_CFG[issue.severity]
                const st = STATUS_CFG[issue.status]
                return (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${sev.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                        {sev.label}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-80">
                      <Link href={`./data-quality/${issue.id}`} className="block hover:underline">
                        <span className="font-medium text-foreground">{issue.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{issue.description}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground text-xs">
                        {ENTITY_LABEL[issue.entityType] ?? issue.entityType}
                      </span>
                      <span className="block truncate max-w-44">{issue.entityLabel}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-40">
                      {issue.projectName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {CATEGORY_LABEL[issue.category] ?? issue.category}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${st.badge}`}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(issue.detectedAt)}
                      <span className="block text-xs">לפני {daysSince(issue.detectedAt)} ימים</span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`./data-quality/${issue.id}`}
                        aria-label={`פתיחת פרטי הבעיה: ${issue.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-gray-100"
                      >
                        <ChevronLeft size={16} />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-3 border-t border-border p-3 text-sm">
            <span className="text-muted-foreground">
              {total.toLocaleString('he-IL')} בעיות · עמוד {page} מתוך {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline" className="h-8"
                disabled={page <= 1}
                onClick={() => set({ skip: Math.max(0, (filters.skip ?? 0) - PAGE_SIZE) })}
              >
                הקודם
              </Button>
              <Button
                size="sm" variant="outline" className="h-8"
                disabled={page >= pageCount}
                onClick={() => set({ skip: (filters.skip ?? 0) + PAGE_SIZE })}
              >
                הבא
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
