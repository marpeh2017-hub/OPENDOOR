import Image from 'next/image'

/**
 * The OpenDoor Group logo: the shield with the open door, beside "OpenDoor"
 * and "התחדשות עירונית".
 *
 * ── WHY AN SVG WITH OUTLINES ───────────────────────────────────────────────
 *
 * `public/brand/opendoor-logo.svg` is the vector master from the brand kit,
 * with the wordmark converted to outlines (Poppins Light and SemiBold,
 * Assistant SemiBold). As live text it would need those fonts, which this
 * site does not load, and an SVG shown as an image cannot fetch them. As
 * outlines it is sharp at every size and screen density from one 9KB file.
 * next/image serves SVG as it is, without the optimiser.
 *
 * ── SIZES ──────────────────────────────────────────────────────────────────
 *
 * The header bar is 64px tall. The logo is 44px tall from `sm` up and 40px
 * on phones, which keeps the Hebrew line at about 10-11px. Smaller than that,
 * use the shield on its own.
 */
const LOGO = { src: '/brand/opendoor-logo.svg', width: 984, height: 366 }

const VARIANTS = {
  header: { className: 'h-10 w-auto sm:h-11', priority: true },
  footer: { className: 'h-12 w-auto', priority: false },
  // A printed form's letterhead: the Word file's logo is 4.4cm wide.
  document: { className: 'h-[58px] w-auto', priority: false },
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
      priority={v.priority}
      className={`${v.className} ${className ?? ''}`}
    />
  )
}
