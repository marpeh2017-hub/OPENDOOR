'use client'

import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChangePassword, useCurrentUser } from '@/hooks/use-auth'
import { PASSWORD_RULE_TEXT, passwordProblem } from '@/lib/password-rule'

/**
 * The signed-in user's own account: for now, their password.
 *
 * Every staff member reaches Settings, so this card comes first and is not
 * limited to admins. It asks for the current password, and for the new one
 * twice, since nobody can read it back afterwards. On success the API signs
 * the user out everywhere, this session included, so the card clears the
 * cookies and sends them to sign in with the new password.
 *
 * `id="password"` is the target of the user menu's "שינוי סיסמה".
 */
export function AccountCard() {
  const { data: me } = useCurrentUser()
  const change = useChangePassword()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [done, setDone] = useState(false)

  const problem = form.next ? passwordProblem(form.next) : null
  const mismatch = form.confirm.length > 0 && form.confirm !== form.next
  const same = form.next.length > 0 && form.next === form.current
  const ready = Boolean(form.current && form.next && form.confirm) && !problem && !mismatch && !same
  const type = show ? 'text' : 'password'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready || change.isPending || done) return
    change.mutate(
      { currentPassword: form.current, newPassword: form.next },
      {
        onSuccess: async () => {
          setDone(true)
          // Every token is refused from now on: clear the cookies, then sign in anew.
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
          window.location.href = '/he/login?changed=1'
        },
      },
    )
  }

  return (
    <section id="password" aria-labelledby="account-heading" className="card-surface scroll-mt-6 p-6">
      <h2 id="account-heading" className="text-lg font-semibold text-foreground">החשבון שלי</h2>
      {me?.email && (
        <p className="mt-0.5 text-sm text-muted-foreground" dir="ltr">{me.email}</p>
      )}

      <form onSubmit={submit} className="mt-5 max-w-md space-y-4" noValidate>
        <h3 className="text-sm font-semibold text-foreground">שינוי סיסמה</h3>

        <div className="space-y-1.5">
          <Label htmlFor="acc-current">סיסמה נוכחית</Label>
          <Input
            id="acc-current" type={type} dir="ltr" autoComplete="current-password"
            value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="acc-next">סיסמה חדשה</Label>
          <Input
            id="acc-next" type={type} dir="ltr" autoComplete="new-password"
            aria-describedby="acc-next-rule" aria-invalid={Boolean(problem || same) || undefined}
            value={form.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
          />
          <p id="acc-next-rule" className={`text-xs ${problem || same ? 'text-red-600' : 'text-muted-foreground'}`}>
            {same ? 'הסיסמה החדשה זהה לנוכחית.' : problem ?? PASSWORD_RULE_TEXT}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="acc-confirm">הסיסמה החדשה שוב</Label>
          <Input
            id="acc-confirm" type={type} dir="ltr" autoComplete="new-password"
            aria-describedby={mismatch ? 'acc-confirm-error' : undefined} aria-invalid={mismatch || undefined}
            value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          />
          {mismatch && <p id="acc-confirm-error" className="text-xs text-red-600">הסיסמאות לא זהות.</p>}
        </div>

        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          הצגת הסיסמאות
        </label>

        {change.isError && (
          <p className="text-sm text-red-600" role="alert">
            {change.error instanceof Error ? change.error.message : 'שינוי הסיסמה נכשל'}
          </p>
        )}
        {done && (
          <p className="text-sm text-teal-700" role="status">הסיסמה שונתה. מעבירים אתכם לכניסה מחדש…</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="gap-1.5" disabled={!ready || change.isPending || done}>
            {change.isPending ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            שינוי סיסמה
          </Button>
          <p className="text-xs text-muted-foreground">אחרי השינוי תתבקשו להתחבר מחדש, בכל המכשירים.</p>
        </div>
      </form>
    </section>
  )
}
