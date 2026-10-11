'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react'
import { isValidIsraeliId } from '@/lib/utils'

/**
 * Asking for the personal area: the owner's choice (2026-10-10) of "request,
 * and we approve".
 *
 * Sign-in finds a person by the phone or email on their resident file, so
 * somebody without one cannot get in. Here they leave their details, confirm
 * their phone with a code (or their email, when the system cannot text), and
 * wait for staff to put them on their apartment. Then they sign in like
 * everyone else.
 *
 * It talks to the gateway's public routes directly, as the website's forms
 * do: no session is involved, so there is no cookie to keep on this origin.
 */
type Step = 'details' | 'code' | 'done' | 'already'
type Relation = 'OWNER' | 'FAMILY' | 'TENANT'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '')
const PRIVACY_POLICY_VERSION = '2026-09-08'
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RELATIONS: { value: Relation; label: string }[] = [
  { value: 'OWNER', label: 'בעל/ת הדירה' },
  { value: 'FAMILY', label: 'בן/בת משפחה של בעל/ת הדירה' },
  { value: 'TENANT', label: 'שוכר/ת' },
]

interface Details {
  fullName: string
  phone: string
  email: string
  address: string
  city: string
  apartmentNumber: string
  idNumber: string
}

const EMPTY: Details = { fullName: '', phone: '', email: '', address: '', city: '', apartmentNumber: '', idNumber: '' }

/** Where focus goes for each problem, so a failed send lands on the first one. */
const FOCUS_IDS: Record<string, string> = {
  fullName: 'reg-fullName',
  phone: 'reg-phone',
  email: 'reg-email',
  address: 'reg-address',
  apartmentNumber: 'reg-apartment',
  city: 'reg-city',
  relation: 'reg-relation-OWNER',
  idNumber: 'reg-idNumber',
  consent: 'reg-consentContact',
}

export function RegisterForm({ locale = 'he' }: { locale?: string }) {
  const [identity] = useState(() => ({ submissionId: crypto.randomUUID(), renderedAt: new Date().toISOString() }))
  const [step, setStep] = useState<Step>('details')
  const [details, setDetails] = useState<Details>(EMPTY)
  const [relation, setRelation] = useState<Relation | null>(null)
  const [consentContact, setConsentContact] = useState(false)
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [company, setCompany] = useState('')
  const [emailRequired, setEmailRequired] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof Details | 'relation' | 'consent', string>>>({})
  const [sentTo, setSentTo] = useState<{ channel: 'SMS' | 'EMAIL'; to: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [focusOn, setFocusOn] = useState<{ key: string } | null>(null)

  useEffect(() => {
    if (focusOn) document.getElementById(FOCUS_IDS[focusOn.key] ?? '')?.focus()
  }, [focusOn])

  const phone = details.phone.replace(/\D/g, '')
  const email = details.email.trim()
  const set = (key: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDetails({ ...details, [key]: e.target.value })

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${API_BASE}/api/v1/public/portal-registrations${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  }

  function validate(): boolean {
    const next: typeof errors = {}
    if (details.fullName.trim().length < 2) next.fullName = 'צריך שם מלא.'
    if (!/^05\d{8}$/.test(phone)) next.phone = 'צריך מספר נייד, 10 ספרות שמתחילות ב־05.'
    if (email && !LOOKS_LIKE_EMAIL.test(email)) next.email = 'כתובת האימייל אינה תקינה.'
    if (emailRequired && !email) next.email = 'כדי לקבל קוד, הוסיפו כתובת אימייל.'
    if (details.address.trim().length < 2) next.address = 'צריך את כתובת הבניין.'
    if (!details.apartmentNumber.trim()) next.apartmentNumber = 'צריך מספר דירה.'
    if (details.city.trim().length < 2) next.city = 'צריך עיר.'
    if (!relation) next.relation = 'בחרו מה הקשר שלכם לדירה.'
    if (details.idNumber.trim() && !isValidIsraeliId(details.idNumber)) next.idNumber = 'מספר תעודת הזהות אינו תקין. בדקו את הספרות.'
    if (!consentContact || !consentPrivacy) next.consent = 'צריך לאשר את שני הסעיפים.'
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) setFocusOn({ key: first })
    return !first
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setFailure(null)
    if (step === 'details' && !validate()) return
    setBusy(true)
    try {
      const { ok, data } = await post('/code', {
        phone,
        ...(email ? { email } : {}),
        renderedAt: identity.renderedAt,
        company,
      })
      if (!ok) {
        if (data?.code === 'EMAIL_REQUIRED') {
          setEmailRequired(true)
          setErrors({ email: data.message })
          setStep('details')
          setFocusOn({ key: 'email' })
          return
        }
        setFailure(data?.message ?? 'שליחת הקוד נכשלה. נסו שוב.')
        return
      }
      setSentTo({ channel: data.channel, to: data.sentTo })
      setCode('')
      setStep('code')
    } catch {
      setFailure('שליחת הקוד נכשלה. בדקו את החיבור ונסו שוב.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFailure(null)
    setBusy(true)
    try {
      const { ok, data } = await post('', {
        submissionId: identity.submissionId,
        renderedAt: identity.renderedAt,
        company,
        locale: locale === 'en' ? 'en' : 'he',
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        consentContact: true,
        consentPrivacy: true,
        fullName: details.fullName.trim(),
        phone,
        email,
        idNumber: details.idNumber.trim(),
        address: details.address.trim(),
        city: details.city.trim(),
        apartmentNumber: details.apartmentNumber.trim(),
        relation,
        code,
      })
      if (!ok) {
        const message = Array.isArray(data?.message) ? data.message[0] : data?.message
        setFailure(message ?? 'הבקשה לא נשלחה. נסו שוב.')
        return
      }
      setStep(data.status === 'ALREADY_REGISTERED' ? 'already' : 'done')
    } catch {
      setFailure('הבקשה לא נשלחה. בדקו את החיבור ונסו שוב.')
    } finally {
      setBusy(false)
    }
  }

  const failureBanner = failure && (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
      {failure}
    </p>
  )
  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent aria-[invalid=true]:border-red-400'
  const buttonClass =
    'flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-teal transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60'
  const fieldError = (key: keyof typeof errors) =>
    errors[key] ? (
      <p id={`reg-${key}-error`} className="mt-1 text-xs text-red-700">
        {errors[key]}
      </p>
    ) : null
  const describedBy = (key: keyof typeof errors, hint?: string) =>
    [hint, errors[key] ? `reg-${key}-error` : null].filter(Boolean).join(' ') || undefined

  if (step === 'done' || step === 'already') {
    return (
      <div className="space-y-4 text-center" role="status">
        <CheckCircle2 size={40} aria-hidden="true" className="mx-auto text-teal-600" />
        <h2 className="text-lg font-bold text-gray-800">
          {step === 'done' ? 'הבקשה התקבלה' : 'אתם כבר רשומים'}
        </h2>
        <p className="text-sm text-gray-600">
          {step === 'done'
            ? 'נבדוק את הפרטים ונצרף אתכם לדירה. כשהבקשה תאושר נודיע לכם, ותוכלו להיכנס עם הטלפון או האימייל שלכם.'
            : 'הטלפון הזה כבר רשום אצלנו, ואפשר להיכנס איתו עכשיו.'}
        </p>
        <Link href={`/${locale}/login`} className={buttonClass}>
          לדף הכניסה
        </Link>
      </div>
    )
  }

  if (step === 'code' && sentTo) {
    return (
      <form onSubmit={submit} className="space-y-4">
        {failureBanner}
        <button
          type="button"
          onClick={() => { setStep('details'); setFailure(null) }}
          className="flex min-h-11 items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
        >
          <ArrowRight size={14} aria-hidden="true" />
          חזרה לפרטים
        </button>
        <p className="text-center text-sm text-gray-600">
          {sentTo.channel === 'SMS' ? (
            <>שלחנו קוד ל־<span className="font-medium text-teal-700" dir="ltr">{sentTo.to}</span></>
          ) : (
            <>
              שלחנו קוד לכתובת <span className="font-medium text-teal-700" dir="ltr">{sentTo.to}</span>. בדקו גם
              בתיקיית הספאם.
            </>
          )}
        </p>
        <div>
          <label className="form-label" htmlFor="reg-code">קוד אימות</label>
          <input
            id="reg-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-center text-xl font-bold tracking-widest placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            required
          />
        </div>
        <button type="submit" disabled={busy || code.length < 6} className={buttonClass}>
          {busy ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : 'שליחת הבקשה'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => sendCode()}
          className="w-full text-center text-sm text-gray-600 transition-colors hover:text-teal-700"
        >
          לא קיבלתם קוד? שלחו שוב
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={sendCode} noValidate className="space-y-4">
      {failureBanner}

      <div>
        <label className="form-label" htmlFor="reg-fullName">שם מלא</label>
        <input id="reg-fullName" autoComplete="name" maxLength={120} value={details.fullName} onChange={set('fullName')}
          aria-invalid={Boolean(errors.fullName)} aria-describedby={describedBy('fullName')} className={inputClass} />
        {fieldError('fullName')}
      </div>

      <div>
        <label className="form-label" htmlFor="reg-phone">טלפון נייד</label>
        <input id="reg-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="050-0000000"
          value={details.phone} onChange={set('phone')} aria-invalid={Boolean(errors.phone)}
          aria-describedby={describedBy('phone')} className={`${inputClass} text-right`} />
        {fieldError('phone')}
      </div>

      <div>
        <label className="form-label" htmlFor="reg-email">
          אימייל{!emailRequired && <span className="ms-1 font-normal text-gray-500">(לא חובה)</span>}
        </label>
        <input id="reg-email" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder="name@example.com"
          value={details.email} onChange={set('email')} aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy('email')} className={`${inputClass} text-right`} />
        {fieldError('email')}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
        <div>
          <label className="form-label" htmlFor="reg-address">כתובת הבניין</label>
          <input id="reg-address" autoComplete="street-address" maxLength={200} placeholder="רחוב ומספר"
            value={details.address} onChange={set('address')} aria-invalid={Boolean(errors.address)}
            aria-describedby={describedBy('address')} className={inputClass} />
          {fieldError('address')}
        </div>
        <div>
          <label className="form-label" htmlFor="reg-apartment">דירה</label>
          <input id="reg-apartment" inputMode="numeric" maxLength={10} value={details.apartmentNumber}
            onChange={set('apartmentNumber')} aria-invalid={Boolean(errors.apartmentNumber)}
            aria-describedby={describedBy('apartmentNumber')} className={inputClass} />
          {fieldError('apartmentNumber')}
        </div>
      </div>

      <div>
        <label className="form-label" htmlFor="reg-city">עיר</label>
        <input id="reg-city" autoComplete="address-level2" maxLength={80} value={details.city} onChange={set('city')}
          aria-invalid={Boolean(errors.city)} aria-describedby={describedBy('city')} className={inputClass} />
        {fieldError('city')}
      </div>

      <fieldset aria-describedby={errors.relation ? 'reg-relation-error' : undefined}>
        <legend className="form-label">הקשר שלכם לדירה</legend>
        <div className="space-y-1">
          {RELATIONS.map((option) => (
            <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-gray-800">
              <input
                id={`reg-relation-${option.value}`}
                type="radio"
                name="relation"
                value={option.value}
                checked={relation === option.value}
                onChange={() => setRelation(option.value)}
                className="h-4 w-4 accent-teal-600"
              />
              {option.label}
            </label>
          ))}
        </div>
        {fieldError('relation')}
      </fieldset>

      <div>
        <label className="form-label" htmlFor="reg-idNumber">
          ת.ז<span className="ms-1 font-normal text-gray-500">(לא חובה)</span>
        </label>
        <input id="reg-idNumber" inputMode="numeric" dir="ltr" maxLength={12} value={details.idNumber}
          onChange={set('idNumber')} aria-invalid={Boolean(errors.idNumber)}
          aria-describedby={describedBy('idNumber', 'reg-idNumber-hint')} className={`${inputClass} text-right`} />
        <p id="reg-idNumber-hint" className="mt-1 text-xs text-gray-500">עוזר לנו לאמת את הבעלות מול נסח הטאבו.</p>
        {fieldError('idNumber')}
      </div>

      <div aria-hidden="true" className="absolute start-[-10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="reg-company">Company</label>
        <input id="reg-company" name="company" type="text" tabIndex={-1} autoComplete="off" value={company}
          onChange={(e) => setCompany(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-gray-700">
          <input id="reg-consentContact" type="checkbox" checked={consentContact} onChange={(e) => setConsentContact(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" />
          אני מסכים/ה שחברת OpenDoor Group תחזור אליי בנוגע לפנייה.
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-gray-700">
          <input type="checkbox" checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" />
          <span>
            קראתי ואני מאשר/ת את{' '}
            <a href={`/${locale}/privacy`} className="text-teal-700 underline">מדיניות הפרטיות</a>
          </span>
        </label>
        {fieldError('consent')}
      </div>

      <button type="submit" disabled={busy} className={buttonClass}>
        {busy ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : 'שליחת קוד אימות'}
      </button>
    </form>
  )
}
