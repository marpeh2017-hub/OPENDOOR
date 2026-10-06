import type { MediaAsset } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { SafeImage } from './safe-image'

/**
 * Preserve the full supplied composition, including on mobile. `wide` is the
 * exception: a 16:9 crop for a row that has to stay short, used only on
 * pictures checked to survive it (the journey's stages).
 */
export function ContextFigure({ asset, t, uniform = false, wide = false, captionHidden = false }: { asset: MediaAsset; t: Localizer; uniform?: boolean; wide?: boolean; captionHidden?: boolean }) {
  // A caption line only when there is something to put in it.
  const hasCaption = Boolean(asset.caption || asset.credit)
  const fit = wide
    ? 'aspect-[16/9] w-full rounded-sm object-cover'
    : uniform ? 'aspect-[4/3] w-full rounded-sm object-cover' : 'h-auto w-full rounded-sm'
  return (
    <figure className="m-0" data-image-classification="EDITORIAL_CONTEXT">
      <SafeImage src={asset.url} alt={t.text(asset.alt)} width={asset.width} height={asset.height}
        className={fit} loading="lazy" />
      {!captionHidden && hasCaption && <figcaption className="mt-3 text-xs leading-relaxed text-gray-600">
        {t.text(asset.caption)}
        {asset.credit && <span> · {asset.credit}</span>}
      </figcaption>}
    </figure>
  )
}
