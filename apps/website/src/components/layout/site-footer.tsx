import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { FOOTER_GROUPS } from '@/lib/navigation'
import { CONTACT } from '@/lib/site-config'

/**
 * Site footer.
 *
 * Contains NO registration number, street address, social profile or company
 * metric. §63 forbids inventing them and none have been supplied. An empty
 * column is preferable to a plausible-looking fabrication.
 */
export async function SiteFooter() {
  const [tNav, tFooter, tBrand] = await Promise.all([
    getTranslations('nav'),
    getTranslations('footer'),
    getTranslations('brand'),
  ])

  return (
    <footer className="mt-24 border-t border-gray-200 bg-surface-sunken">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-base font-bold text-teal-700">{tBrand('name')}</p>
            <p className="mt-2 max-w-narrow text-sm text-gray-600">{tBrand('tagline')}</p>
            <a
              href={CONTACT.phoneHref}
              dir="ltr"
              className="mt-3 block w-fit py-2 text-sm text-gray-700 underline"
            >
              {CONTACT.phone}
            </a>
            <a
              href={`mailto:${CONTACT.email}`}
              dir="ltr"
              className="block w-fit py-2 text-sm text-gray-700 underline"
            >
              {CONTACT.email}
            </a>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.titleKey} aria-label={tFooter(group.titleKey)}>
              <h2 className="text-sm font-semibold text-gray-900">{tFooter(group.titleKey)}</h2>
              <ul className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-600 transition-colors hover:text-teal-700"
                    >
                      {tNav(item.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} {tBrand('name')} · {tFooter('rights')} · odg.co.il
          </p>
          <nav aria-label={tFooter('legal')} className="flex gap-4">
            <Link href="/privacy" className="text-xs text-gray-600 hover:text-teal-700">
              {tFooter('privacy')}
            </Link>
            <Link href="/terms" className="text-xs text-gray-600 hover:text-teal-700">
              {tFooter('terms')}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
