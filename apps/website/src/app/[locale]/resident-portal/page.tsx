import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { DirectContact } from '@/components/forms/direct-contact'
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
        title={he ? 'תיק הדייר' : 'Resident portal'}
        standfirst={
          he
            ? 'מידע ושירות לבעלי דירות במתחמים שאנחנו מלווים.'
            : 'Information for owners in the complexes we support.'
        }
      />
      <Section size="md">
        <p className="mb-8 max-w-prose text-lg leading-relaxed text-gray-700">
          {he
            ? 'הכניסה לתיק דייר דיגיטלי אינה זמינה כרגע. לקבלת מידע על הפרויקט, מסמכים או עדכונים, פנו אלינו ישירות. מידע אישי של בעלי דירות אינו מוצג באתר הציבורי.'
            : 'Online resident sign-in is currently unavailable. Contact us directly for project information, documents or updates. Personal owner information is not displayed on the public website.'}
        </p>
        <DirectContact />
      </Section>
    </>
  )
}
