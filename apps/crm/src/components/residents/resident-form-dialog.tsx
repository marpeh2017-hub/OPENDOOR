'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatStreetAddress } from '@/lib/utils'
import { useCreateResident, useUpdateResident, type Resident } from '@/hooks/use-residents'
import { useBuildings, useApartments } from '@/hooks/use-buildings'

/**
 * Create / edit a Resident (whoever LIVES in the apartment — not necessarily a
 * title holder; that is `Owner`, on /owners).
 *
 * `apartmentId` is required on create and NOT editable here: moving a resident
 * changes which project's signature threshold they count towards, so it has its
 * own separately-audited endpoint and its own dialog.
 *
 * `nationalId` is write-only — encrypted at rest, never returned, so the field
 * starts blank on edit and a blank value leaves the stored one untouched.
 */

const NONE = '__none__'

const CHANNELS: Record<string, string> = {
  WHATSAPP: 'וואטסאפ', SMS: 'SMS', EMAIL: 'אימייל', PUSH: 'התראה',
}
const LANGUAGES: Record<string, string> = { he: 'עברית', en: 'אנגלית', ru: 'רוסית', ar: 'ערבית' }

interface FormState {
  buildingId:       string
  apartmentId:      string
  firstName:        string
  lastName:         string
  nationalId:       string
  phone:            string
  phone2:           string
  email:            string
  language:         string
  preferredChannel: string
  isPrimaryContact: boolean
  doNotContact:     boolean
  notes:            string
}

const EMPTY: FormState = {
  buildingId: NONE, apartmentId: NONE, firstName: '', lastName: '', nationalId: '',
  phone: '', phone2: '', email: '', language: 'he', preferredChannel: NONE,
  isPrimaryContact: true, doNotContact: false, notes: '',
}

export function ResidentFormDialog({
  open,
  onOpenChange,
  resident,
  defaultApartmentId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Omit to create. */
  resident?: Resident
  defaultApartmentId?: string
}) {
  const isEdit = Boolean(resident)
  const [form, setForm] = useState<FormState>(EMPTY)

  const { data: buildings } = useBuildings()
  const { data: apartments, isLoading: aptsLoading } = useApartments(
    form.buildingId === NONE ? undefined : form.buildingId,
    !isEdit && form.buildingId !== NONE,
  )

  const create = useCreateResident()
  const update = useUpdateResident()
  const mutation = isEdit ? update : create

  useEffect(() => {
    if (!open) return
    setForm(resident
      ? {
          ...EMPTY,
          buildingId:       resident.apartment?.building?.id ?? NONE,
          apartmentId:      resident.apartmentId ?? NONE,
          firstName:        resident.firstName,
          lastName:         resident.lastName,
          nationalId:       '',
          phone:            resident.phone ?? '',
          phone2:           resident.phone2 ?? '',
          email:            resident.email ?? '',
          language:         'he',
          preferredChannel: resident.preferredChannel ?? NONE,
          isPrimaryContact: resident.isPrimaryContact,
          doNotContact:     resident.doNotContact,
          notes:            resident.notes ?? '',
        }
      : { ...EMPTY, apartmentId: defaultApartmentId ?? NONE })
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resident?.id, defaultApartmentId])

  const valid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    (isEdit || form.apartmentId !== NONE)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return

    const shared = {
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      // Omitted when blank so an edit never wipes a stored, encrypted ID.
      ...(form.nationalId.trim() ? { nationalId: form.nationalId.trim() } : {}),
      phone:  form.phone.trim()  || undefined,
      phone2: form.phone2.trim() || undefined,
      email:  form.email.trim()  || undefined,
      language: form.language,
      ...(form.preferredChannel === NONE ? {} : { preferredChannel: form.preferredChannel }),
      isPrimaryContact: form.isPrimaryContact,
      doNotContact:     form.doNotContact,
      notes: form.notes.trim() || undefined,
    }

    if (isEdit && resident) {
      update.mutate({ id: resident.id, ...shared }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate({ apartmentId: form.apartmentId, ...shared }, { onSuccess: () => onOpenChange(false) })
    }
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!mutation.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? 'עריכת דייר' : 'דייר חדש'}</DialogTitle>
          <DialogDescription className="text-right">
            {isEdit
              ? 'העברה לדירה אחרת מתבצעת בנפרד, מתפריט הפעולות.'
              : 'דייר משויך תמיד לדירה. בעלי זכויות רשומים מנוהלים במסך ״בעלים״.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>מבנה *</Label>
                <Select
                  value={form.buildingId}
                  onValueChange={(v) => setForm(f => ({ ...f, buildingId: v, apartmentId: NONE }))}
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
                <Label>דירה *</Label>
                <Select
                  value={form.apartmentId}
                  onValueChange={(v) => set('apartmentId', v)}
                  dir="rtl"
                  disabled={form.buildingId === NONE}
                >
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
                {form.buildingId !== NONE && !aptsLoading && (apartments ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">אין דירות רשומות במבנה זה.</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-first">שם פרטי *</Label>
              <Input id="r-first" value={form.firstName} required
                onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-last">שם משפחה *</Label>
              <Input id="r-last" value={form.lastName} required
                onChange={(e) => set('lastName', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-nid" className="flex items-center gap-1.5">
              תעודת זהות
              <ShieldCheck size={13} className="text-teal-600" />
            </Label>
            <Input id="r-nid" value={form.nationalId} dir="ltr" className="text-left"
              inputMode="numeric" autoComplete="off"
              onChange={(e) => set('nationalId', e.target.value)} />
            <p className="text-xs text-muted-foreground">
              נשמר מוצפן ואינו מוחזר לדפדפן.
              {isEdit && ' השארת השדה ריק תשמור על הערך הקיים.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-phone">טלפון</Label>
              <Input id="r-phone" value={form.phone} dir="ltr" className="text-left"
                onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-phone2">טלפון נוסף</Label>
              <Input id="r-phone2" value={form.phone2} dir="ltr" className="text-left" maxLength={30}
                onChange={(e) => set('phone2', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-email">אימייל</Label>
            <Input id="r-email" type="email" value={form.email} dir="ltr" className="text-left"
              onChange={(e) => set('email', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>שפה</Label>
              <Select value={form.language} onValueChange={(v) => set('language', v)} dir="rtl">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGES).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ערוץ מועדף</Label>
              <Select value={form.preferredChannel} onValueChange={(v) => set('preferredChannel', v)} dir="rtl">
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא</SelectItem>
                  {Object.entries(CHANNELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPrimaryContact}
                onChange={(e) => set('isPrimaryContact', e.target.checked)}
                className="h-4 w-4 rounded border-input" />
              איש קשר ראשי בדירה
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.doNotContact}
                onChange={(e) => set('doNotContact', e.target.checked)}
                className="h-4 w-4 rounded border-input" />
              אין ליצור קשר
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-notes">הערות</Label>
            <textarea
              id="r-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {mutation.error instanceof Error ? mutation.error.message : 'שמירת הדייר נכשלה'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {mutation.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              {isEdit ? 'שמירה' : 'יצירת דייר'}
            </Button>
            <Button type="button" variant="outline" disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}>ביטול</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
