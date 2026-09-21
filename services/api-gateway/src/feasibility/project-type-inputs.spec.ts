/**
 * מה כל מסלול שואל — מקור אחד לתצוגה ולבדיקה.
 *
 * הטענה שהטבלה הזו קיימת בשבילה היא שבחירת מסלול אחד אינה גוררת שדות של
 * מסלול אחר. הבדיקות כאן מנסות לשבור בדיוק את זה.
 */
import {
  PROJECT_TYPE_INPUTS, SELECTABLE_PROJECT_TYPES, PROJECT_TYPE_LABELS,
  inputsFor, notApplicableFor, requirementFor, inputReadiness,
} from './project-type-inputs'
import type { FeasibilityProjectType } from '@prisma/client'

const ALL: FeasibilityProjectType[] = ['PINUY_BINUY', 'TAMA_38_1', 'TAMA_38_2', 'COMBINATION', 'NEW_CONSTRUCTION', 'LAND', 'OTHER']

const emptyProfile = { parcels: [], areas: [], planningRights: [] }
const emptyScenario = { unitMix: [], costLines: [], compensations: [], cashFlowAllocations: [], considerationInKind: null, financing: null }

describe('טבלת הקלטים לפי מסלול', () => {
  it('כל מסלול מצהיר על כל קלט — אין קלט שנופל לברירת מחדל שקטה', () => {
    for (const projectType of ALL) {
      for (const input of PROJECT_TYPE_INPUTS) {
        const shown = inputsFor(projectType).some((entry) => entry.key === input.key)
        const hidden = notApplicableFor(projectType).some((entry) => entry.key === input.key)
        // בדיוק אחד מהשניים, לכל קלט ובכל מסלול.
        expect(shown !== hidden).toBe(true)
      }
    }
  })

  it('בחירת מסלול אחד אינה גוררת שדות של אחר', () => {
    const keys = (projectType: FeasibilityProjectType) => inputsFor(projectType).map((input) => input.key)

    // רכישת קרקע: אין דיירים, אין תמורה בעין, אין אחוז קומבינציה.
    expect(keys('NEW_CONSTRUCTION')).not.toContain('compensations')
    expect(keys('NEW_CONSTRUCTION')).not.toContain('unitMix.ownerReplacement')
    expect(keys('NEW_CONSTRUCTION')).not.toContain('combinationShare')
    expect(keys('NEW_CONSTRUCTION')).not.toContain('considerationInKind')

    // פינוי־בינוי: אין רכישת קרקע במזומן ואין מס רכישה.
    expect(keys('PINUY_BINUY')).not.toContain('cost.land')
    expect(keys('PINUY_BINUY')).not.toContain('cost.purchaseTax')
    expect(keys('PINUY_BINUY')).toContain('compensations.relocation')

    // תמ״א 38/1: הדיירים נשארים — אין שכר דירה חלופי, אין הריסה, אין דירות תמורה.
    expect(keys('TAMA_38_1')).not.toContain('compensations.relocation')
    expect(keys('TAMA_38_1')).not.toContain('cost.demolition')
    expect(keys('TAMA_38_1')).not.toContain('unitMix.ownerReplacement')
    expect(keys('TAMA_38_1')).toContain('cost.reinforcement')

    // תמ״א 38/2: כן הריסה, כן שכר דירה חלופי, אין חיזוק.
    expect(keys('TAMA_38_2')).toContain('cost.demolition')
    expect(keys('TAMA_38_2')).toContain('compensations.relocation')
    expect(keys('TAMA_38_2')).not.toContain('cost.reinforcement')

    // קרקע: אין בנייה, אין ערבויות, אין שטח מכירה — יש השבחה ומחיר מכירה.
    expect(keys('LAND')).not.toContain('cost.construction')
    expect(keys('LAND')).not.toContain('cost.guarantees')
    expect(keys('LAND')).not.toContain('unitMix.developerSale')
    expect(keys('LAND')).toContain('cost.upgrade')
    expect(keys('LAND')).toContain('resaleValue')

    // קומבינציה: אחוז ותמורה בעין, ומזומן אופציונלי — קומבינציה מעורבת.
    expect(keys('COMBINATION')).toContain('combinationShare')
    expect(keys('COMBINATION')).toContain('considerationInKind')
    expect(requirementFor('COMBINATION', 'cost.land')).toBe('OPTIONAL')
  })

  it('‏38/1 ו-38/2 נבדלים בפועל, ולא רק בשם', () => {
    const one = new Set(inputsFor('TAMA_38_1').map((input) => input.key))
    const two = new Set(inputsFor('TAMA_38_2').map((input) => input.key))
    const differences = [...new Set([...one, ...two])].filter((key) => one.has(key) !== two.has(key))
    expect(differences.sort()).toEqual(['compensations.relocation', 'cost.demolition', 'cost.reinforcement', 'unitMix.ownerReplacement'])
  })

  it('כל מסלול בבורר הוא מסלול שהוגדר, ו-OTHER אינו מוצג', () => {
    expect(SELECTABLE_PROJECT_TYPES).not.toContain('OTHER')
    expect(SELECTABLE_PROJECT_TYPES).toHaveLength(6)
    for (const projectType of SELECTABLE_PROJECT_TYPES) {
      expect(PROJECT_TYPE_LABELS[projectType]).toBeTruthy()
      // מסלול חייב לדרוש משהו. מסלול בלי דרישות אינו מסלול.
      expect(inputsFor(projectType).some((input) => input.requirement === 'REQUIRED')).toBe(true)
    }
  })

  it('קלט שאין לו עדיין שדה מדווח NOT_ENFORCED — לעולם לא כ"קיים"', () => {
    const readiness = inputReadiness('COMBINATION', emptyProfile, emptyScenario)
    const share = readiness.find((input) => input.key === 'combinationShare')!
    expect(share.coverage).toBe('PLANNED')
    expect(share.status).toBe('NOT_ENFORCED')
    // ומה שכן ממודל ולא נמסר, מדווח כחסר.
    expect(readiness.find((input) => input.key === 'parcels')!.status).toBe('MISSING')
  })

  it('קורא את המודל בפועל: קלט שנמסר מדווח כקיים, וחיזוק מובחן מבנייה', () => {
    const profile = { parcels: [{}], areas: [{}], planningRights: [{}] }
    const scenario = {
      unitMix: [{ disposition: 'DEVELOPER_SALE', unitCount: 4 }],
      costLines: [{ category: 'CONSTRUCTION', label: 'חיזוק המבנה' }, { category: 'GUARANTEES', label: 'ערבות חוק מכר' }],
      compensations: [], cashFlowAllocations: [{}], considerationInKind: null, financing: {},
    }
    const byKey = Object.fromEntries(inputReadiness('TAMA_38_1', profile, scenario).map((input) => [input.key, input.status]))
    expect(byKey['parcels']).toBe('PRESENT')
    expect(byKey['cost.reinforcement']).toBe('PRESENT')
    // שורת חיזוק אינה נספרת גם כבנייה: אחרת "יש בנייה" היה נכון תמיד.
    expect(byKey['cost.construction']).toBe('MISSING')
    expect(byKey['cost.guarantees']).toBe('PRESENT')
    expect(byKey['compensations']).toBe('MISSING')
  })

  it('הסדר הוא סדר הטיפול: חובה־חסר ראשון, נמסר אחרון', () => {
    const readiness = inputReadiness('NEW_CONSTRUCTION', emptyProfile, emptyScenario)
    const first = readiness[0]!
    expect(first.requirement).toBe('REQUIRED')
    expect(first.status).toBe('MISSING')
  })
})
