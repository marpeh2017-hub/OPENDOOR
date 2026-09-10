'use client'

/**
 * Resident signing experience — mobile-first, RTL Hebrew.
 *
 * Flow:
 *   1. LOADING   — verify token, load package info
 *   2. OTP_REQ   — show masked phone, request OTP button
 *   3. OTP_ENTRY — 6-digit OTP input with countdown and resend
 *   4. REVIEW    — display document details, legal disclaimer
 *   5. SIGNING   — confirm button ("אני מאשר/ת")
 *   6. SUCCESS   — confirmation with timestamp
 *   7. DECLINED  — confirmation of decline
 *   8. ERROR     — invalid/expired token or terminal error
 *
 * API (public, no auth header):
 *   GET  /api/v1/signatures/portal/:token          — open session
 *   POST /api/v1/signatures/portal/:token/otp      — request OTP
 *   POST /api/v1/signatures/portal/:token/verify   — verify OTP
 *   POST /api/v1/signatures/portal/:token/sign     — execute signing
 *   POST /api/v1/signatures/portal/:token/decline  — decline
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, XCircle, RefreshCw, Phone, Shield,
  FileText, AlertTriangle, ChevronLeft,
} from 'lucide-react'

const OTP_EXPIRY_SEC = 300 // 5 minutes

type Step = 'loading' | 'order_blocked' | 'otp_req' | 'otp_entry' | 'review' | 'signing' | 'success' | 'declined' | 'error'

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  function handleChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const chars = value.split('')
    chars[idx]  = digit
    const next  = chars.join('').slice(0, 6)
    onChange(next)
    if (digit && idx < 5) inputs.current[idx + 1]?.focus()
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  return (
    <div className="flex gap-2 justify-center" dir="ltr">
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={el => { inputs.current[idx] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[idx] ?? ''}
          onChange={e => handleChange(idx, e.target.value)}
          onKeyDown={e => handleKeyDown(idx, e)}
          disabled={disabled}
          className={cn(
            'w-11 h-14 text-center text-xl font-bold rounded-xl border-2 bg-white focus:outline-none transition-colors',
            value[idx]
              ? 'border-teal-500 text-gray-900'
              : 'border-gray-200 text-gray-400',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      ))}
    </div>
  )
}

function Countdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    const t = setInterval(() => {
      setLeft(prev => {
        if (prev <= 1) { clearInterval(t); onExpire(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [seconds, onExpire])
  const m = Math.floor(left / 60)
  const s = left % 60
  return (
    <span className="tabular-nums text-sm text-muted-foreground">
      {m}:{s.toString().padStart(2, '0')}
    </span>
  )
}

export default function SignPage() {
  const params = useParams()
  const token  = params.token as string

  const [step,        setStep]        = useState<Step>('loading')
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [otp,         setOtp]         = useState('')
  const [otpSent,     setOtpSent]     = useState(false)
  const [otpExpired,  setOtpExpired]  = useState(false)
  const [attempts,    setAttempts]    = useState(0)
  const [busy,        setBusy]        = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [signedAt,    setSignedAt]    = useState<string | null>(null)

  const call = useCallback(async (path: string, method = 'GET', body?: any) => {
    /*
     * Same-origin, so the httpOnly session cookie travels with the request and
     * the proxy can forward it as `Authorization`. A resident who is signed in
     * gets their signature attributed to that authenticated identity as well as
     * to the link; one who is not is forwarded without it and follows exactly
     * the path they always did.
     */
    const res = await fetch(`/api/token-flow/sign/${token}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.message ?? `שגיאת שרת ${res.status}`)
    }
    return data
  }, [token])

  // Step 1: open session
  useEffect(() => {
    call('')
      .then(data => {
        setSessionInfo(data)
        // If signing order blocks this signer, show waiting state
        if (data.orderBlocked) {
          setStep('order_blocked')
        } else {
          setStep('otp_req')
        }
      })
      .catch(err => {
        setError(err.message)
        setStep('error')
      })
  }, [call])

  async function requestOtp() {
    setBusy(true)
    setError(null)
    setOtpExpired(false)
    try {
      await call('/otp', 'POST')
      setOtpSent(true)
      setOtp('')
      setStep('otp_entry')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      await call('/verify', 'POST', { code: otp })
      setStep('review')
    } catch (err: any) {
      setAttempts(a => a + 1)
      setError(err.message)
      if (attempts >= 4) {
        setError('חסמת את הגישה לאחר 5 ניסיונות — בקש קוד חדש')
        setStep('otp_req')
        setOtp('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function executeSign() {
    setBusy(true)
    setError(null)
    try {
      await call('/sign', 'POST')
      setSignedAt(new Date().toLocaleString('he-IL'))
      setStep('success')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function executeDecline(reason: string) {
    setBusy(true)
    setError(null)
    try {
      await call('/decline', 'POST', { reason })
      setStep('declined')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex flex-col items-center justify-start pt-10 pb-20 px-4"
    >
      {/* Logo / brand */}
      <div className="mb-8 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">OD</span>
        </div>
        <span className="font-bold text-gray-800">OpenDoor</span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">

        {/* ── LOADING ── */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <RefreshCw className="animate-spin text-teal-500" size={32} />
            <p className="text-sm text-gray-500">מאמת קישור...</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === 'error' && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="text-red-500" size={28} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">קישור לא תקין</h2>
            <p className="text-sm text-gray-500">{error ?? 'הקישור פג תוקף או אינו תקין.'}</p>
            <p className="text-xs text-gray-400 mt-2">
              פנה לחברת הניהול לקבלת קישור חדש.
            </p>
          </div>
        )}

        {/* ── ORDER BLOCKED ── */}
        {step === 'order_blocked' && (
          <div className="p-8 flex flex-col items-center gap-5 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mb-2">
              <AlertTriangle className="text-amber-500" size={28} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">ממתין לחתימה קודמת</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              חותם קודם טרם השלים את חתימתו. תקבלו הודעה כאשר תורכם יגיע.
            </p>
            {sessionInfo?.packageTitle && (
              <p className="text-xs text-gray-400">
                מסמך: <span className="font-medium text-gray-600">{sessionInfo.packageTitle}</span>
              </p>
            )}
            <button
              disabled
              className="w-full rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-400 cursor-not-allowed"
            >
              שלח קוד אימות (לא זמין עדיין)
            </button>
          </div>
        )}

        {/* ── OTP REQUEST ── */}
        {step === 'otp_req' && (
          <div className="p-8 flex flex-col gap-6">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mb-2">
                <Phone className="text-teal-500" size={28} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">אימות זהות</h2>
              <p className="text-sm text-gray-500">
                {sessionInfo?.packageTitle
                  ? <>נשלח קוד אימות לחתימה על<br /><span className="font-medium text-gray-700">{sessionInfo.packageTitle}</span></>
                  : 'נשלח קוד אימות לטלפון הרשום במערכת'
                }
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            <button
              onClick={requestOtp}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {busy
                ? <RefreshCw size={16} className="animate-spin" />
                : 'שלח קוד אימות'
              }
            </button>

            {sessionInfo?.expiresAt && (
              <p className="text-center text-xs text-gray-400">
                תוקף הקישור: {new Date(sessionInfo.expiresAt).toLocaleDateString('he-IL')}
              </p>
            )}
          </div>
        )}

        {/* ── OTP ENTRY ── */}
        {step === 'otp_entry' && (
          <div className="p-8 flex flex-col gap-6">
            <button
              onClick={() => { setStep('otp_req'); setOtp(''); setError(null) }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronLeft size={16} />
              חזור
            </button>

            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mb-2">
                <Shield className="text-teal-500" size={28} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">הזן קוד אימות</h2>
              <p className="text-sm text-gray-500">
                שלחנו קוד SMS לטלפון הרשום
              </p>
            </div>

            <OtpInput value={otp} onChange={setOtp} disabled={busy} />

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>תוקף הקוד:</span>
              <Countdown
                seconds={OTP_EXPIRY_SEC}
                onExpire={() => {
                  setOtpExpired(true)
                  setError('קוד OTP פג תוקף — בקש קוד חדש')
                }}
              />
            </div>

            <button
              onClick={verifyOtp}
              disabled={otp.length !== 6 || busy || otpExpired}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : 'אמת קוד'}
            </button>

            <button
              onClick={requestOtp}
              disabled={busy}
              className="w-full text-center text-sm text-teal-600 hover:text-teal-700 disabled:opacity-60"
            >
              לא קיבלת קוד? שלח שוב
            </button>
          </div>
        )}

        {/* ── REVIEW ── */}
        {step === 'review' && (
          <div className="p-8 flex flex-col gap-6">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                <FileText className="text-blue-500" size={28} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">עיון במסמך</h2>
              <p className="text-sm text-gray-500">אנא קרא את הפרטים לפני החתימה</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-gray-400 shrink-0">מסמך:</span>
                <span className="font-medium text-gray-800">{sessionInfo?.packageTitle ?? '—'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400 shrink-0">פרויקט:</span>
                <span className="font-medium text-gray-800">{sessionInfo?.packageId ?? '—'}</span>
              </div>
              {sessionInfo?.expiresAt && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 shrink-0">תוקף:</span>
                  <span className="font-medium text-gray-800">
                    {new Date(sessionInfo.expiresAt).toLocaleDateString('he-IL')}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">הצהרה משפטית</p>
              <p>
                לחיצה על "אני מאשר/ת את החתימה" מהווה חתימה אלקטרונית מחייבת
                בהתאם לחוק חתימה אלקטרונית, התשס"א-2001.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            <button
              onClick={() => setStep('signing')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-600 transition-colors"
            >
              אני מאשר/ת לחתום
            </button>

            <button
              onClick={() => {
                const reason = prompt('סיבת הסירוב (אופציונלי):') ?? 'declined'
                executeDecline(reason)
              }}
              disabled={busy}
              className="w-full text-center text-sm text-red-500 hover:text-red-700 disabled:opacity-60"
            >
              אני מסרב/ת לחתום
            </button>
          </div>
        )}

        {/* ── SIGNING CONFIRMATION ── */}
        {step === 'signing' && (
          <div className="p-8 flex flex-col gap-6">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mb-2">
                <Shield className="text-teal-500" size={28} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">אישור סופי</h2>
              <p className="text-sm text-gray-500">
                לחיצה על הכפתור תחתום דיגיטלית על המסמך
              </p>
            </div>

            <div className="rounded-xl border-2 border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 text-center font-medium">
              {sessionInfo?.packageTitle ?? 'מסמך לחתימה'}
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            <button
              onClick={executeSign}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-4 text-base font-bold text-white hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {busy
                ? <RefreshCw size={18} className="animate-spin" />
                : <>
                    <CheckCircle2 size={18} />
                    אני מאשר/ת את החתימה
                  </>
              }
            </button>

            <button
              onClick={() => setStep('review')}
              disabled={busy}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
            >
              חזור לעיון
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'success' && (
          <div className="p-8 flex flex-col items-center gap-5 text-center">
            <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="text-green-500" size={40} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">חתמת בהצלחה!</h2>
              <p className="text-sm text-gray-500">
                {sessionInfo?.packageTitle
                  ? <>חתמת על <strong>{sessionInfo.packageTitle}</strong></>
                  : 'המסמך נחתם בהצלחה'
                }
              </p>
            </div>
            <div className="w-full rounded-xl bg-green-50 border border-green-100 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>תאריך ושעה:</span>
                <span className="font-medium" dir="ltr">{signedAt}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>שיטת אימות:</span>
                <span className="font-medium">SMS OTP</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>ספק:</span>
                <span className="font-medium">OpenDoor NATIVE</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              חתימה זו מוכרת בדין בהתאם לחוק חתימה אלקטרונית, התשס&quot;א-2001.
              שמור עותק מדף זה לצרכיך.
            </p>
          </div>
        )}

        {/* ── DECLINED ── */}
        {step === 'declined' && (
          <div className="p-8 flex flex-col items-center gap-5 text-center">
            <div className="h-20 w-20 rounded-full bg-gray-50 flex items-center justify-center">
              <XCircle className="text-gray-400" size={40} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">סירבת לחתימה</h2>
              <p className="text-sm text-gray-500">
                הסירוב שלך נרשם במערכת. נציג יצור איתך קשר בקרוב.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              אם שינית את דעתך, פנה לחברת הניהול לקבלת קישור חתימה חדש.
            </p>
          </div>
        )}

      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400 text-center">
        מאובטח על ידי OpenDoor · חתימה אלקטרונית חוקית
      </p>
    </div>
  )
}
