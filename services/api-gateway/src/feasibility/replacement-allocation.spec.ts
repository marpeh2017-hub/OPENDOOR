import { replacementAllocationSummary as summarize } from './replacement-allocation'

const row = (ownerApartmentId: string, shareNumerator = 1, shareDenominator = 1, unitReference = 'A') => ({ ownerApartmentId, shareNumerator, shareDenominator, unitReference })

describe('replacement allocation fractions', () => {
  it('accepts exact thirds without floating point drift', () => {
    expect(summarize([row('1', 1, 3), row('2', 1, 3), row('3', 1, 3)])).toEqual({ unitCount: 1, invalid: false, incomplete: false, overallocated: false })
  })
  it('detects partial allocation', () => expect(summarize([row('1', 1, 2)]).incomplete).toBe(true))
  it('detects overallocation', () => expect(summarize([row('1'), row('2', 1, 2)]).overallocated).toBe(true))
  it('rejects repeated ownership in the same unit', () => expect(summarize([row('1', 1, 2), row('1', 1, 2)]).invalid).toBe(true))
  it('permits one holding to receive multiple distinct units', () => {
    expect(summarize([row('1'), row('1', 1, 1, 'B')])).toEqual({ unitCount: 2, invalid: false, incomplete: false, overallocated: false })
  })
  it.each([[0, 1], [1, 0], [-1, 2], [2, 1], [1.5, 2], [NaN, 2], [1, Infinity]])('rejects invalid fraction %s/%s', (n, d) => expect(summarize([row('1', n, d)]).invalid).toBe(true))
  it('rejects missing identifiers', () => expect(summarize([row('', 1, 1, '')]).invalid).toBe(true))
})
