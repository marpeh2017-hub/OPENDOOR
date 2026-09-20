'use client'

import { EmptyState } from '@/components/ui/query-states'

/**
 * NOT IMPLEMENTED — the API Gateway has no resident-scoped document endpoint.
 * DocumentsController.findAll filters by `projectId` and `category` only; there
 * is no `residentId` filter and no Document→Resident relation to filter on.
 * Rendering an honest empty state rather than inventing data.
 */
export function ResidentDocumentsTab({ residentId: _residentId }: { residentId: string }) {
  return (
    <div className="card-surface">
      <EmptyState
        message="מסמכים ברמת הדייר אינם זמינים עדיין"
        hint="ניתן לצפות במסמכי הפרויקט בלשונית המסמכים של הפרויקט"
      />
    </div>
  )
}
