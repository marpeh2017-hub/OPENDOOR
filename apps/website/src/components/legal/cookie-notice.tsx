'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

const NOTICE_KEY = 'odg-cookie-notice'

/**
 * The cookie notice, on a visitor's first visit until they press "הבנתי".
 * Approved 2026-10-12 as drawn.
 *
 * A notice, not a consent request: the site keeps only what it needs to work
 * (the language cookie, this notice's own note, the accessibility settings,
 * the chat for the open tab) and nothing for tracking or advertising, so
 * there is nothing to accept or refuse. "הגדרות עוגיות" in the footer lists
 * it all. If measurement or marketing tools are ever added, this becomes a
 * real choice and those tools load only after a yes, as the privacy policy
 * promises.
 *
 * A bar at the bottom that never takes focus. While it is open it publishes
 * its height as --cookie-notice-h, which lifts the chat and accessibility
 * buttons above it and keeps scrolled-to content clear of it (globals.css).
 */
export function CookieNotice() {
  const t = useTranslations('cookies')
  const [show, setShow] = useState(false)
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let seen = false
    try {
      seen = window.localStorage.getItem(NOTICE_KEY) === 'seen'
    } catch {
      // Storage blocked: the notice shows, and "הבנתי" holds for this page.
    }
    setShow(!seen)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const element = bar.current
    if (!show || !element) return
    const measure = () => root.style.setProperty('--cookie-notice-h', `${element.offsetHeight}px`)
    root.setAttribute('data-cookie-notice', '')
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.removeAttribute('data-cookie-notice')
      root.style.removeProperty('--cookie-notice-h')
    }
  }, [show])

  function dismiss() {
    try {
      window.localStorage.setItem(NOTICE_KEY, 'seen')
    } catch {
      // As above.
    }
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      ref={bar}
      role="region"
      aria-label={t('label')}
      className="fixed inset-x-0 bottom-0 z-[43] border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] print:hidden"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 lg:px-8">
        <p className="min-w-0 flex-[1_1_22rem] type-small text-gray-700">{t('notice')}</p>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-11 items-center rounded-md bg-teal-700 px-5 type-small font-semibold text-white hover:bg-teal-800"
          >
            {t('ok')}
          </button>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center type-small font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800"
          >
            {t('policy')}
          </Link>
        </div>
      </div>
    </div>
  )
}
