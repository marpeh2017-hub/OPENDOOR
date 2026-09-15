'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsManager } from '@/hooks/use-auth'
import { ResidentFormDialog } from './resident-form-dialog'

/**
 * Client island for the "new resident" action, so the residents page can stay a
 * server component.
 *
 * Hidden for non-management roles as a convenience — `POST /residents` is
 * `@Roles(...RESIDENT_WRITE_ROLES)` and remains the enforcement point.
 */
export function NewResidentButton() {
  const [open, setOpen] = useState(false)
  const canWrite = useIsManager()

  if (!canWrite) return null

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus size={15} />
        הוספת דייר
      </Button>
      <ResidentFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
