'use client'

import { useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, QueryError, RowsSkeleton } from '@/components/ui/query-states'
import { useDocumentShares, useShareDocument, useUnshareDocument } from '@/hooks/use-documents'
import { useResidents } from '@/hooks/use-residents'

/**
 * Share a document with residents: a ticked resident sees it in their
 * personal area ("המסמכים שלי") and can download it; unticking withdraws it.
 *
 * Each tick is its own request and takes effect at once, so there is no Save
 * to forget; the API audits every grant and withdrawal. The list is the
 * residents of the document's project; a document without a project lists
 * every resident. "Share with everyone listed" respects the search, so a
 * protocol can go to one building's residents by searching its address.
 */
export function ShareDocumentDialog({
  document,
  onOpenChange,
}: {
  /** The document to share; null closes the dialog. */
  document: { id: string; title: string; projectId: string | null } | null
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const shares = useDocumentShares(document?.id ?? null)
  const residents = useResidents({ ...(document?.projectId ? { projectId: document.projectId } : {}), limit: 500 })
  const share = useShareDocument()
  const unshare = useUnshareDocument()

  const sharedIds = useMemo(() => new Set(shares.data?.map((s) => s.residentId)), [shares.data])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (residents.data?.data ?? [])
      .map((r) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`.trim(),
        apartment: r.apartment?.apartmentNumber ?? '',
        address: r.apartment?.building?.address ?? '',
      }))
      .filter((r) => !term || `${r.name} ${r.apartment} ${r.address}`.toLowerCase().includes(term))
      .sort((a, b) => a.address.localeCompare(b.address, 'he') || a.apartment.localeCompare(b.apartment, 'he', { numeric: true }))
  }, [residents.data, search])

  const notShared = rows.filter((r) => !sharedIds.has(r.id))

  function close(open: boolean) {
    if (bulk) return
    if (!open) {
      setSearch('')
      setActionError(null)
    }
    onOpenChange(open)
  }

  async function toggle(residentId: string) {
    if (!document) return
    setActionError(null)
    setPending((s) => new Set(s).add(residentId))
    try {
      const input = { documentId: document.id, residentId }
      if (sharedIds.has(residentId)) await unshare.mutateAsync(input)
      else await share.mutateAsync(input)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'הפעולה נכשלה')
    } finally {
      setPending((s) => { const next = new Set(s); next.delete(residentId); return next })
    }
  }

  async function shareAll() {
    if (!document || notShared.length === 0) return
    setActionError(null)
    setBulk({ done: 0, total: notShared.length })
    try {
      for (const [index, row] of notShared.entries()) {
        await share.mutateAsync({ documentId: document.id, residentId: row.id })
        setBulk({ done: index + 1, total: notShared.length })
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'השיתוף נכשל באמצע. מה שכבר שותף נשאר משותף.')
    } finally {
      setBulk(null)
    }
  }

  const count = shares.data?.length ?? 0

  return (
    <Dialog open={Boolean(document)} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שיתוף עם דיירים</DialogTitle>
          <DialogDescription className="text-right">
            ״{document?.title}״ יופיע באזור האישי של הדיירים שתסמנו, והם יוכלו להוריד אותו. כל שיתוף והפסקת שיתוף נרשמים.
          </DialogDescription>
        </DialogHeader>

        {!document?.projectId && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            המסמך לא משויך לפרויקט, ולכן מוצגים כל הדיירים.
          </p>
        )}

        <div className="relative">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, דירה או כתובת"
            aria-label="חיפוש דיירים"
            className="pr-9"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground" aria-live="polite">
            {shares.isLoading ? 'טוען…' : count === 0 ? 'עדיין לא משותף עם אף דייר' : `משותף עם ${count} דיירים`}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={shareAll} disabled={Boolean(bulk) || notShared.length === 0}>
            {bulk
              ? <><Loader2 size={14} className="ml-1 animate-spin" /> משתף {bulk.done} מתוך {bulk.total}</>
              : `שיתוף עם כל ${notShared.length} שברשימה`}
          </Button>
        </div>

        {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}

        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          {residents.isLoading || shares.isLoading ? (
            <RowsSkeleton rows={5} />
          ) : residents.isError ? (
            <div className="p-3"><QueryError message="שגיאה בטעינת הדיירים" error={residents.error} onRetry={() => residents.refetch()} /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              message={search ? 'אין דיירים שתואמים לחיפוש' : 'אין דיירים רשומים בפרויקט הזה'}
              hint={search ? undefined : 'דיירים נוספים באזור הדיירים, או כשבעל דירה נרשם לאזור האישי ומאושר.'}
            />
          ) : (
            <ul className="divide-y">
              {rows.map((r) => {
                const checked = sharedIds.has(r.id)
                const busy = pending.has(r.id) || Boolean(bulk)
                return (
                  <li key={r.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 accent-teal-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[r.address, r.apartment && `דירה ${r.apartment}`].filter(Boolean).join(', ')}
                        </span>
                      </span>
                      {pending.has(r.id) && <Loader2 size={14} className="animate-spin text-muted-foreground" aria-label="שומר" />}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
