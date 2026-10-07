import type { ProfileBlock } from '@urban-renewal/api-contracts'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import type { Localizer } from '@/lib/localize'
import { getImageSlot, IMAGE_SLOTS } from '@/mock/fixtures/images'
import { Section } from './section'

/**
 * A person, compactly: a small portrait, the name, one sentence, and the rest
 * behind "read more".
 *
 * ── SINCE 2026-10 ──────────────────────────────────────────────────────────
 *
 * On /about the large portrait and the line in Michael's own words moved up
 * into the page's opening, where the approved design puts a face to the
 * company on the first screen. This block is now the biography further down:
 * one row with the portrait small, so the face is recognised rather than
 * repeated, and the full quotation and biography under the disclosure,
 * unchanged. `pullQuote`, when content still sets it, is not shown here.
 *
 * ── THE DISCLOSURE ─────────────────────────────────────────────────────────
 *
 * A native <details>: keyboard and screen-reader support without script, and
 * the text is in the page for search engines and reader mode open or closed.
 * Its summary is a 44px target styled as a quiet button.
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
    <Section id={block.id} size="sm" className="scroll-mt-16">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5 sm:gap-7">
          {/* Shown as served when it comes from storage (a photograph chosen
              in the CRM): the image optimiser is not configured for it. */}
          {portrait && (
            <Image
              src={portrait.url}
              alt=""
              width={portrait.width ?? 960}
              height={portrait.height ?? 960}
              unoptimized={!portrait.url.startsWith('/')}
              sizes="6rem"
              className="h-20 w-20 shrink-0 rounded-full bg-white object-cover ring-1 ring-gray-200 sm:h-24 sm:w-24"
            />
          )}
          <div className="min-w-0 flex-[999_1_20rem]">
            <h2 className="type-h3 font-bold text-gray-900">{t(block.name)}</h2>
            <p className="mt-1 type-body text-gray-600">{t(block.summary)}</p>
          </div>
        </div>

        {hasMore && (
          <details className="group mt-5">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-teal-600 px-4 type-body font-semibold text-teal-600 hover:bg-teal-50 hover:text-teal-700 [&::-webkit-details-marker]:hidden">
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

            <div className="mt-6 max-w-3xl space-y-4">
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
    </Section>
  )
}
