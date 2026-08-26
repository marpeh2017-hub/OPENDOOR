'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  useCreateApartment, useUpdateApartment, type BuildingApartment,
} from '@/hooks/use-buildings'

/**
 * Create / edit one apartment inside a building.
 *
 * Ownership is NOT edited here — it has its own dialog, because a share set has
 * to be validated as a whole against the exact-fraction rules before any of it
 * is written. `buildingId` is fixed after creation (UpdateApartmentDto omits
 * it), so an apartment can never drift to another building by an edit.
 */

interface FormState {
  apartmentNumber: string
  floor:        string
  rooms:        string
  sizeSqm:      string
  parkingSpots: string
  storageCount: string
  hasBalcony:   boolean
  balconySqm:   string
  notes:        string
}

const EMPTY: FormState = {
  apartmentNumber: '', floor: '', rooms: '', sizeSqm: '',
  parkingSpots: '', storageCount: '', hasBalcony: false, balconySqm: '', notes: '',
}

function numOrUndef(v: string): number | undefined {
  const t = v.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function intOrUndef(v: string): number | undefined {
  const n = numOrUndef(v)
  return n !== undefined && Number.isInteger(n) ? n : undefined
}

export function ApartmentFormDialog({
  open,
  onOpenChange,
  buildingId,
  apartment,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  buildingId: string
  /** Omit to create. */
  apartment?: BuildingApartment
}) {
  const isEdit = Boolean(apartment)
  const [form, setForm] = useState<FormState>(EMPTY)

  const create = useCreateApartment()
  const update = useUpdateApartment()
  const mutation = isEdit ? update : create

  useEffect(() => {
    if (!open) return
    setForm(apartment
      ? {
          apartmentNumber: apartment.apartmentNumber ?? '',
          floor:        apartment.floor        == null ? '' : String(apartment.floor),
          rooms:        apartment.rooms        == null ? '' : String(apartment.rooms),
          sizeSqm:      apartment.sizeSqm      == null ? '' : String(apartment.sizeSqm),
          parkingSpots: apartment.parkingSpots == null ? '' : String(apartment.parkingSpots),
          storageCount: '',
          hasBalcony:   Boolean(apartment.hasBalcony),
          balconySqm:   '',
          notes:        '',
        }
      : EMPTY)
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, apartment?.id])

  const valid = form.apartmentNumber.trim().length > 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return

    const parking = intOrUndef(form.parkingSpots)
    const storage = intOrUndef(form.storageCount)

    const shared = {
      apartmentNumber: form.apartmentNumber.trim(),
      floor:        intOrUndef(form.floor),
      rooms:        numOrUndef(form.rooms),
      sizeSqm:      numOrUndef(form.sizeSqm),
      // hasParking / hasStorage are derived from the counts so the two can
      // never disagree in the record.
      ...(parking === undefined ? {} : { parkingSpots: parking, hasParking: parking > 0 }),
      ...(storage === undefined ? {} : { storageCount: storage, hasStorage: storage > 0 }),
      hasBalcony:   form.hasBalcony,
      ...(form.hasBalcony ? { balconySqm: numOrUndef(form.balconySqm) } : {}),
      notes:        form.notes.trim() || undefined,
    }

    if (isEdit && apartment) {
      update.mutate({ id: apartment.id, buildingId, ...shared }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate({ buildingId, ...shared }, { onSuccess: () => onOpenChange(false) })
    }
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!mutation.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? 'עריכת דירה' : 'דירה חדשה'}</DialogTitle>
          <DialogDescription className="text-right">
            רישום הבעלויות נערך בנפרד, במסך ״בעלויות״ של הדירה.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-num">מספר דירה *</Label>
              <Input id="a-num" value={form.apartmentNumber} required
                onChange={(e) => set('apartmentNumber', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-floor">קומה</Label>
              <Input id="a-floor" type="number" min={-5} max={200} value={form.floor}
                onChange={(e) => set('floor', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-rooms">חדרים</Label>
              <Input id="a-rooms" type="number" min={0} max={50} step="0.5" value={form.rooms}
                onChange={(e) => set('rooms', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-size">שטח (מ״ר)</Label>
              <Input id="a-size" type="number" min={0} max={10000} step="0.1" value={form.sizeSqm}
                onChange={(e) => set('sizeSqm', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-park">חניות</Label>
              <Input id="a-park" type="number" min={0} max={20} value={form.parkingSpots}
                onChange={(e) => set('parkingSpots', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-store">מחסנים</Label>
              <Input id="a-store" type="number" min={0} max={20} value={form.storageCount}
                onChange={(e) => set('storageCount', e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.hasBalcony}
                onChange={(e) => set('hasBalcony', e.target.checked)}
                className="h-4 w-4 rounded border-input" />
              מרפסת
            </label>
            {form.hasBalcony && (
              <div className="flex items-center gap-2">
                <Label htmlFor="a-balc" className="text-xs whitespace-nowrap">שטח מרפסת (מ״ר)</Label>
                <Input id="a-balc" type="number" min={0} max={1000} step="0.1" className="w-28"
                  value={form.balconySqm} onChange={(e) => set('balconySqm', e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-notes">הערות</Label>
            <textarea
              id="a-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {mutation.error instanceof Error ? mutation.error.message : 'שמירת הדירה נכשלה'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {mutation.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              {isEdit ? 'שמירה' : 'יצירת דירה'}
            </Button>
            <Button type="button" variant="outline" disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}>ביטול</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
