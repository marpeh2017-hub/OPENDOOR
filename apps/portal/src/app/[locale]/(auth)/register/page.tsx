import Image from 'next/image'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/register-form'

/**
 * Registration for the personal area, for someone the sign-in cannot find:
 * their phone and email are on no resident file yet. They ask here, and staff
 * put them on their apartment. The same frame as the sign-in page.
 */
export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FCFCFB] px-4 py-10">
      <Image
        src="/brand/opendoor-logo.svg"
        alt="OpenDoor התחדשות עירונית"
        width={167}
        height={62}
        priority
        unoptimized
        className="mb-7 h-[62px] w-auto"
      />

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-white p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-extrabold text-gray-800">הרשמה לאזור האישי</h1>
            <p className="mt-1.5 text-sm text-gray-600">
              הטלפון או האימייל שלכם עוד לא רשומים אצלנו? השאירו פרטים, נאמת אותם ונצרף אתכם לדירה שלכם.
            </p>
          </div>
          <RegisterForm locale={locale} />
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          כבר רשומים?{' '}
          <Link href={`/${locale}/login`} className="font-medium text-teal-700 underline">
            כניסה לאזור האישי
          </Link>
        </p>
      </div>
    </main>
  )
}
