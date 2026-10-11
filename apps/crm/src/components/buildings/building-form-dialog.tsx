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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  useComplexes, useCreateBuilding, useCreateComplex, useUpdateBuilding, type BuildingListItem,
} from '@/hooks/use-buildings'
import { useProjects } from '@/hooks/use-projects'

/**
 * Create / edit a building.
 *
 * `complexId` is settable only on CREATE. UpdateBuildingDto omits it on purpose
 * — moving a building between complexes (and therefore between projects) is a
 * separate, separately-audited endpoint, so it is offered as its own action in
 * the row menu rather than as a field here.
 *
 * A new project has no complex, and a building cannot exist outside one, so
 * the complex list ends with "מתחם חדש": the complex is created first, then
 * the building inside it.
 *
 * `address` is the street NAME; the house number belongs in `streetNumber`.
 */

const NONE = '__none__'
const NEW = '__new__'
const CLASSES: Record<string, string> = { A: 'א', B: 'ב', C: 'ג' }

interface FormState {
  complexId:        string
  newComplexName:   string
  newComplexProject: string
  address:          string
  streetNumber:     string
  city:             string
  zipCode:          string
  floors:           string
  totalApartments:  string
  constructionYear: string
  buildingClass:    string
}

const EMPTY: FormState = {
  complexId: NONE, newComplexName: '', newComplexProject: NONE,
  address: '', streetNumber: '', city: '', zipCode: '',
  floors: '', totalApartments: '', constructionYear: '', buildingClass: NONE,
}

/** Empty string → undefined (omit), otherwise a parsed integer. */
function intOrUndef(v: string): number | undefined {
  const t = v.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isInteger(n) ? n : undefined
}

export function BuildingFormDialog({
  open,
  onOpenChange,
  building,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Omit to create. */
  building?: BuildingListItem
}) {
  const isEdit = Boolean(building)
  const [form, setForm] = useState<FormState>(EMPTY)

  const { data: complexes, isLoading: complexesLoading } = useComplexes()
  const { data: projects } = useProjects({ limit: 100 })
  const create = useCreateBuilding()
  const createComplex = useCreateComplex()
  const update = useUpdateBuilding()
  const mutation = isEdit ? update : create
  const pending = mutation.isPending || createComplex.isPending
  const failure = createComplex.error ?? mutation.error

  useEffect(() => {
    if (!open) return
    setForm(building
      ? {
          complexId:        building.complexId,
          newComplexName:   '',
          newComplexProject: NONE,
          address:          building.address ?? '',
          streetNumber:     building.streetNumber ?? '',
          city:             building.city ?? '',
          zipCode:          building.zipCode ?? '',
          floors:           building.floors == null ? '' : String(building.floors),
          totalApartments:  building.totalApartments == null ? '' : String(building.totalApartments),
          constructionYear: building.constructionYear == null ? '' : String(building.constructionYear),
          buildingClass:    building.buildingClass ?? NONE,
        }
      : EMPTY)
    create.reset()
    createComplex.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, building?.id])

  const newComplex = form.complexId === NEW
  const complexChosen = newComplex
    ? form.newComplexName.trim().length > 0 && form.newComplexProject !== NONE
    : form.complexId !== NONE
  const valid = form.address.trim().length > 0 && (isEdit || complexChosen)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || pending) return

    const shared = {
      address:          form.address.trim(),
      streetNumber:     form.streetNumber.trim() || undefined,
      city:             form.city.trim() || undefined,
      zipCode:          form.zipCode.trim() || undefined,
      floors:           intOrUndef(form.floors),
      totalApartments:  intOrUndef(form.totalApartments),
      constructionYear: intOrUndef(form.constructionYear),
      buildingClass:    form.buildingClass === NONE ? undefined : form.buildingClass,
    }

    if (isEdit && building) {
      update.mutate({ id: building.id, ...shared }, { onSuccess: () => onOpenChange(false) })
      return
    }

    let complexId = form.complexId
    if (newComplex) {
      try {
        const made = await createComplex.mutateAsync({
          projectId: form.newComplexProject,
          name: form.newComplexName.trim(),
        })
        complexId = made.id
        // A retry after a failed building must not make a second complex.
        setForm(f => ({ ...f, complexId: made.id, newComplexName: '', newComplexProject: NONE }))
      } catch {
        return
      }
    }
    create.mutate({ complexId, ...shared }, { onSuccess: () => onOpenChange(false) })
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!pending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? 'עריכת מבנה' : 'מבנה חדש'}</DialogTitle>
          <DialogDescription className="text-right">
            שדה הכתובת מכיל את שם הרחוב בלבד; מספר הבית נשמר בנפרד.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>מתחם *</Label>
              <Select value={form.complexId} onValueChange={(v) => set('complexId', v)} dir="rtl">
                <SelectTrigger>
                  <SelectValue placeholder={complexesLoading ? 'טוען…' : 'בחרו מתחם'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>בחרו מתחם</SelectItem>
                  {(complexes ?? []).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.project.name} · {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW}>מתחם חדש…</SelectItem>
                </SelectContent>
              </Select>
              {!complexesLoading && (complexes ?? []).length === 0 && !newComplex && (
                <p className="text-xs text-muted-foreground">
                  אין עדיין מתחמים. בחרו ״מתחם חדש״ כדי ליצור אחד.
                </p>
              )}
            </div>
          )}

          {!isEdit && newComplex && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-1.5">
                <Label>פרויקט *</Label>
                <Select value={form.newComplexProject} onValueChange={(v) => set('newComplexProject', v)} dir="rtl">
                  <SelectTrigger><SelectValue placeholder="בחרו פרויקט" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE} disabled>בחרו פרויקט</SelectItem>
                    {(projects?.data ?? []).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-complex-name">שם המתחם *</Label>
                <Input id="b-complex-name" value={form.newComplexName} maxLength={120}
                  placeholder="למשל: הרצל 45 ו־47"
                  onChange={(e) => set('newComplexName', e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  השם מופיע גם בהודעות שנשלחות לבעלי הדירות, למשל בהזמנה לכינוס.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="b-address">רחוב *</Label>
              <Input id="b-address" value={form.address} required
                placeholder="הרצל"
                onChange={(e) => set('address', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-num">מספר בית</Label>
              <Input id="b-num" value={form.streetNumber} placeholder="45"
                onChange={(e) => set('streetNumber', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-city">עיר</Label>
              <Input id="b-city" value={form.city}
                onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-zip">מיקוד</Label>
              <Input id="b-zip" value={form.zipCode}
                onChange={(e) => set('zipCode', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-floors">קומות</Label>
              <Input id="b-floors" type="number" min={1} max={200} value={form.floors}
                onChange={(e) => set('floors', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-apts">מספר דירות</Label>
              <Input id="b-apts" type="number" min={0} max={10000} value={form.totalApartments}
                onChange={(e) => set('totalApartments', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-year">שנת בנייה</Label>
              <Input id="b-year" type="number" min={1800} max={2100} value={form.constructionYear}
                onChange={(e) => set('constructionYear', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>סיווג מבנה</Label>
            <Select value={form.buildingClass} onValueChange={(v) => set('buildingClass', v)} dir="rtl">
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>ללא</SelectItem>
                {Object.entries(CLASSES).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {failure && (
            <p className="text-sm text-red-600" role="alert">
              {failure instanceof Error ? failure.message : 'שמירת המבנה נכשלה'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!valid || pending}>
              {pending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              {isEdit ? 'שמירה' : 'יצירת מבנה'}
            </Button>
            <Button type="button" variant="outline" disabled={pending}
              onClick={() => onOpenChange(false)}>ביטול</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
