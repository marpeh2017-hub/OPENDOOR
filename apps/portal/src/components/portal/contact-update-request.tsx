'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PencilLine, RefreshCw, Clock } from 'lucide-react'
import type { PortalProfile } from '@/lib/profile'

/**
 * Asks staff to change contact details the resident may not change themselves.
 *
 * ── WHY THERE IS NO EDIT FIELD FOR THE PHONE NUMBER ─────────────────────────
 *
 * The phone number is the login credential. A resident who could change it in
 * the app could also have it changed by anyone who got hold of their session
 * for five minutes — and that change would be permanent, because the new number
 * is then the one that receives the codes. Doing it properly means verifying
 * the NEW number by OTP before it takes effect, which does not exist yet.
 *
 * So this sends a message to a person instead. The human who reads it and
 * satisfies themselves about who is asking IS the control, and saying that
 * plainly is better than an edit field that silently does nothing.
 */
export function ContactUpdateRequest({
  pending,
}: {
  pending: PortalProfile['pendingContactRequest']
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (pending) {
    return (
      <div className="card-surface flex items-start gap-3 p-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50">
          <Clock size={15} className="text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">בקשת עדכון פרטים ממתינה</p>
          <p className="mt-0.5 text-xs text-gray-500">
            קיבלנו את הבקשה שלך ואנחנו מטפלים בה. ניצור איתך קשר בהקדם.
          </p>
        </div>
      </div>
    )
  }

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/profile/contact-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    setBusy(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body?.message ?? 'שליחת הבקשה נכשלה. נסו שוב.')
      return
    }
    setOpen(false)
    setMessage('')
    startTransition(() => router.refresh())
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card-surface flex w-full items-center gap-3 p-4 text-right transition-colors hover:bg-gray-50"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50">
          <PencilLine size={15} className="text-teal-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800">בקשת עדכון פרטי התקשרות</p>
          <p className="text-xs text-gray-400">
            שינוי טלפון או אימייל נעשה על ידי הצוות, לאבטחת החשבון שלך
          </p>
        </div>
      </button>
    )
  }

  return (
    <div className="card-surface space-y-3 p-4">
      <div>
        <p className="text-sm font-medium text-gray-800">בקשת עדכון פרטי התקשרות</p>
        <p className="mt-0.5 text-xs text-gray-500">
          כתבו מה לעדכן ונחזור אליכם. מספר הטלפון משמש גם לכניסה לפורטל, ולכן
          השינוי נעשה על ידי הצוות.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={1000}
        dir="rtl"
        placeholder="לדוגמה: החלפתי מספר טלפון, המספר החדש הוא…"
        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || message.trim().length < 5}
          onClick={submit}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <RefreshCw size={15} className="animate-spin" /> : 'שליחת הבקשה'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="rounded-lg px-4 py-2 text-sm text-gray-500 transition hover:bg-gray-100"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
