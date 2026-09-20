/**
 * Exact rational arithmetic for ownership shares.
 *
 * WHY THIS EXISTS
 * ---------------
 * Ownership fractions (`OwnerApartment.shareNumerator` / `shareDenominator`)
 * drive the pinuy-binuy signature threshold, which is a legally consequential
 * number. Floating point is not acceptable there:
 *
 *   - Share sums drift: `1/6 + 4/6 + 1/6` is `0.9999999999999999` in IEEE-754,
 *     so a fully signed three-heir apartment looked unsigned. That forced a
 *     magic `>= 0.999` epsilon into the threshold engine, and in the SHARES
 *     basis the drift compounded across every apartment in the project.
 *   - That epsilon then produced the opposite, worse defect: an apartment where
 *     owners holding `999/1000` had signed — i.e. a real owner with a `1/1000`
 *     share had NOT signed — was counted as FULLY SIGNED.
 *
 * Everything here is BigInt-backed, always reduced, and contains no epsilon and
 * no float. `1/3 + 1/3 + 1/3 === 1` by construction, and `999/1000 !== 1`.
 *
 * Single source of truth: Data Quality, ThresholdService, the entity CRUD
 * services and (later) Excel import all consume this module. Do not reimplement
 * fraction maths anywhere else.
 */

export interface FractionParts {
  readonly shareNumerator: number
  readonly shareDenominator: number
}

/** An exact, always-reduced, non-negative-denominator rational number. */
export class Fraction {
  /** Always reduced; `den` is always > 0n. */
  readonly num: bigint
  readonly den: bigint

  private constructor(num: bigint, den: bigint) {
    this.num = num
    this.den = den
  }

  /** Normalises sign and reduces by the GCD. The only way a Fraction is built. */
  private static reduce(num: bigint, den: bigint): Fraction {
    let n = num
    let d = den
    if (d < 0n) { n = -n; d = -d }
    const g = bigGcd(n, d) || 1n
    return new Fraction(n / g, d / g)
  }

  static readonly ZERO = new Fraction(0n, 1n)
  static readonly ONE = new Fraction(1n, 1n)

  /**
   * Builds a reduced fraction. Throws on a zero denominator — callers that
   * tolerate malformed data (Data Quality reports on it rather than throwing)
   * should filter first or use {@link tryFrom}.
   */
  static from(num: number | bigint, den: number | bigint = 1): Fraction {
    const n = toBigInt(num, 'numerator')
    const d = toBigInt(den, 'denominator')
    if (d === 0n) throw new RangeError('Fraction denominator must not be zero')
    return Fraction.reduce(n, d)
  }

  /** Non-throwing variant: returns `null` for malformed input. */
  static tryFrom(num: number | bigint, den: number | bigint = 1): Fraction | null {
    try {
      return Fraction.from(num, den)
    } catch {
      return null
    }
  }

  static fromParts(part: FractionParts): Fraction | null {
    return Fraction.tryFrom(part.shareNumerator, part.shareDenominator)
  }

  add(other: Fraction): Fraction {
    return Fraction.reduce(this.num * other.den + other.num * this.den, this.den * other.den)
  }

  sub(other: Fraction): Fraction {
    return Fraction.reduce(this.num * other.den - other.num * this.den, this.den * other.den)
  }

  mul(other: Fraction): Fraction {
    return Fraction.reduce(this.num * other.num, this.den * other.den)
  }

  /** -1 if `this < other`, 0 if equal, 1 if greater. Exact — no epsilon. */
  compare(other: Fraction): -1 | 0 | 1 {
    const left = this.num * other.den
    const right = other.num * this.den
    return left < right ? -1 : left > right ? 1 : 0
  }

  equals(other: Fraction): boolean {
    return this.compare(other) === 0
  }

  lt(other: Fraction): boolean { return this.compare(other) < 0 }
  lte(other: Fraction): boolean { return this.compare(other) <= 0 }
  gt(other: Fraction): boolean { return this.compare(other) > 0 }
  gte(other: Fraction): boolean { return this.compare(other) >= 0 }

  isZero(): boolean { return this.num === 0n }
  /** Exactly 1 — never "close to 1". */
  isOne(): boolean { return this.equals(Fraction.ONE) }
  isNegative(): boolean { return this.num < 0n }

  /** Clamps into `[0, 1]` exactly. */
  clamp01(): Fraction {
    if (this.isNegative()) return Fraction.ZERO
    if (this.gt(Fraction.ONE)) return Fraction.ONE
    return this
  }

  min(other: Fraction): Fraction { return this.lte(other) ? this : other }

  /**
   * Lossy on purpose — for DISPLAY ONLY. Never make a decision from this value.
   * Decisions use {@link compare} / {@link gte}.
   */
  toNumber(): number {
    return Number(this.num) / Number(this.den)
  }

  /** `{ num, den }` as plain numbers, for JSON payloads and audit metadata. */
  toJSON(): { num: number; den: number } {
    return { num: Number(this.num), den: Number(this.den) }
  }

  toString(): string {
    return `${this.num}/${this.den}`
  }
}

function toBigInt(v: number | bigint, label: string): bigint {
  if (typeof v === 'bigint') return v
  if (!Number.isFinite(v) || !Number.isInteger(v)) {
    throw new RangeError(`Fraction ${label} must be a finite integer, received ${v}`)
  }
  return BigInt(v)
}

function bigAbs(v: bigint): bigint {
  return v < 0n ? -v : v
}

export function bigGcd(a: bigint, b: bigint): bigint {
  let x = bigAbs(a)
  let y = bigAbs(b)
  while (y !== 0n) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

// ─── Aggregate helpers ──────────────────────────────────────────────────────

/**
 * Sums a list of ownership rows exactly.
 *
 * Rows with a zero/non-finite denominator are SKIPPED (matching the previous
 * Data Quality behaviour — malformed rows are reported by their own rule rather
 * than blowing up the sum).
 */
export function sumFractionParts(parts: readonly FractionParts[]): Fraction {
  let acc = Fraction.ZERO
  for (const p of parts) {
    const f = Fraction.fromParts(p)
    if (f === null) continue
    acc = acc.add(f)
  }
  return acc
}

/**
 * Backwards-compatible shape used by the Data Quality ownership rule and by API
 * responses: reduced `{ num, den }` as plain numbers.
 */
export function sumFractions(parts: readonly FractionParts[]): { num: number; den: number } {
  return sumFractionParts(parts).toJSON()
}

/** True only when the shares sum to EXACTLY 1. `999/1000` is false. */
export function sharesSumToWhole(parts: readonly FractionParts[]): boolean {
  return sumFractionParts(parts).isOne()
}

// ─── Percentage / threshold helpers ─────────────────────────────────────────

/**
 * Converts a percentage that may carry decimals (e.g. `66.67`) into an exact
 * fraction of 1 — `66.67%` becomes `6667/10000`, not `0.6667`.
 */
export function percentToFraction(pct: number): Fraction {
  if (!Number.isFinite(pct)) throw new RangeError(`Invalid percentage: ${pct}`)
  // Percentages are stored with at most 2 decimals anywhere in the schema.
  const scaled = Math.round(pct * 10_000)
  return Fraction.from(scaled, 1_000_000)
}

/**
 * EXACT decimal-string → Fraction. This is the entry point for any value that
 * arrives as TEXT (a spreadsheet cell, a form field, an API string).
 *
 * `percentToFraction` above takes a `number`, which means the value has already
 * been through IEEE-754 by the time we see it. That is fine for the handful of
 * hard-coded thresholds in the schema, but it is NOT fine for import: a sheet
 * cell reading `33.33` must become exactly `3333/10000`, and a cell reading
 * `0.333333333333333314829616256247` (what Excel actually stores for some
 * hand-entered values) must not be silently rounded into a different number
 * than the one on screen.
 *
 * So we never call `Number()`. The string is split on the decimal point and
 * re-assembled as an integer numerator over a power of ten:
 *
 *   "33.33"  → 3333 / 100
 *   "25"     → 25 / 1
 *   "0.5"    → 5 / 10 → reduced to 1/2
 *
 * Accepts an optional leading sign, ASCII digits, and both `.` and the Hebrew
 * locale's `,` thousands separators are rejected rather than guessed at —
 * see `parseShareCell` in the import module for the sheet-level tolerance.
 *
 * Returns `null` for anything that is not a plain decimal numeral.
 */
export function fractionFromDecimalString(raw: string): Fraction | null {
  const s = raw.trim()
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null

  const negative = s.startsWith('-')
  const unsigned = s.replace(/^[+-]/, '')
  const [intPart = '', fracPart = ''] = unsigned.split('.')

  // Guard against a pathological cell like "1." + 100000 digits.
  if (intPart.length + fracPart.length > 40) return null

  const digits = `${intPart}${fracPart}` || '0'
  const num = BigInt(digits) * (negative ? -1n : 1n)
  const den = 10n ** BigInt(fracPart.length)
  return Fraction.from(num, den)
}

/**
 * A percentage written as text → an exact fraction OF ONE.
 *
 * `"33.33"` (or `"33.33%"`) becomes `3333/10000`, never `0.3333`. A trailing
 * `%` sign and surrounding whitespace are tolerated; nothing else is.
 */
export function percentStringToFraction(raw: string): Fraction | null {
  const s = raw.trim().replace(/%\s*$/, '')
  const pct = fractionFromDecimalString(s)
  if (pct === null) return null
  return pct.mul(Fraction.from(1n, 100n))
}

/**
 * An explicit fraction written as text — `"1/3"`, `"2 / 4"`.
 *
 * This is the LOSSLESS form and the one the import template recommends: a
 * three-heir apartment written as `1/3` each sums to exactly 1, whereas
 * `33.33%` each sums to `9999/10000` and is correctly reported as incomplete.
 */
export function fractionFromRatioString(raw: string): Fraction | null {
  const m = raw.trim().match(/^([+-]?\d+)\s*\/\s*(\d+)$/)
  if (!m) return null
  const den = BigInt(m[2])
  if (den === 0n) return null
  return Fraction.from(BigInt(m[1]), den)
}

/** Postgres `Int` (int4) bounds — `OwnerApartment.share*` are both `Int`. */
const INT32_MAX = 2_147_483_647n

/**
 * Converts a Fraction to the `{ shareNumerator, shareDenominator }` pair the
 * schema stores, or `null` when the reduced fraction will not fit in `Int`.
 *
 * Reduction happens first, so `0.5` stores as `1/2` rather than `5/10`, and a
 * cell like `0.333333333333333314829616256247` — an exact decimal with 30
 * places that Excel shows as `0.33` — is refused here rather than silently
 * truncated into a DIFFERENT share than the sheet says. The caller turns that
 * `null` into a row-level error telling the user to write `1/3`.
 */
export function toIntParts(f: Fraction): FractionParts | null {
  if (bigAbs(f.num) > INT32_MAX || f.den > INT32_MAX) return null
  return { shareNumerator: Number(f.num), shareDenominator: Number(f.den) }
}

export interface ThresholdComparison {
  /** Exact decision. Never derived from the rounded display value. */
  reached: boolean
  /** Value to render, in percent. Consistent with `reached` — see below. */
  displayPct: number
}

/**
 * Decides a threshold AND produces the number to display, from the same exact
 * ratio, so the screen can never contradict the decision.
 *
 * Resolution of the previous display/decision split:
 *   1. `reached` is an exact rational comparison of `achieved` against
 *      `requiredPct` — no rounding, no epsilon.
 *   2. `displayPct` TRUNCATES toward the failing side instead of rounding to
 *      nearest, so a project at 66.96% renders "66.9%", never "67.0%", while
 *      `reached` is false. (The old code rounded to 67.0 and reported false.)
 *   3. Truncation can only ever understate, so the one remaining way for the
 *      display to contradict the decision is a fractional `requiredPct`
 *      (e.g. 66.67% achieved at 66.671%). When `reached` is true and the
 *      truncated value falls below the requirement, we display exactly
 *      `requiredPct`.
 * Result: `displayPct >= requiredPct` if and only if `reached` is true.
 */
export function compareToThreshold(
  achieved: Fraction,
  requiredPct: number,
  decimals = 1,
): ThresholdComparison {
  const required = percentToFraction(requiredPct)
  const reached = achieved.gte(required)

  const scale = 10 ** decimals
  // Exact truncated percentage: floor(achieved * 100 * scale) / scale
  const scaledNum = achieved.num * 100n * BigInt(scale)
  let truncated = Number(floorDiv(scaledNum, achieved.den)) / scale

  if (reached && truncated < requiredPct) truncated = requiredPct

  return { reached, displayPct: truncated }
}

/** Floor division for BigInt (JS `/` truncates toward zero). */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b
  return a % b !== 0n && (a < 0n) !== (b < 0n) ? q - 1n : q
}

/** Exact ratio `part / whole` as a fraction. `whole === 0` yields 0. */
export function ratio(part: Fraction, whole: number | bigint): Fraction {
  const w = typeof whole === 'bigint' ? whole : BigInt(whole)
  if (w === 0n) return Fraction.ZERO
  return part.mul(Fraction.from(1n, w))
}
