/**
 * Exact ownership-fraction arithmetic (src/common/fractions).
 *
 * Pure unit tests — no DB, no Nest app. They live under test/ because the Jest
 * config's testRegex only picks up `test/*.e2e-spec.ts`.
 */
import {
  Fraction,
  sumFractions,
  sumFractionParts,
  sharesSumToWhole,
  percentToFraction,
  compareToThreshold,
  ratio,
  bigGcd,
} from '../src/common/fractions'

const part = (n: number, d: number) => ({ shareNumerator: n, shareDenominator: d })

describe('Fraction — exact rational arithmetic', () => {
  it('1/3 + 1/3 + 1/3 is EXACTLY 1, and so is 1/6 + 4/6 + 1/6 (which floats get wrong)', () => {
    const sum = sumFractionParts([part(1, 3), part(1, 3), part(1, 3)])
    expect(sum.isOne()).toBe(true)
    expect(sum.toString()).toBe('1/1')
    expect(sumFractions([part(1, 3), part(1, 3), part(1, 3)])).toEqual({ num: 1, den: 1 })
    // A three-heir split that DOES drift below 1 in IEEE-754 — the kind of
    // case that forced the epsilon into the old threshold engine:
    expect(1 / 6 + 4 / 6 + 1 / 6).toBe(0.9999999999999999)
    expect(sumFractionParts([part(1, 6), part(4, 6), part(1, 6)]).isOne()).toBe(true)
  })

  it('2/3 + 1/3 is exactly 1', () => {
    expect(sharesSumToWhole([part(2, 3), part(1, 3)])).toBe(true)
  })

  it('25% is exactly 1/4 and four quarters make a whole', () => {
    expect(percentToFraction(25).toString()).toBe('1/4')
    expect(percentToFraction(25).equals(Fraction.from(1, 4))).toBe(true)
    expect(sharesSumToWhole([part(1, 4), part(1, 4), part(1, 4), part(1, 4)])).toBe(true)
  })

  it('999/1000 is NOT 1 — the old `>= 0.999` epsilon counted it as fully signed', () => {
    const almost = Fraction.from(999, 1000)
    expect(almost.isOne()).toBe(false)
    expect(almost.lt(Fraction.ONE)).toBe(true)
    // the defect being fixed: float + epsilon accepted this
    expect(999 / 1000 >= 0.999).toBe(true)
  })

  it('sums many small shares without drift', () => {
    const parts = Array.from({ length: 1000 }, () => part(1, 1000))
    expect(sumFractionParts(parts).isOne()).toBe(true)
    const missingOne = parts.slice(0, 999)
    expect(sumFractionParts(missingOne).toString()).toBe('999/1000')
    expect(sharesSumToWhole(missingOne)).toBe(false)
  })

  it('reduces, normalises sign, and compares exactly', () => {
    expect(Fraction.from(6, 8).toString()).toBe('3/4')
    expect(Fraction.from(1, -2).toString()).toBe('-1/2')
    expect(Fraction.from(1, 3).compare(Fraction.from(2, 6))).toBe(0)
    expect(Fraction.from(1, 3).compare(Fraction.from(1, 2))).toBe(-1)
    expect(Fraction.from(1, 2).compare(Fraction.from(1, 3))).toBe(1)
    expect(bigGcd(48n, 18n)).toBe(6n)
  })

  it('rejects a zero denominator and skips malformed rows in a sum', () => {
    expect(() => Fraction.from(1, 0)).toThrow(RangeError)
    expect(Fraction.tryFrom(1, 0)).toBeNull()
    expect(Fraction.tryFrom(1.5, 2)).toBeNull()
    // malformed rows are reported by the Data Quality rule, not thrown here
    expect(sumFractionParts([part(1, 2), part(1, 0), part(1, 2)]).isOne()).toBe(true)
  })

  it('clamps over-registered ownership to 1', () => {
    expect(sumFractionParts([part(2, 3), part(2, 3)]).clamp01().isOne()).toBe(true)
    expect(Fraction.from(-1, 2).clamp01().isZero()).toBe(true)
  })
})

describe('compareToThreshold — display never contradicts the decision', () => {
  it('66.96% against a 67% requirement displays 66.9% and is NOT reached', () => {
    // 1874/2800 = 66.928…% — the old code rounded to 67.0 while reached was false
    const { reached, displayPct } = compareToThreshold(Fraction.from(6696, 10000), 67)
    expect(reached).toBe(false)
    expect(displayPct).toBe(66.9)
    expect(displayPct < 67).toBe(true)
  })

  it('exactly 67% is reached and displays 67', () => {
    const { reached, displayPct } = compareToThreshold(Fraction.from(67, 100), 67)
    expect(reached).toBe(true)
    expect(displayPct).toBe(67)
  })

  it('one tick below the requirement is not reached', () => {
    expect(compareToThreshold(Fraction.from(669999, 1000000), 67).reached).toBe(false)
  })

  it('2/3 signed does not reach a 67% requirement (66.66…%)', () => {
    const r = compareToThreshold(Fraction.from(2, 3), 67)
    expect(r.reached).toBe(false)
    expect(r.displayPct).toBe(66.6)
  })

  it('a fractional requirement never displays below itself when reached', () => {
    // 66.671% achieved against a 66.67% requirement: truncating to 1 decimal
    // would show 66.6 (< requirement) while reached is true — so we show 66.67
    const r = compareToThreshold(Fraction.from(66671, 100000), 66.67)
    expect(r.reached).toBe(true)
    expect(r.displayPct).toBeGreaterThanOrEqual(66.67)
  })

  it('display >= required if and only if reached, across a sweep', () => {
    for (let n = 0; n <= 200; n++) {
      const achieved = Fraction.from(n, 200)
      for (const required of [50, 66.67, 67, 80, 100]) {
        const { reached, displayPct } = compareToThreshold(achieved, required)
        expect(displayPct >= required).toBe(reached)
      }
    }
  })

  it('0 of 0 units is 0% and never reached', () => {
    const r = compareToThreshold(ratio(Fraction.ZERO, 0), 67)
    expect(r.reached).toBe(false)
    expect(r.displayPct).toBe(0)
  })

  it('100% of units reaches a 100% requirement', () => {
    const r = compareToThreshold(ratio(Fraction.from(12), 12), 100)
    expect(r.reached).toBe(true)
    expect(r.displayPct).toBe(100)
  })
})

describe('threshold arithmetic mirrors ThresholdService', () => {
  /** SHARES basis: sum of per-apartment signed fractions over apartment count. */
  const sharesPct = (apts: number[][][], requiredPct: number) => {
    let signed = Fraction.ZERO
    for (const owners of apts) {
      let apt = Fraction.ZERO
      for (const [n, d] of owners) apt = apt.add(Fraction.from(n as number, d as number))
      signed = signed.add(apt.clamp01())
    }
    return compareToThreshold(ratio(signed, apts.length), requiredPct)
  }

  it('three apartments, all thirds signed, is exactly 100%', () => {
    const thirds = [[1, 3], [1, 3], [1, 3]]
    const r = sharesPct([thirds, thirds, thirds], 67)
    expect(r.displayPct).toBe(100)
    expect(r.reached).toBe(true)
  })

  it('an unsigned 1/1000 owner keeps the apartment out of signedUnits', () => {
    const signedShares = [[999, 1000]]
    let apt = Fraction.ZERO
    for (const [n, d] of signedShares) apt = apt.add(Fraction.from(n as number, d as number))
    expect(apt.isOne()).toBe(false) // old code: 0.999 >= 0.999 → counted as signed
  })

  it('2 of 3 apartments fully signed falls short of 67% on SHARES', () => {
    const whole = [[1, 1]]
    const r = sharesPct([whole, whole, []], 67)
    expect(r.displayPct).toBe(66.6)
    expect(r.reached).toBe(false)
  })
})
