import Decimal from 'decimal.js'
import { daysBetween, xirr, type DatedCashFlow } from './financial-math'

/**
 * ── THE EQUITY WATERFALL ──────────────────────────────────────────────────
 *
 * Until now the engine knew how much equity went in and how much came back
 * out, and computed one internal rate of return over the pair. That answers
 * "what did the equity earn" only when there is a single investor. The moment
 * capital is layered — senior money on an 8% preference, sponsor money behind
 * it — one blended number describes nobody's return, because the whole point
 * of a structure is that the layers do NOT earn the same thing.
 *
 * This distributes each payment across the tranches in priority order and
 * gives every layer its own dated cash flow, so its IRR is an actual IRR of
 * actual money rather than a share of an average.
 *
 * ── WHAT IS DERIVED AND WHAT IS AUTHORED ──────────────────────────────────
 *
 * Authored, and left alone: WHEN cash leaves the project for investors, and
 * HOW MUCH. Those are the scenario's EQUITY OUTFLOW allocations, a modelled
 * fact about the deal. Deriving them instead would mean inventing a
 * distribution policy — pay out all free cash immediately? hold a reserve? —
 * that nobody stated.
 *
 * Derived, and the whole job of this file: WHO receives each payment. That is
 * what a waterfall is, and it is the one thing the cash-flow model cannot say
 * on its own.
 *
 * ── THE TIERS ─────────────────────────────────────────────────────────────
 *
 *   1. Return of Capital — each tranche, in priority order, until its
 *      distributions cover its contributions.
 *   2. Preferred Return  — accrued on capital the tranche has not had back,
 *      on the actual/365 basis the rest of the engine discounts on, paid in
 *      priority order.
 *   3. Residual Split    — whatever remains, by each tranche's agreed share.
 *
 * Catch-up is NOT implemented, and deliberately has no field to configure
 * either. A structure needing one cannot be expressed here at all, which is
 * the honest form of "not yet": the alternative — accepting a catch-up term
 * and running a waterfall that silently omits the tier — would return numbers
 * for a deal nobody agreed to. `structure` names what WAS applied, so a reader
 * can see which shape produced the figures.
 */

export type EquityTrancheTerms = {
  id: string
  name: string
  kind: 'SENIOR' | 'JUNIOR' | 'SPONSOR'
  priority: number
  commitment: string | null
  /** Annual hurdle as a decimal fraction. Null means this tranche has no preference. */
  preferredReturnRate: string | null
  preferredReturnAccrual: 'SIMPLE' | 'COMPOUNDED'
  profitSharePercent: string
}

export type EquityFlow = {
  /** ISO date, YYYY-MM-DD. */
  date: string
  amount: Decimal
  /** Which tranche put this in. Distributions carry null — the waterfall decides. */
  trancheId: string | null
}

export type WaterfallIssue = { code: string; severity: 'CRITICAL' | 'WARNING' | 'INFO'; message: string; entityId?: string }

const ZERO = new Decimal(0)
const money = (value: Decimal) => value.toFixed(2)
const rate = (value: Decimal | null) => value === null ? null : value.toFixed(10)

/** A cent. Below this, a residual balance is rounding rather than an amount owed. */
const DUST = new Decimal('0.005')

type TrancheState = {
  terms: EquityTrancheTerms
  contributed: Decimal
  /** Capital the tranche has put in and not yet had back. */
  unreturnedCapital: Decimal
  /** Preference accrued and not yet paid. */
  unpaidPreferred: Decimal
  returnedCapital: Decimal
  paidPreferred: Decimal
  paidResidual: Decimal
  /** The tranche's own dated flows: contributions negative, distributions positive. */
  flows: DatedCashFlow[]
  /** The date accrual has been carried up to. */
  accruedTo: string | null
}

export type EquityWaterfallResult = ReturnType<typeof computeEquityWaterfall>

/**
 * @param tranches the capital structure's terms
 * @param flows    every EQUITY allocation: contributions carry a `trancheId`,
 *                 distributions carry null and are split here
 */
export function computeEquityWaterfall(tranches: EquityTrancheTerms[], flows: EquityFlow[]) {
  const issues: WaterfallIssue[] = []
  if (tranches.length === 0) {
    return {
      applicable: false,
      reason: 'NO_TRANCHES_DEFINED' as const,
      tranches: [],
      events: [],
      totals: { contributed: money(ZERO), distributed: money(ZERO), undistributed: money(ZERO) },
      issues,
    }
  }

  const ordered = [...tranches].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index]!.priority === ordered[index - 1]!.priority) {
      issues.push({
        code: 'WATERFALL_PRIORITY_TIE', severity: 'WARNING',
        message: `„${ordered[index - 1]!.name}” ו„${ordered[index]!.name}” הוגדרו באותה עדיפות (${ordered[index]!.priority}). החלוקה ביניהם נעשית לפי סדר השם, ולא לפי כוונה מוצהרת.`,
        entityId: ordered[index]!.id,
      })
    }
  }

  const totalShare = ordered.reduce((sum, tranche) => sum.plus(tranche.profitSharePercent), ZERO)
  if (!totalShare.minus(1).abs().lte('0.000001')) {
    issues.push({
      code: 'WATERFALL_PROFIT_SHARE_NOT_WHOLE', severity: 'CRITICAL',
      message: `סך חלקי הרווח השיורי הוא ${totalShare.mul(100).toFixed(4)}% ולא 100%. חלוקת השארית אינה מוגדרת עד שהחלקים יסתכמו למלוא הרווח.`,
    })
  }

  const state = new Map<string, TrancheState>(ordered.map((terms) => [terms.id, {
    terms,
    contributed: ZERO, unreturnedCapital: ZERO, unpaidPreferred: ZERO,
    returnedCapital: ZERO, paidPreferred: ZERO, paidResidual: ZERO,
    flows: [], accruedTo: null,
  }]))

  const known = new Set(ordered.map((tranche) => tranche.id))
  for (const flow of flows) {
    if (flow.trancheId && !known.has(flow.trancheId)) {
      issues.push({
        code: 'WATERFALL_FLOW_TRANCHE_UNKNOWN', severity: 'CRITICAL',
        message: `הקצאת הון מתייחסת לשכבת הון שאינה קיימת בתרחיש (${flow.trancheId}).`,
        entityId: flow.trancheId,
      })
    }
  }

  const contributions = flows.filter((flow) => flow.amount.gt(0))
  const distributions = flows.filter((flow) => flow.amount.lt(0))

  const unattributed = contributions.filter((flow) => !flow.trancheId)
  if (unattributed.length > 0) {
    // A contribution with no tranche cannot be returned to anybody: return of
    // capital is per tranche. Reported rather than spread across tranches,
    // because spreading it would invent an ownership split.
    issues.push({
      code: 'WATERFALL_CONTRIBUTION_UNATTRIBUTED', severity: 'CRITICAL',
      message: `${unattributed.length} הזרמות הון אינן משויכות לשכבת הון. לא ניתן להחזיר הון למי שלא הוגדר, ולכן הן אינן נכללות במפל.`,
    })
  }
  const attributedDistributions = distributions.filter((flow) => flow.trancheId)
  if (attributedDistributions.length > 0) {
    // The waterfall decides who is paid. An allocation that already names a
    // tranche is asserting the answer, and the two can disagree.
    issues.push({
      code: 'WATERFALL_DISTRIBUTION_PRE_ATTRIBUTED', severity: 'WARNING',
      message: `${attributedDistributions.length} חלוקות הון משויכות מראש לשכבה מסוימת. המפל הוא שקובע מי מקבל, ולכן השיוך הזה מתעלם ממנו.`,
    })
  }

  /** Carry every tranche's preference up to `date` before paying anything on it. */
  const accrueTo = (date: string) => {
    for (const tranche of state.values()) {
      const annual = tranche.terms.preferredReturnRate
      if (!annual || !tranche.accruedTo) { tranche.accruedTo = tranche.accruedTo ?? date; continue }
      const days = daysBetween(tranche.accruedTo, date)
      if (days <= 0) { tranche.accruedTo = date; continue }
      const years = new Decimal(days).div(365)
      const compounded = tranche.terms.preferredReturnAccrual === 'COMPOUNDED'
      /*
       * The two accruals differ in BOTH the base and the shape, and getting
       * only the base right would have made them nearly the same number.
       *
       *   COMPOUNDED — (1+r)^t − 1 on capital plus preference already owed.
       *                Deferring the hurdle costs more, which is the whole
       *                commercial point of the term.
       *   SIMPLE     — r × t on unreturned capital alone. Linear, so unpaid
       *                preference never earns anything itself.
       *
       * Using the geometric form for both would leave SIMPLE compounding on a
       * smaller base — a third thing, that no term sheet describes.
       */
      const base = compounded ? tranche.unreturnedCapital.plus(tranche.unpaidPreferred) : tranche.unreturnedCapital
      if (base.gt(0)) {
        const growth = compounded
          ? new Decimal(1).plus(annual).pow(years).minus(1)
          : new Decimal(annual).mul(years)
        tranche.unpaidPreferred = tranche.unpaidPreferred.plus(base.mul(growth))
      }
      tranche.accruedTo = date
    }
  }

  const events: Array<{
    date: string
    kind: 'CONTRIBUTION' | 'DISTRIBUTION'
    available: string
    unallocated: string
    tiers: Array<{ tier: 'RETURN_OF_CAPITAL' | 'PREFERRED_RETURN' | 'RESIDUAL_SPLIT'; trancheId: string; trancheName: string; amount: string }>
  }> = []

  const byDate = new Map<string, EquityFlow[]>()
  for (const flow of flows) byDate.set(flow.date, [...(byDate.get(flow.date) ?? []), flow])
  const dates = [...byDate.keys()].sort()

  for (const date of dates) {
    const sameDay = byDate.get(date)!
    accrueTo(date)

    // Contributions land before distributions on the same date: money put in
    // that morning is capital the evening's payment can return.
    for (const flow of sameDay.filter((row) => row.amount.gt(0) && row.trancheId && known.has(row.trancheId))) {
      const tranche = state.get(flow.trancheId!)!
      tranche.contributed = tranche.contributed.plus(flow.amount)
      tranche.unreturnedCapital = tranche.unreturnedCapital.plus(flow.amount)
      tranche.flows.push({ date, amount: flow.amount.negated() })
      events.push({ date, kind: 'CONTRIBUTION', available: money(flow.amount), unallocated: money(ZERO), tiers: [{ tier: 'RETURN_OF_CAPITAL', trancheId: tranche.terms.id, trancheName: tranche.terms.name, amount: money(flow.amount.negated()) }] })
    }

    let available = sameDay.filter((row) => row.amount.lt(0)).reduce((sum, row) => sum.plus(row.amount.abs()), ZERO)
    if (available.lte(0)) continue
    const tiers: Array<{ tier: 'RETURN_OF_CAPITAL' | 'PREFERRED_RETURN' | 'RESIDUAL_SPLIT'; trancheId: string; trancheName: string; amount: string }> = []
    const paidToday = new Map<string, Decimal>()
    const pay = (tranche: TrancheState, tier: 'RETURN_OF_CAPITAL' | 'PREFERRED_RETURN' | 'RESIDUAL_SPLIT', wanted: Decimal) => {
      const amount = Decimal.min(wanted, available)
      if (amount.lte(0)) return ZERO
      available = available.minus(amount)
      tiers.push({ tier, trancheId: tranche.terms.id, trancheName: tranche.terms.name, amount: money(amount) })
      paidToday.set(tranche.terms.id, (paidToday.get(tranche.terms.id) ?? ZERO).plus(amount))
      return amount
    }

    // Tier 1 — return of capital, strictly in priority order.
    for (const terms of ordered) {
      if (available.lte(DUST)) break
      const tranche = state.get(terms.id)!
      const paid = pay(tranche, 'RETURN_OF_CAPITAL', tranche.unreturnedCapital)
      tranche.unreturnedCapital = tranche.unreturnedCapital.minus(paid)
      tranche.returnedCapital = tranche.returnedCapital.plus(paid)
    }

    // Tier 2 — preferred return, again strictly in priority order. A junior
    // tranche sees nothing here until every senior preference is current,
    // which is what "preferred" means and what makes the IRRs diverge.
    for (const terms of ordered) {
      if (available.lte(DUST)) break
      const tranche = state.get(terms.id)!
      const paid = pay(tranche, 'PREFERRED_RETURN', tranche.unpaidPreferred)
      tranche.unpaidPreferred = tranche.unpaidPreferred.minus(paid)
      tranche.paidPreferred = tranche.paidPreferred.plus(paid)
    }

    // Tier 3 — residual, by agreed share rather than by priority.
    if (available.gt(DUST)) {
      const residual = available
      let handedOut = ZERO
      ordered.forEach((terms, index) => {
        const tranche = state.get(terms.id)!
        // The last tranche takes the remainder rather than its own rounded
        // share, so the tiers sum to the payment exactly.
        const share = index === ordered.length - 1
          ? residual.minus(handedOut)
          : residual.mul(terms.profitSharePercent)
        const paid = pay(tranche, 'RESIDUAL_SPLIT', share)
        handedOut = handedOut.plus(paid)
        tranche.paidResidual = tranche.paidResidual.plus(paid)
      })
    }

    for (const [trancheId, amount] of paidToday) state.get(trancheId)!.flows.push({ date, amount })
    events.push({ date, kind: 'DISTRIBUTION', available: money(sameDay.filter((row) => row.amount.lt(0)).reduce((sum, row) => sum.plus(row.amount.abs()), ZERO)), unallocated: money(available), tiers })
    if (available.gt(DUST)) {
      // Everybody's capital and preference is current and the residual split
      // did not consume the payment. That is a structure that does not add up,
      // not cash to quietly drop.
      issues.push({
        code: 'WATERFALL_CASH_UNALLOCATED', severity: 'CRITICAL',
        message: `בתאריך ${date} נותרו ${money(available)} ללא נמען לאחר כל שכבות המפל.`,
        entityId: date,
      })
    }
  }

  const trancheResults = ordered.map((terms) => {
    const tranche = state.get(terms.id)!
    const distributed = tranche.returnedCapital.plus(tranche.paidPreferred).plus(tranche.paidResidual)
    const irr = xirr(tranche.flows)
    if (!irr && tranche.contributed.gt(0)) {
      issues.push({
        code: 'WATERFALL_TRANCHE_IRR_UNAVAILABLE', severity: 'WARNING',
        message: `לא ניתן לחשב IRR לשכבה „${terms.name}”: דרושים תזרים חיובי ותזרים שלילי כאחד.`,
        entityId: terms.id,
      })
    }
    if (terms.commitment && tranche.contributed.gt(read(terms.commitment))) {
      issues.push({
        code: 'WATERFALL_COMMITMENT_EXCEEDED', severity: 'WARNING',
        message: `השכבה „${terms.name}” הזרימה ${money(tranche.contributed)} מול התחייבות של ${money(read(terms.commitment))}.`,
        entityId: terms.id,
      })
    }
    if (tranche.unpaidPreferred.gt(DUST)) {
      issues.push({
        code: 'WATERFALL_PREFERRED_SHORTFALL', severity: 'WARNING',
        message: `השכבה „${terms.name}” נותרה עם תשואה מועדפת שלא שולמה בסך ${money(tranche.unpaidPreferred)}. התרחיש אינו מייצר מספיק מזומן כדי לכסות את הרף שלה.`,
        entityId: terms.id,
      })
    }
    if (tranche.unreturnedCapital.gt(DUST)) {
      issues.push({
        code: 'WATERFALL_CAPITAL_NOT_RETURNED', severity: 'CRITICAL',
        message: `השכבה „${terms.name}” לא קיבלה בחזרה ${money(tranche.unreturnedCapital)} מההון שהזרימה.`,
        entityId: terms.id,
      })
    }
    return {
      id: terms.id,
      name: terms.name,
      kind: terms.kind,
      priority: terms.priority,
      preferredReturnRate: terms.preferredReturnRate,
      preferredReturnAccrual: terms.preferredReturnAccrual,
      profitSharePercent: terms.profitSharePercent,
      commitment: terms.commitment,
      equityInvested: money(tranche.contributed),
      returnOfCapital: money(tranche.returnedCapital),
      preferredReturnPaid: money(tranche.paidPreferred),
      preferredReturnUnpaid: money(tranche.unpaidPreferred),
      residualProfit: money(tranche.paidResidual),
      capitalNotReturned: money(tranche.unreturnedCapital),
      equityDistributed: money(distributed),
      /** Total back over total in. 1.0 is getting the money back and nothing more. */
      equityMultiple: tranche.contributed.gt(0) ? distributed.div(tranche.contributed).toFixed(8) : null,
      profit: money(distributed.minus(tranche.contributed)),
      /** XIRR over THIS tranche's own dated flows — not a share of a blended rate. */
      equityIrrAnnual: rate(irr),
      cashFlows: tranche.flows.map((flow) => ({ date: flow.date, amount: money(new Decimal(flow.amount)) })),
    }
  })

  const contributed = trancheResults.reduce((sum, tranche) => sum.plus(tranche.equityInvested), ZERO)
  const distributed = trancheResults.reduce((sum, tranche) => sum.plus(tranche.equityDistributed), ZERO)
  const pool = distributions.reduce((sum, flow) => sum.plus(flow.amount.abs()), ZERO)

  return {
    applicable: true,
    reason: null,
    structure: 'RETURN_OF_CAPITAL_THEN_PREFERRED_THEN_SPLIT' as const,
    tranches: trancheResults,
    events,
    totals: {
      contributed: money(contributed),
      distributed: money(distributed),
      /** Cash that left the project for investors but reached no tranche. Should be zero. */
      undistributed: money(pool.minus(distributed)),
    },
    issues,
  }
}

const read = (value: string) => new Decimal(value)
