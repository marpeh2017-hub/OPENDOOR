import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { DirectContact } from '@/components/forms/direct-contact'
import { Link } from '@/i18n/navigation'
import { PERSONAL_AREA_HREF } from '@/lib/navigation'
import { PORTAL_URL } from '@/lib/site-config'
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.residentPortal' })
  return { title: t('title'), robots: { index: false, follow: true } }
}
export default async function ResidentPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const he = locale === 'he'
  return (
    <>
      <PageHeader
        title={he ? 'האזור האישי' : 'Personal area'}
        standfirst={
          he
            ? 'מידע ושירות לבעלי דירות במתחמים שאנחנו מלווים.'
            : 'Information for owners in the complexes we support.'
        }
      />
      {/*
        Two states, and the page says which one is true. The personal-area
        links in the header and the hero point at the portal when it is
        configured; telling a visitor here that sign-in is unavailable while
        those links work would be the page contradicting the site.
      */}
      <Section size="md">
        {PORTAL_URL ? (
          <>
            <p className="mb-8 max-w-prose text-lg leading-relaxed text-gray-700">
              {he
                ? 'הכניסה לאזור האישי נעשית בקוד חד־פעמי שנשלח לטלפון הנייד הרשום אצלנו. אם אינכם מצליחים להיכנס, או שהמספר שלכם אינו רשום, פנו אלינו ונסדיר את הגישה. מידע אישי של בעלי דירות אינו מוצג באתר הציבורי.'
                : 'You sign in to your personal area with a one-time code sent to the mobile number we hold for you. If you cannot sign in, or your number is not on record, contact us and we will set up access. Personal owner information is not displayed on the public website.'}
            </p>
            <Link
              href={PERSONAL_AREA_HREF}
              className="mb-12 inline-flex min-h-12 items-center justify-center rounded-md bg-teal-600 px-7 py-4 text-base font-semibold text-white hover:bg-teal-700"
            >
              {he ? 'כניסה לאזור האישי' : 'Sign in to your personal area'}
            </Link>
          </>
        ) : (
          <p className="mb-8 max-w-prose text-lg leading-relaxed text-gray-700">
            {he
              ? 'הכניסה לאזור האישי אינה זמינה כרגע. לקבלת מידע על הפרויקט, מסמכים או עדכונים, פנו אלינו ישירות. מידע אישי של בעלי דירות אינו מוצג באתר הציבורי.'
              : 'Sign-in to the personal area is currently unavailable. Contact us directly for project information, documents or updates. Personal owner information is not displayed on the public website.'}
          </p>
        )}
        <DirectContact />
      </Section>
    </>
  )
}
