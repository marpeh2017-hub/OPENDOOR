'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useCreateOwner, useUpdateOwner, type Owner } from '@/hooks/use-owners'

/**
 * Create / edit an Owner (registered title holder — NOT a Resident).
 *
 * `nationalId` is write-only. The API encrypts it with AES-256-GCM before
 * persisting and returns only `hasNationalId` + a mask, so the field starts
 * blank on edit and an empty value means "leave unchanged" rather than "clear".
 * The value is never echoed back into the form, never put in a query string and
 * never logged.
 *
 * Holdings are not edited here: a share only makes sense against a specific
 * apartment's complete share set, so it is edited from the apartment's
 * ownership dialog where the exact sum can be validated as a whole.
 */

interface FormState {
  fullName:        string
  nationalId:      string
  phone:           string
  email:           string
  addressAbroad:   string
  isEstate:        boolean
  guardianContact: string
  notes:           string
}

const EMPTY: FormState = {
  fullName: '', nationalId: '', phone: '', email: '',
  addressAbroad: '', isEstate: false, guardianContact: '', notes: '',
}

export function OwnerFormDialog({
  open,
  onOpenChange,
  owner,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Omit to create. */
  owner?: Owner
}) {
  const isEdit = Boolean(owner)
  const [form, setForm] = useState<FormState>(EMPTY)

  const create = useCreateOwner()
  const update = useUpdateOwner()
  const mutation = isEdit ? update : create

  useEffect(() => {
    if (!open) return
    setForm(owner
      ? {
          fullName:        owner.fullName,
          // Deliberately blank: the plaintext ID is never returned to the browser.
          nationalId:      '',
          phone:           owner.phone ?? '',
          email:           owner.email ?? '',
          addressAbroad:   owner.addressAbroad ?? '',
          isEstate:        owner.isEstate,
          guardianContact: owner.guardianContact ?? '',
          notes:           owner.notes ?? '',
        }
      : EMPTY)
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner?.id])

  const valid = form.fullName.trim().length > 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return

    const shared = {
      fullName:        form.fullName.trim(),
      // Omitted entirely when blank so an edit never wipes a stored ID.
      ...(form.nationalId.trim() ? { nationalId: form.nationalId.trim() } : {}),
      phone:           form.phone.trim() || undefined,
      email:           form.email.trim() || undefined,
      addressAbroad:   form.addressAbroad.trim() || undefined,
      isEstate:        form.isEstate,
      guardianContact: form.guardianContact.trim() || undefined,
      notes:           form.notes.trim() || undefined,
    }

    if (isEdit && owner) {
      update.mutate({ id: owner.id, ...shared }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate(shared, { onSuccess: () => onOpenChange(false) })
    }
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!mutation.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? 'עריכת בעלים' : 'בעלים חדש'}</DialogTitle>
          <DialogDescription className="text-right">
            בעלים הוא מי שרשום בטאבו — לא בהכרח מי שגר בדירה. שיוך לדירות ורישום
            חלקים מתבצעים ממסך הבעלויות של הדירה.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="o-name">שם מלא *</Label>
            <Input id="o-name" value={form.fullName} required maxLength={200}
              onChange={(e) => set('fullName', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-nid" className="flex items-center gap-1.5">
              תעודת זהות
              <ShieldCheck size={13} className="text-teal-600" />
            </Label>
            <Input id="o-nid" value={form.nationalId} dir="ltr" className="text-left"
              inputMode="numeric" autoComplete="off" maxLength={20}
              placeholder={isEdit ? (owner?.hasNationalId ? 'שמור ומוצפן — השאירו ריק לשמירה' : '') : ''}
              onChange={(e) => set('nationalId', e.target.value)} />
            <p className="text-xs text-muted-foreground">
              נשמר מוצפן ואינו מוחזר לדפדפן.
              {isEdit && ' השארת השדה ריק תשמור על הערך הקיים.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-phone">טלפון</Label>
              <Input id="o-phone" value={form.phone} dir="ltr" className="text-left" maxLength={30}
                onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-email">אימייל</Label>
              <Input id="o-email" type="email" value={form.email} dir="ltr" className="text-left" maxLength={160}
                onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-abroad">כתובת בחו״ל</Label>
            <Input id="o-abroad" value={form.addressAbroad} maxLength={300}
              onChange={(e) => set('addressAbroad', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isEstate}
              onChange={(e) => set('isEstate', e.target.checked)}
              className="h-4 w-4 rounded border-input" />
            עיזבון — הירושה טרם הוסדרה
          </label>

          {form.isEstate && (
            <div className="space-y-1.5">
              <Label htmlFor="o-guardian">איש קשר / אפוטרופוס</Label>
              <Input id="o-guardian" value={form.guardianContact} maxLength={300}
                onChange={(e) => set('guardianContact', e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="o-notes">הערות</Label>
            <textarea
              id="o-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {mutation.error instanceof Error ? mutation.error.message : 'שמירת הבעלים נכשלה'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {mutation.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              {isEdit ? 'שמירה' : 'יצירת בעלים'}
            </Button>
            <Button type="button" variant="outline" disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}>ביטול</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
