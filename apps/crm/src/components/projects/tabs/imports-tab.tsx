'use client'

import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCanImport } from '@/hooks/use-auth'
import { ImportWizardDialog } from '@/components/imports/import-wizard-dialog'
import { ImportHistory } from '@/components/imports/import-history'

/**
 * The import entry point, on the project it imports into.
 *
 * `useCanImport()` only HIDES the button. `IMPORT_ROLES` on
 * `ImportsController` is the enforcement point and returns 403 for every other
 * role — a user who reaches the endpoint directly gets refused there.
 */
export function ProjectImportsTab({
  projectId,
  projectName,
}: {
  projectId: string
  projectName?: string
}) {
  const [open, setOpen] = useState(false)
  const canImport = useCanImport()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">ייבוא מאקסל</h3>
          <p className="text-xs text-muted-foreground">
            טעינת בעלים או דיירים מקובץ xlsx. — עם מיפוי עמודות, בדיקת תקינות ותצוגה
            מקדימה לפני שמירה.
          </p>
        </div>
        {canImport && (
          <Button onClick={() => setOpen(true)}>
            <FileSpreadsheet size={15} className="ml-1.5" />
            ייבוא בעלים/דיירים מאקסל
          </Button>
        )}
      </div>

      <ImportHistory projectId={projectId} />

      {canImport && (
        <ImportWizardDialog
          open={open}
          onOpenChange={setOpen}
          projectId={projectId}
          projectName={projectName}
        />
      )}
    </div>
  )
}
