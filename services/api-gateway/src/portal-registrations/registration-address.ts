/**
 * Whether an address someone typed is one of our buildings.
 *
 * People write "רחוב הרצל 12", "הרצל 12" and "הרצל, 12" for the same door,
 * and a building may keep its number in `address` or in `streetNumber`. So
 * both sides are reduced to letters and digits, without the street-type word
 * in front, and the city has to agree when both sides have one. Nothing
 * fuzzier: a wrong match would put a stranger's request on somebody's
 * building, and staff see the address either way.
 */

const STREET_WORD = /^(?:רחוב|רח['׳]|שדרות|שד['׳]|סמטת|סמ['׳])\s*/u

export function addressKey(value: string): string {
  return value.trim().replace(STREET_WORD, '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()
}

function cityKey(value: string | null | undefined): string {
  return (value ?? '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()
}

export interface BuildingAddress {
  id: string
  address: string
  streetNumber: string | null
  city: string | null
}

export function matchBuilding(buildings: readonly BuildingAddress[], address: string, city: string): string | null {
  const wanted = addressKey(address)
  const wantedCity = cityKey(city)
  if (!wanted) return null
  const found = buildings.find((building) => {
    if (building.city && wantedCity && cityKey(building.city) !== wantedCity) return false
    const keys = [addressKey(building.address), addressKey(`${building.address} ${building.streetNumber ?? ''}`)]
    return keys.includes(wanted)
  })
  return found?.id ?? null
}

/** "12" before "3" would read as a mistake; apartments sort the way people count. */
export function byApartmentNumber(a: string, b: string): number {
  return a.localeCompare(b, 'he', { numeric: true })
}
