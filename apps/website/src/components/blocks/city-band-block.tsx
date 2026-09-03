import type { MediaBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { EditorialImage } from '@/components/brand/editorial-image'
import { getImageSlot, IMAGE_SLOTS } from '@/mock/fixtures/images'
import { STROKE } from '@/components/brand/architecture'

/**
 * The city band.
 *
 * ── WHAT IT IS FOR ─────────────────────────────────────────────────────────
 *
 * A full-bleed horizontal moment that breaks the page's column rhythm. It
 * appears twice, at the two points where the homepage changes subject:
 * after the process (→ "and this is the city it happens in") and before the
 * closing. Between them the page runs on type and geometry alone, which is
 * what makes these two land.
 *
 * ── EDGE TO EDGE, DELIBERATELY ─────────────────────────────────────────────
 *
 * Everything else on this page lives inside a 80rem column. The band ignores
 * it. That contrast is the point: a reader who has been moving down a measured
 * text column meets something that runs past both edges, and the change of
 * scale does the work that a colour band was doing in V1.
 *
 * ── THE CAPTION IS NOT DECORATION ──────────────────────────────────────────
 *
 * These are `EDITORIAL_CONTEXT` images: real places OpenDoor had nothing to do
 * with. The band always states what it is showing. `EditorialImage` prints the
 * asset's own caption when a photograph is present; the block's `caption` adds
 * the editorial framing, and the two are different things — one is a fact
 * about the picture, the other is why it is here.
 */
export async function CityBandBlockView({ block, t }: { block: MediaBlock; t: Localizer }) {
  const slot = block.slotId && block.slotId in IMAGE_SLOTS
    ? await getImageSlot(block.slotId as keyof typeof IMAGE_SLOTS)
    : null

  if (!slot) return null

  return (
    <section className="relative overflow-x-clip bg-surface-page py-4 sm:py-6">
      {/* Full-bleed: escapes the page column, centred rather than offset so it
          behaves identically in RTL and LTR.

          The section is `overflow-x-clip` rather than `hidden`: `100vw`
          includes the scrollbar gutter while the layout viewport does not, so
          a full-bleed child ends up a few pixels wider than the page and
          produces a horizontal scrollbar. `clip` removes that overflow WITHOUT
          creating a scroll container — which `hidden` would, breaking the
          `position: sticky` columns elsewhere on the page. */}
      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <div className="relative">
          <EditorialImage
            t={t}
            slot={slot}
            sizes="100vw"
            captionHidden
            className="aspect-[3/2] w-full sm:aspect-[2/1] lg:aspect-[21/9]"
          />

          {/* The thread crosses the band — the journey does not pause for the
              photograph, it passes through it. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 top-0 hidden lg:block"
            style={{
              insetInlineStart: 'max(1.25rem, calc((100vw - 80rem) / 2 + 1.25rem))',
              width: '1px',
              background: `linear-gradient(to bottom, ${STROKE.teal}, ${STROKE.teal})`,
              opacity: 0.55,
            }}
          />
        </div>
      </div>

      {/* The framing line, back inside the page column. */}
      {block.caption && (
        <div className="relative mx-auto mt-5 max-w-7xl px-4 lg:px-8">
          <p className="flex max-w-2xl items-start gap-3 text-sm leading-relaxed text-gray-600">
            <span aria-hidden="true" className="mt-2.5 h-px w-6 shrink-0 bg-teal-600" />
            {t(block.caption)}
          </p>
        </div>
      )}
    </section>
  )
}
