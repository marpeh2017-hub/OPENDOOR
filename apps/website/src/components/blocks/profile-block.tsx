import type { ProfileBlock } from '@urban-renewal/api-contracts'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import type { Localizer } from '@/lib/localize'
import { getImageSlot, IMAGE_SLOTS } from '@/mock/fixtures/images'
import { Section } from './section'

/**
 * A person, at a glance: portrait, one line in their own words, one sentence
 * about them, and the rest behind "read more".
 *
 * ── WHY NOT A CHAPTER ──────────────────────────────────────────────────────
 *
 * Michael's section on /about used to be a CHAPTER: a pull quote of 30 words,
 * then two paragraphs of biography, beside a drawing where his photograph
 * would go. On a phone that was a hundred words before the page moved on. The
 * design review asked for a face, one line, and the rest on request. The full
 * quotation and biography are still in the page, unchanged, inside the
 * disclosure; the visible line and sentence are cut from them.
 *
 * ── THE DISCLOSURE ─────────────────────────────────────────────────────────
 *
 * A native <details>: keyboard and screen-reader support without script, and
 * the text is in the page for search engines and reader mode whether it is
 * open or not. Its summary is a 44px target styled as a quiet button.
 *
 * ── THE PORTRAIT ───────────────────────────────────────────────────────────
 *
 * From the image inventory, like every image on the site, with the claim
 * PERSON_PORTRAIT. If the slot has no asset nothing is drawn in its place: a
 * placeholder silhouette beside a real person's name is not neutral. The
 * offset ring is decoration, in the brand teal.
 */
export async function ProfileBlockView({ block, t }: { block: ProfileBlock; t: Localizer }) {
  const tUi = await getTranslations('ui')
  const slot =
    block.slotId && block.slotId in IMAGE_SLOTS
      ? await getImageSlot(block.slotId as keyof typeof IMAGE_SLOTS)
      : null
  const portrait = slot?.asset ?? null
  const paragraphs = t(block.body)
    .split('\n')
    .filter((paragraph) => paragraph.trim().length > 0)
  const hasMore = Boolean(t(block.quote)) || paragraphs.length > 0

  return (
    <Section tone="sunken" size="md">
      <div className="grid items-center gap-10 md:grid-cols-[auto_minmax(0,1fr)] md:gap-16">
        {portrait && (
          <div className="relative mx-auto w-44 md:mx-0 md:w-60 lg:w-64">
            <span
              aria-hidden="true"
              className="absolute inset-0 translate-x-3 translate-y-3 rounded-full border-2 border-teal-500 rtl:-translate-x-3"
            />
            <Image
              src={portrait.url}
              alt={t.text(portrait.alt)}
              width={portrait.width ?? 960}
              height={portrait.height ?? 960}
              sizes="(min-width: 1024px) 16rem, (min-width: 768px) 15rem, 11rem"
              className="relative aspect-square w-full rounded-full bg-white object-cover shadow-[0_14px_32px_-18px_rgba(20,49,47,0.5)] ring-1 ring-gray-200"
            />
          </div>
        )}

        <div className="min-w-0">
          <figure className="m-0">
            <blockquote className="m-0">
              <p className="max-w-[24ch] type-h2 font-bold text-teal-700 text-balance">
                {t(block.pullQuote)}
              </p>
            </blockquote>
            <figcaption className="mt-5">
              <h2 className="type-h3 font-bold text-gray-900">{t(block.name)}</h2>
            </figcaption>
          </figure>

          <p className="mt-2 max-w-2xl type-body text-gray-700">{t(block.summary)}</p>

          {hasMore && (
            <details className="group mt-6 max-w-2xl">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-teal-600 px-4 type-body font-semibold text-teal-600 hover:bg-white hover:text-teal-700 [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">{tUi('readMore')}</span>
                <span className="hidden group-open:inline">{tUi('readLess')}</span>
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="group-open:rotate-180 motion-safe:transition-transform"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </summary>

              <div className="mt-6 space-y-4">
                {t(block.quote) && (
                  <blockquote className="m-0 border-s-2 border-teal-500 ps-5">
                    <p className="type-lead font-semibold text-gray-900">{t(block.quote)}</p>
                  </blockquote>
                )}
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="type-body text-gray-600">
                    {paragraph}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </Section>
  )
}
