'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, RefreshCw, Plus } from 'lucide-react'
import { TICKET_CATEGORIES } from '@/lib/support'

/**
 * Opens a support ticket.
 *
 * The mock's version set `sent = true` and discarded everything typed. This one
 * files a real ticket, and shows the server's own refusal when there is one —
 * "you already have several open" is a thing a resident needs to be told, not
 * a silent failure.
 */
const SELECTABLE = ['GENERAL', 'SIGNATURE', 'DOCUMENTS', 'MEETING', 'CONSTRUCTION', 'COMPENSATION', 'OTHER']

export function NewTicketForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('GENERAL')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const valid = subject.trim().length >= 3 && description.trim().length >= 10

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, description, category }),
    })
    setBusy(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body?.message ?? 'שליחת הפנייה נכשלה. נסו שוב.')
      return
    }
    setSubject('')
    setDescription('')
    setCategory('GENERAL')
    setOpen(false)
    startTransition(() => router.refresh())
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-teal transition hover:bg-teal-600"
      >
        <Plus size={16} />
        פנייה חדשה
      </button>
    )
  }

  return (
    <div className="card-surface space-y-3 p-5">
      <h2 className="text-base font-semibold text-gray-800">פנייה חדשה</h2>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div>
        <label htmlFor="ticket-category" className="form-label">נושא</label>
        <select
          id="ticket-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {SELECTABLE.map((key) => (
            <option key={key} value={key}>{TICKET_CATEGORIES[key]}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ticket-subject" className="form-label">כותרת</label>
        <input
          id="ticket-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          dir="rtl"
          placeholder="במשפט אחד — במה מדובר?"
          className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div>
        <label htmlFor="ticket-body" className="form-label">פירוט</label>
        <textarea
          id="ticket-body"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={5000}
          dir="rtl"
          placeholder="תארו את השאלה או הבעיה…"
          className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !valid}
          onClick={submit}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <RefreshCw size={15} className="animate-spin" /> : <><Send size={14} /> שליחה</>}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="rounded-lg px-4 py-2.5 text-sm text-gray-500 transition hover:bg-gray-100"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
