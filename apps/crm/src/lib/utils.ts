import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Join a building's street name and house number for display.
 *
 * `CreateBuildingDto.address` is documented as the street NAME only, but seed
 * rows and imported data have historically carried the number inside `address`
 * too — which rendered as `הרצל 45 45`. Appending only when the address does
 * not already end with that number keeps dirty rows readable without silently
 * rewriting stored data.
 */
export function formatStreetAddress(
  address: string | null | undefined,
  streetNumber?: string | null,
): string {
  const street = (address ?? '').trim()
  const number = (streetNumber ?? '').trim()
  if (!number) return street
  if (!street) return number
  // Match the number as a trailing token, e.g. 'הרצל 45' or 'הרצל 45א'.
  const trailing = street.split(/\s+/).at(-1) ?? ''
  if (trailing === number) return street
  return `${street} ${number}`
}
