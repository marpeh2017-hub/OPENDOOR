'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2, ChevronDown, Search, Users, Plus, Pencil, Archive, ArchiveRestore,
  MoveRight, MoreHorizontal, Percent,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn, formatStreetAddress } from '@/lib/utils'
import {
  useBuildings, useBuilding, useSetBuildingStatus, useBulkBuildingStatus,
  useArchiveApartment, useSetApartmentStatus,
  type BuildingListItem, type BuildingApartment,
} from '@/hooks/use-buildings'
import { useProjects } from '@/hooks/use-projects'
import { useIsManager } from '@/hooks/use-auth'
import { BuildingFormDialog } from './building-form-dialog'
import { ApartmentFormDialog } from './apartment-form-dialog'
import { ApartmentOwnersDialog } from './apartment-owners-dialog'
import { MoveBuildingsDialog } from './move-buildings-dialog'

const SIGNATURE_CFG: Record<string, { label: string; cls: string }> = {
  SIGNED:        { label: 'חתם',         cls: 'bg-green-100 text-green-700 border-green-200' },
  INTERESTED:    { label: 'מעוניין',      cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  CONTACTED:     { label: 'נוצר קשר',    cls: 'bg-teal-100 text-teal-700 border-teal-200' },
  UNDECIDED:     { label: 'לא החליט',    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  OBJECTING:     { label: 'מתנגד',       cls: 'bg-red-100 text-red-700 border-red-200' },
  NOT_CONTACTED: { label: 'לא נוצר קשר', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  UNREACHABLE:   { label: 'לא זמין',     cls: 'bg-orange-100 text-orange-700 border-orange-200' },
}

/**
 * Ownership sum for one apartment, rendered EXACTLY.
 *
 * The stored numerator/denominator pairs are summed with integer cross
 * multiplication — never by dividing to a float — so 1/3 + 1/3 + 1/3 shows as
 * complete and 999/1000 shows as incomplete. This mirrors the API's
 * `OwnershipService`, which is the authority.
 */
function ownershipSum(owners: BuildingApartment['owners']): { num: number; den: number; complete: boolean } {
  let num = 0n
  let den = 1n
  for (const o of owners) {
    if (!Number.isInteger(o.shareNumerator) || !Number.isInteger(o.shareDenominator) || o.shareDenominator === 0) continue
    num = num * BigInt(o.shareDenominator) + BigInt(o.shareNumerator) * den
    den = den * BigInt(o.shareDenominator)
    const g = (function gcd(a: bigint, b: bigint): bigint {
      let x = a < 0n ? -a : a, y = b < 0n ? -b : b
      while (y) { const t = x % y; x = y; y = t }
      return x || 1n
    })(num, den)
    num /= g
    den /= g
  }
  return { num: Number(num), den: Number(den), complete: num === den && num !== 0n }
}

/** Expanded apartment breakdown for one building — fetched only when opened. */
function ApartmentsPanel({
  buildingId,
  canWrite,
}: {
  buildingId: string
  canWrite: boolean
}) {
  const { data, isLoading, isError, error, refetch } = useBuilding(buildingId)
  const archiveApt = useArchiveApartment()
  const setAptStatus = useSetApartmentStatus()

  const [formOpen,   setFormOpen]   = useState(false)
  const [editApt,    setEditApt]    = useState<BuildingApartment | undefined>()
  const [ownersApt,  setOwnersApt]  = useState<BuildingApartment | null>(null)
  const [archiveApt_, setArchiveApt_] = useState<BuildingApartment | null>(null)

  if (isLoading) return <RowsSkeleton rows={3} />
  if (isError || !data) {
    return (
      <div className="p-4">
        <QueryError message="שגיאה בטעינת הדירות" error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className="bg-muted/20 px-6 py-4 space-y-3">
      {canWrite && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="gap-1.5"
            onClick={() => { setEditApt(undefined); setFormOpen(true) }}>
            <Plus size={14} />
            דירה חדשה
          </Button>
        </div>
      )}

      {data.apartments.length === 0 ? (
        <EmptyState message="לא רשומות דירות במבנה זה" hint={canWrite ? 'הוסיפו דירה כדי להתחיל' : undefined} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="pb-2 text-right font-semibold">דירה</th>
              <th className="pb-2 text-right font-semibold">קומה</th>
              <th className="pb-2 text-right font-semibold">חדרים</th>
              <th className="pb-2 text-right font-semibold">שטח</th>
              <th className="pb-2 text-right font-semibold">דיירים</th>
              <th className="pb-2 text-right font-semibold">בעלויות</th>
              {canWrite && <th className="pb-2 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.apartments.map(apt => {
              const sum = ownershipSum(apt.owners)
              const archived = apt.status === 'archived'
              return (
                <tr key={apt.id} className={cn(archived && 'opacity-50')}>
                  <td className="py-2 font-medium">
                    {apt.apartmentNumber}
                    {archived && <span className="mr-1.5 text-xs text-muted-foreground">(בארכיון)</span>}
                  </td>
                  <td className="py-2 text-muted-foreground">{apt.floor ?? '—'}</td>
                  <td className="py-2 text-muted-foreground">{apt.rooms ?? '—'}</td>
                  <td className="py-2 text-muted-foreground">{apt.sizeSqm ? `${apt.sizeSqm} מ״ר` : '—'}</td>
                  <td className="py-2">
                    {apt.residents.length === 0
                      ? <span className="text-muted-foreground">—</span>
                      : (
                        <div className="flex flex-wrap gap-1.5">
                          {apt.residents.map(r => {
                            const cfg = SIGNATURE_CFG[r.signatureStatus]
                              ?? { label: r.signatureStatus, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
                            return (
                              <Link
                                key={r.id}
                                href={`/residents/${r.id}`}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:opacity-80',
                                  cfg.cls,
                                )}
                              >
                                {r.firstName} {r.lastName} · {cfg.label}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {apt.owners.length === 0 ? (
                      '—'
                    ) : (
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap gap-x-2">
                          {apt.owners.map(o => (
                            <span key={o.id} className="inline-block">
                              {o.owner.fullName} ({o.shareNumerator}/{o.shareDenominator})
                              {o.owner.isEstate ? ' · עיזבון' : ''}
                            </span>
                          ))}
                        </div>
                        <span
                          className={cn(
                            'inline-block rounded px-1.5 py-0.5 tabular-nums',
                            sum.complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                          )}
                          dir="ltr"
                        >
                          Σ {sum.num}/{sum.den}
                        </span>
                      </div>
                    )}
                  </td>
                  {canWrite && (
                    <td className="py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal size={15} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[11rem]">
                          <DropdownMenuItem onSelect={() => { setEditApt(apt); setFormOpen(true) }}>
                            <Pencil size={14} className="ml-2" /> עריכה
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setOwnersApt(apt)}>
                            <Percent size={14} className="ml-2" /> רישום בעלויות
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {archived ? (
                            <DropdownMenuItem
                              onSelect={() => setAptStatus.mutate({ id: apt.id, status: 'active', buildingId })}
                            >
                              <ArchiveRestore size={14} className="ml-2" /> שחזור מארכיון
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-red-600"
                              onSelect={() => setArchiveApt_(apt)}
                            >
                              <Archive size={14} className="ml-2" /> העברה לארכיון
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {(archiveApt.isError || setAptStatus.isError) && (
        <QueryError
          message="עדכון הדירה נכשל"
          error={archiveApt.error ?? setAptStatus.error}
        />
      )}

      <ApartmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        buildingId={buildingId}
        apartment={editApt}
      />

      {ownersApt && (
        <ApartmentOwnersDialog
          open={Boolean(ownersApt)}
          onOpenChange={(o) => { if (!o) setOwnersApt(null) }}
          apartmentId={ownersApt.id}
          apartmentLabel={ownersApt.apartmentNumber}
          buildingId={buildingId}
        />
      )}

      <ConfirmDialog
        open={Boolean(archiveApt_)}
        onOpenChange={(o) => { if (!o) setArchiveApt_(null) }}
        title="העברת דירה לארכיון"
        description={
          <>
            דירה {archiveApt_?.apartmentNumber} תועבר לארכיון. רישום הבעלויות
            והיסטוריית החתימות נשמרים, וניתן לשחזר את הדירה בהמשך.
          </>
        }
        destructive
        confirmLabel="העברה לארכיון"
        pending={archiveApt.isPending}
        error={archiveApt.error}
        onConfirm={() => {
          if (!archiveApt_) return
          archiveApt.mutate(
            { id: archiveApt_.id, buildingId },
            { onSuccess: () => setArchiveApt_(null) },
          )
        }}
      />
    </div>
  )
}

export function BuildingsTable() {
  const [projectId, setProjectId] = useState('ALL')
  const [search, setSearch]       = useState('')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [selected, setSelected]   = useState<Set<string>>(new Set())

  const [formOpen,  setFormOpen]  = useState(false)
  const [editB,     setEditB]     = useState<BuildingListItem | undefined>()
  const [moveIds,   setMoveIds]   = useState<string[] | null>(null)
  const [archiveB,  setArchiveB]  = useState<BuildingListItem | null>(null)
  const [bulkArchive, setBulkArchive] = useState(false)

  const canWrite = useIsManager()

  const { data, isLoading, isError, error, refetch } = useBuildings({
    ...(projectId !== 'ALL' ? { projectId } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  })
  const { data: projects } = useProjects({ limit: 100 })

  const setStatus = useSetBuildingStatus()
  const bulkStatus = useBulkBuildingStatus()

  const visibleIds = useMemo(() => (data ?? []).map(b => b.id), [data])
  const selectedIds = useMemo(
    () => visibleIds.filter(id => selected.has(id)),
    [visibleIds, selected],
  )
  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length

  function toggle(id: string) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-72 items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Search size={15} className="flex-shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי כתובת"
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <Select value={projectId} onValueChange={setProjectId} dir="rtl">
          <SelectTrigger className="w-52"><SelectValue placeholder="פרויקט" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הפרויקטים</SelectItem>
            {projects?.data.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />
        {data && <span className="text-sm text-muted-foreground">{data.length} מבנים</span>}
        {canWrite && (
          <Button size="sm" className="gap-1.5"
            onClick={() => { setEditB(undefined); setFormOpen(true) }}>
            <Plus size={15} />
            מבנה חדש
          </Button>
        )}
      </div>

      {/* Bulk action bar — management roles only. Every action here confirms,
          and each endpoint applies the whole set in one transaction. */}
      {canWrite && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.length} מבנים נבחרו</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="gap-1.5"
            onClick={() => setMoveIds(selectedIds)}>
            <MoveRight size={14} />
            העברה למתחם
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5"
            disabled={bulkStatus.isPending}
            onClick={() => bulkStatus.mutate(
              { ids: selectedIds, status: 'active' },
              { onSuccess: () => setSelected(new Set()) },
            )}>
            <ArchiveRestore size={14} />
            שחזור
          </Button>
          <Button size="sm" variant="destructive" className="gap-1.5"
            onClick={() => setBulkArchive(true)}>
            <Archive size={14} />
            העברה לארכיון
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>ניקוי</Button>
        </div>
      )}

      {bulkStatus.isError && <QueryError message="פעולת האצווה נכשלה" error={bulkStatus.error} />}
      {setStatus.isError  && <QueryError message="עדכון המבנה נכשל"   error={setStatus.error} />}

      <div className="card-surface overflow-hidden">
        {isLoading ? (
          <RowsSkeleton rows={5} />
        ) : isError || !data ? (
          <div className="p-4">
            <QueryError message="שגיאה בטעינת המבנים" error={error} onRetry={() => refetch()} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            message="לא נמצאו מבנים"
            hint="מבנים נוצרים בתוך מתחם של פרויקט"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canWrite && (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="בחירת כל המבנים"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(visibleIds))}
                      className="h-4 w-4 rounded border-input"
                    />
                  </TableHead>
                )}
                <TableHead className="text-right font-semibold">כתובת</TableHead>
                <TableHead className="text-right font-semibold">פרויקט / מתחם</TableHead>
                <TableHead className="text-right font-semibold">קומות</TableHead>
                <TableHead className="text-right font-semibold">דירות</TableHead>
                <TableHead className="text-right font-semibold">דיירים</TableHead>
                <TableHead className="text-right font-semibold">שנת בנייה</TableHead>
                {canWrite && <TableHead className="w-10" />}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(b => {
                const isOpen = expanded === b.id
                const archived = b.status === 'archived'
                return (
                  <Fragment key={b.id}>
                    <TableRow
                      className={cn('cursor-pointer', archived && 'opacity-50')}
                      onClick={() => setExpanded(isOpen ? null : b.id)}
                    >
                      {canWrite && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`בחירת ${b.address}`}
                            checked={selected.has(b.id)}
                            onChange={() => toggle(b.id)}
                            className="h-4 w-4 rounded border-input"
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 size={15} className="flex-shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {formatStreetAddress(b.address, b.streetNumber)}
                          </span>
                          {b.city && <span className="text-xs text-muted-foreground">{b.city}</span>}
                          {archived && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              בארכיון
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link
                          href={`/projects/${b.complex.project.id}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {b.complex.project.name}
                        </Link>
                        <span className="text-muted-foreground"> · {b.complex.name}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.floors ?? '—'}</TableCell>
                      <TableCell className="text-sm">{b.apartmentCount}</TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1">
                          <Users size={13} className="text-muted-foreground" />
                          {b.residentCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.constructionYear ?? '—'}</TableCell>

                      {canWrite && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal size={15} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[11rem]">
                              <DropdownMenuItem onSelect={() => { setEditB(b); setFormOpen(true) }}>
                                <Pencil size={14} className="ml-2" /> עריכה
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setMoveIds([b.id])}>
                                <MoveRight size={14} className="ml-2" /> העברה למתחם אחר
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {archived ? (
                                <DropdownMenuItem
                                  onSelect={() => setStatus.mutate({ id: b.id, status: 'active' })}
                                >
                                  <ArchiveRestore size={14} className="ml-2" /> שחזור מארכיון
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="text-red-600" onSelect={() => setArchiveB(b)}>
                                  <Archive size={14} className="ml-2" /> העברה לארכיון
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}

                      <TableCell>
                        <ChevronDown
                          size={16}
                          className={cn('text-muted-foreground transition-transform', isOpen && 'rotate-180')}
                        />
                      </TableCell>
                    </TableRow>

                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={canWrite ? 9 : 7} className="p-0">
                          <ApartmentsPanel buildingId={b.id} canWrite={canWrite} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <BuildingFormDialog open={formOpen} onOpenChange={setFormOpen} building={editB} />

      <MoveBuildingsDialog
        open={Boolean(moveIds)}
        onOpenChange={(o) => { if (!o) setMoveIds(null) }}
        ids={moveIds ?? []}
        onMoved={() => setSelected(new Set())}
      />

      <ConfirmDialog
        open={Boolean(archiveB)}
        onOpenChange={(o) => { if (!o) setArchiveB(null) }}
        title="העברת מבנה לארכיון"
        description={
          <>
            המבנה {archiveB ? formatStreetAddress(archiveB.address, archiveB.streetNumber) : ''} וכל
            דירותיו יועברו לארכיון. הנתונים נשמרים וניתן לשחזר בהמשך.
          </>
        }
        destructive
        confirmLabel="העברה לארכיון"
        pending={setStatus.isPending}
        error={setStatus.error}
        onConfirm={() => {
          if (!archiveB) return
          setStatus.mutate(
            { id: archiveB.id, status: 'archived' },
            { onSuccess: () => setArchiveB(null) },
          )
        }}
      />

      <ConfirmDialog
        open={bulkArchive}
        onOpenChange={setBulkArchive}
        title={`העברת ${selectedIds.length} מבנים לארכיון`}
        description="כל הדירות במבנים שנבחרו יועברו לארכיון גם הן. הפעולה מבוצעת כטרנזקציה אחת וניתנת לשחזור."
        destructive
        confirmLabel="העברה לארכיון"
        pending={bulkStatus.isPending}
        error={bulkStatus.error}
        onConfirm={() =>
          bulkStatus.mutate(
            { ids: selectedIds, status: 'archived' },
            { onSuccess: () => { setSelected(new Set()); setBulkArchive(false) } },
          )
        }
      />
    </div>
  )
}
