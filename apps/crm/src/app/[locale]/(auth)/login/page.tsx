import { Metadata } from 'next'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'כניסה' }

/**
 * The CRM's sign-in, in the website's brand (2026-10-07): the company's own
 * logo over the form, and on a wide screen a dark panel in the website's depth
 * colour saying what the system is for. The panel's lines describe what the
 * CRM does today; extend them as it grows. Below `lg` only the form shows.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-wrap bg-[#FCFCFB]">
      <main className="flex flex-[1_1_520px] flex-col items-center justify-center gap-7 px-4 py-12">
        <Image
          src="/brand/opendoor-logo.svg"
          alt="OpenDoor התחדשות עירונית"
          width={194}
          height={72}
          priority
          unoptimized
          className="h-[72px] w-auto"
        />

        <div className="w-full max-w-[400px] rounded-2xl border border-border bg-white p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-foreground">כניסה למערכת</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">ה-CRM של OpenDoor Group, לצוות החברה</p>
          </div>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} OpenDoor Group · קבוצת אופן דור יזמות והתחדשות בע״מ
        </p>
      </main>

      <aside
        aria-label="על המערכת"
        className="hidden flex-[1_1_420px] flex-col justify-center gap-6 bg-teal-950 px-14 py-14 text-white lg:flex"
      >
        <Image
          src="/brand/opendoor-icon-512.png"
          alt=""
          width={72}
          height={72}
          className="h-[72px] w-[72px] rounded-[18px] bg-white p-2"
        />
        <p className="max-w-[420px] text-3xl font-extrabold leading-tight">
          כל פרויקט, כל דייר וכל חתימה, במקום אחד.
        </p>
        <ul className="space-y-3 text-base text-teal-100">
          {['לידים מהאתר, ישר לטיפול', 'דיירים, בעלים וחתימות לכל פרויקט', 'ניהול תוכן האתר'].map((line) => (
            <li key={line} className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-teal-300" />
              {line}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
