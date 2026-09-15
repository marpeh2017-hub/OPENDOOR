import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

/** Exact-period financial mathematics shared by calculation, sensitivity and export. */
export function npv(cashFlows: Decimal.Value[], periodicRate: Decimal.Value): Decimal {
  const rate = new Decimal(periodicRate)
  if (rate.lte(-1)) throw new RangeError('Discount rate must be greater than -100%')
  return cashFlows.reduce<Decimal>((total, value, index) => total.plus(new Decimal(value).div(new Decimal(1).plus(rate).pow(index))), new Decimal(0))
}

/**
 * Bisection IRR avoids Number/Math.pow drift. Returns null where no rate can
 * exist (all cash flows are one sign) or where the root is not bracketed.
 */
export function irr(cashFlows: Decimal.Value[]): Decimal | null {
  const values = cashFlows.map((value) => new Decimal(value))
  if (!values.some((value) => value.lt(0)) || !values.some((value) => value.gt(0))) return null
  let low = new Decimal('-0.99999999')
  let high = new Decimal('10')
  let lowValue = npv(values, low)
  let highValue = npv(values, high)
  for (let expansion = 0; lowValue.mul(highValue).gt(0) && expansion < 20; expansion += 1) {
    high = high.mul(2).plus(1)
    highValue = npv(values, high)
  }
  if (lowValue.mul(highValue).gt(0)) return null
  for (let iteration = 0; iteration < 240; iteration += 1) {
    const mid = low.plus(high).div(2)
    const value = npv(values, mid)
    if (value.abs().lte('0.00000001')) return mid
    if (lowValue.mul(value).lte(0)) { high = mid; highValue = value } else { low = mid; lowValue = value }
  }
  return low.plus(high).div(2)
}

export function annualizeMonthlyRate(monthlyRate: Decimal.Value): Decimal {
  return new Decimal(1).plus(new Decimal(monthlyRate)).pow(12).minus(1)
}

export function monthlyRateFromAnnual(annualRate: Decimal.Value): Decimal {
  return new Decimal(1).plus(new Decimal(annualRate)).pow(new Decimal(1).div(12)).minus(1)
}
