'use client'

import { useId } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing, type AppLocale } from '@/i18n/routing'
import { localeLocation } from '@/lib/locale-location'

const LABELS: Record<AppLocale, string> = { he: 'עברית', en: 'English' }

/**
 * Language switcher.
 *
 * A native `<select>` rather than a custom dropdown: on mobile it opens the
 * platform picker, and it is keyboard- and screen-reader-correct with no work.
 * There are two options — a bespoke listbox would be all cost and no benefit.
 *
 * Switching preserves the CURRENT PATH via next-intl's router, so a visitor
 * reading `/he/why-organizer` lands on `/en/why-organizer` rather than being
 * dumped at the homepage.
 *
 * ── THE ARROW ──────────────────────────────────────────────────────────────
 *
 * The forms plugin draws the arrow as a background image pinned to the right,
 * and expects 2.5rem of right padding to hold it. With `px-2` the arrow was
 * drawn over the text: over the first letter of "עברית", over the end of
 * "English". It now sits at the inline end in both directions, with the
 * padding on that side to hold it. The text stays at 16px, below which iOS
 * zooms the page when the control is tapped.
 *
 * ── TWO PLACES ─────────────────────────────────────────────────────────────
 *
 * The header shows it from `sm` up. On a phone the header has no room for it
 * once the arrow has room, so there it lives in the mobile menu, with its
 * label shown. `useId` keeps each label pointing at its own select.
 */
export function LanguageSwitcher({
  className,
  labelVisible = false,
  onSwitch,
}: {
  className?: string
  /** Shown in the mobile menu; for screen readers only in the header. */
  labelVisible?: boolean
  /** Called once the switch starts, so the mobile menu can close. */
  onSwitch?: () => void
}) {
  const locale = useLocale() as AppLocale
  const t = useTranslations('nav')
  const pathname = usePathname()
  const router = useRouter()
  const id = useId()

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={labelVisible ? 'mb-2 block text-sm font-semibold text-gray-500' : 'sr-only'}
      >
        {t('languageSwitcher')}
      </label>
      <select
        id={id}
        value={locale}
        onChange={(event) => {
          router.replace(localeLocation(pathname, window.location.search, window.location.hash), {
            locale: event.target.value as AppLocale,
          })
          onSwitch?.()
        }}
        className={`block min-h-[44px] min-w-[44px] rounded-md border border-gray-300 bg-white ps-3 pe-9 text-base text-gray-700 ltr:bg-[position:right_0.625rem_center] rtl:bg-[position:left_0.625rem_center] ${labelVisible ? 'w-full' : ''}`}
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {LABELS[code]}
          </option>
        ))}
      </select>
    </div>
  )
}
