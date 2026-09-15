'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { routing, type AppLocale } from '@/i18n/routing'

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
 */
export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()

  return (
    <>
      <label htmlFor="language-switcher" className="sr-only">
        {LABELS[locale] === 'עברית' ? 'בחירת שפה' : 'Select language'}
      </label>
      <select
        id="language-switcher"
        value={locale}
        onChange={(event) => {
          router.replace(pathname, { locale: event.target.value as AppLocale })
        }}
        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {LABELS[code]}
          </option>
        ))}
      </select>
    </>
  )
}
