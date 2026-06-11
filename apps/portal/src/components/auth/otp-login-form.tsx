'use client'

import { useState } from 'react'
import { Phone, ArrowLeft, RefreshCw } from 'lucide-react'

type Step = 'phone' | 'otp'

export function OtpLoginForm() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    // TODO: call /api/auth/send-otp
    await new Promise((r) => setTimeout(r, 1000))
    setIsLoading(false)
    setStep('otp')
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    // TODO: call /api/auth/verify-otp
    await new Promise((r) => setTimeout(r, 1000))
    setIsLoading(false)
    // redirect to dashboard
  }

  if (step === 'phone') {
    return (
      <form onSubmit={handleSendOtp} className="space-y-4">
        <div>
          <label className="form-label" htmlFor="phone">מספר טלפון</label>
          <div className="relative">
            <Phone size={16} className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-400" />
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 pe-9 text-sm text-right placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading || phone.length < 9}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-teal transition hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <>שלח קוד אימות</>
          )}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleVerifyOtp} className="space-y-4">
      <button
        type="button"
        onClick={() => setStep('phone')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
      >
        <ArrowLeft size={14} />
        חזור
      </button>

      <p className="text-sm text-gray-600 text-center">
        שלחנו קוד ל-<span className="font-medium text-teal-600" dir="ltr">{phone}</span>
      </p>

      <div>
        <label className="form-label" htmlFor="otp">קוד אימות</label>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
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
        className="w-full text-center text-sm text-gray-400 hover:text-teal-500 transition-colors"
        onClick={handleSendOtp}
      >
        לא קיבלת קוד? שלח שוב
      </button>
    </form>
  )
}
