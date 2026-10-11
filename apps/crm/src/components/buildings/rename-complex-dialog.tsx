'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useUpdateComplex, type BuildingComplexRef } from '@/hooks/use-buildings'

/**
 * Rename the complex a building belongs to. The name is what the forms and
 * the owners' messages call the compound, so it says that forms already made
 * keep the name they were made with.
 */
export function RenameComplexDialog({
  complex,
  onOpenChange,
}: {
  /** The complex to rename; null closes the dialog. */
  complex: BuildingComplexRef | null
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const rename = useUpdateComplex()

  useEffect(() => {
    if (!complex) return
    setName(complex.name)
    rename.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complex?.id])

  const trimmed = name.trim()
  const valid = trimmed.length > 0 && trimmed !== complex?.name

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!complex || !valid) return
    rename.mutate({ id: complex.id, name: trimmed }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={Boolean(complex)} onOpenChange={(o) => { if (!rename.isPending) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שינוי שם המתחם</DialogTitle>
          <DialogDescription className="text-right">
            השם מופיע בטפסים ובהודעות לבעלי הדירות. טפסים שכבר נוצרו שומרים את השם שהיה בהם.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="complex-name">שם המתחם</Label>
            <Input id="complex-name" value={name} maxLength={120} required
              onChange={(e) => setName(e.target.value)} />
            {complex && (
              <p className="text-xs text-muted-foreground">פרויקט: {complex.project.name}</p>
            )}
          </div>

          {rename.isError && (
            <p className="text-sm text-red-600" role="alert">
              {rename.error instanceof Error ? rename.error.message : 'שינוי השם נכשל'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!valid || rename.isPending}>
              {rename.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              שמירה
            </Button>
            <Button type="button" variant="outline" disabled={rename.isPending}
              onClick={() => onOpenChange(false)}>ביטול</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
