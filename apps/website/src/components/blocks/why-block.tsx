import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { LineIcon, isLineIcon } from '@/components/brand/line-icon'

/**
 * A plain FEATURE_GRID: things the company does, each with a line icon.
 *
 * ── A LIST, NOT A PATH ─────────────────────────────────────────────────────
 *
 * The block's use is the list of services on /services, which must not look
 * like a process: the process is told once, on /how-we-work. So there are no
 * numerals and no connecting line, and the order carries no claim.
 *
 * ── COMPACT CARDS (2026-10) ────────────────────────────────────────────────
 *
 * The approved /services design asked for less scrolling: the services are
 * cards, three to a row from lg, the icon beside the text, on a tighter
 * section rhythm. An item with `href` is a link card on the dark surface,
 * for a service told in full elsewhere (the offer check, on /about).
 *
 * ── ON THE DARK SURFACE (2026-10-11) ───────────────────────────────────────
 *
 * With `tone: 'inverse'` the whole section is dark, as /trust's documents
 * are: the heading turns white, the link cards lighten to a translucent
 * white so they still read as cards on it, and they show their icon. The
 * block's `linkLabel` and `linkHref` then close the section with a link to
 * where everything is, /forms.
 */
export function WhyBlockView({ block, t }: { block: FeatureGridBlock; t: Localizer }) {
  const inverse = block.tone === 'inverse'

  return (
    <Section id={block.id} size="sm" tone={inverse ? 'inverse' : 'page'} className="scroll-mt-16">
      {inverse ? (
        <div className="max-w-2xl">
          <h2 className="type-h2 font-bold text-balance text-white">{t(block.heading)}</h2>
          {block.intro && <p className="mt-4 type-body text-teal-100">{t(block.intro)}</p>}
        </div>
      ) : (
        <SectionHeading heading={block.heading} intro={block.intro} t={t} />
      )}

      <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {block.items.map((item) =>
          item.href ? (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`group flex h-full flex-col gap-1.5 rounded-2xl p-5 text-white hover:text-white sm:p-6 ${
                  inverse
                    ? 'border border-white/15 bg-white/[0.06] transition-colors hover:bg-white/[0.1]'
                    : 'justify-center bg-surface-inverse'
                }`}
              >
                {inverse && isLineIcon(item.icon) && (
                  <span
                    aria-hidden="true"
                    className="mb-2 hidden h-11 w-11 items-center justify-center rounded-xl bg-white/[0.08] text-teal-300 sm:flex"
                  >
                    <LineIcon name={item.icon} size={22} />
                  </span>
                )}
                <span className="type-h3 font-bold">{t(item.title)}</span>
                <span className="type-small text-teal-100">{t(item.body)}</span>
                {t(item.linkLabel) && (
                  <span className={`inline-flex items-center gap-2 type-small font-bold text-teal-300 group-hover:text-teal-200 ${inverse ? 'mt-auto pt-2' : 'mt-1'}`}>
                    {t(item.linkLabel)}
                    <span
                      aria-hidden="true"
                      className="inline-block rtl:rotate-180 motion-safe:transition-transform motion-safe:ltr:group-hover:translate-x-1 motion-safe:rtl:group-hover:-translate-x-1"
                    >
                      →
                    </span>
                  </span>
                )}
              </Link>
            </li>
          ) : (
            <li key={item.id} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              {isLineIcon(item.icon) && (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                  <LineIcon name={item.icon} size={22} />
                </span>
              )}
              <span className="min-w-0">
                <span className="block type-h3 font-bold text-gray-900">{t(item.title)}</span>
                <span className="mt-1 block type-small text-gray-600">{t(item.body)}</span>
              </span>
            </li>
          ),
        )}
      </ul>

      {block.linkHref && t(block.linkLabel) && (
        <p className="mt-6">
          <Link
            href={block.linkHref}
            className={`inline-flex min-h-11 items-center type-body font-bold underline underline-offset-4 ${
              inverse ? 'text-white hover:text-teal-200' : 'text-teal-700 hover:text-teal-800'
            }`}
          >
            {t(block.linkLabel)}
          </Link>
        </p>
      )}
    </Section>
  )
}
