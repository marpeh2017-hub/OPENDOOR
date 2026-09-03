/**
 * The feasibility domain model: precision, formulas, overrides, migration.
 *
 * Pure unit tests over `feasibility-model.ts` — no database, no HTTP. The
 * arithmetic is the part that has to be right before any of it is worth
 * persisting, and it is testable in milliseconds without either.
 */
import {
  FORMULAS, applyEdit, canonical, dependentsOf, effectiveRole, effectiveValue,
  isNumeric, migrateFeasibility, recalculate,
  type FeasibilityScenario, type FeasibilityWorkspace,
} from '../src/cms/feasibility-model'

/** The Pass 4C flat shape, exactly as seeded for Tchernichovsky. */
const LEGACY = {
  sourceData: {
    registeredLotArea: { value: 10_575, unit: 'מ״ר', note: 'שטח מגרש רשום', reviewState: 'IN_REVIEW' },
    gisMeasuredArea: { value: 10_545.14, unit: 'מ״ר', note: 'מדידת GIS', reviewState: 'IN_REVIEW' },
    existingBuiltArea: { value: 9_296.8, unit: 'מ״ר', reviewState: 'UNREVIEWED' },
    permittedArea: { value: 12_550.68, unit: 'מ״ר', reviewState: 'UNREVIEWED' },
    averageApartmentArea: { value: 94.87, unit: 'מ״ר', reviewState: 'UNREVIEWED' },
    existingUnits: { value: '95 או 98', note: 'שתי פרשנויות אפשריות. לא הוכרע.', reviewState: 'IN_REVIEW' },
  },
  assumptions: {
    expropriation: { value: 'הופחתה הפרשה להפקעה', note: 'הנחת תרחיש' },
    ownerConsideration: { value: 'כלל תמורה לבעלים לפי התרחיש' },
  },
  outputs: {
    buildingEnvelope: { value: 43_930.7, unit: 'מ״ר' },
    residentialSaleArea: { value: 35_031.5, unit: 'מ״ר' },
    totalScenarioUnits: { value: 337.18, unit: 'יח״ד' },
    developerUnits: { value: 239.18, unit: 'יח״ד' },
  },
  economics: {
    sales: { value: 825_600_000, unit: '₪' },
    profit: { value: 135_900_000, unit: '₪' },
  },
}

const migrate = () => migrateFeasibility(LEGACY, { now: () => '2026-09-03T00:00:00.000Z' })!
const active = (w: FeasibilityWorkspace): FeasibilityScenario =>
  w.scenarios.find((s) => s.id === w.activeScenarioId)!
const val = (w: FeasibilityWorkspace, key: string) => effectiveValue(active(w).fields[key]!)

describe('feasibility precision', () => {
  it('stores every number as a decimal STRING, never a JS number', () => {
    const w = migrate()
    for (const f of Object.values(active(w).fields)) {
      if (f.value !== undefined) expect(typeof f.value).toBe('string')
      if (f.calculatedValue !== undefined) expect(typeof f.calculatedValue).toBe('string')
    }
  })

  it('preserves 337.18 exactly, through migration and a JSON round trip', () => {
    const w = migrate()
    expect(val(w, 'totalScenarioUnits')).toBe('337.18')
    const roundTripped = JSON.parse(JSON.stringify(w)) as FeasibilityWorkspace
    expect(val(roundTripped, 'totalScenarioUnits')).toBe('337.18')
    // And the serialised form is the characters, not a float literal.
    expect(JSON.stringify(w)).toContain('"337.18"')
  })

  it.each([
    ['10575', 'registeredLotArea'],
    ['10545.14', 'gisMeasuredArea'],
    ['9296.8', 'existingBuiltArea'],
    ['12550.68', 'permittedArea'],
    ['94.87', 'averageApartmentArea'],
    ['43930.7', 'buildingEnvelope'],
    ['35031.5', 'residentialSaleArea'],
    ['239.18', 'developerUnits'],
    ['825600000', 'sales'],
    ['135900000', 'profit'],
  ])('preserves %s (%s) exactly', (expected, key) => {
    expect(val(migrate(), key)).toBe(expected)
  })

  it('does not drift where binary floating point would', () => {
    // 0.1 + 0.2 === 0.30000000000000004 as doubles. The decimal path must not.
        const scenario: FeasibilityScenario = {
      id: 's', label: 's', kind: 'BASELINE',
      fields: {
        sales: { key: 'sales', label: 'a', category: 'ECONOMICS', role: 'INPUT', kind: 'CURRENCY_ILS', value: '0.3' },
        profit: { key: 'profit', label: 'b', category: 'ECONOMICS', role: 'INPUT', kind: 'CURRENCY_ILS', value: '0.1' },
        cost: { key: 'cost', label: 'c', category: 'ECONOMICS', role: 'FORMULA', kind: 'CURRENCY_ILS', formulaId: 'cost' },
      },
    }
    const out = recalculate(scenario, undefined, () => 'now')
    expect(out.fields['cost']!.calculatedValue).toBe('0.2')
    expect(Number(out.fields['cost']!.calculatedValue)).not.toBe(0.30000000000000004 - 0.1)
  })

  it('canonicalises without rounding', () => {
    expect(canonical('0337.1800')).toBe('337.18')
    expect(canonical(' 1.005 ')).toBe('1.005')
    expect(canonical('1e3')).toBe('1000')
  })

  it('rejects things that are not numbers', () => {
    expect(isNumeric('95 או 98')).toBe(false)
    expect(isNumeric('')).toBe(false)
    expect(isNumeric(undefined)).toBe(false)
    expect(isNumeric('337.18')).toBe(true)
  })
})

describe('formulas', () => {
  const w = migrate()

  it('derives owner units as the exact identity 337.18 - 239.18', () => {
    expect(val(w, 'ownerUnits')).toBe('98')
  })

  it('derives cost from sales and profit', () => {
    expect(val(w, 'cost')).toBe('689700000')
  })

  it('derives return on cost and profit-on-sales as percentages', () => {
    // 135_900_000 / 689_700_000 * 100
    expect(val(w, 'returnOnCost')!.startsWith('19.70421922')).toBe(true)
    // 135_900_000 / 825_600_000 * 100
    expect(val(w, 'profitOnSales')!.startsWith('16.46075')).toBe(true)
  })

  it('derives the registered-vs-measured area discrepancy', () => {
    expect(val(w, 'areaDiscrepancy')).toBe('29.86')
  })

  it('derives the developer unit share', () => {
    expect(val(w, 'developerUnitShare')!.startsWith('70.9354')).toBe(true)
  })

  it('reports MISSING_INPUTS, naming the field, when a source value is unresolved', () => {
    // existingUnits reads "95 או 98" in the workbook. The formula exists, the
    // answer does not, and the difference is stated rather than left blank.
    const f = active(w).fields['averageExistingUnitArea']!
    expect(f.calcStatus).toBe('MISSING_INPUTS')
    expect(f.calculatedValue).toBeUndefined()
    expect(f.missingInputs).toContain('existingUnits')
  })

  it('does NOT invent a formula for the workbook headline figures', () => {
    // Their method is unknown, so they stay imported inputs. Guessing
    // "sale area / average apartment area" would give 369.26 against the
    // workbook's 337.18 — wrong by thirty-two apartments.
    for (const key of ['totalScenarioUnits', 'developerUnits', 'buildingEnvelope', 'residentialSaleArea']) {
      const f = active(w).fields[key]!
      expect(f.role).toBe('INPUT')
      expect(f.formulaId).toBeUndefined()
      expect(f.importedFrom).toBeTruthy()
    }
  })

  it('every registered formula declares its inputs and an explanation', () => {
    for (const spec of Object.values(FORMULAS)) {
      expect(spec.inputs.length).toBeGreaterThan(0)
      expect(spec.explain.length).toBeGreaterThan(10)
    }
  })

  it('stores no executable formula text anywhere in the persisted shape', () => {
    // Formula LOGIC is typed code; the document holds only an identifier.
    const serialised = JSON.stringify(migrate())
    for (const forbidden of ['=>', 'function', 'eval', '.div(', '.times(']) {
      expect(serialised).not.toContain(forbidden)
    }
    expect(active(migrate()).fields['cost']!.formulaId).toBe('cost')
  })
})

describe('recalculation is limited to what depends on the change', () => {
  const w = migrate()

  it('knows the transitive dependents of an input', () => {
    // sales -> cost -> returnOnCost, and sales -> profitOnSales
    const deps = dependentsOf(active(w), ['sales'])
    expect(deps).toEqual(expect.arrayContaining(['cost', 'returnOnCost', 'profitOnSales']))
    expect(deps).not.toContain('ownerUnits')
    expect(deps).not.toContain('areaDiscrepancy')
  })

  it('recomputes a formula that depends on a formula, in the right order', () => {
    const edited = applyEdit(w, {
      op: 'setValue', scenarioId: 'baseline', key: 'sales', value: '1000',
    }, { userId: 'u1' }, () => 'T2')
    // cost = 1000 - 135900000 ; returnOnCost must use the NEW cost, not the old
    expect(val(edited, 'cost')).toBe('-135899000')
    const roc = val(edited, 'returnOnCost')!
    expect(roc.startsWith('-100.000')).toBe(true)
  })

  it('leaves untouched calculations alone, timestamp included', () => {
    const before = active(w).fields['areaDiscrepancy']!
    const edited = applyEdit(w, {
      op: 'setValue', scenarioId: 'baseline', key: 'sales', value: '900000000',
    }, { userId: 'u1' }, () => 'T2')
    const after = active(edited).fields['areaDiscrepancy']!
    // The timestamp is evidence about when a number was derived; a blanket
    // refresh would destroy it.
    expect(after.calculatedAt).toBe(before.calculatedAt)
    expect(after.calculatedValue).toBe(before.calculatedValue)
  })

  it('metadata edits change no calculation at all', () => {
    const edited = applyEdit(w, {
      op: 'setMeta', scenarioId: 'baseline', key: 'sales', note: 'הערה חדשה',
    }, { userId: 'u1' }, () => 'T2')
    expect(val(edited, 'cost')).toBe(val(w, 'cost'))
    expect(active(edited).fields['cost']!.calculatedAt).toBe(active(w).fields['cost']!.calculatedAt)
  })
})

describe('manual override', () => {
  const w = migrate()

  it('keeps the calculated value beside the override, and records who and why', () => {
    const o = applyEdit(w, {
      op: 'setOverride', scenarioId: 'baseline', key: 'ownerUnits',
      value: '95', reason: 'הקובץ קורא 95 במקום אחר; נבחר הפירוש השמרני',
    }, { userId: 'usr_pm_01' }, () => '2026-09-03T10:00:00.000Z')

    const f = active(o).fields['ownerUnits']!
    expect(f.override!.value).toBe('95')
    expect(f.override!.userId).toBe('usr_pm_01')
    expect(f.override!.reason).toContain('95')
    // The calculation SURVIVES, so the two can always be compared.
    expect(f.calculatedValue).toBe('98')
    expect(effectiveValue(f)).toBe('95')
    expect(effectiveRole(f)).toBe('MANUAL_OVERRIDE')
  })

  it('feeds the override, not the calculation, into dependent formulas', () => {
    const o = applyEdit(w, {
      op: 'setOverride', scenarioId: 'baseline', key: 'cost',
      value: '700000000', reason: 'תקציב מעודכן מהיזם',
    }, { userId: 'u1' }, () => 'T2')
    // returnOnCost = profit / cost, and cost is now overridden
    expect(val(o, 'returnOnCost')!.startsWith('19.41428')).toBe(true)
    expect(active(o).fields['cost']!.calculatedValue).toBe('689700000')
  })

  it('refuses an override with no reason', () => {
    expect(() => applyEdit(w, {
      op: 'setOverride', scenarioId: 'baseline', key: 'ownerUnits', value: '95', reason: '  ',
    }, { userId: 'u1' })).toThrow(/נימוק/)
  })

  it('refuses an override on an input, and a direct write to a formula', () => {
    expect(() => applyEdit(w, {
      op: 'setOverride', scenarioId: 'baseline', key: 'sales', value: '1', reason: 'x',
    }, { userId: 'u1' })).toThrow(/מחושבים בלבד/)

    expect(() => applyEdit(w, {
      op: 'setValue', scenarioId: 'baseline', key: 'cost', value: '1',
    }, { userId: 'u1' })).toThrow(/שדה מחושב/)
  })

  it('restores the calculated value when the override is cleared', () => {
    const o = applyEdit(w, {
      op: 'setOverride', scenarioId: 'baseline', key: 'ownerUnits', value: '95', reason: 'סיבה',
    }, { userId: 'u1' }, () => 'T2')
    const cleared = applyEdit(o, {
      op: 'clearOverride', scenarioId: 'baseline', key: 'ownerUnits',
    }, { userId: 'u1' }, () => 'T3')
    const f = active(cleared).fields['ownerUnits']!
    expect(f.override).toBeUndefined()
    expect(effectiveValue(f)).toBe('98')
    expect(effectiveRole(f)).toBe('FORMULA')
  })
})

describe('edit validation', () => {
  const w = migrate()

  it('refuses a non-numeric value for a numeric field', () => {
    expect(() => applyEdit(w, {
      op: 'setValue', scenarioId: 'baseline', key: 'sales', value: 'הרבה',
    }, { userId: 'u1' })).toThrow(/מספר/)
  })

  it('accepts free text where the source itself is unresolved', () => {
    const edited = applyEdit(w, {
      op: 'setValue', scenarioId: 'baseline', key: 'existingUnits', value: '95 או 98, טרם הוכרע',
    }, { userId: 'u1' }, () => 'T2')
    expect(val(edited, 'existingUnits')).toBe('95 או 98, טרם הוכרע')
  })

  it('allows a review state only on source data', () => {
    expect(() => applyEdit(w, {
      op: 'setMeta', scenarioId: 'baseline', key: 'sales', reviewState: 'ACCEPTED',
    }, { userId: 'u1' })).toThrow(/נתוני מקור/)

    const ok = applyEdit(w, {
      op: 'setMeta', scenarioId: 'baseline', key: 'registeredLotArea', reviewState: 'ACCEPTED',
    }, { userId: 'u1' }, () => 'T2')
    expect(active(ok).fields['registeredLotArea']!.reviewState).toBe('ACCEPTED')
  })

  it('never marks source data verified on its own', () => {
    // Importing a workbook is not review. Everything arrives UNREVIEWED or
    // carrying whatever the import explicitly recorded.
    const w2 = migrate()
    for (const f of Object.values(active(w2).fields)) {
      // Calculated fields carry no review state: there is no source to review,
      // only inputs that have their own.
      if (f.category === 'SOURCE_DATA' && f.role === 'INPUT') {
        expect(['UNREVIEWED', 'IN_REVIEW']).toContain(f.reviewState)
        expect(f.reviewState).not.toBe('ACCEPTED')
      }
    }
  })

  it('404s a scenario or field that does not exist', () => {
    expect(() => applyEdit(w, {
      op: 'setValue', scenarioId: 'nope', key: 'sales', value: '1',
    }, { userId: 'u1' })).toThrow(/לא נמצא/)
    expect(() => applyEdit(w, {
      op: 'setValue', scenarioId: 'baseline', key: 'nope', value: '1',
    }, { userId: 'u1' })).toThrow(/לא נמצא/)
  })
})

describe('adding a field', () => {
  const w = migrate()

  it('takes its label and kind from the known registry when the key is known', () => {
    const out = applyEdit(w, {
      op: 'addField', scenarioId: 'baseline', key: 'buildingCount',
      category: 'ASSUMPTION', value: '4',
    }, { userId: 'u1' }, () => 'T2')
    const f = active(out).fields['buildingCount']!
    expect(f.label).toBe('מספר מבנים')
    expect(f.kind).toBe('COUNT')
    expect(f.role).toBe('INPUT')
    expect(f.category).toBe('ASSUMPTION')
    expect(f.value).toBe('4')
  })

  it('can complete a formula that was waiting on a missing input', () => {
    // averageExistingUnitArea needs a numeric existingUnits, which the
    // workbook leaves ambiguous. Resolving it makes the calculation possible.
    const before = active(w).fields['averageExistingUnitArea']!
    expect(before.calcStatus).toBe('MISSING_INPUTS')

    const resolved = applyEdit(w, {
      op: 'setValue', scenarioId: 'baseline', key: 'existingUnits', value: '98',
    }, { userId: 'u1' }, () => 'T2')
    const after = active(resolved).fields['averageExistingUnitArea']!
    expect(after.calcStatus).toBe('OK')
    expect(after.calculatedValue!.startsWith('94.865')).toBe(true)
  })

  it('creates INPUT fields only, never a formula', () => {
    const out = applyEdit(w, {
      op: 'addField', scenarioId: 'baseline', key: 'someNewThing',
      category: 'ASSUMPTION', label: 'משהו חדש', kind: 'DECIMAL', value: '1.5',
    }, { userId: 'u1' }, () => 'T2')
    const f = active(out).fields['someNewThing']!
    expect(f.role).toBe('INPUT')
    expect(f.formulaId).toBeUndefined()
  })

  it('marks a newly added source value as reviewed by nobody', () => {
    const out = applyEdit(w, {
      op: 'addField', scenarioId: 'baseline', key: 'demolitionGrossArea',
      category: 'SOURCE_DATA', value: '12000',
    }, { userId: 'u1' }, () => 'T2')
    expect(active(out).fields['demolitionGrossArea']!.reviewState).toBe('UNREVIEWED')
  })

  it('refuses a duplicate key, a bad key, a missing label and a bad number', () => {
    const bad = (edit: Record<string, unknown>) => () =>
      applyEdit(w, { op: 'addField', scenarioId: 'baseline', category: 'ASSUMPTION', ...edit } as never,
        { userId: 'u1' })

    expect(bad({ key: 'sales' })).toThrow(/כבר קיים/)
    expect(bad({ key: 'שדה', label: 'x' })).toThrow(/באנגלית/)
    expect(bad({ key: 'brandNew' })).toThrow(/כותרת/)
    expect(bad({ key: 'brandNew', label: 'חדש', value: 'הרבה' })).toThrow(/מספר/)
  })
})

describe('migration and scenario readiness', () => {
  it('is idempotent — a workspace passes through untouched', () => {
    const once = migrate()
    const twice = migrateFeasibility(once)!
    expect(twice).toBe(once)
  })

  it('produces one BASELINE scenario in a list, not a single hardcoded slot', () => {
    const w = migrate()
    expect(Array.isArray(w.scenarios)).toBe(true)
    expect(w.scenarios).toHaveLength(1)
    expect(w.scenarios[0]!.kind).toBe('BASELINE')
    expect(w.activeScenarioId).toBe('baseline')
  })

  it('holds a second scenario without any shape change', () => {
    // The comparison UI is not built; the model must not be what blocks it.
    const w = migrate()
    const withAlt: FeasibilityWorkspace = {
      ...w,
      scenarios: [...w.scenarios, { ...active(w), id: 'dev-proposal', label: 'הצעת יזם', kind: 'DEVELOPER_PROPOSAL' }],
    }
    const edited = applyEdit(withAlt, {
      op: 'setValue', scenarioId: 'dev-proposal', key: 'sales', value: '900000000',
    }, { userId: 'u1' }, () => 'T2')
    // Editing one scenario leaves the other alone.
    expect(val(edited, 'sales')).toBe('825600000')
    expect(effectiveValue(edited.scenarios[1]!.fields['sales']!)).toBe('900000000')
    expect(effectiveValue(edited.scenarios[1]!.fields['cost']!)).toBe('764100000')
  })

  it('keeps the four categories structurally distinct', () => {
    const cats = new Set(Object.values(active(migrate()).fields).map((f) => f.category))
    expect(cats).toEqual(new Set(['SOURCE_DATA', 'ASSUMPTION', 'OUTPUT', 'ECONOMICS']))
  })

  it('carries workbook quality warnings that survive the import', () => {
    const w = migrate()
    const ids = (w.sourceWarnings ?? []).map((x) => x.id)
    expect(ids).toEqual(expect.arrayContaining([
      'dq-external-ref', 'dq-ref-errors', 'dq-cached-values', 'dq-unknown-author',
    ]))
    // And they are attached to the figures they bear on.
    expect(active(w).fields['sales']!.warnings).toContain('dq-cached-values')
    expect(active(w).fields['existingUnits']!.warnings).toContain('dq-95-vs-98')
  })

  it('gives every field a numeric kind, so nothing has to guess at format', () => {
    for (const f of Object.values(active(migrate()).fields)) {
      expect(f.kind).toBeTruthy()
      // A formatted string is never a value.
      if (f.value) {
        expect(f.value).not.toContain('₪')
        expect(f.value).not.toContain(',')
      }
    }
  })
})
