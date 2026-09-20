'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useUpdateProject, type Project } from '@/hooks/use-projects'

/**
 * Edit a project's descriptive fields (PUT /projects/:id).
 *
 * Stage, status and team assignment are NOT here: each has its own audited
 * endpoint, because advancing a stage writes a stage-history row and a status
 * change can archive the project. They are offered as distinct actions instead.
 */

interface FormState {
  name:          string
  city:          string
  address:       string
  neighborhood:  string
  description:   string
  totalUnits:    string
  signatureGoal: string
  startDate:     string
  targetEndDate: string
}

function dateInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function intOrUndef(v: string): number | undefined {
  const t = v.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isInteger(n) ? n : undefined
}

export function ProjectEditDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  project: (Project & { description?: string | null; startDate?: string | null; targetEndDate?: string | null }) | null
}) {
  const [form, setForm] = useState<FormState>({
    name: '', city: '', address: '', neighborhood: '', description: '',
    totalUnits: '', signatureGoal: '', startDate: '', targetEndDate: '',
  })

  const update = useUpdateProject(project?.id ?? '')

  useEffect(() => {
    if (!open || !project) return
    setForm({
      name:          project.name,
      city:          project.city,
      address:       project.address ?? '',
      neighborhood:  project.neighborhood ?? '',
      description:   project.description ?? '',
      totalUnits:    project.totalUnits == null ? '' : String(project.totalUnits),
      signatureGoal: project.signatureGoal == null ? '' : String(project.signatureGoal),
      startDate:     dateInput(project.startDate),
      targetEndDate: dateInput(project.targetEndDate),
    })
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id])

  const valid = form.name.trim().length > 0 && form.city.trim().length > 0

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || !project) return
    update.mutate(
      {
        name:          form.name.trim(),
        city:          form.city.trim(),
        address:       form.address.trim()      || undefined,
        neighborhood:  form.neighborhood.trim() || undefined,
        description:   form.description.trim()  || undefined,
        totalUnits:    intOrUndef(form.totalUnits),
        signatureGoal: intOrUndef(form.signatureGoal),
        // Prisma DateTime rejects a bare date string — send a full timestamp.
        startDate:     form.startDate     ? new Date(`${form.startDate}T12:00:00`).toISOString()     : undefined,
        targetEndDate: form.targetEndDate ? new Date(`${form.targetEndDate}T12:00:00`).toISOString() : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!update.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">עריכת פרויקט</DialogTitle>
          <DialogDescription className="text-right">
            שינוי שלב, סטטוס והרכב הצוות מתבצע בפעולות נפרדות.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">שם הפרויקט *</Label>
            <Input id="p-name" value={form.name} required
              onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-city">עיר *</Label>
              <Input id="p-city" value={form.city} required
                onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-hood">שכונה</Label>
              <Input id="p-hood" value={form.neighborhood}
                onChange={(e) => set('neighborhood', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-address">כתובת</Label>
            <Input id="p-address" value={form.address}
              onChange={(e) => set('address', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-units">מספר יחידות</Label>
              <Input id="p-units" type="number" min={0} value={form.totalUnits}
                onChange={(e) => set('totalUnits', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-goal">יעד חתימות (%)</Label>
              <Input id="p-goal" type="number" min={0} max={100} value={form.signatureGoal}
                onChange={(e) => set('signatureGoal', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-start">תאריך התחלה</Label>
              <Input id="p-start" type="date" value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-end">תאריך יעד</Label>
              <Input id="p-end" type="date" value={form.targetEndDate}
                onChange={(e) => set('targetEndDate', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-desc">תיאור</Label>
            <textarea
              id="p-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {update.isError && (
            <p className="text-sm text-red-600" role="alert">
              {update.error instanceof Error ? update.error.message : 'שמירת הפרויקט נכשלה'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!valid || update.isPending}>
              {update.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              שמירה
            </Button>
            <Button type="button" variant="outline" disabled={update.isPending}
              onClick={() => onOpenChange(false)}>ביטול</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
