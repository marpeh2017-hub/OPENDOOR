import { SafeImage } from '@/components/brand/safe-image'
import type { MediaAsset } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import type { Localizer } from '@/lib/localize'

/**
 * Project images, each stating what it is allowed to claim.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THE LABEL IS PART OF THE PICTURE, NOT PART OF THE CAPTION
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A caption beneath a photograph is read after the photograph, by fewer
 * people, and is separated from it the moment the image is screenshotted or
 * the layout reflows. So the claim label sits ON the image, always visible,
 * never revealed on hover — a hover-gated disclaimer does not exist on a touch
 * device, which is where most of these will be seen.
 *
 * `EDITORIAL_CONTEXT` gets a neutral graphite label reading "context, not this
 * project", and its caption repeats that in a sentence. Two statements rather
 * than one, because this is the single image class that can mislead simply by
 * being present.
 *
 * ── WHAT NEVER APPEARS HERE ────────────────────────────────────────────────
 *
 * Unclassified images and `ARCHITECTURAL_PATTERN` are removed upstream by
 * `galleryItems`. There is no lightbox, no carousel and no autoplay: a handful
 * of images does not need a viewer, and a carousel hides the labels behind an
 * interaction.
 */
export async function GalleryGrid({
  items,
  t: loc,
}: {
  items: readonly MediaAsset[]
  /** Resolves the assets' authored alt text and captions. Named `loc` so it
   *  cannot be confused with the message catalogue below. */
  t: Localizer
}) {
  const t = await getTranslations('projectImages')
  if (items.length === 0) return null

  return (
    <ul className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((asset) => {
        const isContext = asset.imageType === 'EDITORIAL_CONTEXT'

        return (
          <li key={asset.id}>
            <figure className="m-0">
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <SafeImage
                  src={asset.url}
                  alt={loc.text(asset.alt)}
                  className="h-full w-full object-cover"
                  style={
                    asset.focalPoint
                      ? { objectPosition: `${asset.focalPoint.x}% ${asset.focalPoint.y}%` }
                      : undefined
                  }
                />
                <span
                  className={`absolute bottom-0 start-0 px-2.5 py-1.5 text-[11px] font-semibold text-white ${
                    isContext ? 'bg-gray-800/90' : 'bg-surface-inverse/90'
                  }`}
                >
                  {t(isContext ? 'context' : 'projectPhoto')}
                </span>
              </div>

              <figcaption className="mt-2.5 text-[13px] leading-relaxed text-gray-600">
                {loc.text(asset.caption)}
                {/* The second statement, on its own line so it survives the
                    caption being edited or shortened. */}
                {isContext && (
                  <span className="mt-1 block text-gray-600">{t('contextCaption')}</span>
                )}
                {(asset.takenOn || asset.credit) && (
                  <span className="mt-1 block text-gray-600">
                    {[asset.takenOn, asset.credit].filter(Boolean).join(' · ')}
                  </span>
                )}
              </figcaption>
            </figure>
          </li>
        )
      })}
    </ul>
  )
}
