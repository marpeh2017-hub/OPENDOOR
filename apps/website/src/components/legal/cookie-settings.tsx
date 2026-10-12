'use client'

import { useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

/**
 * "הגדרות עוגיות" in the footer: what the site keeps in the browser, by
 * category. Approved 2026-10-12 as drawn: the necessary ones, always on, and
 * measurement and marketing, of which the site has none.
 *
 * Nothing to switch, because there is nothing optional to switch off; the
 * day the site adds an analytics or marketing tool, its category gets a real
 * toggle here and the tool waits for it.
 *
 * A native modal <dialog>: the browser traps focus, Escape closes it, and
 * focus goes back to the footer link.
 */
export function CookieSettings() {
  const t = useTranslations('cookies')
  // The assistant runs on the Hebrew site only.
  const chat = useLocale() === 'he'
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()

  const close = () => dialog.current?.close()

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-[24px] items-center py-1 text-xs text-gray-600 hover:text-teal-700"
      >
        {t('settings')}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-0 text-gray-800 shadow-xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id={`${id}-title`} className="type-h3 font-bold text-gray-900">{t('settings')}</h2>
            <button
              type="button"
              onClick={close}
              aria-label={t('close')}
              className="-mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 type-small text-gray-600">{t('intro')}</p>

          <dl className="mt-5 space-y-3">
            <div className="rounded-xl border border-gray-200 p-4">
              <dt className="flex flex-wrap items-center justify-between gap-2">
                <span className="type-body font-semibold text-gray-900">{t('necessary')}</span>
                <span className="rounded-full bg-teal-50 px-3 py-0.5 type-small font-semibold text-teal-800">{t('necessaryStatus')}</span>
              </dt>
              <dd className="mt-2 type-small text-gray-600">
                {t('necessaryBody')}
                {chat && ` ${t('necessaryChat')}`}
              </dd>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <dt className="flex flex-wrap items-center justify-between gap-2">
                <span className="type-body font-semibold text-gray-900">{t('marketing')}</span>
                <span className="rounded-full bg-gray-100 px-3 py-0.5 type-small font-semibold text-gray-700">{t('marketingStatus')}</span>
              </dt>
              <dd className="mt-2 type-small text-gray-600">{t('marketingBody')}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={close}
              className="inline-flex min-h-11 items-center rounded-md bg-teal-700 px-5 type-small font-semibold text-white hover:bg-teal-800"
            >
              {t('close')}
            </button>
            <Link
              href="/privacy"
              onClick={close}
              className="inline-flex min-h-11 items-center type-small font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800"
            >
              {t('policy')}
            </Link>
          </div>
        </div>
      </dialog>
    </>
  )
}
