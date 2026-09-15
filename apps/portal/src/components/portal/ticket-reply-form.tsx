'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, RefreshCw } from 'lucide-react'

/**
 * Replies to one of the resident's own tickets.
 *
 * Unlike the reply box the messages page shipped with — which had no inbound
 * model behind it at all — this one writes a real `TicketReply` with
 * `authorResidentId` set. The column exists; the schema always intended a
 * two-way conversation here.
 *
 * A reply to a RESOLVED ticket reopens it, and the page says so afterwards,
 * because "that did not fix it" is the most important thing a support system
 * can be told and a resident should be able to see that it registered.
 */
export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/support/${ticketId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    setBusy(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.message ?? 'שליחת התגובה נכשלה.')
      return
    }
    setBody('')
    startTransition(() => router.refresh())
  }

  return (
    <div className="card-surface space-y-3 p-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={5000}
        dir="rtl"
        placeholder="כתבו תגובה…"
        aria-label="תגובה לפנייה"
        className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <button
        type="button"
        disabled={busy || body.trim().length === 0}
        onClick={submit}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <RefreshCw size={15} className="animate-spin" /> : <><Send size={14} /> שליחת תגובה</>}
      </button>
    </div>
  )
}
