import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

/**
 * The filter rail.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  IT APPEARS WHEN IT HELPS, WHICH IS NOT YET
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Whether this renders at all is decided by `shouldShowFilters` in
 * `lib/project-presentation.ts`, where the threshold and the reasoning live
 * together. In short: below seven published projects, reading every card is
 * faster than operating a control, and a rail above four cards implies a
 * catalogue that is not there while giving the visitor a way to filter the
 * list down to nothing.
 *
 * The decision is DATA-AWARE rather than a flag someone must remember to turn
 * on: the rail appears by itself on the day the catalogue justifies it.
 *
 * ── LINKS, NOT A CONTROL PANEL ─────────────────────────────────────────────
 *
 * Each filter is a link carrying a query string. No client component, no
 * JavaScript, no combobox, no chips with clear buttons. It works with
 * scripting off, every state is a real URL a resident can send to a neighbour,
 * and the page stays a static render. The brief asks for no complex filter UX
 * in this pass, and this is what the simple version actually looks like.
 */
export async function ProjectFilters({
  cities,
  types,
  active,
}: {
  cities: readonly string[]
  types: readonly string[]
  active: { city?: string; type?: string }
}) {
  const [t, tTypes] = await Promise.all([
    getTranslations('projectFilters'),
    getTranslations('projectTypes'),
  ])

  const noneActive = !active.city && !active.type

  return (
    <nav
      aria-label={t('label')}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-gray-200 pb-5"
    >
      <span className="text-[13px] text-gray-600">{t('label')}</span>

      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <FilterLink href="/projects" active={noneActive} label={t('all')} />

        {cities.map((city) => (
          <FilterLink
            key={city}
            href={`/projects?city=${encodeURIComponent(city)}`}
            active={active.city === city}
            label={city}
          />
        ))}

        {types.map((type) => (
          <FilterLink
            key={type}
            href={`/projects?type=${encodeURIComponent(type)}`}
            active={active.type === type}
            label={tTypes(type)}
          />
        ))}
      </ul>
    </nav>
  )
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string
  active: boolean
  label: string
}) {
  return (
    <li>
      <Link
        href={href}
        // `aria-current` rather than colour alone: the active filter has to be
        // announced, not just look different.
        {...(active ? { 'aria-current': 'page' as const } : {})}
        className={`inline-flex min-h-[44px] items-center border-b-2 pb-1 pt-1 transition-colors ${
          active
            ? 'border-teal-600 font-semibold text-teal-800'
            : 'border-transparent text-gray-600 hover:text-teal-800'
        }`}
      >
        {label}
      </Link>
    </li>
  )
}
