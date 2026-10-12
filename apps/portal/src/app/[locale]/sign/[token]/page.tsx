'use client'

/**
 * Resident signing experience — mobile-first, RTL Hebrew.
 *
 * Flow:
 *   1. LOADING   — verify token, load package info
 *   2. OTP_REQ   — show masked phone, request OTP button
 *   3. OTP_ENTRY — 6-digit OTP input with countdown and resend
 *   4. REVIEW    — display document details, legal disclaimer
 *   5. SIGNING   — confirm button ("אישור החתימה")
 *   6. SUCCESS   — confirmation with timestamp
 *   7. DECLINED  — confirmation of decline
 *   8. ERROR     — invalid/expired token or terminal error
 *
 * A FORM package (the representation-appointment protocol) leaves this flow
 * after LOADING for ProtocolSigning: the text, the code, then the signer's
 * own row and a drawn signature.
 *
 * API (public, no auth header):
 *   GET  /api/v1/signatures/portal/:token          — open session
 *   POST /api/v1/signatures/portal/:token/otp      — request OTP
 *   POST /api/v1/signatures/portal/:token/verify   — verify OTP
 *   POST /api/v1/signatures/portal/:token/sign     — execute signing
 *   POST /api/v1/signatures/portal/:token/decline  — decline
 */

import Image from 'next/image'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ProtocolSigning } from '@/components/forms/protocol-signing'
import { NoticeReading } from '@/components/forms/notice-reading'
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

  // A whole code, pasted or filled in by the phone from the SMS, is spread
  // across the boxes from where it landed: nobody has to retype a code digit
  // by digit (WCAG 2.2, 3.3.8). Only the first box takes more than one
  // character, for the phone's autofill; the others take a paste.
  function spread(idx: number, digits: string) {
    const next = (value.slice(0, idx) + digits).slice(0, 6)
    onChange(next)
    inputs.current[Math.min(next.length, 5)]?.focus()
  }

  function handleChange(idx: number, val: string) {
    const digits = val.replace(/\D/g, '')
    if (digits.length > 1) return spread(idx, digits)
    const digit = digits.slice(-1)
    const chars = value.split('')
    chars[idx]  = digit
    const next  = chars.join('').slice(0, 6)
    onChange(next)
    if (digit && idx < 5) inputs.current[idx + 1]?.focus()
  }

  function handlePaste(idx: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '')
    if (!digits) return
    e.preventDefault()
    spread(idx, digits)
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  return (
    <div role="group" aria-label="קוד אימות" className="flex gap-2 justify-center" dir="ltr">
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={el => { inputs.current[idx] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={idx === 0 ? 6 : 1}
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          aria-label={`ספרה ${idx + 1} מתוך 6`}
          value={value[idx] ?? ''}
          onChange={e => handleChange(idx, e.target.value)}
          onPaste={e => handlePaste(idx, e)}
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
  // Why a link cannot open, as the gateway names it: `CANCELLED` with the
  // package's form type titles the screen "ההודעה בוטלה" / "הטופס בוטל".
  const [errorKind,   setErrorKind]   = useState<{ code?: string; formType?: string | null } | null>(null)
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
      throw Object.assign(new Error(data.message ?? `שגיאת שרת ${res.status}`), {
        code: data.code as string | undefined,
        formType: data.formType as string | null | undefined,
      })
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
        setErrorKind({ code: err.code, formType: err.formType })
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
        setError('אחרי 5 ניסיונות הקוד נחסם. בקשו קוד חדש.')
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

  // A form (the representation protocol, the organizing agreement) is signed
  // with the signer's own row and a drawn signature, in its own steps; the
  // assembly notice is only read. Documents keep the flow below.
  if (sessionInfo?.form?.type === 'ASSEMBLY_NOTICE') return <NoticeReading initial={sessionInfo.form} />
  if (sessionInfo?.form) return <ProtocolSigning initial={sessionInfo.form} call={call} />

  return (
    <div
      dir="rtl"
      data-a11y-surface
      className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex flex-col items-center justify-start pt-10 pb-20 px-4"
    >
      {/* Logo / brand */}
      <div className="mb-8 flex items-center gap-2">
        {/* The first thing a resident sees from a link: the company's logo. */}
        <Image
          src="/brand/opendoor-logo.svg"
          alt="OpenDoor התחדשות עירונית"
          width={118}
          height={44}
          unoptimized
          className="h-11 w-auto"
        />
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
            <h2 className="text-lg font-bold text-gray-900">
              {errorKind?.code !== 'CANCELLED'
                ? 'הקישור לא זמין'
                : errorKind.formType === 'ASSEMBLY_NOTICE'
                  ? 'ההודעה בוטלה'
                  : errorKind.formType
                    ? 'הטופס בוטל'
                    : 'המסמך בוטל'}
            </h2>
            <p className="text-sm text-gray-500">{error ?? 'הקישור לא זמין כרגע.'}</p>
            <p className="text-xs text-gray-500 mt-2">
              שאלה? דברו איתנו:{' '}
              <a href="tel:+972548018613" dir="ltr" className="font-semibold text-teal-700">054-8018613</a>
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
              שליחת קוד אימות (עוד לא זמין)
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
                  ? <>קוד אימות לחתימה על<br /><span className="font-medium text-gray-700">{sessionInfo.packageTitle}</span><br />יישלח לטלפון או לאימייל שבתיק.</>
                  : 'קוד אימות יישלח לטלפון או לאימייל שבתיק.'
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
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {busy
                ? <RefreshCw size={16} className="animate-spin" />
                : 'שליחת קוד אימות'
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
              חזרה
            </button>

            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mb-2">
                <Shield className="text-teal-500" size={28} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">הזינו את קוד האימות</h2>
              <p className="text-sm text-gray-500">
                שלחנו לכם קוד אימות.
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
                  setError('תוקף הקוד הסתיים. בקשו קוד חדש.')
                }}
              />
            </div>

            <button
              onClick={verifyOtp}
              disabled={otp.length !== 6 || busy || otpExpired}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : 'אימות הקוד'}
            </button>

            <button
              onClick={requestOtp}
              disabled={busy}
              className="w-full text-center text-sm text-teal-600 hover:text-teal-700 disabled:opacity-60"
            >
              לא הגיע קוד? שליחה חוזרת
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
              <p className="text-sm text-gray-500">קראו את הפרטים לפני החתימה.</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3 text-sm">
              {sessionInfo?.packageTitle && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 shrink-0">מסמך:</span>
                  <span className="font-medium text-gray-800">{sessionInfo.packageTitle}</span>
                </div>
              )}
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
                לחיצה על "אישור החתימה" מהווה חתימה אלקטרונית מחייבת
                בהתאם לחוק חתימה אלקטרונית, התשס"א־2001.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            <button
              onClick={() => setStep('signing')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              המשך לחתימה
            </button>

            <button
              onClick={() => {
                const reason = prompt('סיבת הסירוב (לא חובה):') ?? 'declined'
                executeDecline(reason)
              }}
              disabled={busy}
              className="w-full text-center text-sm text-red-500 hover:text-red-700 disabled:opacity-60"
            >
              סירוב לחתימה
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
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-4 text-base font-bold text-white hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {busy
                ? <RefreshCw size={18} className="animate-spin" />
                : <>
                    <CheckCircle2 size={18} />
                    אישור החתימה
                  </>
              }
            </button>

            <button
              onClick={() => setStep('review')}
              disabled={busy}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
            >
              חזרה לעיון
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
              <h2 className="text-xl font-bold text-gray-900 mb-1">החתימה נקלטה</h2>
              <p className="text-sm text-gray-500">
                {sessionInfo?.packageTitle
                  ? <>חתמתם על <strong>{sessionInfo.packageTitle}</strong>.</>
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
                <span>אימות:</span>
                <span className="font-medium">קוד חד־פעמי</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              חתימה זו מוכרת בדין בהתאם לחוק חתימה אלקטרונית, התשס&quot;א־2001.
              שמרו עותק מהדף הזה לצרכיכם.
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
              <h2 className="text-xl font-bold text-gray-900 mb-1">הסירוב נרשם</h2>
              <p className="text-sm text-gray-500">
                רשמנו את הסירוב, ונציג שלנו יחזור אליכם בקרוב.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              שיניתם את דעתכם? דברו איתנו ונשלח קישור חדש:{' '}
              <a href="tel:+972548018613" dir="ltr" className="font-semibold text-teal-700">054-8018613</a>
            </p>
          </div>
        )}

      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400 text-center">
        מאובטח על ידי OpenDoor{step === 'error' || step === 'declined' ? '' : ' · חתימה אלקטרונית חוקית'}
      </p>
    </div>
  )
}
