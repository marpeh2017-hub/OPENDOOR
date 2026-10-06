import type { PageHeroBlock, PortraitVisual } from '@urban-renewal/api-contracts'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { CONTACT } from '@/lib/site-config'
import { LineIcon } from '@/components/brand/line-icon'
import { getImageSlot, IMAGE_SLOTS } from '@/mock/fixtures/images'

/**
 * The opening of an inner page that has to persuade.
 *
 * ── WHY NOT PAGE_HEADER ────────────────────────────────────────────────────
 *
 * PAGE_HEADER titles a page someone has already chosen to read. The pages
 * that use this one were found, in the 2026-10 review, to open weakly: /about
 * on a stock-like photograph, /services on a title and a line. The approved
 * designs open on the page's claim, the action and the phone, and a visual
 * that carries the claim, with three proof points under the whole.
 *
 * The heading is the page's one h1. The action and the phone sit together,
 * because the brief asked for the number to be visible from the first screen.
 *
 * ── THE VISUALS ────────────────────────────────────────────────────────────
 *
 * A closed set, chosen by `visual.kind`. `portrait` is a real photograph of
 * a named person (claim PERSON_PORTRAIT) with a line in their own words; if
 * the slot has no asset, nothing is drawn in its place.
 */
export async function PageHeroBlockView({ block, t }: { block: PageHeroBlock; t: Localizer }) {
  const visual = block.visual ? await renderVisual(block.visual, t) : null
  const points = block.points ?? []

  return (
    <section className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 lg:px-8 lg:pb-14 lg:pt-16">
        <div className={`grid items-center gap-12 ${visual ? 'lg:grid-cols-[1.15fr_0.85fr] lg:gap-16' : ''}`}>
          <div>
            {t(block.eyebrow) && (
              <p className="flex items-center gap-3 type-small font-bold text-teal-600">
                <span aria-hidden="true" className="h-0.5 w-8 bg-teal-500" />
                {t(block.eyebrow)}
              </p>
            )}
            <h1 className={`max-w-[22ch] text-balance type-h1 font-extrabold text-gray-900 ${t(block.eyebrow) ? 'mt-5' : ''}`}>
              {t(block.heading)}
            </h1>
            {t(block.standfirst) && (
              <p className="mt-5 max-w-2xl type-lead text-gray-600">{t(block.standfirst)}</p>
            )}
            {(block.ctaHref || block.showPhone) && (
              <div className="mt-8 flex flex-wrap gap-3">
                {block.ctaHref && t(block.ctaLabel) && (
                  <Link
                    href={block.ctaHref}
                    className="inline-flex min-h-[52px] items-center justify-center rounded-md bg-teal-600 px-7 type-body font-semibold text-white transition-colors hover:bg-teal-700 hover:text-white"
                  >
                    {t(block.ctaLabel)}
                  </Link>
                )}
                {block.showPhone && (
                  <a
                    href={CONTACT.phoneHref}
                    dir="ltr"
                    className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-md border border-gray-300 bg-white px-6 type-body font-semibold text-gray-900 transition-colors hover:border-teal-600 hover:text-teal-700"
                  >
                    <LineIcon name="phone" size={20} className="text-teal-600" />
                    {CONTACT.phone}
                  </a>
                )}
              </div>
            )}
          </div>
          {visual}
        </div>

        {points.length > 0 && (
          <ul className="mt-12 grid gap-5 border-t border-gray-200 pt-6 md:grid-cols-3">
            {points.map((point) => (
              <li key={point.id} className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                  <LineIcon name={point.icon} size={24} />
                </span>
                <span className="min-w-0">
                  <span className="block type-body font-bold text-gray-900">{t(point.title)}</span>
                  {t(point.body) && <span className="block type-small text-gray-600">{t(point.body)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

async function renderVisual(visual: PortraitVisual, t: Localizer): Promise<React.ReactNode> {
  switch (visual.kind) {
    case 'portrait':
      return <Portrait visual={visual} t={t} />
    default:
      return null
  }
}

async function Portrait({ visual, t }: { visual: PortraitVisual; t: Localizer }) {
  const slot = visual.slotId in IMAGE_SLOTS
    ? await getImageSlot(visual.slotId as keyof typeof IMAGE_SLOTS)
    : null
  const asset = slot?.asset
  if (!asset) return null

  return (
    <div className="flex flex-col items-center lg:relative lg:pb-10">
      <div className="relative w-56 sm:w-64 lg:w-[21rem]">
        <span
          aria-hidden="true"
          className="absolute inset-0 -translate-x-3 translate-y-3 rounded-full border-2 border-teal-500 ltr:translate-x-3"
        />
        <Image
          src={asset.url}
          alt={t.text(asset.alt)}
          width={asset.width ?? 960}
          height={asset.height ?? 960}
          priority
          sizes="(min-width: 1024px) 21rem, (min-width: 640px) 16rem, 14rem"
          className="relative aspect-square w-full rounded-full bg-white object-cover shadow-[0_18px_40px_-22px_rgba(20,49,47,0.55)] ring-1 ring-gray-200"
        />
      </div>
      {t(visual.quote) && (
        <figure className="relative -mt-5 w-full max-w-[19rem] rounded-2xl border border-gray-200 bg-white px-5 py-4 text-center shadow-[0_16px_36px_-20px_rgba(20,49,47,0.45)] lg:absolute lg:bottom-0 lg:end-[8%] lg:mt-0 lg:text-start">
          <blockquote className="m-0 type-h3 font-bold text-teal-700">{t(visual.quote)}</blockquote>
          {t(visual.quoteBy) && (
            <figcaption className="mt-1.5 type-small text-gray-600">{t(visual.quoteBy)}</figcaption>
          )}
        </figure>
      )}
    </div>
  )
}
