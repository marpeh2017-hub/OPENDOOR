'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  MoreHorizontal, ArrowUpRight, Pencil, GitBranch, CircleDot, Archive, ArchiveRestore,
} from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  useProjects, useBulkProjectStatus, useArchiveProject, useRestoreProject,
  PROJECT_STATUSES, type Project,
} from '@/hooks/use-projects'
import { useIsManager } from '@/hooks/use-auth'
import { ProjectEditDialog } from './project-edit-dialog'
import { ProjectStageDialog, ProjectStatusDialog } from './project-lifecycle-dialogs'

const STAGE_LABELS: Record<string, string> = {
  DISCOVERY:             'גילוי',
  FEASIBILITY:           'היתכנות',
  RESIDENT_ORGANIZATION: 'התארגנות',
  SIGNATURES:            'חתימות',
  DEVELOPER_SELECTION:   'בחירת יזם',
  PLANNING:              'תכנון',
  MUNICIPAL_APPROVAL:    'אישור עירוני',
  PERMIT:                'היתר',
  EVACUATION:            'פינוי',
  CONSTRUCTION:          'בנייה',
  DELIVERY:              'מסירה',
  POST_DELIVERY:         'לאחר מסירה',
}

const STAGE_VARIANT: Record<string, string> = {
  SIGNATURES:   'bg-purple-100 text-purple-700 border-purple-200',
  CONSTRUCTION: 'bg-green-100 text-green-700 border-green-200',
  PLANNING:     'bg-cyan-100 text-cyan-700 border-cyan-200',
  DELIVERY:     'bg-teal-100 text-teal-700 border-teal-200',
  EVACUATION:   'bg-orange-100 text-orange-700 border-orange-200',
  PERMIT:       'bg-blue-100 text-blue-700 border-blue-200',
}

const BULK_NONE = '__none__'
/** Statuses that retire a project — these require an explicit confirmation. */
const RETIRING = new Set(['CANCELLED', 'ARCHIVED'])

export function ProjectsTable() {
  // Two mutually exclusive views. The API hides archived projects by default,
  // so the archive is something the user opens deliberately — it never mixes
  // retired projects into the working list.
  const [showArchived, setShowArchived] = useState(false)

  const { data, isLoading, isError, error, refetch } = useProjects(
    showArchived ? { limit: 50, status: 'ARCHIVED' } : { limit: 50 },
  )
  const canWrite = useIsManager()

  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [bulkValue,   setBulkValue]   = useState(BULK_NONE)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [editP,       setEditP]       = useState<Project | null>(null)
  const [stageP,      setStageP]      = useState<Project | null>(null)
  const [statusP,     setStatusP]     = useState<Project | null>(null)
  const [archiveP,    setArchiveP]    = useState<Project | null>(null)
  const [restoreP,    setRestoreP]    = useState<Project | null>(null)

  const bulk    = useBulkProjectStatus()
  const archive = useArchiveProject()
  const restore = useRestoreProject()

  const rows = data?.data ?? []
  const visibleIds  = useMemo(() => rows.map(p => p.id), [rows])
  const selectedIds = useMemo(() => visibleIds.filter(id => selected.has(id)), [visibleIds, selected])
  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length

  function toggle(id: string) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function applyBulk() {
    bulk.mutate(
      { ids: selectedIds, status: bulkValue },
      { onSuccess: () => { setSelected(new Set()); setBulkValue(BULK_NONE); setConfirmBulk(false) } },
    )
  }

  // The toggle is rendered above every state — including loading, error and
  // empty — so a user who opens an empty archive can always get back out.
  const viewToggle = (
    <div className="flex items-center justify-end border-b border-border px-4 py-2">
      <Button
        variant={showArchived ? 'default' : 'ghost'}
        size="sm"
        className="gap-2"
        aria-pressed={showArchived}
        onClick={() => { setShowArchived(v => !v); setSelected(new Set()) }}
      >
        <Archive size={14} />
        {showArchived ? 'חזרה לפרויקטים פעילים' : 'הצגת ארכיון'}
      </Button>
    </div>
  )

  if (isLoading) return <>{viewToggle}<RowsSkeleton rows={6} /></>

  if (isError || !data) {
    return (
      <>
        {viewToggle}
        <QueryError message="שגיאה בטעינת הפרויקטים" error={error} onRetry={() => refetch()} />
      </>
    )
  }

  if (rows.length === 0) {
    return (
      <>
        {viewToggle}
        {showArchived
          ? <EmptyState message="אין פרויקטים בארכיון" hint="פרויקטים שיועברו לארכיון יופיעו כאן" />
          : <EmptyState message="לא נמצאו פרויקטים" hint="צרו פרויקט חדש כדי להתחיל" />}
      </>
    )
  }

  return (
    <>
    {viewToggle}
    {canWrite && selectedIds.length > 0 && (
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-4 py-2.5">
        <span className="text-sm font-medium">{selectedIds.length} פרויקטים נבחרו</span>
        <div className="flex-1" />
        <Select value={bulkValue} onValueChange={setBulkValue} dir="rtl">
          <SelectTrigger className="w-44"><SelectValue placeholder="שינוי סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={BULK_NONE} disabled>שינוי סטטוס</SelectItem>
            {Object.entries(PROJECT_STATUSES).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={RETIRING.has(bulkValue) ? 'destructive' : 'default'}
          disabled={bulkValue === BULK_NONE || bulk.isPending}
          onClick={() => {
            // Retiring statuses always confirm; a benign status applies directly.
            if (RETIRING.has(bulkValue)) setConfirmBulk(true)
            else applyBulk()
          }}
        >
          החלה
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>ניקוי</Button>
      </div>
    )}

    {bulk.isError && (
      <div className="p-4"><QueryError message="פעולת האצווה נכשלה" error={bulk.error} /></div>
    )}

    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          {canWrite && (
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label="בחירת כל הפרויקטים"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(visibleIds))}
                className="h-4 w-4 rounded border-input"
              />
            </TableHead>
          )}
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground w-24">קוד</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground">פרויקט</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground">עיר</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground">שלב</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground w-48">חתימות</TableHead>
          <TableHead className="text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground w-20">יחידות</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(p => {
          const pct = p.totalUnits > 0 ? Math.round((p.signedUnits / p.totalUnits) * 100) : 0
          return (
            <TableRow key={p.id} className="group hover:bg-muted/30">
              {canWrite && (
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`בחירת ${p.name}`}
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-4 w-4 rounded border-input"
                  />
                </TableCell>
              )}
              <TableCell className="font-mono text-xs text-muted-foreground">{p.code}</TableCell>
              <TableCell>
                <Link href={`/projects/${p.id}`} className="font-medium text-foreground hover:text-primary transition-colors group-hover:underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{p.city}</TableCell>
              <TableCell>
                <span className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
                  STAGE_VARIANT[p.stage] ?? 'bg-muted text-muted-foreground border-border',
                )}>
                  {STAGE_LABELS[p.stage] ?? p.stage}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className={cn(
                    'text-xs font-semibold tabular-nums w-10 text-left',
                    pct >= 80 ? 'text-green-600' : pct >= 51 ? 'text-primary' : 'text-orange-600',
                  )}>
                    {pct}%
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {p.signedUnits}/{p.totalUnits}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm text-center">{p.totalUnits}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem asChild>
                      <Link href={`/projects/${p.id}`} className="gap-2">
                        <ArrowUpRight size={14} /> פתח פרויקט
                      </Link>
                    </DropdownMenuItem>
                    {canWrite && (
                      <>
                        <DropdownMenuItem onSelect={() => setEditP(p)} className="gap-2">
                          <Pencil size={14} /> עריכת פרטים
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStageP(p)} className="gap-2">
                          <GitBranch size={14} /> שינוי שלב
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatusP(p)} className="gap-2">
                          <CircleDot size={14} /> שינוי סטטוס
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {p.status === 'ARCHIVED' ? (
                          <DropdownMenuItem onSelect={() => setRestoreP(p)} className="gap-2">
                            <ArchiveRestore size={14} /> שחזור מארכיון
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => setArchiveP(p)}
                            className="gap-2 text-red-600 focus:text-red-600"
                          >
                            <Archive size={14} /> העברה לארכיון
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/data-quality?projectId=${p.id}`}>איכות נתונים</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>

    <ProjectEditDialog   open={Boolean(editP)}   onOpenChange={(o) => { if (!o) setEditP(null) }}   project={editP} />
    <ProjectStageDialog  open={Boolean(stageP)}  onOpenChange={(o) => { if (!o) setStageP(null) }}  project={stageP} />
    <ProjectStatusDialog open={Boolean(statusP)} onOpenChange={(o) => { if (!o) setStatusP(null) }} project={statusP} />

    <ConfirmDialog
      open={Boolean(archiveP)}
      onOpenChange={(o) => { if (!o) { setArchiveP(null); archive.reset() } }}
      title={`העברה לארכיון — ${archiveP?.name ?? ''}`}
      description={
        <>
          הפרויקט יוסר מרשימת הפרויקטים הפעילים. שום נתון אינו נמחק — מתחמים,
          מבנים, דירות, בעלים וחתימות נשמרים כפי שהם, וניתן לשחזר את הפרויקט
          בכל עת מתצוגת הארכיון.
        </>
      }
      destructive
      confirmLabel="העברה לארכיון"
      pending={archive.isPending}
      error={archive.error}
      onConfirm={() => {
        if (!archiveP) return
        archive.mutate({ id: archiveP.id }, { onSuccess: () => setArchiveP(null) })
      }}
    />

    <ConfirmDialog
      open={Boolean(restoreP)}
      onOpenChange={(o) => { if (!o) { setRestoreP(null); restore.reset() } }}
      title={`שחזור מארכיון — ${restoreP?.name ?? ''}`}
      description="הפרויקט יחזור לסטטוס שהיה לו לפני ההעברה לארכיון, ויופיע שוב ברשימת הפרויקטים."
      confirmLabel="שחזור"
      pending={restore.isPending}
      error={restore.error}
      onConfirm={() => {
        if (!restoreP) return
        restore.mutate({ id: restoreP.id }, { onSuccess: () => setRestoreP(null) })
      }}
    />

    <ConfirmDialog
      open={confirmBulk}
      onOpenChange={setConfirmBulk}
      title={`${PROJECT_STATUSES[bulkValue] ?? bulkValue} — ${selectedIds.length} פרויקטים`}
      description={
        <>
          כל הפרויקטים שנבחרו יעברו לסטטוס
          <span className="font-semibold"> {PROJECT_STATUSES[bulkValue] ?? bulkValue}</span> ולא
          ייספרו עוד כפעילים בדוחות. הפעולה מבוצעת כטרנזקציה אחת,
          הנתונים נשמרים וניתן להחזיר את הסטטוס לִפעילִ.
        </>
      }
      destructive
      confirmLabel="אישור"
      pending={bulk.isPending}
      error={bulk.error}
      onConfirm={applyBulk}
    />
    </>
  )
}
