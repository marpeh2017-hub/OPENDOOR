import Image from 'next/image'
import type { ImageSlotSpec } from '@/mock/fixtures/images'
import { ProjectPattern } from './architecture'
import type { Localizer } from '@/lib/localize'
import {
  JerusalemHillside,
  ChordsBridgeGeometry,
  LightRailStreet,
} from './jerusalem'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  ONE SLOT, TWO STATES — DRAWING TODAY, PHOTOGRAPH TOMORROW
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every photographic moment on the homepage goes through this component, so
 * three things are guaranteed in one place rather than remembered in six:
 *
 *   1. THE BOX IS RESERVED BEFORE ANYTHING LOADS. The slot's aspect ratio is
 *      declared in the inventory and applied to the container, so swapping a
 *      drawing for a photograph — or a slow photograph arriving late — cannot
 *      shift the page. This is the whole of the CLS defence.
 *   2. AN EDITORIAL_CONTEXT IMAGE ALWAYS CARRIES ITS CAPTION. Not on hover,
 *      not in a tooltip, not only for screen readers. A photograph of the
 *      Chords Bridge on a company homepage is read as that company's work
 *      unless the page says otherwise, and the caption is what says otherwise.
 *   3. NOTHING CAN BE SHOWN AS A PROJECT PHOTOGRAPH BY ACCIDENT. Only
 *      `VERIFIED_PROJECT_PHOTO` renders without a context caption, and the
 *      project card never passes anything else.
 *
 * ── THE FALLBACK IS A DESIGN, NOT AN ERROR STATE ───────────────────────────
 *
 * When `asset` is null the slot draws its OpenDoor graphic — the hillside, the
 * bridge, the tram street. There is no "image missing" box, no grey rectangle,
 * no blurred placeholder, because the page has to be shippable and handsome in
 * exactly the state it is in now. The photographs will make it better; their
 * absence does not make it unfinished.
 */

/* The drawings, indexed by the inventory's `fallback` key. */
const FALLBACKS = {
  hillside: JerusalemHillside,
  'chords-bridge': ChordsBridgeGeometry,
  'light-rail': LightRailStreet,
  pattern: null,
} as const

export function EditorialImage({
  slot,
  /** Extra classes for the ratio box — used to override the ratio per layout. */
  className = '',
  /** LCP candidate. Exactly one image per page may set this. */
  priority = false,
  /** `sizes` for the responsive srcset. Required whenever an asset exists:
   *  without it Next serves a desktop-width file to a 375px phone. */
  sizes = '100vw',
  /** Suppresses the caption. Legitimate only where the surrounding copy
   *  already states what the image shows and that it is city context. */
  captionHidden = false,
  /** Deterministic seed for the `pattern` fallback. */
  patternSlug = 'opendoor',
  /** Resolves the asset's alt text and caption. Both are authored content now,
   *  and alt text in the wrong language is worse than none: a screen reader
   *  announces it regardless. */
  t,
}: {
  slot: ImageSlotSpec
  className?: string
  priority?: boolean
  sizes?: string
  captionHidden?: boolean
  patternSlug?: string
  t: Localizer
}) {
  const Fallback = FALLBACKS[slot.fallback]
  const asset = slot.asset

  // An EDITORIAL_CONTEXT photograph must say what it is. The drawing does not
  // need to: it is visibly a drawing and therefore claims nothing.
  const needsCaption =
    asset !== null && asset.imageType !== 'VERIFIED_PROJECT_PHOTO' && !captionHidden

  return (
    <figure className="relative m-0">
      <div className={`relative overflow-hidden bg-surface-sunken ${className}`}>
        {asset ? (
          <Image
            src={asset.url}
            alt={t.text(asset.alt)}
            fill
            priority={priority}
            // Below the fold and not the LCP candidate → let the browser defer
            // it. `priority` already implies eager for the one that is.
            loading={priority ? undefined : 'lazy'}
            sizes={sizes}
            className="object-cover"
            style={
              asset.focalPoint
                ? { objectPosition: `${asset.focalPoint.x}% ${asset.focalPoint.y}%` }
                : undefined
            }
          />
        ) : Fallback ? (
          <Fallback />
        ) : (
          <ProjectPattern slug={patternSlug} />
        )}
      </div>

      {needsCaption && (
        <figcaption className="mt-3 text-xs leading-relaxed text-gray-600">
          {t.text(asset.caption)}
          {asset.credit && <span className="text-gray-500"> · {asset.credit}</span>}
        </figcaption>
      )}
    </figure>
  )
}
