import { Metadata } from 'next'
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
            <span className="text-white text-2xl font-black">OD</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">OpenDoor CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">מערכת ניהול התחדשות עירונית</p>
        </div>

        <div className="card-surface p-8 space-y-4" dir="rtl">
          <h2 className="text-xl font-bold text-foreground">שכחתם את הסיסמה?</h2>
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
          © {new Date().getFullYear()} OpenDoor התחדשות עירונית · כל הזכויות שמורות
        </p>
      </div>
    </div>
  )
}
