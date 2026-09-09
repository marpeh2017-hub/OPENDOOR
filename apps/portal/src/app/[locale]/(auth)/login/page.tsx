import { Shield } from 'lucide-react'
import { OtpLoginForm } from '@/components/auth/otp-login-form'

/**
 * `reason` is set when a page bounced the visitor back here: the session
 * expired, or the resident's placement changed since it was issued. Saying
 * which is the difference between "sign in again" and a person wondering why
 * the app logged them out for no reason.
 */
const REASONS: Record<string, string> = {
  PORTAL_SCOPE_CHANGED: 'פרטי הדירה שלך עודכנו מאז ההתחברות. יש להתחבר מחדש.',
  RESIDENT_NOT_FOUND: 'הפרופיל אינו זמין עוד. פנו אלינו אם זו טעות.',
  PORTAL_SESSION_INVALID: 'ההתחברות פגה. יש להתחבר מחדש.',
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ reason?: string }>
}) {
  const { locale } = await params
  const { reason } = await searchParams
  const notice = reason ? REASONS[reason] ?? 'ההתחברות פגה. יש להתחבר מחדש.' : null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500 shadow-teal">
          <Shield size={32} className="text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">OpenDoor</h1>
          <p className="text-sm text-gray-500">התחדשות עירונית</p>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm">
        <div className="card-surface p-8">
          {notice && (
            <p role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {notice}
            </p>
          )}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-gray-800">כניסה לפורטל</h2>
            <p className="text-sm text-gray-500 mt-1">
              הזן את מספר הטלפון שלך לקבלת קוד אימות
            </p>
          </div>
          <OtpLoginForm locale={locale} />
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          בכניסה לפורטל אתה מאשר את{' '}
          <a href="/terms" className="underline">תנאי השימוש</a>
          {' '}ואת{' '}
          <a href="/privacy" className="underline">מדיניות הפרטיות</a>
        </p>
      </div>
    </div>
  )
}
