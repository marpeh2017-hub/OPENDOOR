import type { CtaBlock } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'

/**
 * Closing call to action.
 *
 * Calm by construction: no countdown, no scarcity, no "last chance". The only
 * persuasion is the reassurance that the check commits the visitor to nothing,
 * which is true and is the actual objection.
 *
 * Sits on WHITE, not the muted band. The alternating rhythm lands the FAQ above
 * it on the muted surface and the footer below it on the same one, so a muted
 * CTA produced three identical stacked bands with only hairlines between them —
 * the closing moment of the page reading as one undifferentiated block.
 *
 * White also does the work a teal field is usually reached for here: it makes
 * the final section the brightest thing on screen without a brand-colour band,
 * which is the single most common way a restrained page turns into a template.
 */
export async function CtaBlockView({ block, t }: { block: CtaBlock; t: Localizer }) {
  const tLinks = await getTranslations('links')
  return (
    <section className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8 lg:py-20">
        <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {t(block.heading)}
        </h2>
        {block.body && (
          <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">{t(block.body)}</p>
        )}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={block.ctaHref}
            className="inline-flex items-center justify-center rounded-md bg-teal-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-teal-700"
          >
            {t(block.ctaLabel)}
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-800 transition-colors hover:border-gray-400"
          >
            {tLinks('contact')}
          </Link>
        </div>
      </div>
    </section>
  )
}
