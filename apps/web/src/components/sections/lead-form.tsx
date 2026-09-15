'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Public lead-capture form for the marketing site.
 *
 * Posts straight to the CRM API — the marketing site has no backend of its own
 * and there is no intermediate review queue. Submitting to the API directly
 * (rather than through a Next route handler) is deliberate: it keeps the real
 * visitor IP visible to the API's per-IP rate limiter, which a server-side hop
 * would replace with this server's own address.
 *
 * The form owns two anti-spam mechanisms, both of which must match what
 * `PublicLeadsService` expects:
 *   1. A honeypot field, visually and programmatically hidden. A human never
 *      sees it; a bot fills it and the submission is silently discarded.
 *   2. `renderedAt`, stamped on mount, so a submission returned faster than a
 *      person could type is discarded.
 *
 * Neither is a security control — the API's rate limiter is the real ceiling.
 * A paid captcha service was deliberately not added; that is a cost decision
 * for the business to make.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const INTERESTS = [
  { value: 'DEMO',        label: 'הדגמה של המערכת' },
  { value: 'INFO',        label: 'מידע כללי' },
  { value: 'PARTNERSHIP', label: 'שיתוף פעולה' },
  { value: 'OTHER',       label: 'אחר' },
] as const

type Status = 'idle' | 'submitting' | 'success' | 'error'

interface FieldErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Mirrors the server DTO's pattern. The server remains authoritative. */
const PHONE_RE = /^(?:\+?972[-\s]?|0)(?:[23489]|5[0-9]|7[0-9])[-\s]?\d{3}[-\s]?\d{4}$/

export function LeadForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [emailValue, setEmail]    = useState('')
  const [phone, setPhone]         = useState('')
  const [city, setCity]           = useState('')
  const [interest, setInterest]   = useState<string>('DEMO')
  const [message, setMessage]     = useState('')
  /** Honeypot. Bound to state only so React does not warn about an uncontrolled input. */
  const [company, setCompany]     = useState('')

  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Stamped on mount, not on submit — this is the whole point of the check.
  const renderedAt = useRef<string>('')
  useEffect(() => {
    renderedAt.current = new Date().toISOString()
  }, [])

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (firstName.trim().length < 2) next.firstName = 'שם פרטי חייב להכיל לפחות 2 תווים'
    if (lastName.trim().length < 2)  next.lastName  = 'שם משפחה חייב להכיל לפחות 2 תווים'
    if (!EMAIL_RE.test(emailValue.trim())) next.email = 'כתובת אימייל אינה תקינה'
    if (phone.trim() && !PHONE_RE.test(phone.trim())) next.phone = 'מספר טלפון אינו תקין'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return

    setStatus('submitting')
    try {
      const res = await fetch(`${API_BASE}/api/v1/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName:  lastName.trim(),
          email:     emailValue.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(city.trim()  ? { city:  city.trim()  } : {}),
          interest,
          ...(message.trim() ? { message: message.trim() } : {}),
          // Sent verbatim; the server decides what it means.
          company,
          renderedAt: renderedAt.current,
        }),
      })

      if (res.status === 429) {
        setStatus('error')
        setFormError('נשלחו יותר מדי פניות מכתובת זו. נסו שוב בעוד מספר דקות.')
        return
      }
      if (!res.ok) {
        setStatus('error')
        setFormError('אירעה שגיאה בשליחת הטופס. נסו שוב, או כתבו לנו ישירות.')
        return
      }

      setStatus('success')
    } catch {
      setStatus('error')
      setFormError('לא הצלחנו להתחבר לשרת. בדקו את החיבור לאינטרנט ונסו שוב.')
    }
  }

  if (status === 'success') {
    return (
      <div
        className="rounded-2xl bg-white/10 p-8 text-center backdrop-blur"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path
              d="M7 14.5l4.5 4.5L21 9.5"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-xl font-bold text-white">תודה! הפנייה התקבלה</h3>
        <p className="text-sm text-white/80">
          נציג יחזור אליכם תוך 24 שעות. אין צורך לשלוח שוב.
        </p>
      </div>
    )
  }

  const inputClass = (hasError?: string) =>
    [
      'w-full rounded-xl px-4 py-3 text-sm text-gray-800 outline-none transition',
      'bg-white placeholder:text-gray-400',
      'focus:ring-2 focus:ring-white/70',
      hasError ? 'ring-2 ring-red-300' : '',
    ].join(' ')

  const labelClass = 'mb-1.5 block text-right text-xs font-medium text-white/80'
  const errorClass = 'mt-1 text-right text-xs text-red-100'

  return (
    <form onSubmit={handleSubmit} noValidate className="text-right" dir="rtl">
      {/*
        Honeypot. Hidden from sight AND from assistive technology, and removed
        from the tab order, so no human can reach it by any route.
      */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor="company">אל תמלאו שדה זה</label>
        <input
          id="company" name="company" type="text" tabIndex={-1}
          autoComplete="off" value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="lead-first-name">שם פרטי *</label>
          <input
            id="lead-first-name" type="text" value={firstName} autoComplete="given-name"
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass(errors.firstName)}
            placeholder="ישראל"
            aria-invalid={Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? 'err-first-name' : undefined}
          />
          {errors.firstName && <p id="err-first-name" className={errorClass}>{errors.firstName}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="lead-last-name">שם משפחה *</label>
          <input
            id="lead-last-name" type="text" value={lastName} autoComplete="family-name"
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass(errors.lastName)}
            placeholder="ישראלי"
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? 'err-last-name' : undefined}
          />
          {errors.lastName && <p id="err-last-name" className={errorClass}>{errors.lastName}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="lead-email">אימייל *</label>
          <input
            id="lead-email" type="email" value={emailValue} autoComplete="email" dir="ltr"
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass(errors.email)} text-left`}
            placeholder="israel@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'err-email' : undefined}
          />
          {errors.email && <p id="err-email" className={errorClass}>{errors.email}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="lead-phone">טלפון</label>
          <input
            id="lead-phone" type="tel" value={phone} autoComplete="tel" dir="ltr"
            onChange={(e) => setPhone(e.target.value)}
            className={`${inputClass(errors.phone)} text-left`}
            placeholder="050-1234567"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'err-phone' : undefined}
          />
          {errors.phone && <p id="err-phone" className={errorClass}>{errors.phone}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="lead-city">עיר</label>
          <input
            id="lead-city" type="text" value={city} autoComplete="address-level2"
            onChange={(e) => setCity(e.target.value)}
            className={inputClass()}
            placeholder="תל אביב"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="lead-interest">נושא הפנייה</label>
          <select
            id="lead-interest" value={interest}
            onChange={(e) => setInterest(e.target.value)}
            className={inputClass()}
          >
            {INTERESTS.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className={labelClass} htmlFor="lead-message">הודעה</label>
        <textarea
          id="lead-message" value={message} rows={3} maxLength={1000}
          onChange={(e) => setMessage(e.target.value)}
          className={`${inputClass()} resize-none`}
          placeholder="ספרו לנו בקצרה על הפרויקט שלכם"
        />
      </div>

      {formError && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-500/20 px-4 py-3 text-right text-sm text-white"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-5 w-full rounded-xl px-6 py-3.5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        style={{ background: '#1D6A6C' }}
      >
        {status === 'submitting' ? (
          <span className="flex items-center justify-center gap-2">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
            שולח…
          </span>
        ) : (
          'שלחו פנייה'
        )}
      </button>

      <p className="mt-3 text-right text-xs text-white/50">
        בשליחת הטופס אתם מאשרים שניצור אתכם קשר. הפרטים נשמרים לפי{' '}
        <a href="/he/privacy" className="underline hover:text-white/80">מדיניות הפרטיות</a>.
      </p>
    </form>
  )
}
