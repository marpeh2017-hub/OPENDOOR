import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

const MONTH_START_PATTERN = /^(\d{4})-(\d{2})-01$/
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  זמן הוא לא רשימת אירועים
 * ══════════════════════════════════════════════════════════════════════════
 *
 * תזרים מזומנים הוא דליל מטבעו: לפרויקט יכול להיות חודש שלם בלי תנועה
 * אחת. אבל חודש בלי תנועה הוא עדיין חודש שבו נצברה ריבית ושבו הכסף לא
 * היה זמין. אם החישוב מדלג עליו, הוא מקצר את משך הפרויקט — וזה מייפה
 * גם את הריבית וגם את ה-IRR.
 *
 * הפונקציות כאן קיימות כדי שדילוג כזה לא יהיה אפשרי: הציר נבנה מהחודש
 * הראשון עד האחרון, רציף, ולא מרשימת החודשים שבמקרה יש בהם תנועה.
 */
export function continuousMonthlyPeriodAxis(periodStarts: readonly string[]): string[] {
  if (periodStarts.length === 0) return []

  const serialMonths = [...new Set(periodStarts)].map((periodStart) => {
    const match = MONTH_START_PATTERN.exec(periodStart)
    if (!match) throw new RangeError(`Monthly period must use YYYY-MM-01: ${periodStart}`)
    const year = Number(match[1])
    const month = Number(match[2])
    if (month < 1 || month > 12) throw new RangeError(`Monthly period contains an invalid month: ${periodStart}`)
    return year * 12 + month - 1
  }).sort((a, b) => a - b)

  const first = serialMonths[0]!
  const last = serialMonths[serialMonths.length - 1]!
  const periods: string[] = []
  for (let serialMonth = first; serialMonth <= last; serialMonth += 1) {
    const year = Math.floor(serialMonth / 12)
    const month = serialMonth % 12 + 1
    periods.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`)
  }
  return periods
}

/** Add whole calendar months to a canonical YYYY-MM-01 period. */
export function addMonthsToMonthlyPeriod(periodStart: string, monthOffset: number): string {
  const match = MONTH_START_PATTERN.exec(periodStart)
  if (!match) throw new RangeError(`Monthly period must use YYYY-MM-01: ${periodStart}`)
  if (!Number.isInteger(monthOffset)) throw new RangeError('Month offset must be an integer')
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) throw new RangeError(`Monthly period contains an invalid month: ${periodStart}`)
  const serialMonth = year * 12 + month - 1 + monthOffset
  const resultYear = Math.floor(serialMonth / 12)
  const resultMonth = serialMonth % 12 + 1
  return `${String(resultYear).padStart(4, '0')}-${String(resultMonth).padStart(2, '0')}-01`
}

/** Whole-month distance between two canonical monthly periods. */
export function monthlyPeriodDistance(from: string, to: string): number {
  const fromMatch = MONTH_START_PATTERN.exec(from)
  const toMatch = MONTH_START_PATTERN.exec(to)
  if (!fromMatch || !toMatch) throw new RangeError(`Monthly periods must use YYYY-MM-01: ${from}, ${to}`)
  const fromMonth = Number(fromMatch[2])
  const toMonth = Number(toMatch[2])
  if (fromMonth < 1 || fromMonth > 12 || toMonth < 1 || toMonth > 12) throw new RangeError(`Monthly period contains an invalid month: ${from}, ${to}`)
  return (Number(toMatch[1]) * 12 + toMonth - 1) - (Number(fromMatch[1]) * 12 + fromMonth - 1)
}

/**
 * ריבית על יתרת חוב ממוצעת, לפי מספר הימים בפועל בחודש.
 *
 * לא 1/12 קבוע: פברואר אינו ינואר, ועל יתרות של עשרות מיליונים ההפרש
 * מצטבר לסכום שמופיע בדוח. הבסיס הוא 365 יום בפועל.
 */
export function averageMonthlyDebtInterest(
  openingDebt: Decimal.Value,
  debtMovement: Decimal.Value,
  annualRate: Decimal.Value,
  periodStart: string,
): Decimal {
  const match = MONTH_START_PATTERN.exec(periodStart)
  if (!match) throw new RangeError(`Monthly period must use YYYY-MM-01: ${periodStart}`)
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) throw new RangeError(`Monthly period contains an invalid month: ${periodStart}`)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const opening = new Decimal(openingDebt)
  const ending = opening.plus(debtMovement)
  return opening.plus(ending).div(2).mul(annualRate).mul(daysInMonth).div(365)
}

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

// ══════════════════════════════════════════════════════════════════════════
//  תזרים לפי תאריכים בפועל — XNPV / XIRR
// ══════════════════════════════════════════════════════════════════════════
//
// `npv`/`irr` שלמעלה מניחים תקופות באורך אחיד. ההנחה הזאת נכונה לציר חודשי
// רציף ושגויה לכל דבר אחר: תשלום קרקע ביום החתימה, מענק שמתקבל ב-17 בחודש,
// או לוח תשלומים שנקבע בהסכם ולא בלוח שנה. חישוב כזה בציר "תקופתי" מניח
// שכל פער בין תאריכים שווה — וזו טעות שגדלה עם משך הפרויקט.
//
// לכן: כאשר התאריכים אינם אחידים, המנוע חייב להשתמש בפונקציות האלה, לפי
// ימים בפועל מהתאריך הראשון. הבסיס הוא 365 יום, כמקובל ב-XIRR של Excel,
// כך שהתוצאה ניתנת להשוואה מול הגיליון שהשמאי כבר מחזיק ביד.

/** ימים בפועל בין שני תאריכי ISO, ב-UTC כדי שאזור זמן לא יזיז יום. */
export function daysBetween(from: string, to: string): number {
  const fromMatch = DATE_PATTERN.exec(from)
  const toMatch = DATE_PATTERN.exec(to)
  if (!fromMatch || !toMatch) throw new RangeError(`Dates must use YYYY-MM-DD: ${from}, ${to}`)
  const parseDate = (value: string) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new RangeError(`Invalid date: ${value}`)
    }
    return parsed.getTime()
  }
  const fromMs = parseDate(from)
  const toMs = parseDate(to)
  return Math.round((toMs - fromMs) / 86_400_000)
}

export interface DatedCashFlow {
  /** ISO date, YYYY-MM-DD. */
  date: string
  amount: Decimal.Value
}

/**
 * XNPV — ערך נוכחי נקי לפי תאריכים בפועל.
 *
 * `annualRate` הוא שיעור שנתי אפקטיבי. ההיוון הוא לפי (ימים/365) ולא לפי
 * מספר התקופה, ולכן שני תשלומים באותו חודש אך בתאריכים שונים אינם מקבלים
 * את אותו משקל.
 */
export function xnpv(cashFlows: readonly DatedCashFlow[], annualRate: Decimal.Value): Decimal {
  if (cashFlows.length === 0) return new Decimal(0)
  const rate = new Decimal(annualRate)
  if (rate.lte(-1)) throw new RangeError('Discount rate must be greater than -100%')

  const ordered = [...cashFlows].sort((a, b) => a.date.localeCompare(b.date))
  const base = ordered[0]!.date
  const onePlusRate = new Decimal(1).plus(rate)

  return ordered.reduce<Decimal>((total, flow) => {
    const years = new Decimal(daysBetween(base, flow.date)).div(365)
    return total.plus(new Decimal(flow.amount).div(onePlusRate.pow(years)))
  }, new Decimal(0))
}

/**
 * XIRR — שיעור התשואה הפנימי לפי תאריכים בפועל.
 *
 * ביסקציה, מאותה סיבה ש-`irr` משתמש בה: Newton-Raphson מתכנס מהר יותר אך
 * יכול להתבדר על תזרים עם יותר מהיפוך סימן אחד, וזה בדיוק המקרה של
 * פרויקט עם משיכות חוב ופירעונות. ביסקציה איטית ותמיד מתכנסת בתוך התחום.
 *
 * מחזיר null כאשר אין שורש: תזרים חד-סימני, או שורש שאינו בתוך התחום.
 *
 * ── גבול התחום, ולמה הוא מה שהוא ────────────────────────────────────────
 *
 * התחום מתרחב עד 40 פעמים, כלומר עד תשואה שנתית בסדר גודל של 10^13.
 * זה מכסה כל תזרים נדל״ני מציאותי בהפרש ניכר. מה שהוא לא מכסה הוא תזרים
 * של יום-יומיים, שבו ריבית דריבית שנתית מייצרת מספר חסר משמעות כלכלית —
 * ושם `null` היא התשובה הנכונה יותר ממספר שאיש לא יוכל לפרש.
 */
export function xirr(cashFlows: readonly DatedCashFlow[]): Decimal | null {
  if (cashFlows.length < 2) return null
  const byDate = new Map<string, Decimal>()
  for (const flow of cashFlows) {
    daysBetween(flow.date, flow.date)
    byDate.set(flow.date, (byDate.get(flow.date) ?? new Decimal(0)).plus(flow.amount))
  }
  cashFlows = [...byDate].filter(([, amount]) => !amount.isZero()).map(([date, amount]) => ({ date, amount }))
  if (cashFlows.length < 2) return null
  const values = cashFlows.map((flow) => new Decimal(flow.amount))
  if (!values.some((value) => value.lt(0)) || !values.some((value) => value.gt(0))) return null

  let low = new Decimal('-0.99999999')
  let high = new Decimal('10')
  let lowValue = xnpv(cashFlows, low)
  let highValue = xnpv(cashFlows, high)
  for (let expansion = 0; lowValue.mul(highValue).gt(0) && expansion < 40; expansion += 1) {
    high = high.mul(2).plus(1)
    highValue = xnpv(cashFlows, high)
  }
  if (lowValue.mul(highValue).gt(0)) return null

  for (let iteration = 0; iteration < 240; iteration += 1) {
    const mid = low.plus(high).div(2)
    const value = xnpv(cashFlows, mid)
    if (value.abs().lte('0.00000001')) return mid
    if (lowValue.mul(value).lte(0)) { high = mid; highValue = value } else { low = mid; lowValue = value }
  }
  return low.plus(high).div(2)
}

/**
 * האם התאריכים יושבים על ציר חודשי אחיד?
 *
 * זו השאלה שקובעת אם מותר להשתמש ב-`irr`/`npv` התקופתיים או שחובה לעבור
 * ל-`xirr`/`xnpv`. המנוע קורא לזה במקום להחליט לפי תחושה, כי "בערך חודשי"
 * הוא בדיוק המצב שבו הטעות נכנסת בלי שאיש מבחין.
 */
export function isUniformMonthlyAxis(dates: readonly string[]): boolean {
  if (dates.length < 2) return true
  return dates.every((date) => MONTH_START_PATTERN.test(date))
    && dates.every((date, index) => index === 0 || monthlyPeriodDistance(dates[index - 1]!, date) === 1)
}

export function annualizeMonthlyRate(monthlyRate: Decimal.Value): Decimal {
  return new Decimal(1).plus(new Decimal(monthlyRate)).pow(12).minus(1)
}

export function monthlyRateFromAnnual(annualRate: Decimal.Value): Decimal {
  return new Decimal(1).plus(new Decimal(annualRate)).pow(new Decimal(1).div(12)).minus(1)
}
