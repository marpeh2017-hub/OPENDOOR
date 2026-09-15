import type { MediaAsset } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { SafeImage } from './safe-image'

/** Preserve the full supplied composition, including on mobile. */
export function ContextFigure({ asset, t, uniform = false, captionHidden = false }: { asset: MediaAsset; t: Localizer; uniform?: boolean; captionHidden?: boolean }) {
  return (
    <figure className="m-0" data-image-classification="EDITORIAL_CONTEXT">
      <SafeImage src={asset.url} alt={t.text(asset.alt)} width={asset.width} height={asset.height}
        className={uniform ? 'aspect-[4/3] w-full rounded-sm object-cover' : 'h-auto w-full rounded-sm'} loading="lazy" />
      {!captionHidden && <figcaption className="mt-3 text-xs leading-relaxed text-gray-600">
        {t.text(asset.caption)}
        {asset.credit && <span> · {asset.credit}</span>}
      </figcaption>}
    </figure>
  )
}
