'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  useAdvanceProjectStage, useChangeProjectStatus,
  PROJECT_STAGES, PROJECT_STATUSES, type Project,
} from '@/hooks/use-projects'

/**
 * Stage and status changes for a project.
 *
 * Both are separate audited endpoints rather than fields on the edit form:
 * advancing a stage closes the previous stage-history row and opens a new one,
 * and CANCELLED / ARCHIVED effectively retire the project. Those two statuses
 * are treated as destructive and get an explicit warning.
 */

/** Statuses that take the project out of active use. */
const RETIRING_STATUSES = new Set(['CANCELLED', 'ARCHIVED'])

export function ProjectStageDialog({
  open, onOpenChange, project,
}: { open: boolean; onOpenChange: (o: boolean) => void; project: Project | null }) {
  const [stage, setStage] = useState('DISCOVERY')
  const [notes, setNotes] = useState('')
  const advance = useAdvanceProjectStage()

  useEffect(() => {
    if (!open || !project) return
    setStage(project.stage)
    setNotes('')
    advance.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id])

  const changed = Boolean(project) && stage !== project?.stage

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!advance.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שינוי שלב הפרויקט</DialogTitle>
          <DialogDescription className="text-right">
            השלב הנוכחי ייסגר בהיסטוריית השלבים ותיפתח רשומה חדשה.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>שלב</Label>
          <Select value={stage} onValueChange={setStage} dir="rtl">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_STAGES).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ps-notes">הערות</Label>
          <textarea
            id="ps-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="סיבת המעבר (אופציונלי)"
          />
        </div>

        {changed && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {PROJECT_STAGES[project?.stage ?? ''] ?? project?.stage} → <span className="font-semibold">{PROJECT_STAGES[stage]}</span>
          </p>
        )}

        {advance.isError && (
          <p className="text-sm text-red-600" role="alert">
            {advance.error instanceof Error ? advance.error.message : 'שינוי השלב נכשל'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            disabled={!changed || advance.isPending}
            onClick={() => project && advance.mutate(
              { id: project.id, stage, notes: notes.trim() || undefined },
              { onSuccess: () => onOpenChange(false) },
            )}
          >
            {advance.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
            שינוי שלב
          </Button>
          <Button type="button" variant="outline" disabled={advance.isPending}
            onClick={() => onOpenChange(false)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectStatusDialog({
  open, onOpenChange, project,
}: { open: boolean; onOpenChange: (o: boolean) => void; project: Project | null }) {
  const [status, setStatus] = useState('ACTIVE')
  const [reason, setReason] = useState('')
  const change = useChangeProjectStatus()

  useEffect(() => {
    if (!open || !project) return
    setStatus(project.status)
    setReason('')
    change.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id])

  const changed    = Boolean(project) && status !== project?.status
  const retiring   = RETIRING_STATUSES.has(status)
  // A retiring change must carry a reason — it is the only record of WHY the
  // project left active use.
  const needsReason = retiring && reason.trim().length === 0

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!change.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            {retiring && <AlertTriangle size={17} className="text-red-600" />}
            שינוי סטטוס הפרויקט
          </DialogTitle>
          <DialogDescription className="text-right">
            הסטטוס קובע אם הפרויקט נספר כפעיל בדוחות ובלוח הבקרה.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>סטטוס</Label>
          <Select value={status} onValueChange={setStatus} dir="rtl">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_STATUSES).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pst-reason">
            סיבה{retiring ? ' *' : ''}
          </Label>
          <textarea
            id="pst-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {retiring && changed && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            הפרויקט ״{project?.name}״ יוצא משימוש פעיל. הנתונים נשמרים והפעולה
            הפיכה על ידי החזרת הסטטוס ל״פעיל״.
          </p>
        )}

        {change.isError && (
          <p className="text-sm text-red-600" role="alert">
            {change.error instanceof Error ? change.error.message : 'שינוי הסטטוס נכשל'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant={retiring ? 'destructive' : 'default'}
            disabled={!changed || needsReason || change.isPending}
            onClick={() => project && change.mutate(
              { id: project.id, status, reason: reason.trim() || undefined },
              { onSuccess: () => onOpenChange(false) },
            )}
          >
            {change.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
            שינוי סטטוס
          </Button>
          <Button type="button" variant="outline" disabled={change.isPending}
            onClick={() => onOpenChange(false)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
