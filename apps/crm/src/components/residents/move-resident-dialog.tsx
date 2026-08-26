'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatStreetAddress } from '@/lib/utils'
import { useMoveResident, type Resident } from '@/hooks/use-residents'
import { useBuildings, useApartments } from '@/hooks/use-buildings'

/**
 * Move a resident to another apartment (PATCH /residents/:id/apartment).
 *
 * Separate from the edit form because the move changes which project's
 * signature threshold the resident counts towards — a consequential change that
 * is audited on its own and restricted to management roles.
 */

const NONE = '__none__'

export function MoveResidentDialog({
  open,
  onOpenChange,
  resident,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  resident: Resident | null
}) {
  const [buildingId, setBuildingId]   = useState(NONE)
  const [apartmentId, setApartmentId] = useState(NONE)

  const { data: buildings } = useBuildings()
  const { data: apartments, isLoading: aptsLoading } =
    useApartments(buildingId === NONE ? undefined : buildingId, buildingId !== NONE)

  const move = useMoveResident()

  useEffect(() => {
    if (!open) return
    setBuildingId(NONE)
    setApartmentId(NONE)
    move.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resident?.id])

  const currentApt = resident?.apartment
  const unchanged  = apartmentId !== NONE && apartmentId === resident?.apartmentId

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!move.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">העברת דייר לדירה אחרת</DialogTitle>
          <DialogDescription className="text-right">
            ההעברה משנה את הפרויקט שאליו נספרת חתימת הדייר, ולכן נרשמת ביומן
            הביקורת.
          </DialogDescription>
        </DialogHeader>

        {currentApt && (
          <p className="text-sm text-muted-foreground">
            כרגע: דירה {currentApt.apartmentNumber}
            {currentApt.building
              ? ` · ${formatStreetAddress(currentApt.building.address, null)}`
              : ''}
          </p>
        )}

        <div className="space-y-1.5">
          <Label>מבנה יעד *</Label>
          <Select
            value={buildingId}
            onValueChange={(v) => { setBuildingId(v); setApartmentId(NONE) }}
            dir="rtl"
          >
            <SelectTrigger><SelectValue placeholder="בחרו מבנה" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>בחרו מבנה</SelectItem>
              {(buildings ?? []).map(b => (
                <SelectItem key={b.id} value={b.id}>
                  {formatStreetAddress(b.address, b.streetNumber)} · {b.complex.project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>דירת יעד *</Label>
          <Select value={apartmentId} onValueChange={setApartmentId} dir="rtl"
            disabled={buildingId === NONE}>
            <SelectTrigger>
              <SelectValue placeholder={aptsLoading ? 'טוען…' : 'בחרו דירה'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>בחרו דירה</SelectItem>
              {(apartments ?? []).map(a => (
                <SelectItem key={a.id} value={a.id}>
                  דירה {a.apartmentNumber}{a.floor != null ? ` · קומה ${a.floor}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {unchanged && (
          <p className="text-sm text-amber-700">זו הדירה הנוכחית של הדייר.</p>
        )}

        {move.isError && (
          <p className="text-sm text-red-600" role="alert">
            {move.error instanceof Error ? move.error.message : 'ההעברה נכשלה'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            disabled={apartmentId === NONE || unchanged || move.isPending}
            onClick={() => resident && move.mutate(
              { id: resident.id, apartmentId },
              { onSuccess: () => onOpenChange(false) },
            )}
          >
            {move.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
            העברה
          </Button>
          <Button type="button" variant="outline" disabled={move.isPending}
            onClick={() => onOpenChange(false)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
