import { addressKey, byApartmentNumber, matchBuilding } from './registration-address'

const buildings = [
  { id: 'herzl', address: 'הרצל', streetNumber: '12', city: 'ירושלים' },
  { id: 'jaffa', address: 'רחוב יפו 40', streetNumber: null, city: 'ירושלים' },
  { id: 'jaffa-tlv', address: 'יפו 40', streetNumber: null, city: 'תל אביב' },
  { id: 'no-city', address: 'הנביאים 3', streetNumber: null, city: null },
]

describe('registration address matching', () => {
  it('reads the same door the same way, however it is typed', () => {
    expect(addressKey('רחוב הרצל 12')).toBe(addressKey('הרצל, 12'))
    expect(addressKey("רח' הרצל 12")).toBe(addressKey('הרצל 12'))
    expect(addressKey('שדרות הרצל 12')).toBe(addressKey('הרצל 12'))
  })

  it('finds a building whose number is kept apart from the street', () => {
    expect(matchBuilding(buildings, 'רחוב הרצל 12', 'ירושלים')).toBe('herzl')
  })

  it('needs the city to agree when both sides have one', () => {
    expect(matchBuilding(buildings, 'יפו 40', 'תל אביב')).toBe('jaffa-tlv')
    expect(matchBuilding(buildings, 'יפו 40', 'ירושלים')).toBe('jaffa')
    expect(matchBuilding(buildings, 'הנביאים 3', 'ירושלים')).toBe('no-city')
  })

  it('matches nothing rather than something close', () => {
    expect(matchBuilding(buildings, 'הרצל 1', 'ירושלים')).toBeNull()
    expect(matchBuilding(buildings, 'הרצל 120', 'ירושלים')).toBeNull()
    expect(matchBuilding(buildings, '', 'ירושלים')).toBeNull()
  })

  it('sorts apartments the way people count', () => {
    expect(['12', '3', '1', '2א'].sort(byApartmentNumber)).toEqual(['1', '2א', '3', '12'])
  })
})
