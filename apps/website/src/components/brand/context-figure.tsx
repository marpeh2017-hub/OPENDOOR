import type { MediaAsset } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { SafeImage } from './safe-image'

/** Preserve the full supplied composition, including on mobile. */
export function ContextFigure({ asset, t }: { asset: MediaAsset; t: Localizer }) {
  return (
    <figure className="m-0" data-image-classification="EDITORIAL_CONTEXT">
      <SafeImage src={asset.url} alt={t.text(asset.alt)} width={asset.width} height={asset.height}
        className="h-auto w-full rounded-sm" loading="lazy" />
      <figcaption className="mt-2 text-xs text-gray-600">
        {t({ he: 'להמחשה בלבד', en: 'For illustration only' })}
      </figcaption>
    </figure>
  )
}
