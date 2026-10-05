import Image from 'next/image'

/**
 * The OpenDoor Group logo: the shield with the open door, beside "OpenDoor"
 * and "התחדשות עירונית".
 *
 * ── WHY A PNG ──────────────────────────────────────────────────────────────
 *
 * `public/brand/opendoor-logo.png` is rendered from the vector master in the
 * brand kit, transparent, 1200x446. The master's wordmark is live text in
 * Poppins and Assistant, which this site does not load, and an SVG shown as
 * an image cannot fetch fonts, so the SVG would draw the wordmark in a
 * fallback face. next/image serves the PNG at the width and density each
 * screen needs, from `sizes`. The favicon (`app/icon.svg`) is the shield
 * alone, which has no text, so it stays vector.
 *
 * ── SIZES ──────────────────────────────────────────────────────────────────
 *
 * The header bar is 64px tall. The logo is 44px tall from `sm` up and 40px
 * on phones, which keeps the Hebrew line at about 10-11px. Phones narrower
 * than 375px get 38px, so the header row still fits a 360px screen (see
 * SiteHeader). Smaller than that, use the shield on its own.
 *
 * `sizes` states about a third more than the drawn width (119px in the
 * header, 108px on phones, 129px in the footer). Stated exactly, a screen at
 * 125% scaling, common on Windows laptops, was sent the 128px file for a
 * 149-pixel slot and the wordmark came out soft.
 */
const LOGO = { src: '/brand/opendoor-logo.png', width: 1200, height: 446 }

const VARIANTS = {
  header: { className: 'h-[38px] w-auto min-[375px]:h-10 sm:h-11', sizes: '(min-width: 640px) 160px, 144px', priority: true },
  footer: { className: 'h-12 w-auto', sizes: '176px', priority: false },
} as const

export function BrandMark({
  name,
  variant = 'header',
  className,
}: {
  /** The accessible name. The image itself carries the logo's text. */
  name: string
  variant?: keyof typeof VARIANTS
  className?: string
}) {
  const v = VARIANTS[variant]
  return (
    <Image
      src={LOGO.src}
      alt={name}
      width={LOGO.width}
      height={LOGO.height}
      sizes={v.sizes}
      priority={v.priority}
      className={`${v.className} ${className ?? ''}`}
    />
  )
}
