import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = { title: 'שכחת סיסמה' }

/**
 * Where "שכחת סיסמה?" on the sign-in page leads. It used to lead nowhere.
 *
 * There is no self-service reset: that would need the CRM to send email,
 * which it does not. What works is an admin setting a temporary password from
 * the users list in Settings, so the page says that, and what to do when the
 * person who forgot is the only admin. When email sending exists, this page
 * becomes the reset form.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FCFCFB] px-4 py-12">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-7">
        <Image
          src="/brand/opendoor-logo.svg"
          alt="OpenDoor התחדשות עירונית"
          width={194}
          height={72}
          priority
          unoptimized
          className="h-[72px] w-auto"
        />

        <div className="w-full space-y-4 rounded-2xl border border-border bg-white p-8" dir="rtl">
          <h1 className="text-2xl font-extrabold text-foreground">שכחתם את הסיסמה?</h1>
          <p className="text-sm leading-relaxed text-foreground">
            מנהל המערכת בחברה יכול לקבוע לכם סיסמה זמנית, בהגדרות, ברשימת המשתמשים. אחרי הכניסה,
            החליפו אותה בהגדרות › החשבון שלי.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            אם אתם מנהל המערכת היחיד, פנו למי שמתחזק את המערכת.
          </p>
          <Link
            href="/he/login"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 hover:underline"
          >
            חזרה לכניסה
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} OpenDoor Group · קבוצת אופן דור יזמות והתחדשות בע״מ
        </p>
      </div>
    </div>
  )
}
