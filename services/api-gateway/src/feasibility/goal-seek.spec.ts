import Decimal from 'decimal.js'
import { goalSeek } from './goal-seek'

const D = (value: number | string) => new Decimal(value)

const defaults = {
  target: D(0),
  lowerBound: D(-10),
  upperBound: D(10),
  toleranceY: D('1e-9'),
  toleranceX: D('1e-12'),
}

describe('goalSeek', () => {
  describe('finding the root', () => {
    it('solves a straight line', () => {
      // 2x - 8 = 0  →  x = 4
      const result = goalSeek({ ...defaults, evaluate: (x) => x.mul(2).minus(8) })
      expect(result.status).toBe('CONVERGED')
      expect(result.solution!.toNumber()).toBeCloseTo(4, 9)
    })

    it('solves for a non-zero target', () => {
      // x² = 2 on [0, 10]
      const result = goalSeek({
        ...defaults, target: D(2), lowerBound: D(0),
        evaluate: (x) => x.mul(x),
      })
      expect(result.status).toBe('CONVERGED')
      expect(result.solution!.toNumber()).toBeCloseTo(Math.SQRT2, 8)
    })

    it('solves a decreasing function, not just an increasing one', () => {
      // Costs go up, profit goes down: the bracket is the other way round and
      // the solver must not assume a direction.
      const result = goalSeek({ ...defaults, evaluate: (x) => D(8).minus(x.mul(2)) })
      expect(result.status).toBe('CONVERGED')
      expect(result.solution!.toNumber()).toBeCloseTo(4, 9)
    })

    it('reports the metric it achieved, not just the input', () => {
      const result = goalSeek({ ...defaults, target: D(5), evaluate: (x) => x.mul(3) })
      // Within the tolerance the solver was ASKED for — not tighter.
      expect(result.achieved!.minus(5).abs().lte(defaults.toleranceY)).toBe(true)
    })

    it('returns a bound immediately when the target is already met there', () => {
      const result = goalSeek({ ...defaults, lowerBound: D(4), upperBound: D(10), evaluate: (x) => x.minus(4) })
      expect(result.status).toBe('CONVERGED')
      expect(result.solution!.toNumber()).toBe(4)
      expect(result.iterations).toBe(2)
    })
  })

  describe('refusing instead of inventing', () => {
    it('says NOT_BRACKETED when the target is out of reach', () => {
      // x² is never negative — no amount of searching finds -1.
      const result = goalSeek({ ...defaults, target: D(-1), evaluate: (x) => x.mul(x) })
      expect(result.status).toBe('NOT_BRACKETED')
      expect(result.solution).toBeNull()
    })

    it('reports how close the range actually came, so the answer is actionable', () => {
      const result = goalSeek({
        ...defaults, target: D(100), lowerBound: D(0), upperBound: D(10),
        evaluate: (x) => x.mul(2),
      })
      expect(result.status).toBe('NOT_BRACKETED')
      // "the best this range reaches is 20, you asked for 100"
      expect(result.boundsProbe!.lower!.toNumber()).toBe(0)
      expect(result.boundsProbe!.upper!.toNumber()).toBe(20)
    })

    it('does not return the nearest endpoint dressed up as a solution', () => {
      const result = goalSeek({
        ...defaults, target: D(100), lowerBound: D(0), upperBound: D(10),
        evaluate: (x) => x.mul(2),
      })
      expect(result.solution).toBeNull()
      expect(result.achieved).toBeNull()
    })

    it('refuses when the metric does not exist at a bound', () => {
      const result = goalSeek({ ...defaults, evaluate: (x) => (x.lte(-10) ? null : x) })
      expect(result.status).toBe('UNDEFINED_AT_BOUNDS')
      expect(result.solution).toBeNull()
    })

    it('refuses when the metric vanishes inside a valid bracket', () => {
      // Brackets fine at the ends, but there is a hole where the root would be.
      const result = goalSeek({
        ...defaults,
        evaluate: (x) => (x.abs().lt(3) ? null : x),
      })
      expect(result.status).toBe('UNDEFINED_AT_BOUNDS')
      expect(result.solution).toBeNull()
    })

    it('labels an exhausted search rather than calling it converged', () => {
      const result = goalSeek({
        ...defaults, toleranceY: D('1e-40'), toleranceX: D('1e-40'), maxIterations: 6,
        evaluate: (x) => x.mul(2).minus(8),
      })
      expect(result.status).toBe('EXHAUSTED')
      // The approximation is still handed back — it is just not claimed as exact.
      expect(result.solution).not.toBeNull()
    })
  })

  describe('it survives the shapes a real engine produces', () => {
    it('finds a root through a step, when the step still crosses the target', () => {
      // A threshold flipping mid-range is what breaks a derivative-based solver.
      // Bisection only ever asks which side of the target it is on, so a jump it
      // can still straddle is no obstacle.
      const result = goalSeek({
        ...defaults, lowerBound: D(0), upperBound: D(10),
        // Jumps down by 5 at x=5, and still crosses zero at x=7.
        evaluate: (x) => (x.lt(5) ? x.minus(2) : x.minus(7)),
      })
      expect(result.status).toBe('CONVERGED')
      expect(result.solution!.toNumber()).toBeCloseTo(7, 8)
      expect(result.achieved!.abs().lte(defaults.toleranceY)).toBe(true)
    })

    it('says DISCONTINUITY when the metric jumps straight over the target', () => {
      // g goes from -3 to +3 at x=5 without ever being 0. The bracket is real,
      // the sign change is real, and there is still no solution. Returning the
      // collapsed midpoint as CONVERGED would be a wrong number wearing the
      // right label.
      const result = goalSeek({
        ...defaults, lowerBound: D(0), upperBound: D(10),
        evaluate: (x) => (x.lt(5) ? x.minus(8) : x.minus(2)),
      })
      expect(result.status).toBe('DISCONTINUITY')
      expect(result.solution).toBeNull()
      // It still reports what the metric does at the jump, so the gap is visible.
      expect(result.achieved!.abs().toNumber()).toBeGreaterThan(1)
    })

    it('converges in a sane number of iterations', () => {
      const result = goalSeek({ ...defaults, evaluate: (x) => x.mul(2).minus(8) })
      expect(result.iterations).toBeLessThan(80)
    })

    it('rejects an inverted range rather than searching backwards', () => {
      expect(() => goalSeek({ ...defaults, lowerBound: D(10), upperBound: D(-10), evaluate: (x) => x }))
        .toThrow(/lowerBound/)
    })
  })
})
