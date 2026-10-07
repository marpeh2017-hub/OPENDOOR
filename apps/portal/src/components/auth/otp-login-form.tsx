'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Mail, ArrowLeft, RefreshCw, Home } from 'lucide-react'

/**
 * Resident sign-in.
 *
 * ── THE THIRD STEP ──────────────────────────────────────────────────────────
 *
 * Sign-in is not always two steps. One phone number can match more than one
 * resident record — a spouse on two apartments, an owner in two projects — and
 * in that case the API answers with a list and NO session, because choosing
 * between two people's files is not a decision the server is allowed to make on
 * a coin flip. So this form has three states, and the third one is not an error
 * path: it is a normal way for a legitimate resident to sign in.
 *
 * ── PHONE OR EMAIL ──────────────────────────────────────────────────────────
 *
 * The code can go to a phone or to an email address on the resident's file.
 * The two differ only in where the code is sent and in the wording; the code
 * step and the selection step are the same. The API answers the email request
 * the same way whether or not the address is registered, so the code step
 * says "if it is registered" rather than promising a message.
 *
 * No token is stored here. The session arrives as httpOnly cookies set by the
 * same-origin route handlers, which client-side JavaScript cannot read.
 */
type Step = 'start' | 'otp' | 'select'
type Method = 'phone' | 'email'

interface SelectionOption {
  residentId: string
  projectName: string
  buildingAddress: string
  apartmentNumber: string
}

/** Enough to send, not a full validation: the API has the last word. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function OtpLoginForm({ locale = 'he' }: { locale?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('start')
  const [method, setMethod] = useState<Method>('phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<SelectionOption[]>([])
  const [selectionToken, setSelectionToken] = useState('')

  /** The API wants 05XXXXXXXX; people type dashes and spaces. */
  const normalisedPhone = phone.replace(/\D/g, '')
  const trimmedEmail = email.trim()
  const canSend = method === 'phone' ? normalisedPhone.length === 10 : LOOKS_LIKE_EMAIL.test(trimmedEmail)

  const post = async (path: string, body: unknown) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  }

  const chooseMethod = (next: Method) => {
    setMethod(next)
    setError(null)
  }

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    setIsLoading(true)
    const { ok, data } = method === 'phone'
      ? await post('/api/auth/otp/send', { phone: normalisedPhone })
      : await post('/api/auth/otp/email/send', { email: trimmedEmail })
    setIsLoading(false)

    if (!ok) {
      setError(data?.message ?? 'שליחת הקוד נכשלה. נסו שוב.')
      return
    }
    setStep('otp')
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    const { ok, data } = method === 'phone'
      ? await post('/api/auth/otp/verify', { phone: normalisedPhone, code: otp })
      : await post('/api/auth/otp/email/verify', { email: trimmedEmail, code: otp })
    setIsLoading(false)

    if (!ok) {
      setError(data?.message ?? 'הקוד שגוי או שפג תוקפו.')
      return
    }

    // Verified the handset or inbox, but it matches more than one record.
    if (data.selectionRequired) {
      setOptions(data.options ?? [])
      setSelectionToken(data.selectionToken)
      setStep('select')
      return
    }

    router.replace(`/${locale}/dashboard`)
  }

  async function handleSelect(residentId: string) {
    setError(null)
    setIsLoading(true)
    const { ok, data } = await post('/api/auth/select', { selectionToken, residentId })
    setIsLoading(false)

    if (!ok) {
      // The challenge is short-lived and single-use; expiry means starting over.
      setError(data?.message ?? 'הבחירה נכשלה. התחילו מחדש.')
      setStep('start')
      setOtp('')
      return
    }
    router.replace(`/${locale}/dashboard`)
  }

  const errorBanner = error && (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
      {error}
    </p>
  )

  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2.5 pe-9 text-sm text-right placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent'

  if (step === 'start') {
    return (
      <form onSubmit={handleSendOtp} className="space-y-4">
        {errorBanner}
        <div role="radiogroup" aria-label="איך לשלוח את הקוד" className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          {([
            ['phone', 'טלפון', Phone],
            ['email', 'אימייל', Mail],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={method === value}
              onClick={() => chooseMethod(value)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition ${
                method === value ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {method === 'phone' ? (
          <div>
            <label className="form-label" htmlFor="phone">מספר טלפון</label>
            <div className="relative">
              <Phone size={16} className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-400" />
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-0000000"
                className={inputClass}
                required
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="form-label" htmlFor="email">כתובת אימייל</label>
            <div className="relative">
              <Mail size={16} className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-400" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={inputClass}
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">הכתובת שרשומה אצלנו בתיק שלכם.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !canSend}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-teal transition hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <>שלח קוד אימות</>}
        </button>
      </form>
    )
  }

  if (step === 'select') {
    return (
      <div className="space-y-4">
        {errorBanner}
        <div>
          <p className="text-sm font-semibold text-gray-800">לאיזו דירה להיכנס?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {method === 'phone'
              ? 'מצאנו יותר מרשומה אחת המשויכת למספר הזה.'
              : 'מצאנו יותר מרשומה אחת המשויכת לכתובת הזאת.'}
          </p>
        </div>
        <ul className="space-y-2">
          {options.map((option) => (
            <li key={option.residentId}>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleSelect(option.residentId)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-white px-3 py-3 text-right transition hover:border-teal-400 hover:bg-teal-50 disabled:opacity-60"
              >
                <Home size={18} className="flex-shrink-0 text-teal-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800">
                    {option.buildingAddress} · דירה {option.apartmentNumber}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{option.projectName}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <form onSubmit={handleVerifyOtp} className="space-y-4">
      {errorBanner}
      <button
        type="button"
        onClick={() => { setStep('start'); setOtp(''); setError(null) }}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
      >
        <ArrowLeft size={14} />
        חזור
      </button>

      <p className="text-sm text-gray-600 text-center">
        {method === 'phone' ? (
          <>שלחנו קוד ל-<span className="font-medium text-teal-600" dir="ltr">{phone}</span></>
        ) : (
          <>
            אם הכתובת <span className="font-medium text-teal-600" dir="ltr">{trimmedEmail}</span> רשומה
            אצלנו, שלחנו אליה קוד. בדקו גם בתיקיית הספאם.
          </>
        )}
      </p>

      <div>
        <label className="form-label" htmlFor="otp">קוד אימות</label>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          dir="ltr"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-center text-xl font-bold tracking-widest placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || otp.length < 6}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-teal transition hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? <RefreshCw size={16} className="animate-spin" /> : 'כניסה'}
      </button>

      <button
        type="button"
        disabled={isLoading}
        className="w-full text-center text-sm text-gray-400 hover:text-teal-500 transition-colors"
        onClick={() => handleSendOtp()}
      >
        לא קיבלת קוד? שלח שוב
      </button>
    </form>
  )
}
