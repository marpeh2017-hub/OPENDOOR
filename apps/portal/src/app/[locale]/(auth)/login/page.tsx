import Image from 'next/image'
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
    // The whole screen is the login task, so it is one <main> rather than a
    // <main> nested inside a bare wrapper div — nothing on this page sits
    // outside a landmark.
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#FCFCFB] px-4 py-10">
      {/* The company's own logo, the website's (2026-10-07). It carries the
          name, so the page's heading is the task: signing in. */}
      <Image
        src="/brand/opendoor-logo.svg"
        alt="OpenDoor התחדשות עירונית"
        width={167}
        height={62}
        priority
        unoptimized
        className="mb-7 h-[62px] w-auto"
      />

      {/* Login Card: white on the off-white page, as on the CRM's sign-in.
          The shared card-surface is grey, made for cards on a white page. */}
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-white p-8">
          {notice && (
            <p role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {notice}
            </p>
          )}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-extrabold text-gray-800">כניסה לאזור האישי</h1>
            <p className="text-sm text-gray-600 mt-1.5">
              נשלח קוד חד-פעמי לטלפון או לאימייל שרשומים בתיק שלכם.
            </p>
          </div>
          <OtpLoginForm locale={locale} />
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          הטלפון או האימייל שלכם לא רשומים אצלנו?{' '}
          <a href={`/${locale}/register`} className="font-medium text-teal-700 underline">
            הרשמה לאזור האישי
          </a>
        </p>

        <p className="mt-4 text-center text-xs text-gray-600">
          בכניסה אתם מאשרים את{' '}
          <a href={`/${locale}/terms`} className="text-teal-700 underline">תנאי השימוש</a>
          {' '}ואת{' '}
          <a href={`/${locale}/privacy`} className="text-teal-700 underline">מדיניות הפרטיות</a>
        </p>
      </div>
    </main>
  )
}
