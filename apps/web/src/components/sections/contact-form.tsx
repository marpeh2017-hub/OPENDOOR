'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

type FieldName = 'firstName' | 'lastName' | 'phone' | 'consent'
type FieldErrors = Partial<Record<FieldName, string>>

const inputClass =
  'w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
const errorInputClass = 'border-error-500'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1 flex items-center gap-1 text-xs text-error-700">
      <AlertCircle size={13} aria-hidden="true" />
      {message}
    </p>
  )
}

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Until React has hydrated, onSubmit is not attached and a click would fall
  // through to a native GET submit that silently discards the entry.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    setFieldErrors({})
    setFormError(null)

    const data = Object.fromEntries(new FormData(event.currentTarget))

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, consent: data.consent === 'on' }),
      })

      if (res.status === 422) {
        const { fieldErrors } = await res.json()
        setFieldErrors(fieldErrors ?? {})
        setFormError('נא לתקן את השדות המסומנים ולנסות שוב.')
        setStatus('idle')
        return
      }

      if (!res.ok) throw new Error(`status ${res.status}`)

      setStatus('success')
    } catch {
      setFormError(
        'שליחת הפרטים נכשלה. נא לנסות שוב, או להתקשר אלינו ישירות: 054-8018613',
      )
      setStatus('idle')
    }
  }

  if (status === 'success') {
    return (
      <div className="card-surface p-8 text-center" role="status">
        <CheckCircle2 size={44} className="mx-auto mb-4 text-teal-600" aria-hidden="true" />
        <h3 className="mb-2 text-lg font-bold text-gray-800">הפרטים התקבלו</h3>
        <p className="text-sm text-gray-600">
          תודה. ניצור איתך קשר בהקדם. לפנייה דחופה ניתן להתקשר ל־054-8018613.
        </p>
      </div>
    )
  }

  const submitting = status === 'submitting'

  return (
    <div className="card-surface p-8">
      <h3 className="mb-5 text-lg font-bold text-gray-800">השאר פרטים וניצור קשר</h3>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-error-500/30 bg-error-50 px-3 py-2.5 text-sm text-error-700"
          >
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {formError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label" htmlFor="firstName">
              שם פרטי <span className="text-error-700">*</span>
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              maxLength={60}
              aria-invalid={!!fieldErrors.firstName}
              aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
              className={`${inputClass} ${fieldErrors.firstName ? errorInputClass : ''}`}
              placeholder="ישראל"
            />
            <FieldError id="firstName-error" message={fieldErrors.firstName} />
          </div>

          <div>
            <label className="form-label" htmlFor="lastName">
              שם משפחה <span className="text-error-700">*</span>
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              maxLength={60}
              aria-invalid={!!fieldErrors.lastName}
              aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined}
              className={`${inputClass} ${fieldErrors.lastName ? errorInputClass : ''}`}
              placeholder="ישראלי"
            />
            <FieldError id="lastName-error" message={fieldErrors.lastName} />
          </div>
        </div>

        <div>
          <label className="form-label" htmlFor="phone">
            טלפון <span className="text-error-700">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            required
            autoComplete="tel"
            maxLength={25}
            aria-invalid={!!fieldErrors.phone}
            aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
            className={`${inputClass} text-right ${fieldErrors.phone ? errorInputClass : ''}`}
            placeholder="050-0000000"
          />
          <FieldError id="phone-error" message={fieldErrors.phone} />
        </div>

        <div>
          <label className="form-label" htmlFor="address">
            כתובת הנכס
          </label>
          <input
            id="address"
            name="address"
            type="text"
            autoComplete="street-address"
            maxLength={200}
            className={inputClass}
            placeholder="רחוב, מספר, עיר"
          />
        </div>

        <div>
          <label className="form-label" htmlFor="message">
            הודעה (אופציונלי)
          </label>
          <textarea
            id="message"
            name="message"
            rows={3}
            maxLength={2000}
            className={`${inputClass} resize-none`}
            placeholder="ספרו לנו על הנכס שלכם..."
          />
        </div>

        {/* Honeypot: hidden from users and assistive tech, bots fill it in. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div>
          <div className="flex items-start gap-2.5">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              required
              aria-invalid={!!fieldErrors.consent}
              aria-describedby={fieldErrors.consent ? 'consent-error' : undefined}
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border text-teal-600 focus:ring-2 focus:ring-teal-500"
            />
            <label htmlFor="consent" className="text-xs leading-relaxed text-gray-600">
              קראתי ואני מאשר/ת את{' '}
              <Link href="/terms" className="text-teal-600 underline">
                תנאי השימוש
              </Link>{' '}
              ואת{' '}
              <Link href="/privacy" className="text-teal-600 underline">
                מדיניות הפרטיות
              </Link>
              , ומסכים/ה שתיצרו איתי קשר בנוגע לפנייה זו.{' '}
              <span className="text-error-700">*</span>
            </label>
          </div>
          <FieldError id="consent-error" message={fieldErrors.consent} />
        </div>

        <button
          type="submit"
          disabled={submitting || !hydrated}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white shadow-teal transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {submitting ? 'שולח...' : 'שלח פרטים'}
        </button>
      </form>
    </div>
  )
}
