import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ProtocolDocument } from '@/components/forms/protocol-document'
import { JoinProtocolForm } from '@/components/forms/join-protocol-form'
import { getPublicForm } from '@/lib/public-forms'
import { CONTACT } from '@/lib/site-config'

/**
 * The neighbours' link of a protocol started on the website: the protocol as
 * its initiator filled it in (the meeting, the proposed members), and the
 * form for the reader's own row. Personal to a building, so never indexed.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.forms' })
  return { title: t('joinTitle'), robots: { index: false, follow: false } }
}

export default async function JoinProtocolPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const [t, tNav] = await Promise.all([getTranslations('pages.forms'), getTranslations('nav')])
  const form = await getPublicForm(token)

  if (!form) {
    return (
      <section className="bg-surface-page">
        <div className="mx-auto max-w-2xl px-4 py-16">
          <h1 className="type-h2 font-bold text-gray-900">{t('joinNotFoundHeading')}</h1>
          <p className="mt-3 type-body text-gray-700">{t('joinNotFound')}</p>
          <Link href="/forms" className="mt-5 inline-flex min-h-11 items-center type-body font-semibold">
            {tNav('forms')}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10 lg:py-12">
          <h1 className="text-balance type-h2 font-extrabold text-gray-900">
            {t('joinHeading', { compound: form.compoundName })}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty type-lead text-gray-600">{t('joinStandfirst')}</p>
          <p className="mt-3 type-small font-semibold text-teal-700">{t('joinSigned', { count: form.signed })}</p>
        </div>
      </section>
      <section className="bg-surface-page">
        <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8">
          <ProtocolDocument
            protocol={form.text}
            meeting={form.meeting}
            members={form.members}
            ownersTable={false}
            titleLevel={2}
          />
          {form.open ? (
            <JoinProtocolForm token={token} />
          ) : (
            <p role="status" className="rounded-2xl border border-gray-200 bg-white p-6 type-body text-gray-800">
              {t('joinClosed', { phone: CONTACT.phone })}
            </p>
          )}
        </div>
      </section>
    </>
  )
}
