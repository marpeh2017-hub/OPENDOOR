'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Phone, MessageSquare, MoreHorizontal, Pencil, MoveRight, Archive,
  UserCheck, UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  useResidents, useSetResidentActive, useArchiveResident, useBulkResidentStatus,
  RESIDENT_SIGNATURE_STATUSES, type Resident,
} from '@/hooks/use-residents'
import { useIsManager } from '@/hooks/use-auth'
import { ResidentFormDialog } from './resident-form-dialog'
import { MoveResidentDialog } from './move-resident-dialog'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  SIGNED:        { label: 'חתם',          cls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' },
  INTERESTED:    { label: 'מעוניין',       cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
  CONTACTED:     { label: 'נוצר קשר',     cls: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400' },
  UNDECIDED:     { label: 'לא החליט',     cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
  OBJECTING:     { label: 'מתנגד',        cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  NOT_CONTACTED: { label: 'לא נוצר קשר', cls: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400' },
  UNREACHABLE:   { label: 'לא זמין',      cls: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400' },
}

function riskLabel(score: number): { label: string; cls: string } {
  if (score >= 70) return { label: 'גבוה',  cls: 'text-red-600' }
  if (score >= 40) return { label: 'בינוני', cls: 'text-amber-500' }
  return { label: 'נמוך', cls: 'text-green-600' }
}

/** Bulk signature-status change — one server-side transaction. */
const BULK_NONE = '__none__'

export function ResidentsTable() {
  const { data, isLoading, isError, error, refetch } = useResidents({ limit: 100 })
  const canWrite = useIsManager()

  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [bulkStatus_, setBulkStatus_] = useState(BULK_NONE)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [editRes,    setEditRes]    = useState<Resident | undefined>()
  const [formOpen,   setFormOpen]   = useState(false)
  const [moveRes,    setMoveRes]    = useState<Resident | null>(null)
  const [activeRes,  setActiveRes]  = useState<Resident | null>(null)
  const [archiveRes, setArchiveRes] = useState<Resident | null>(null)

  const setActive  = useSetResidentActive()
  const archive    = useArchiveResident()
  const bulkUpdate = useBulkResidentStatus()

  const rows = data?.data ?? []
  const visibleIds  = useMemo(() => rows.map(r => r.id), [rows])
  const selectedIds = useMemo(() => visibleIds.filter(id => selected.has(id)), [visibleIds, selected])
  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length

  function toggle(id: string) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  if (isLoading) return <RowsSkeleton rows={6} />

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת הדיירים" error={error} onRetry={() => refetch()} />
  }

  if (rows.length === 0) {
    return <EmptyState message="לא נמצאו דיירים" hint="דיירים יופיעו לאחר שיוך לדירות" />
  }

  return (
    <>
    {/* Bulk bar — management roles only; the endpoint enforces the same. */}
    {canWrite && selectedIds.length > 0 && (
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-4 py-2.5">
        <span className="text-sm font-medium">{selectedIds.length} דיירים נבחרו</span>
        <div className="flex-1" />
        <Select value={bulkStatus_} onValueChange={setBulkStatus_} dir="rtl">
          <SelectTrigger className="w-48"><SelectValue placeholder="שינוי סטטוס חתימה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={BULK_NONE} disabled>שינוי סטטוס חתימה</SelectItem>
            {Object.entries(RESIDENT_SIGNATURE_STATUSES).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={bulkStatus_ === BULK_NONE} onClick={() => setConfirmBulk(true)}>
          החלה
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>ניקוי</Button>
      </div>
    )}

    {(setActive.isError || archive.isError || bulkUpdate.isError) && (
      <div className="p-4">
        <QueryError
          message="עדכון הדייר נכשל"
          error={setActive.error ?? archive.error ?? bulkUpdate.error}
        />
      </div>
    )}

    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {canWrite && (
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label="בחירת כל הדיירים"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(visibleIds))}
                className="h-4 w-4 rounded border-input"
              />
            </TableHead>
          )}
          <TableHead className="text-right font-semibold">דייר</TableHead>
          <TableHead className="text-right font-semibold">פרויקט / דירה</TableHead>
          <TableHead className="text-right font-semibold">סטטוס</TableHead>
          <TableHead className="text-right font-semibold">סיכון</TableHead>
          <TableHead className="text-right font-semibold">בעלות</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(resident => {
          const status = STATUS_CFG[resident.signatureStatus]
            ?? { label: resident.signatureStatus, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
          const risk = riskLabel(resident.riskScore ?? 0)
          const fullName = `${resident.firstName} ${resident.lastName}`
          const apt = resident.apartment
          const projectName = apt?.building?.complex?.project?.name
          return (
            <TableRow key={resident.id} className="group">
              {canWrite && (
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`בחירת ${fullName}`}
                    checked={selected.has(resident.id)}
                    onChange={() => toggle(resident.id)}
                    className="h-4 w-4 rounded border-input"
                  />
                </TableCell>
              )}
              <TableCell>
                <Link href={`/residents/${resident.id}`} className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                      {resident.firstName.slice(0, 1)}{resident.lastName.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {fullName}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {resident.phone ?? '—'}
                    </p>
                  </div>
                </Link>
              </TableCell>

              <TableCell>
                <p className="text-sm text-foreground">{projectName ?? '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {apt ? `דירה ${apt.apartmentNumber}${apt.floor != null ? ` · קומה ${apt.floor}` : ''}` : 'ללא שיוך'}
                </p>
              </TableCell>

              <TableCell>
                <span className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  status.cls,
                )}>
                  {status.label}
                </span>
              </TableCell>

              <TableCell>
                <span className={cn('text-sm font-medium', risk.cls)}>{risk.label}</span>
              </TableCell>

              <TableCell>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {resident.ownershipPercentage != null ? `${resident.ownershipPercentage}%` : '—'}
                </span>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                  {resident.phone && !resident.doNotContact && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="התקשר" asChild>
                        <a href={`tel:${resident.phone}`}><Phone size={13} /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="WhatsApp" asChild>
                        <a
                          href={`https://wa.me/${resident.phone.replace(/\D/g, '').replace(/^0/, '972')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageSquare size={13} />
                        </a>
                      </Button>
                    </>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal size={13} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[11rem]">
                      <DropdownMenuItem asChild>
                        <Link href={`/residents/${resident.id}`}>צפייה בפרופיל</Link>
                      </DropdownMenuItem>
                      {canWrite && (
                        <>
                          <DropdownMenuItem onSelect={() => { setEditRes(resident); setFormOpen(true) }}>
                            <Pencil size={14} className="ml-2" /> עריכה
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setMoveRes(resident)}>
                            <MoveRight size={14} className="ml-2" /> העברה לדירה אחרת
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setActiveRes(resident)}>
                            <UserX size={14} className="ml-2" /> סימון כלא פעיל
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => setArchiveRes(resident)}>
                            <Archive size={14} className="ml-2" /> העברה לארכיון
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>

    <ResidentFormDialog open={formOpen} onOpenChange={setFormOpen} resident={editRes} />
    <MoveResidentDialog
      open={Boolean(moveRes)}
      onOpenChange={(o) => { if (!o) setMoveRes(null) }}
      resident={moveRes}
    />

    <ConfirmDialog
      open={Boolean(activeRes)}
      onOpenChange={(o) => { if (!o) setActiveRes(null) }}
      title="סימון דייר כלא פעיל"
      description={`${activeRes?.firstName ?? ''} ${activeRes?.lastName ?? ''} יסומן כלא פעיל. ההיסטוריה והחתימות נשמרות.`}
      destructive
      confirmLabel="סימון כלא פעיל"
      pending={setActive.isPending}
      error={setActive.error}
      onConfirm={() => {
        if (!activeRes) return
        setActive.mutate({ id: activeRes.id, isActive: false }, { onSuccess: () => setActiveRes(null) })
      }}
    />

    <ConfirmDialog
      open={Boolean(archiveRes)}
      onOpenChange={(o) => { if (!o) setArchiveRes(null) }}
      title="העברת דייר לארכיון"
      description={`${archiveRes?.firstName ?? ''} ${archiveRes?.lastName ?? ''} יועבר לארכיון. הנתונים נשמרים והפעולה נרשמת ביומן הביקורת.`}
      destructive
      confirmLabel="העברה לארכיון"
      pending={archive.isPending}
      error={archive.error}
      onConfirm={() => {
        if (!archiveRes) return
        archive.mutate(archiveRes.id, { onSuccess: () => setArchiveRes(null) })
      }}
    />

    <ConfirmDialog
      open={confirmBulk}
      onOpenChange={setConfirmBulk}
      title={`שינוי סטטוס חתימה ל-${selectedIds.length} דיירים`}
      description={
        <>
          הסטטוס של כל הדיירים שנבחרו ישונה ל
          <span className="font-semibold"> {RESIDENT_SIGNATURE_STATUSES[bulkStatus_] ?? bulkStatus_}</span>.
          סטטוס החתימה משפיע על חישוב רף החתימות בפרויקט. הפעולה מבוצעת
          כטרנזקציה אחת ונרשמת ביומן הביקורת לכל דייר בנפרד.
        </>
      }
      destructive
      confirmLabel="שינוי סטטוס"
      pending={bulkUpdate.isPending}
      error={bulkUpdate.error}
      onConfirm={() =>
        bulkUpdate.mutate(
          { ids: selectedIds, status: bulkStatus_ },
          { onSuccess: () => { setSelected(new Set()); setConfirmBulk(false); setBulkStatus_(BULK_NONE) } },
        )
      }
    />
    </>
  )
}
