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
import { useComplexes, useMoveBuilding, useBulkMoveBuildings } from '@/hooks/use-buildings'

/**
 * Move one or many buildings to another complex.
 *
 * Moving a building changes which PROJECT its apartments, residents and
 * signature weight belong to, so it is deliberately not a field on the general
 * building edit form — it is this explicit, confirmed action against its own
 * audited endpoint. The bulk variant is a single server-side transaction, so a
 * partially-moved set is not possible.
 */

const NONE = '__none__'

export function MoveBuildingsDialog({
  open,
  onOpenChange,
  ids,
  onMoved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** One id uses PATCH /buildings/:id/complex; several use POST /buildings/move. */
  ids: string[]
  onMoved?: () => void
}) {
  const [complexId, setComplexId] = useState(NONE)
  const { data: complexes, isLoading } = useComplexes()
  const moveOne  = useMoveBuilding()
  const moveMany = useBulkMoveBuildings()

  const bulk     = ids.length > 1
  const mutation = bulk ? moveMany : moveOne

  useEffect(() => {
    if (!open) return
    setComplexId(NONE)
    moveOne.reset()
    moveMany.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function submit() {
    if (complexId === NONE || ids.length === 0) return
    const done = { onSuccess: () => { onMoved?.(); onOpenChange(false) } }
    if (bulk) moveMany.mutate({ ids, complexId }, done)
    else      moveOne.mutate({ id: ids[0], complexId }, done)
  }

  const target = (complexes ?? []).find(c => c.id === complexId)

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!mutation.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            העברת {ids.length > 1 ? `${ids.length} מבנים` : 'מבנה'} למתחם אחר
          </DialogTitle>
          <DialogDescription className="text-right">
            העברה משנה את הפרויקט שאליו משויכים המבנה, דירותיו ודייריו — ולכן גם
            את חישוב רף החתימות. הפעולה נרשמת ביומן הביקורת.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>מתחם יעד *</Label>
          <Select value={complexId} onValueChange={setComplexId} dir="rtl">
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? 'טוען…' : 'בחרו מתחם'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>בחרו מתחם</SelectItem>
              {(complexes ?? []).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.project.name} · {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {target && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            היעד: <span className="font-semibold">{target.project.name} · {target.name}</span>
          </p>
        )}

        {mutation.isError && (
          <p className="text-sm text-red-600" role="alert">
            {mutation.error instanceof Error ? mutation.error.message : 'ההעברה נכשלה'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" disabled={complexId === NONE || mutation.isPending} onClick={submit}>
            {mutation.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
            העברה
          </Button>
          <Button type="button" variant="outline" disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
