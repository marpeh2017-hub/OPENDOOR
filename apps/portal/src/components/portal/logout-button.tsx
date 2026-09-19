'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, RefreshCw } from 'lucide-react'

/**
 * Signs out.
 *
 * The mock's button did nothing. This one calls the route handler that revokes
 * the session upstream and clears both cookies — and then navigates rather than
 * refreshing, because after a sign-out there is nothing on this page left to
 * render.
 */
export function LogoutButton({ locale }: { locale: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        // Best-effort upstream, guaranteed locally — the route handler clears
        // the cookies whether or not the gateway answers.
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
        router.replace(`/${locale}/login`)
      }}
      className="card-surface flex w-full items-center justify-center gap-2 p-4 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-60"
    >
      {busy ? <RefreshCw size={16} className="animate-spin" /> : <LogOut size={16} />}
      התנתקות
    </button>
  )
}
