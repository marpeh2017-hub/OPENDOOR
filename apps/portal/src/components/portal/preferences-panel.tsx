'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Globe, MessageCircle, Smartphone, Mail, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CHANNEL_LABELS, LANGUAGE_LABELS,
  type EditablePreferences, type PortalProfile,
} from '@/lib/profile'

/**
 * The five things a resident may change about themselves.
 *
 * ── WHY EACH TOGGLE SAVES ON ITS OWN ────────────────────────────────────────
 *
 * There is no Save button, because there is no draft state worth having: these
 * are five independent facts, and a resident who switches SMS off and closes
 * the app has expressed a preference whether or not they found a button. The
 * cost is a request per toggle, which is the right trade for a consent setting.
 *
 * The optimistic value is reverted if the request fails, so the switch never
 * shows a state the server did not accept — a consent toggle that LOOKS off
 * while the database says on is exactly the disagreement that ends up in a
 * complaint.
 */
export function PreferencesPanel({ preferences }: { preferences: PortalProfile['preferences'] }) {
  const router = useRouter()
  const [values, setValues] = useState(preferences)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function save(patch: EditablePreferences, field: string) {
    const previous = values
    setValues((v) => ({ ...v, ...patch }))
    setSaving(field)
    setError(null)

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSaving(null)

    if (!res.ok) {
      setValues(previous)
      const body = await res.json().catch(() => ({}))
      setError(body?.message ?? 'העדכון נכשל. נסו שוב.')
      return
    }
    // The server component holds the same values; refresh so a reload does not
    // show something older than what is on screen.
    startTransition(() => router.refresh())
  }

  const consent: { key: keyof EditablePreferences; label: string; sub: string; icon: typeof Bell }[] = [
    { key: 'whatsappOptIn', label: 'WhatsApp', sub: 'עדכונים והזמנות', icon: MessageCircle },
    { key: 'smsOptIn', label: 'SMS', sub: 'תזכורות והודעות', icon: Smartphone },
    { key: 'emailOptIn', label: 'אימייל', sub: 'מסמכים וסיכומים', icon: Mail },
  ]

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div className="card-surface overflow-hidden">
        <div className="border-b border-border bg-gray-50/50 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">איך ליצור איתך קשר</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            ההסכמה שלך, ואפשר לשנות אותה בכל רגע
          </p>
        </div>
        <div className="divide-y divide-border">
          {consent.map(({ key, label, sub, icon: Icon }) => (
            <div key={key} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <Icon size={15} className="text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
              {saving === key
                ? <RefreshCw size={16} className="animate-spin text-gray-300" />
                : (
                  <Toggle
                    checked={Boolean(values[key])}
                    label={label}
                    onChange={() => save({ [key]: !values[key] } as EditablePreferences, key)}
                  />
                )}
            </div>
          ))}
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="border-b border-border bg-gray-50/50 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">העדפות</h2>
        </div>
        <div className="divide-y divide-border">
          <SelectRow
            icon={Globe}
            label="שפה"
            value={values.language}
            options={LANGUAGE_LABELS}
            busy={saving === 'language'}
            onChange={(v) => save({ language: v }, 'language')}
          />
          <SelectRow
            icon={Bell}
            label="ערוץ מועדף"
            value={values.preferredChannel}
            options={CHANNEL_LABELS}
            busy={saving === 'preferredChannel'}
            onChange={(v) => save({ preferredChannel: v }, 'preferredChannel')}
          />
        </div>
      </div>
    </div>
  )
}

function SelectRow({
  icon: Icon, label, value, options, busy, onChange,
}: {
  icon: typeof Bell
  label: string
  value: string
  options: Record<string, string>
  busy: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
        <Icon size={15} className="text-gray-500" />
      </div>
      <label htmlFor={`pref-${label}`} className="min-w-0 flex-1 text-sm font-medium text-gray-800">
        {label}
      </label>
      {busy && <RefreshCw size={14} className="animate-spin text-gray-300" />}
      <select
        id={`pref-${label}`}
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
      >
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>{text}</option>
        ))}
      </select>
    </div>
  )
}

function Toggle({
  checked, label, onChange,
}: {
  checked: boolean
  label: string
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'relative h-5 w-9 flex-shrink-0 rounded-full transition-colors',
        checked ? 'bg-teal-500' : 'bg-gray-300',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
