/**
 * Exact rational helpers for the ownership editor.
 *
 * The API's `src/common/fractions` module is THE source of truth for ownership
 * arithmetic, and the server re-validates every share sum before writing. This
 * file exists only so the browser can (a) parse what a user types into an exact
 * numerator/denominator pair and (b) show a running sum that agrees with the
 * server instead of drifting.
 *
 * Everything here is BigInt-backed. There is no float and no epsilon: a
 * percentage is parsed as a decimal STRING and scaled by a power of ten, so
 * `25%` becomes exactly `1/4` and `33.333%` becomes exactly `33333/100000` —
 * never `Number('33.333') / 100`.
 *
 * `shareNumerator` / `shareDenominator` are `@IsInt()` on the wire, so anything
 * that does not fit a JS safe integer is rejected here rather than silently
 * rounded on the way out.
 */

export interface FractionParts {
  shareNumerator: number
  shareDenominator: number
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y) { const t = x % y; x = y; y = t }
  return x
}

/** An exact, always-reduced, positive-denominator rational. */
export class Frac {
  readonly num: bigint
  readonly den: bigint

  private constructor(num: bigint, den: bigint) {
    this.num = num
    this.den = den
  }

  static make(num: bigint, den: bigint): Frac {
    if (den === 0n) throw new RangeError('denominator must not be zero')
    let n = num
    let d = den
    if (d < 0n) { n = -n; d = -d }
    const g = gcd(n, d) || 1n
    return new Frac(n / g, d / g)
  }

  static readonly ZERO = Frac.make(0n, 1n)
  static readonly ONE  = Frac.make(1n, 1n)

  add(o: Frac): Frac { return Frac.make(this.num * o.den + o.num * this.den, this.den * o.den) }
  sub(o: Frac): Frac { return Frac.make(this.num * o.den - o.num * this.den, this.den * o.den) }

  isZero(): boolean { return this.num === 0n }
  equals(o: Frac): boolean { return this.num === o.num && this.den === o.den }
  /** -1, 0 or 1 — comparison without ever producing a float. */
  cmp(o: Frac): number {
    const l = this.num * o.den
    const r = o.num * this.den
    return l < r ? -1 : l > r ? 1 : 0
  }

  /** `1/4`, or `0` / `1` for the degenerate cases. */
  toFractionString(): string {
    if (this.den === 1n) return this.num.toString()
    return `${this.num}/${this.den}`
  }

  /**
   * Percentage rendered to a fixed number of decimals, for DISPLAY ONLY.
   * Computed with integer division so it never round-trips through a float.
   * The value sent to the server is always the exact numerator/denominator.
   */
  toPercentString(decimals = 4): string {
    const scale = 10n ** BigInt(decimals)
    // Round half away from zero on the scaled integer.
    const scaled = (this.num * 100n * scale * 2n + (this.den * (this.num < 0n ? -1n : 1n))) / (this.den * 2n)
    const neg = scaled < 0n
    const abs = neg ? -scaled : scaled
    const whole = abs / scale
    const frac  = (abs % scale).toString().padStart(decimals, '0').replace(/0+$/, '')
    return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}%`
  }

  /** Wire form. Throws if either part exceeds the safe-integer range. */
  toParts(): FractionParts {
    const MAX = BigInt(Number.MAX_SAFE_INTEGER)
    if (this.num > MAX || this.num < -MAX || this.den > MAX) {
      throw new RangeError('FRACTION_TOO_LARGE')
    }
    return { shareNumerator: Number(this.num), shareDenominator: Number(this.den) }
  }

  static fromParts(p: FractionParts): Frac | null {
    if (!Number.isInteger(p.shareNumerator) || !Number.isInteger(p.shareDenominator)) return null
    if (p.shareDenominator === 0) return null
    return Frac.make(BigInt(p.shareNumerator), BigInt(p.shareDenominator))
  }
}

export type ShareMode = 'FRACTION' | 'PERCENT'

export interface ParseResult {
  ok: boolean
  value?: Frac
  /** Hebrew message shown under the field. */
  error?: string
}

/** Parses a decimal string like `33.333` into an exact fraction, no floats. */
function parseDecimalString(raw: string): Frac | null {
  const m = /^(\d*)(?:\.(\d*))?$/.exec(raw)
  if (!m) return null
  const whole = m[1] ?? ''
  const frac  = m[2] ?? ''
  if (!whole && !frac) return null
  const digits = `${whole || '0'}${frac}`
  return Frac.make(BigInt(digits), 10n ** BigInt(frac.length))
}

/**
 * Parses user input in either mode.
 *
 *   FRACTION — `1/3`, `2 / 6`, `1` (whole), or a decimal such as `0.25`.
 *   PERCENT  — `25`, `25%`, `33.333` → exactly 33333/100000 of one.
 *
 * Returns an exact `Frac` of the apartment (so 25% → 1/4), never a rounded one.
 */
export function parseShare(raw: string, mode: ShareMode): ParseResult {
  const input = raw.trim().replace(/%$/, '').trim()
  if (!input) return { ok: false, error: 'יש להזין ערך' }

  if (mode === 'FRACTION' && input.includes('/')) {
    const parts = input.split('/')
    if (parts.length !== 2) return { ok: false, error: 'שבר לא תקין — לדוגמה 1/3' }
    const n = parts[0].trim()
    const d = parts[1].trim()
    if (!/^\d+$/.test(n) || !/^\d+$/.test(d)) {
      return { ok: false, error: 'מונה ומכנה חייבים להיות מספרים שלמים' }
    }
    if (BigInt(d) === 0n) return { ok: false, error: 'המכנה לא יכול להיות אפס' }
    return { ok: true, value: Frac.make(BigInt(n), BigInt(d)) }
  }

  const dec = parseDecimalString(input)
  if (!dec) {
    return {
      ok: false,
      error: mode === 'PERCENT' ? 'אחוז לא תקין — לדוגמה 25 או 33.333' : 'ערך לא תקין — לדוגמה 1/3 או 0.25',
    }
  }

  const value = mode === 'PERCENT' ? Frac.make(dec.num, dec.den * 100n) : dec

  if (value.cmp(Frac.ZERO) < 0) return { ok: false, error: 'הערך חייב להיות חיובי' }
  if (value.cmp(Frac.ONE) > 0) {
    return { ok: false, error: mode === 'PERCENT' ? 'לא ניתן להזין יותר מ־100%' : 'החלק לא יכול לעלות על 1' }
  }

  return { ok: true, value }
}

/** Exact sum of a list of shares. */
export function sumShares(shares: readonly Frac[]): Frac {
  return shares.reduce((acc, f) => acc.add(f), Frac.ZERO)
}
