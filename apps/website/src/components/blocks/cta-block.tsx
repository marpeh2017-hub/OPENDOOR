import type { CtaBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { CONTACT } from '@/lib/site-config'
import { LineIcon } from '@/components/brand/line-icon'

/**
 * The closing call: one band on the brand wash, the action, and the phone.
 *
 * ── WHAT CHANGED IN 2026-10 ────────────────────────────────────────────────
 *
 * The call used to stand inside a drawn "threshold" over a faded photograph
 * of the Chords Bridge, at display size. The design review found its heading
 * larger than the page's own h1, so the end of every page read as its main
 * message, and the approved page designs close on a plain band instead: the
 * section's h2, an optional line, the primary action, and the company phone.
 * The phone replaced the old "יצירת קשר" link because the owner asked for
 * the number to be visible, and because some owners would rather call than
 * open another page to find it.
 *
 * ── TWO ARRANGEMENTS ───────────────────────────────────────────────────────
 *
 * Centred, by default. With `summary`, two columns: the page's argument in
 * brief beside a card holding the call, so a page whose last section is its
 * summary (as /why-organizer's "תפקידנו") does not end on two bands in a row.
 * The summary's heading is then the section's h2 and the call's line is not
 * a heading.
 */
export function CtaBlockView({ block, t }: { block: CtaBlock; t: Localizer }) {
  const actions = (stacked: boolean) => (
    <div className={`flex gap-3 ${stacked ? 'flex-col items-stretch sm:items-start' : 'flex-wrap justify-center'}`}>
      <Link
        href={block.ctaHref}
        className="inline-flex min-h-[52px] items-center justify-center rounded-md bg-teal-600 px-7 type-body font-semibold text-white transition-colors hover:bg-teal-700 hover:text-white"
      >
        {t(block.ctaLabel)}
      </Link>
      <a
        href={CONTACT.phoneHref}
        dir="ltr"
        className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-md border border-teal-600 bg-white px-6 type-body font-semibold text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700"
      >
        <LineIcon name="phone" size={20} />
        {CONTACT.phone}
      </a>
    </div>
  )

  if (block.summary) {
    return (
      <section className="bg-teal-50">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14 lg:px-8 lg:py-16">
          <div>
            <h2 className="type-h2 font-bold text-gray-900">{t(block.summary.heading)}</h2>
            <p className="mt-4 type-body text-gray-900">{t(block.summary.body)}</p>
            {t(block.summary.emphasis) && (
              <p className="mt-4 type-lead font-bold text-teal-700">{t(block.summary.emphasis)}</p>
            )}
          </div>
          <div className="rounded-2xl bg-white p-7 sm:p-8">
            <p className="type-h3 font-bold text-gray-900">{t(block.heading)}</p>
            {t(block.body) && <p className="mt-2 type-body text-gray-700">{t(block.body)}</p>}
            <div className="mt-6">{actions(true)}</div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-teal-50">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-14 text-center lg:px-8 lg:py-20">
        {t(block.eyebrow) && <p className="type-small font-bold text-teal-600">{t(block.eyebrow)}</p>}
        <h2
          className={`max-w-[34ch] text-balance type-h2 font-bold text-gray-900 ${t(block.eyebrow) ? 'mt-3' : ''}`}
        >
          {t(block.heading)}
        </h2>
        {t(block.body) && <p className="mt-4 max-w-2xl type-lead text-gray-700">{t(block.body)}</p>}
        <div className="mt-8">{actions(false)}</div>
      </div>
    </section>
  )
}
