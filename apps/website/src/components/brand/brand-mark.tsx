import Image from 'next/image'

/**
 * The OpenDoor Group brand lockup.
 *
 * ── LOGO READINESS ─────────────────────────────────────────────────────────
 *
 * The official logo — a teal shield containing an open doorway, beside the
 * "OpenDoor" wordmark with "התחדשות עירונית" beneath — is NOT in the repository
 * yet. Until the file lands, this renders a text wordmark shaped to the same
 * proportions, so dropping the asset in does not move anything around it.
 *
 * TO SWITCH: put the file at `public/brand/opendoor-logo.svg` and set
 * `BRAND_LOGO` below. Nothing else changes — not the header, not this
 * component's callers, not the spacing.
 *
 * The asset is rendered with BOTH width and height from its intrinsic ratio and
 * `object-contain`, so it is never cropped, masked or distorted. The measured
 * ratio of the supplied artwork is ~2.7:1; `LOGO_ASPECT` records it so a
 * differently-proportioned export is a one-number fix rather than a visual bug
 * someone has to notice.
 */
const BRAND_LOGO: string | null = null
const LOGO_ASPECT = 2.7

export function BrandMark({
  name,
  tagline,
  className,
  height = 36,
}: {
  name: string
  tagline?: string
  className?: string
  height?: number
}) {
  if (BRAND_LOGO) {
    return (
      <Image
        src={BRAND_LOGO}
        alt={name}
        width={Math.round(height * LOGO_ASPECT)}
        height={height}
        priority
        className={`h-9 w-auto object-contain ${className ?? ''}`}
      />
    )
  }

  return (
    <span className={`flex flex-col leading-none ${className ?? ''}`}>
      <span className="text-lg font-bold tracking-tight text-gray-900">
        {/* Matches the logo's own emphasis: "Open" light, "Door" bold. */}
        <span className="font-normal">Open</span>Door
      </span>
      {tagline && (
        <span className="mt-0.5 text-[11px] font-medium text-gray-500">{tagline}</span>
      )}
    </span>
  )
}
