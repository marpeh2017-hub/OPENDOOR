import Decimal from 'decimal.js'

/**
 * A one-dimensional root finder for "what input makes this project work?".
 *
 * ── WHY BISECTION AND NOT NEWTON ───────────────────────────────────────────
 *
 * Newton–Raphson converges faster and is the obvious choice for a smooth
 * function. The function here is NOT smooth. One run of the feasibility engine
 * contains an IRR solved numerically, thresholds that flip, interest accrued on
 * a balance that can change sign, and validation rules that switch on at a
 * boundary. A derivative estimated by finite difference across one of those
 * steps points somewhere arbitrary, and Newton will happily run off to a
 * confident, wrong answer — the failure mode where the number LOOKS solved.
 *
 * Bisection needs no derivative, cannot diverge, and halves the interval every
 * iteration whatever the function does inside it. It is slower and it does not
 * matter: forty iterations of an engine run is a fraction of a second, and this
 * is a number somebody signs.
 *
 * ── WHY IT REFUSES RATHER THAN RETURNS ─────────────────────────────────────
 *
 * Bisection is only valid on a bracket — two points whose results straddle the
 * target. If the target is unreachable anywhere in the searched range, there is
 * no root to find, and the honest answer is "this project does not get there",
 * not the nearest endpoint dressed up as a solution. `NOT_BRACKETED` says so,
 * and reports how close the range actually came.
 */

export type GoalSeekStatus =
  | 'CONVERGED'
  | 'NOT_BRACKETED'
  | 'UNDEFINED_AT_BOUNDS'
  | 'DISCONTINUITY'
  | 'EXHAUSTED'

export interface GoalSeekOptions {
  /**
   * The metric, as a function of the input being solved for. Returns null when
   * the metric is undefined at that input — an IRR that does not exist, a margin
   * over zero costs — which is a refusal, not a zero.
   */
  evaluate: (x: Decimal) => Decimal | null
  target: Decimal
  /** The search range for the input. */
  lowerBound: Decimal
  upperBound: Decimal
  /** Stop once the metric is this close to the target. */
  toleranceY: Decimal
  /** Stop once the bracket is this narrow, whatever the metric is doing. */
  toleranceX: Decimal
  maxIterations?: number
}

export interface GoalSeekResult {
  status: GoalSeekStatus
  /** The input that hits the target. Null unless CONVERGED. */
  solution: Decimal | null
  /** The metric at `solution`, or at the best point examined. */
  achieved: Decimal | null
  iterations: number
  /** Populated on NOT_BRACKETED: what the ends of the range actually produce. */
  boundsProbe?: { lower: Decimal | null; upper: Decimal | null }
}

export function goalSeek(options: GoalSeekOptions): GoalSeekResult {
  const { evaluate, target, toleranceY, toleranceX } = options
  const maxIterations = options.maxIterations ?? 80

  let lo = options.lowerBound
  let hi = options.upperBound
  if (lo.gte(hi)) throw new Error('goalSeek: lowerBound must be below upperBound')

  const residual = (x: Decimal): Decimal | null => {
    const value = evaluate(x)
    return value === null ? null : value.minus(target)
  }

  let residualLo = residual(lo)
  let residualHi = residual(hi)
  let iterations = 2

  // A metric that does not exist at the edge of the range cannot be bracketed
  // against. Reported separately from NOT_BRACKETED because the fix is
  // different: this one is usually an incomplete cash flow, not an impossible
  // target.
  if (residualLo === null || residualHi === null) {
    return { status: 'UNDEFINED_AT_BOUNDS', solution: null, achieved: null, iterations }
  }

  // The target is already sitting exactly on an endpoint.
  if (residualLo.abs().lte(toleranceY)) {
    return { status: 'CONVERGED', solution: lo, achieved: residualLo.plus(target), iterations }
  }
  if (residualHi.abs().lte(toleranceY)) {
    return { status: 'CONVERGED', solution: hi, achieved: residualHi.plus(target), iterations }
  }

  // Same sign at both ends: the target is not crossed anywhere in the range.
  if (residualLo.isPositive() === residualHi.isPositive()) {
    return {
      status: 'NOT_BRACKETED',
      solution: null,
      achieved: null,
      iterations,
      boundsProbe: { lower: residualLo.plus(target), upper: residualHi.plus(target) },
    }
  }

  let mid = lo
  let residualMid: Decimal | null = residualLo

  while (iterations < maxIterations) {
    mid = lo.plus(hi).div(2)
    residualMid = residual(mid)
    iterations += 1

    // A hole in the middle of an otherwise valid bracket. Bisection cannot
    // reason about it, and guessing a side would be inventing a root.
    if (residualMid === null) {
      return { status: 'UNDEFINED_AT_BOUNDS', solution: null, achieved: null, iterations }
    }

    if (residualMid.abs().lte(toleranceY)) {
      return { status: 'CONVERGED', solution: mid, achieved: residualMid.plus(target), iterations }
    }

    // The bracket has collapsed to a point but the metric is still far from the
    // target: the function JUMPS across the target rather than crossing it, so
    // there is no input that produces it.
    //
    // This is the case that makes the difference between a solver and a number
    // generator. Exiting on the x-tolerance alone would return this midpoint as
    // CONVERGED with a residual of any size, and it would be indistinguishable
    // from a real solution. A discontinuity is a genuine answer — "the project
    // steps straight past that target" — and it has to be said, not smoothed.
    if (hi.minus(lo).abs().lte(toleranceX)) {
      return {
        status: 'DISCONTINUITY',
        solution: null,
        achieved: residualMid.plus(target),
        iterations,
      }
    }

    // Keep the half that still straddles the target.
    if (residualMid.isPositive() === residualLo.isPositive()) {
      lo = mid
      residualLo = residualMid
    } else {
      hi = mid
      residualHi = residualMid
    }
  }

  // The bracket was real but the iteration budget ran out. The midpoint is a
  // genuine approximation, so it is returned — labelled, never as CONVERGED.
  return {
    status: 'EXHAUSTED',
    solution: mid,
    achieved: residualMid === null ? null : residualMid.plus(target),
    iterations,
  }
}
