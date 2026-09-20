import { getLocale } from 'next-intl/server'
import { CONTACT } from '@/lib/site-config'

export async function DirectContact({ eligibility = false }: { eligibility?: boolean }) {
  const he = (await getLocale()) === 'he'
  return (
    <div className="border-s-2 border-teal-700 bg-surface-sunken p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-gray-900">{he ? 'דברו איתנו' : 'Contact us'}</h2>
      <p className="mt-4 text-base leading-relaxed text-gray-700">
        {he
          ? eligibility
            ? 'לבדיקה ראשונית של האפשרויות בבניין שלכם, פנו אלינו בטלפון או בדוא״ל וציינו את כתובת הבניין. הבדיקה אינה אישור להתאמת המתחם לפרויקט.'
            : 'אפשר לפנות אל OpenDoor Group בטלפון או בדוא״ל. נשמח לשמוע מכם.'
          : eligibility
            ? 'For an initial enquiry about your building, call or email us with its address. An enquiry does not confirm project eligibility.'
            : 'Call or email OpenDoor Group. We look forward to hearing from you.'}
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        <a
          href={CONTACT.phoneHref}
          dir="ltr"
          className="inline-flex min-h-11 items-center border border-teal-800 px-4 font-semibold text-teal-900"
        >
          {CONTACT.phone}
        </a>
        <a
          href={`mailto:${CONTACT.email}`}
          dir="ltr"
          className="inline-flex min-h-11 items-center px-2 font-semibold text-teal-900 underline underline-offset-4"
        >
          {CONTACT.email}
        </a>
      </div>
    </div>
  )
}
