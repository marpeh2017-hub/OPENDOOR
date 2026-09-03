/**
 * The feasibility workspace: its shape, its formulas, and its arithmetic.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  EVERY NUMBER IS A STRING, AND THAT IS THE POINT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `337.18` as a JavaScript number is 337.179999999999996589394868351519107818604...
 * The display happens to round-trip, so the error stays invisible until two of
 * these are multiplied and a figure appears in a room full of apartment owners
 * that is a few agorot away from the workbook. Financial and appraisal values
 * do not get to be approximately right.
 *
 * So the canonical form of every value here is a DECIMAL STRING, and all
 * arithmetic goes through `decimal.js` with the same settings the gateway's
 * existing feasibility calculation service uses. JSON then stores the
 * characters `337.18`, not the nearest double to them, and what comes back out
 * is what went in.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  INPUT, FORMULA, MANUAL_OVERRIDE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every field declares which it is, because "where did this number come from"
 * is the question the whole tab exists to answer:
 *
 *   INPUT     somebody typed it, or it arrived from a source document. This
 *             system did not compute it and cannot check it.
 *   FORMULA   this system computed it, from named inputs, by a rule that lives
 *             in `FORMULAS` below.
 *   MANUAL_OVERRIDE  a FORMULA field whose computed answer somebody replaced.
 *             The calculated value is KEPT beside the override, never
 *             destroyed, together with who overrode it and why.
 *
 * The third is a state of the second rather than a separate role, which is why
 * `effectiveRole()` exists: it answers the §7 classification question for a
 * field without the caller having to know that rule.
 *
 * ── WHY NO FORMULAS ARE STORED IN THE DATABASE ─────────────────────────────
 *
 * A formula column holding `"a * b / 100"` needs an evaluator, and an evaluator
 * over user-supplied strings is an code-execution surface reachable by anyone
 * who can edit a spreadsheet cell. Formula LOGIC lives here, in typed code,
 * under review, in version control. The database stores only which formula id
 * a field uses. Adding a formula is a deployment, deliberately.
 *
 * ── WHAT THE WORKBOOK'S OWN OUTPUTS ARE ────────────────────────────────────
 *
 * Tchernichovsky's headline figures — the building envelope, the sale area,
 * 337.18 scenario units — arrived FROM the workbook. Nobody here knows the
 * method that produced them. They are therefore `category: 'OUTPUT'` (they are
 * outputs of somebody's model) and `role: 'INPUT'` (this system received them
 * and did not compute them). Marking them FORMULA would be a claim that we can
 * reproduce a calculation we have never seen.
 */

import Decimal from 'decimal.js'

// Same configuration as `feasibility/feasibility-calculation.service.ts`, so
// the two never disagree about rounding.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

// ══════════════════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════════════════

/**
 * What a number MEANS, so presentation can format it and nothing has to guess.
 *
 * Stored separately from the value because a formatted Hebrew string
 * ("₪825,600,000") is not a number: it cannot be added, compared or
 * recalculated, and the day somebody parses one back is the day the units are
 * silently wrong. Formatting belongs to the screen.
 */
export type NumericKind =
  | 'AREA_SQM'
  | 'CURRENCY_ILS'
  | 'PERCENT'
  | 'COUNT'
  | 'DECIMAL'
  | 'BOOLEAN'
  /** Deliberately non-numeric: a value the source leaves unresolved. */
  | 'TEXT'

export type FieldRole = 'INPUT' | 'FORMULA'

/** The §7 classification, with override folded in. */
export type EffectiveRole = 'INPUT' | 'FORMULA' | 'MANUAL_OVERRIDE'

export type FieldCategory = 'SOURCE_DATA' | 'ASSUMPTION' | 'OUTPUT' | 'ECONOMICS'

export type ReviewState = 'UNREVIEWED' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED'

/** Why a formula field has no number. Never silently blank. */
export type CalcStatus = 'OK' | 'MISSING_INPUTS' | 'NOT_CALCULATED'

export interface FieldOverride {
  /** Canonical decimal string, like every other value here. */
  value: string
  /** Required. An override with no stated reason is an unexplained number. */
  reason: string
  userId: string
  at: string
}

export interface FeasibilityField {
  key: string
  label: string
  category: FieldCategory
  role: FieldRole
  kind: NumericKind
  /**
   * The authored value, for INPUT fields. Canonical decimal string, or free
   * text when `kind` is TEXT.
   *
   * For FORMULA fields this is not written: read the effective value through
   * `effectiveValue()`, which knows about overrides.
   */
  value?: string
  unit?: string
  note?: string

  /** SOURCE_DATA: where it came from, and whether anybody has checked it. */
  sourceRef?: string
  reviewState?: ReviewState

  /** Set on an OUTPUT that arrived from an external model rather than here. */
  importedFrom?: string

  /** FORMULA only. */
  formulaId?: string
  calculatedValue?: string
  calculatedAt?: string
  calcStatus?: CalcStatus
  /** Named when `calcStatus` is MISSING_INPUTS, so the gap is legible. */
  missingInputs?: string[]

  /** Present means MANUAL_OVERRIDE. The calculated value survives beside it. */
  override?: FieldOverride

  /** Data-quality flag ids from `internal.dataQualityFlags` that bear on this. */
  warnings?: string[]
}

export type ScenarioKind =
  | 'BASELINE'
  | 'ALTERNATIVE_PLANNING'
  | 'DEVELOPER_PROPOSAL'
  | 'OWNER_PREFERRED'

export interface FeasibilityScenario {
  id: string
  label: string
  kind: ScenarioKind
  note?: string
  fields: Record<string, FeasibilityField>
  createdAt?: string
  updatedAt?: string
}

/**
 * The whole private workspace for one project.
 *
 * ── WHY A LIST OF SCENARIOS IN V1, WHICH ONLY EVER SHOWS ONE ───────────────
 *
 * A project WILL need to hold a baseline beside a developer's proposal beside
 * an owner-preferred variant. Storing one scenario's fields at the top level
 * today means that day is a data migration under a live editor rather than a
 * new row. The list costs one indirection now and removes a migration later.
 * The comparison UI is deliberately not built.
 */
export interface FeasibilityWorkspace {
  /** Schema marker. 1 was the flat Pass 4C shape; this is 2. */
  version: 2
  scenarios: FeasibilityScenario[]
  activeScenarioId: string
  /**
   * Warnings about the SOURCE the figures came from, held at workspace level
   * because they outlive any one scenario. Importing a workbook does not make
   * its `#REF!` errors go away, and this is where that stays true.
   */
  sourceWarnings?: { id: string; label: string; detail: string }[]
}

// ══════════════════════════════════════════════════════════════════════════
//  DECIMAL HELPERS
// ══════════════════════════════════════════════════════════════════════════

/** Is this a value arithmetic can use? */
export function isNumeric(v: string | undefined): boolean {
  if (v === undefined || v === null || v === '') return false
  try {
    const d = new Decimal(v)
    return d.isFinite()
  } catch {
    return false
  }
}

/**
 * Canonicalise a decimal string WITHOUT changing its value.
 *
 * Trims and normalises notation, and deliberately does NOT round: rounding
 * here is exactly the silent precision loss this module exists to prevent.
 */
export function canonical(v: string | number): string {
  return new Decimal(typeof v === 'number' ? String(v) : v.trim()).toFixed()
}

/** The value that actually applies: an override wins, else the calculation. */
export function effectiveValue(f: FeasibilityField): string | undefined {
  if (f.override) return f.override.value
  if (f.role === 'FORMULA') return f.calculatedValue
  return f.value
}

/** The §7 classification for one field. */
export function effectiveRole(f: FeasibilityField): EffectiveRole {
  if (f.role === 'FORMULA' && f.override) return 'MANUAL_OVERRIDE'
  return f.role
}

// ══════════════════════════════════════════════════════════════════════════
//  THE FORMULA REGISTRY
// ══════════════════════════════════════════════════════════════════════════

export interface FormulaSpec {
  id: string
  /** Field keys this formula reads. Drives recalculation ordering. */
  inputs: string[]
  kind: NumericKind
  unit?: string
  /** Hebrew, shown in the editor beside the result. */
  explain: string
  compute: (get: (key: string) => Decimal | undefined) => Decimal | undefined
}

/** Only run the body when every named input resolves to a real number. */
function needAll(
  keys: string[],
  get: (k: string) => Decimal | undefined,
  body: (...values: Decimal[]) => Decimal | undefined,
): Decimal | undefined {
  const values: Decimal[] = []
  for (const k of keys) {
    const v = get(k)
    if (v === undefined) return undefined
    values.push(v)
  }
  return body(...values)
}

/**
 * Every formula this system is willing to assert.
 *
 * ── THE RULE FOR ADDING ONE ────────────────────────────────────────────────
 *
 * A formula may only encode a relationship that is TRUE BY DEFINITION between
 * the values it reads. It may not reconstruct a method somebody else used.
 *
 * That rule is why `totalScenarioUnits` is not a formula here. The obvious
 * guess — sale area divided by average apartment area — gives 369.26 against
 * the workbook's 337.18, so the workbook plainly did something else, and
 * encoding the guess would produce a confident number that is wrong by
 * thirty-two apartments. It stays an imported INPUT, and the arithmetic below
 * builds only on identities.
 */
export const FORMULAS: Record<string, FormulaSpec> = {
  // ── Areas ───────────────────────────────────────────────────────────────
  areaDiscrepancy: {
    id: 'areaDiscrepancy',
    inputs: ['registeredLotArea', 'gisMeasuredArea'],
    kind: 'AREA_SQM',
    unit: 'מ״ר',
    explain: 'שטח המגרש הרשום פחות המדידה בפועל. הפרש שאינו אפס מצביע על אי-התאמה שדורשת בירור.',
    compute: (get) => needAll(['registeredLotArea', 'gisMeasuredArea'], get, (a, b) => a.minus(b)),
  },

  buildableRatio: {
    id: 'buildableRatio',
    inputs: ['buildingEnvelope', 'registeredLotArea'],
    kind: 'DECIMAL',
    explain: 'מעטפת הבנייה בתרחיש חלקי שטח המגרש הרשום. יחס תרחיש, אינו זכויות בנייה מאושרות.',
    compute: (get) => needAll(['buildingEnvelope', 'registeredLotArea'], get,
      (env, lot) => (lot.isZero() ? undefined : env.div(lot))),
  },

  saleAreaPerScenarioUnit: {
    id: 'saleAreaPerScenarioUnit',
    inputs: ['residentialSaleArea', 'totalScenarioUnits'],
    kind: 'AREA_SQM',
    unit: 'מ״ר',
    explain: 'שטח המכירה למגורים חלקי מספר היחידות בתרחיש. שטח ממוצע ליחידה בתרחיש בלבד.',
    compute: (get) => needAll(['residentialSaleArea', 'totalScenarioUnits'], get,
      (area, units) => (units.isZero() ? undefined : area.div(units))),
  },

  /**
   * Deliberately included even though it cannot currently compute.
   *
   * Its input, the existing unit count, reads as 95 in one place in the
   * workbook and 98 in another, so it is stored as text and this formula
   * reports MISSING_INPUTS naming it. An empty cell would say the same thing
   * as "nobody got round to it"; this says "the source does not know".
   */
  averageExistingUnitArea: {
    id: 'averageExistingUnitArea',
    inputs: ['existingBuiltArea', 'existingUnits'],
    kind: 'AREA_SQM',
    unit: 'מ״ר',
    explain: 'שטח בנוי קיים חלקי מספר היחידות הקיימות. לא ניתן לחישוב כל עוד מספר היחידות אינו חד-משמעי.',
    compute: (get) => needAll(['existingBuiltArea', 'existingUnits'], get,
      (area, units) => (units.isZero() ? undefined : area.div(units))),
  },

  // ── Unit split ──────────────────────────────────────────────────────────
  /**
   * The identity that exposes the 95-vs-98 problem instead of burying it.
   *
   * 337.18 − 239.18 = 98 exactly. The workbook's existing-unit count is
   * ambiguous between 95 and 98, and in פינוי בינוי the owners' allocation
   * tracks the existing units, so the two readings are not interchangeable.
   * Computing this and attaching the blocking flag puts the discrepancy on the
   * screen where the decision gets made.
   */
  ownerUnits: {
    id: 'ownerUnits',
    inputs: ['totalScenarioUnits', 'developerUnits'],
    kind: 'COUNT',
    unit: 'יח״ד',
    explain: 'סך היחידות בתרחיש פחות יחידות היזם. זהות חשבונית, לא הקצאה מאושרת.',
    compute: (get) => needAll(['totalScenarioUnits', 'developerUnits'], get, (total, dev) => total.minus(dev)),
  },

  developerUnitShare: {
    id: 'developerUnitShare',
    inputs: ['developerUnits', 'totalScenarioUnits'],
    kind: 'PERCENT',
    unit: '%',
    explain: 'חלקו של היזם מסך היחידות בתרחיש.',
    compute: (get) => needAll(['developerUnits', 'totalScenarioUnits'], get,
      (dev, total) => (total.isZero() ? undefined : dev.div(total).times(100))),
  },

  // ── Economics ───────────────────────────────────────────────────────────
  /**
   * Cost from sales and profit, by the definition profit = sales − cost.
   *
   * The workbook gives sales and profit and not cost. Deriving it is an
   * identity rather than an invention, but the identity is STATED here and in
   * `explain` so nobody reads the result as a figure somebody costed.
   */
  cost: {
    id: 'cost',
    inputs: ['sales', 'profit'],
    kind: 'CURRENCY_ILS',
    unit: '₪',
    explain: 'מכירות פחות רווח, לפי ההגדרה רווח = מכירות פחות עלות. נגזר, ולא תקציב שנבנה.',
    compute: (get) => needAll(['sales', 'profit'], get, (sales, profit) => sales.minus(profit)),
  },

  returnOnCost: {
    id: 'returnOnCost',
    inputs: ['profit', 'cost'],
    kind: 'PERCENT',
    unit: '%',
    explain: 'רווח חלקי עלות. נשען על העלות הנגזרת שמעליו.',
    compute: (get) => needAll(['profit', 'cost'], get,
      (profit, cost) => (cost.isZero() ? undefined : profit.div(cost).times(100))),
  },

  profitOnSales: {
    id: 'profitOnSales',
    inputs: ['profit', 'sales'],
    kind: 'PERCENT',
    unit: '%',
    explain: 'רווח היזם כאחוז מהמכירות.',
    compute: (get) => needAll(['profit', 'sales'], get,
      (profit, sales) => (sales.isZero() ? undefined : profit.div(sales).times(100))),
  },
}

// ══════════════════════════════════════════════════════════════════════════
//  RECALCULATION
// ══════════════════════════════════════════════════════════════════════════

/**
 * Order formula keys so a formula runs after everything it depends on.
 *
 * `returnOnCost` reads `cost`, which is itself a formula, so evaluating in
 * declaration order would read a stale value on the turn `sales` changes. A
 * topological pass is a dozen lines and removes that class of bug outright.
 * A cycle is dropped rather than looped on.
 */
function topoOrder(scenario: FeasibilityScenario): string[] {
  const formulaKeys = Object.keys(scenario.fields).filter(
    (k) => scenario.fields[k]!.role === 'FORMULA' && scenario.fields[k]!.formulaId,
  )
  const isFormula = new Set(formulaKeys)
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const out: string[] = []

  const visit = (key: string) => {
    if (visited.has(key) || visiting.has(key)) return
    visiting.add(key)
    const spec = FORMULAS[scenario.fields[key]!.formulaId!]
    for (const dep of spec?.inputs ?? []) {
      if (isFormula.has(dep)) visit(dep)
    }
    visiting.delete(key)
    visited.add(key)
    out.push(key)
  }

  for (const k of formulaKeys) visit(k)
  return out
}

/** Every formula key that depends on `changed`, directly or transitively. */
export function dependentsOf(scenario: FeasibilityScenario, changed: string[]): string[] {
  const dirty = new Set(changed)
  const ordered = topoOrder(scenario)
  const affected: string[] = []
  // One pass in dependency order suffices: a formula's own dependencies are
  // already settled by the time it is reached.
  for (const key of ordered) {
    const spec = FORMULAS[scenario.fields[key]!.formulaId!]
    if (!spec) continue
    if (spec.inputs.some((i) => dirty.has(i))) {
      dirty.add(key)
      affected.push(key)
    }
  }
  return affected
}

/**
 * Recompute formula fields.
 *
 * `changedKeys` limits the work to what actually depends on an edit, per §12:
 * changing the sale price should not restamp `calculatedAt` on an area
 * calculation nobody touched, because that timestamp is evidence about when a
 * number was last derived and a blanket refresh destroys it.
 *
 * Pass `undefined` to recompute everything, which is what an import does.
 *
 * Returns a NEW scenario; the input is not mutated.
 */
export function recalculate(
  scenario: FeasibilityScenario,
  changedKeys?: string[],
  now: () => string = () => new Date().toISOString(),
): FeasibilityScenario {
  const fields: Record<string, FeasibilityField> = { ...scenario.fields }

  const targets = changedKeys === undefined
    ? topoOrder(scenario)
    : (() => {
        const affected = new Set(dependentsOf(scenario, changedKeys))
        return topoOrder(scenario).filter((k) => affected.has(k))
      })()

  const get = (key: string): Decimal | undefined => {
    const f = fields[key]
    if (!f) return undefined
    const v = effectiveValue(f)
    if (!isNumeric(v)) return undefined
    return new Decimal(v!)
  }

  const stamp = now()
  for (const key of targets) {
    const field = fields[key]!
    const spec = FORMULAS[field.formulaId!]
    if (!spec) continue

    const missing = spec.inputs.filter((k) => {
      const dep = fields[k]
      return !dep || !isNumeric(effectiveValue(dep))
    })

    if (missing.length > 0) {
      fields[key] = {
        ...field,
        calculatedValue: undefined,
        calcStatus: 'MISSING_INPUTS',
        missingInputs: missing,
        calculatedAt: stamp,
      }
      continue
    }

    const result = spec.compute(get)
    fields[key] = result === undefined
      ? { ...field, calculatedValue: undefined, calcStatus: 'MISSING_INPUTS', missingInputs: spec.inputs, calculatedAt: stamp }
      // `toFixed()` with no argument is exact: it renders the full decimal
      // value without rounding to a fixed number of places.
      : { ...field, calculatedValue: result.toFixed(), calcStatus: 'OK', missingInputs: undefined, calculatedAt: stamp }
  }

  return { ...scenario, fields }
}

// ══════════════════════════════════════════════════════════════════════════
//  MIGRATION FROM THE PASS 4C FLAT SHAPE
// ══════════════════════════════════════════════════════════════════════════

/** The Pass 4C shape, kept only so it can be read and converted. */
interface LegacyFeasibility {
  sourceData?: Record<string, LegacyEntry>
  assumptions?: Record<string, LegacyEntry>
  outputs?: Record<string, LegacyEntry>
  economics?: Record<string, LegacyEntry>
}
interface LegacyEntry {
  value: number | string
  unit?: string
  note?: string
  reviewState?: string
}

/** Hebrew labels and numeric semantics for the keys the pilot already holds. */
const KNOWN: Record<string, { label: string; kind: NumericKind; unit?: string }> = {
  registeredLotArea:       { label: 'שטח מגרש רשום', kind: 'AREA_SQM', unit: 'מ״ר' },
  gisMeasuredArea:         { label: 'שטח במדידת GIS', kind: 'AREA_SQM', unit: 'מ״ר' },
  existingBuiltArea:       { label: 'שטח בנוי קיים', kind: 'AREA_SQM', unit: 'מ״ר' },
  permittedArea:           { label: 'שטח מותר', kind: 'AREA_SQM', unit: 'מ״ר' },
  averageApartmentArea:    { label: 'שטח דירה ממוצע', kind: 'AREA_SQM', unit: 'מ״ר' },
  existingUnits:           { label: 'יחידות קיימות', kind: 'TEXT' },
  residentialSubParcels:   { label: 'תתי-חלקות למגורים', kind: 'COUNT' },
  commercialSubParcels:    { label: 'תתי-חלקות מסחר וקרקע', kind: 'COUNT' },
  demolitionGrossArea:     { label: 'שטח הריסה ברוטו משוער', kind: 'AREA_SQM', unit: 'מ״ר' },

  averageFloors:           { label: 'קומות ממוצעות מעל הקרקע', kind: 'DECIMAL' },
  buildingCount:           { label: 'מספר מבנים', kind: 'COUNT' },
  aboveGroundCoverage:     { label: 'תכסית מעל הקרקע', kind: 'PERCENT', unit: '%' },
  expropriation:           { label: 'הנחת הפקעה', kind: 'TEXT' },
  ownerConsideration:      { label: 'כלל תמורה לבעלים', kind: 'TEXT' },
  note:                    { label: 'הערת תרחיש', kind: 'TEXT' },

  buildingEnvelope:        { label: 'מעטפת בנייה', kind: 'AREA_SQM', unit: 'מ״ר' },
  residentialSaleArea:     { label: 'שטח מכירה למגורים', kind: 'AREA_SQM', unit: 'מ״ר' },
  commercialArea:          { label: 'שטח מסחרי', kind: 'AREA_SQM', unit: 'מ״ר' },
  publicUseArea:           { label: 'שטח לצורכי ציבור', kind: 'AREA_SQM', unit: 'מ״ר' },
  penthouseCount:          { label: 'מספר פנטהאוזים', kind: 'COUNT' },
  totalScenarioUnits:      { label: 'סך יחידות בתרחיש', kind: 'COUNT', unit: 'יח״ד' },
  developerUnits:          { label: 'יחידות יזם', kind: 'COUNT', unit: 'יח״ד' },

  sales:                   { label: 'מכירות', kind: 'CURRENCY_ILS', unit: '₪' },
  profit:                  { label: 'רווח', kind: 'CURRENCY_ILS', unit: '₪' },
}

const CATEGORY_OF: Record<keyof LegacyFeasibility, FieldCategory> = {
  sourceData: 'SOURCE_DATA',
  assumptions: 'ASSUMPTION',
  outputs: 'OUTPUT',
  economics: 'ECONOMICS',
}

/** Formula fields this system adds on top of whatever was imported. */
const DERIVED: { key: string; label: string; category: FieldCategory; formulaId: string }[] = [
  { key: 'areaDiscrepancy',        label: 'הפרש בין שטח רשום למדוד', category: 'SOURCE_DATA', formulaId: 'areaDiscrepancy' },
  { key: 'averageExistingUnitArea', label: 'שטח ממוצע ליחידה קיימת', category: 'SOURCE_DATA', formulaId: 'averageExistingUnitArea' },
  { key: 'buildableRatio',         label: 'יחס מעטפת לשטח מגרש', category: 'OUTPUT', formulaId: 'buildableRatio' },
  { key: 'saleAreaPerScenarioUnit', label: 'שטח מכירה ממוצע ליחידה', category: 'OUTPUT', formulaId: 'saleAreaPerScenarioUnit' },
  { key: 'ownerUnits',             label: 'יחידות בעלים', category: 'OUTPUT', formulaId: 'ownerUnits' },
  { key: 'developerUnitShare',     label: 'חלק היזם מהיחידות', category: 'OUTPUT', formulaId: 'developerUnitShare' },
  { key: 'cost',                   label: 'עלות (נגזרת)', category: 'ECONOMICS', formulaId: 'cost' },
  { key: 'returnOnCost',           label: 'תשואה על העלות', category: 'ECONOMICS', formulaId: 'returnOnCost' },
  { key: 'profitOnSales',          label: 'רווח כאחוז מהמכירות', category: 'ECONOMICS', formulaId: 'profitOnSales' },
]

/** Data-quality flag ids that bear on particular figures, surfaced in-place. */
const FIELD_WARNINGS: Record<string, string[]> = {
  registeredLotArea:  ['dq-external-ref', 'dq-cached-values'],
  gisMeasuredArea:    ['dq-cached-values'],
  existingBuiltArea:  ['dq-ref-errors', 'dq-cached-values'],
  existingUnits:      ['dq-95-vs-98'],
  averageExistingUnitArea: ['dq-95-vs-98'],
  ownerUnits:         ['dq-95-vs-98'],
  buildingEnvelope:   ['dq-cached-values'],
  residentialSaleArea: ['dq-cached-values'],
  totalScenarioUnits: ['dq-cached-values'],
  developerUnits:     ['dq-cached-values'],
  sales:              ['dq-cached-values', 'dq-unknown-author'],
  profit:             ['dq-cached-values', 'dq-unknown-author'],
}

export function isWorkspace(v: unknown): v is FeasibilityWorkspace {
  return Boolean(v && typeof v === 'object' && (v as FeasibilityWorkspace).version === 2)
}

/**
 * Convert whatever is stored into the current workspace shape.
 *
 * Idempotent: a workspace passes through untouched, so this can sit on the
 * read path without rewriting rows on every request.
 *
 * ── PRECISION DURING MIGRATION ─────────────────────────────────────────────
 *
 * The legacy values are JSON numbers, i.e. doubles. `String(337.18)` returns
 * "337.18" because JavaScript prints the shortest decimal that round-trips to
 * the same double — so the author's intended decimal is recovered exactly,
 * and from here on it is stored as those characters and never becomes a double
 * again.
 */
export function migrateFeasibility(
  legacy: unknown,
  opts: { now?: () => string } = {},
): FeasibilityWorkspace | undefined {
  if (isWorkspace(legacy)) return legacy
  if (!legacy || typeof legacy !== 'object') return undefined

  const src = legacy as LegacyFeasibility
  const fields: Record<string, FeasibilityField> = {}

  for (const group of ['sourceData', 'assumptions', 'outputs', 'economics'] as const) {
    const entries = src[group]
    if (!entries) continue
    for (const [key, entry] of Object.entries(entries)) {
      if (!entry || typeof entry !== 'object') continue
      const known = KNOWN[key]
      const raw = entry.value
      const asString = typeof raw === 'number' ? String(raw) : String(raw ?? '')
      const numeric = known?.kind !== 'TEXT' && isNumeric(asString)

      const field: FeasibilityField = {
        key,
        label: known?.label ?? key,
        category: CATEGORY_OF[group],
        role: 'INPUT',
        kind: numeric ? (known?.kind ?? 'DECIMAL') : 'TEXT',
        value: numeric ? canonical(asString) : asString,
      }
      const unit = entry.unit ?? known?.unit
      if (unit) field.unit = unit
      if (entry.note) field.note = entry.note
      if (group === 'sourceData') {
        field.reviewState = (entry.reviewState as ReviewState | undefined) ?? 'UNREVIEWED'
      }
      // An OUTPUT that arrived from somebody else's model. Said out loud, so
      // it is never mistaken for something this system worked out.
      if (group === 'outputs') field.importedFrom = 'קובץ בדיקת ההיתכנות'
      if (FIELD_WARNINGS[key]) field.warnings = FIELD_WARNINGS[key]
      fields[key] = field
    }
  }

  for (const d of DERIVED) {
    // Never clobber an imported value with a derived field of the same name.
    if (fields[d.key]) continue
    const spec = FORMULAS[d.formulaId]!
    const field: FeasibilityField = {
      key: d.key,
      label: d.label,
      category: d.category,
      role: 'FORMULA',
      kind: spec.kind,
      formulaId: d.formulaId,
      calcStatus: 'NOT_CALCULATED',
    }
    if (spec.unit) field.unit = spec.unit
    if (FIELD_WARNINGS[d.key]) field.warnings = FIELD_WARNINGS[d.key]
    fields[d.key] = field
  }

  const stamp = (opts.now ?? (() => new Date().toISOString()))()
  const scenario = recalculate(
    {
      id: 'baseline',
      label: 'תרחיש בסיס',
      kind: 'BASELINE',
      note: 'התרחיש שיובא מקובץ בדיקת ההיתכנות.',
      fields,
      createdAt: stamp,
      updatedAt: stamp,
    },
    undefined,
    () => stamp,
  )

  return {
    version: 2,
    scenarios: [scenario],
    activeScenarioId: scenario.id,
    sourceWarnings: [
      { id: 'dq-external-ref', label: 'הפניה לקובץ חיצוני',
        detail: 'הקובץ נשען על קובץ חיצוני שאינו זמין. ערכים שנגזרים ממנו אינם ניתנים לאימות מתוך הקובץ.' },
      { id: 'dq-ref-errors', label: 'נוסחאות #REF!',
        detail: 'קיימות נוסחאות עם הפניות שבורות. כל ערך שתלוי בהן אינו אמין.' },
      { id: 'dq-cached-values', label: 'סיכון בערכים שמורים',
        detail: 'הערכים בקובץ הם ערכים שמורים שלא חושבו מחדש. ייתכן שאינם תואמים לנוסחאות שמאחוריהם.' },
      { id: 'dq-unknown-author', label: 'מחבר ותאריך הקובץ אינם ידועים',
        detail: 'לא ידוע מי הכין את הקובץ ומתי, ולא ידוע מול איזה מצב תכנוני הוא נכתב.' },
      { id: 'dq-95-vs-98', label: 'מספר יחידות קיימות: 95 מול 98',
        detail: 'הקובץ מאפשר שתי פרשנויות. כל חישוב שנגזר ממספר היחידות הקיימות מושפע מכך.' },
    ],
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  EDIT OPERATIONS
// ══════════════════════════════════════════════════════════════════════════

export type FeasibilityEdit =
  | { op: 'setValue'; scenarioId: string; key: string; value: string }
  | { op: 'setMeta'; scenarioId: string; key: string; note?: string; sourceRef?: string; reviewState?: ReviewState }
  | { op: 'setOverride'; scenarioId: string; key: string; value: string; reason: string }
  | { op: 'clearOverride'; scenarioId: string; key: string }

export class FeasibilityEditError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
  }
}

/**
 * Apply one edit and recompute exactly what it affects.
 *
 * ── WHY EDITS ARE OPERATIONS AND NOT A WHOLE-DOCUMENT PUT ──────────────────
 *
 * A client that sent back the entire workspace could set `calculatedValue`
 * directly, and a calculated field that the browser can write is not a
 * calculated field. Naming the operations means the server decides what a
 * formula says, always, and the only writable things are inputs, metadata and
 * a declared override.
 */
export function applyEdit(
  workspace: FeasibilityWorkspace,
  edit: FeasibilityEdit,
  actor: { userId: string },
  now: () => string = () => new Date().toISOString(),
): FeasibilityWorkspace {
  const index = workspace.scenarios.findIndex((s) => s.id === edit.scenarioId)
  if (index < 0) {
    throw new FeasibilityEditError('SCENARIO_NOT_FOUND', `התרחיש ${edit.scenarioId} לא נמצא.`)
  }
  const scenario = workspace.scenarios[index]!
  const field = scenario.fields[edit.key]
  if (!field) {
    throw new FeasibilityEditError('FIELD_NOT_FOUND', `השדה ${edit.key} לא נמצא בתרחיש.`)
  }

  const stamp = now()
  let nextField: FeasibilityField

  switch (edit.op) {
    case 'setValue': {
      if (field.role === 'FORMULA') {
        throw new FeasibilityEditError(
          'FIELD_IS_CALCULATED',
          'זהו שדה מחושב. כדי לקבוע ערך אחר יש להגדיר עקיפה ידנית עם נימוק.',
        )
      }
      if (field.kind === 'TEXT') {
        nextField = { ...field, value: edit.value }
      } else {
        if (!isNumeric(edit.value)) {
          throw new FeasibilityEditError('NOT_A_NUMBER', `הערך של "${field.label}" חייב להיות מספר.`)
        }
        nextField = { ...field, value: canonical(edit.value) }
      }
      break
    }
    case 'setMeta': {
      nextField = { ...field }
      if (edit.note !== undefined) nextField.note = edit.note || undefined
      if (edit.sourceRef !== undefined) nextField.sourceRef = edit.sourceRef || undefined
      if (edit.reviewState !== undefined) {
        if (field.category !== 'SOURCE_DATA') {
          throw new FeasibilityEditError(
            'REVIEW_STATE_NOT_APPLICABLE',
            'מצב בדיקה קיים לנתוני מקור בלבד.',
          )
        }
        nextField.reviewState = edit.reviewState
      }
      break
    }
    case 'setOverride': {
      if (field.role !== 'FORMULA') {
        throw new FeasibilityEditError(
          'OVERRIDE_ON_INPUT',
          'עקיפה ידנית קיימת לשדות מחושבים בלבד. שדה קלט פשוט עורכים.',
        )
      }
      if (!isNumeric(edit.value)) {
        throw new FeasibilityEditError('NOT_A_NUMBER', `ערך העקיפה של "${field.label}" חייב להיות מספר.`)
      }
      if (!edit.reason || !edit.reason.trim()) {
        // An override with no reason is an unexplained number that outlives
        // the person who typed it.
        throw new FeasibilityEditError('OVERRIDE_NEEDS_REASON', 'עקיפה ידנית מחייבת נימוק.')
      }
      nextField = {
        ...field,
        override: {
          value: canonical(edit.value),
          reason: edit.reason.trim(),
          userId: actor.userId,
          at: stamp,
        },
      }
      // `calculatedValue` is deliberately untouched. The calculation survives
      // the override so the two can always be compared.
      break
    }
    case 'clearOverride': {
      if (!field.override) {
        throw new FeasibilityEditError('NO_OVERRIDE', 'אין עקיפה ידנית לשדה הזה.')
      }
      nextField = { ...field }
      delete nextField.override
      break
    }
  }

  const edited: FeasibilityScenario = {
    ...scenario,
    fields: { ...scenario.fields, [edit.key]: nextField },
    updatedAt: stamp,
  }

  // Metadata cannot change a number, so it cannot change a calculation.
  const recomputed = edit.op === 'setMeta'
    ? edited
    : recalculate(edited, [edit.key], () => stamp)

  const scenarios = [...workspace.scenarios]
  scenarios[index] = recomputed
  return { ...workspace, scenarios }
}
