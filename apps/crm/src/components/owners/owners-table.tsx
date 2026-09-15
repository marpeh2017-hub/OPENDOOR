'use client'

import { useState } from 'react'
import {
  Search, Plus, Pencil, MoreHorizontal, Archive, UserCheck, UserX,
  ShieldCheck, Home, Landmark,
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
import { cn } from '@/lib/utils'
import {
  useOwners, useSetOwnerActive, useArchiveOwner, type Owner,
} from '@/hooks/use-owners'
import { useProjects } from '@/hooks/use-projects'
import { useIsManager } from '@/hooks/use-auth'
import { OwnerFormDialog } from './owner-form-dialog'

/**
 * Owners register.
 *
 * Owners are NOT residents and this screen never mixes the two: it shows title
 * holders, their holdings count and their signature count. A resident's
 * communication history, documents and portal access live on /residents.
 *
 * National IDs are shown only as the server-side mask (`nationalIdMasked`);
 * the plaintext never reaches the browser and is never searchable — the random
 * AES-GCM IV means two identical IDs have different ciphertexts, so there is
 * nothing to match against without decrypting every row.
 */
export function OwnersTable() {
  const [search, setSearch]       = useState('')
  const [projectId, setProjectId] = useState('ALL')
  const [status, setStatus]       = useState('ALL')
  const [estate, setEstate]       = useState('ALL')

  const [formOpen,   setFormOpen]   = useState(false)
  const [editOwner,  setEditOwner]  = useState<Owner | undefined>()
  const [activeOwner, setActiveOwner] = useState<Owner | null>(null)
  const [archiveOwner_, setArchiveOwner_] = useState<Owner | null>(null)

  const canWrite = useIsManager()

  const { data, isLoading, isError, error, refetch } = useOwners({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(projectId !== 'ALL' ? { projectId } : {}),
    ...(status !== 'ALL' ? { isActive: status === 'ACTIVE' } : {}),
    ...(estate !== 'ALL' ? { isEstate: estate === 'ESTATE' } : {}),
  })
  const { data: projects } = useProjects({ limit: 100 })

  const setActive = useSetOwnerActive()
  const archive   = useArchiveOwner()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-72 items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Search size={15} className="flex-shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, טלפון או אימייל"
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <Select value={projectId} onValueChange={setProjectId} dir="rtl">
          <SelectTrigger className="w-48"><SelectValue placeholder="פרויקט" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הפרויקטים</SelectItem>
            {projects?.data.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus} dir="rtl">
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הסטטוסים</SelectItem>
            <SelectItem value="ACTIVE">פעילים</SelectItem>
            <SelectItem value="INACTIVE">לא פעילים</SelectItem>
          </SelectContent>
        </Select>

        <Select value={estate} onValueChange={setEstate} dir="rtl">
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">הכול</SelectItem>
            <SelectItem value="ESTATE">עיזבונות בלבד</SelectItem>
            <SelectItem value="REGULAR">ללא עיזבונות</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />
        {data && <span className="text-sm text-muted-foreground">{data.length} בעלים</span>}
        {canWrite && (
          <Button size="sm" className="gap-1.5"
            onClick={() => { setEditOwner(undefined); setFormOpen(true) }}>
            <Plus size={15} />
            בעלים חדש
          </Button>
        )}
      </div>

      <div className="card-surface overflow-hidden">
        {isLoading ? (
          <RowsSkeleton rows={6} />
        ) : isError || !data ? (
          <div className="p-4">
            <QueryError message="שגיאה בטעינת הבעלים" error={error} onRetry={() => refetch()} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            message="לא נמצאו בעלים"
            hint={canWrite ? 'צרו בעלים ושייכו אותו לדירה ממסך הבעלויות' : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right font-semibold">שם</TableHead>
                <TableHead className="text-right font-semibold">ת״ז</TableHead>
                <TableHead className="text-right font-semibold">טלפון</TableHead>
                <TableHead className="text-right font-semibold">אימייל</TableHead>
                <TableHead className="text-right font-semibold">דירות</TableHead>
                <TableHead className="text-right font-semibold">חתימות</TableHead>
                <TableHead className="text-right font-semibold">סטטוס</TableHead>
                {canWrite && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(o => (
                <TableRow key={o.id} className={cn(!o.isActive && 'opacity-50')}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{o.fullName}</span>
                      {o.isEstate && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                          <Landmark size={11} />
                          עיזבון
                        </span>
                      )}
                      {o.residentId && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-100 px-2 py-0.5 text-xs text-teal-700">
                          <Home size={11} />
                          גם דייר
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">
                    {o.hasNationalId ? (
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck size={13} className="text-teal-600" />
                        {o.nationalIdMasked ?? '••••'}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">{o.phone ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">{o.email ?? '—'}</TableCell>
                  <TableCell className="text-sm tabular-nums">{o.apartmentCount}</TableCell>
                  <TableCell className="text-sm tabular-nums">{o.signatureCount}</TableCell>
                  <TableCell>
                    <span className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      o.isActive
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200',
                    )}>
                      {o.isActive ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal size={15} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[11rem]">
                          <DropdownMenuItem onSelect={() => { setEditOwner(o); setFormOpen(true) }}>
                            <Pencil size={14} className="ml-2" /> עריכה
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setActiveOwner(o)}>
                            {o.isActive
                              ? <><UserX size={14} className="ml-2" /> סימון כלא פעיל</>
                              : <><UserCheck size={14} className="ml-2" /> סימון כפעיל</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onSelect={() => setArchiveOwner_(o)}>
                            <Archive size={14} className="ml-2" /> העברה לארכיון
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <OwnerFormDialog open={formOpen} onOpenChange={setFormOpen} owner={editOwner} />

      <ConfirmDialog
        open={Boolean(activeOwner)}
        onOpenChange={(o) => { if (!o) setActiveOwner(null) }}
        title={activeOwner?.isActive ? 'סימון בעלים כלא פעיל' : 'סימון בעלים כפעיל'}
        description={
          activeOwner?.isActive
            ? `${activeOwner.fullName} יסומן כלא פעיל. החזקות הבעלות והיסטוריית החתימות נשמרות במלואן.`
            : `${activeOwner?.fullName ?? ''} יסומן כפעיל.`
        }
        destructive={Boolean(activeOwner?.isActive)}
        confirmLabel={activeOwner?.isActive ? 'סימון כלא פעיל' : 'סימון כפעיל'}
        pending={setActive.isPending}
        error={setActive.error}
        onConfirm={() => {
          if (!activeOwner) return
          setActive.mutate(
            { id: activeOwner.id, isActive: !activeOwner.isActive },
            { onSuccess: () => setActiveOwner(null) },
          )
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveOwner_)}
        onOpenChange={(o) => { if (!o) setArchiveOwner_(null) }}
        title="העברת בעלים לארכיון"
        description={
          <>
            {archiveOwner_?.fullName} יועבר לארכיון.
            {(archiveOwner_?.apartmentCount ?? 0) > 0 && (
              <> לבעלים זה {archiveOwner_?.apartmentCount} החזקות רשומות — הן נשמרות,
              וסך החלקים בדירות המושפעות עשוי להישאר חלקי.</>
            )}
          </>
        }
        destructive
        confirmLabel="העברה לארכיון"
        pending={archive.isPending}
        error={archive.error}
        onConfirm={() => {
          if (!archiveOwner_) return
          archive.mutate(archiveOwner_.id, { onSuccess: () => setArchiveOwner_(null) })
        }}
      />
    </div>
  )
}
