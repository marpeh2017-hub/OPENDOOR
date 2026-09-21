import type { FeasibilityProjectType } from '@prisma/client'

/**
 * מה כל מסלול באמת שואל.
 *
 * ── למה טבלה אחת ולא שני ענפים ────────────────────────────────────────────
 *
 * שאלת "אילו שדות להציג" ושאלת "אילו שדות חייבים להיות מלאים" הן אותה שאלה
 * שנשאלת פעמיים. כשהן נענות בשני מקומות, הן נפרדות — טופס שמציג שדה שאיש
 * לא בודק, או בדיקה שדורשת שדה שהטופס לא הציג. הטבלה הזו היא התשובה
 * היחידה, ושני הצדדים קוראים ממנה.
 *
 * זה גם הציר שה-Rules Registry כבר משתמש בו דרך `appliesTo`: אותו
 * `FeasibilityProjectType`, לא enum שני שצריך להישאר מסונכרן איתו.
 *
 * ── שלוש דרגות, ולא שתיים ─────────────────────────────────────────────────
 *
 * `REQUIRED` — בלעדיו אי אפשר לענות על השאלה שהמסלול שואל.
 * `OPTIONAL` — רלוונטי למסלול, ולא כל עסקה כוללת אותו.
 * `NOT_APPLICABLE` — לא קיים במסלול הזה, ולכן לא מוצג בכלל. שכר דירה חלופי
 *   בתמ״א 38/1 אינו "שדה ריק": הדיירים לא מפונים, ואין מה לשאול.
 *
 * ההבחנה בין `OPTIONAL` ריק לבין `NOT_APPLICABLE` היא אותה הבחנה שהרישום
 * עושה בין `UNSET` ל-`NOT_APPLICABLE`, ומאותה סיבה: "לא נמסר" ו"לא רלוונטי"
 * הן שתי אמירות, ומיזוגן לשדה ריק אחד מוחק את היותר חשובה מבין השתיים.
 */
export type InputRequirement = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE'

/**
 * האם המבנה יודע כבר לבדוק אם הקלט נמסר.
 *
 * `MODELLED` — יש שדה במודל, והבדיקה אמיתית.
 * `PLANNED`  — הקלט נדרש למסלול אבל עדיין אין לו שדה. הטבלה מצהירה עליו
 *   כחסר במקום להשמיט אותו, כדי שהפער יהיה קריא ולא יתגלה מאוחר כשדה
 *   שנשכח. בדיקת המוכנות מדווחת אותו כ-`NOT_ENFORCED` ולעולם לא כ"קיים".
 */
export type InputCoverage = 'MODELLED' | 'PLANNED'

export interface ProjectTypeInputSpec {
  key: string
  label: string
  /** מה הקלט עונה עליו — מוצג לצד השדה, ונכנס להסבר כשהוא חסר. */
  intent: string
  coverage: InputCoverage
}

/** כל הקלטים שהמסלולים מדברים עליהם, במקום אחד. */
export const PROJECT_TYPE_INPUTS: readonly ProjectTypeInputSpec[] = [
  { key: 'parcels', label: 'גוש וחלקה', intent: 'זיהוי הנכס', coverage: 'MODELLED' },
  { key: 'areas', label: 'מרשם שטחים', intent: 'בסיס כל חישוב שטח', coverage: 'MODELLED' },
  { key: 'planningRights', label: 'זכויות בנייה', intent: 'מה מותר לבנות', coverage: 'MODELLED' },
  { key: 'unitMix.developerSale', label: 'שטח מכירה ליזם', intent: 'מקור ההכנסה', coverage: 'MODELLED' },
  { key: 'unitMix.ownerReplacement', label: 'דירות תמורה לבעלים', intent: 'מה מתחייבים לתת בעין', coverage: 'MODELLED' },
  { key: 'compensations', label: 'תמורות לבעלי הדירות', intent: 'מה כל בעל דירה מקבל', coverage: 'MODELLED' },
  { key: 'compensations.relocation', label: 'שכר דירה חלופי והובלות', intent: 'עלות הפינוי לאורך הבנייה', coverage: 'MODELLED' },
  { key: 'cost.land', label: 'מחיר רכישת הקרקע', intent: 'התמורה במזומן', coverage: 'MODELLED' },
  { key: 'cost.purchaseTax', label: 'מס רכישה', intent: 'מס על הרכישה', coverage: 'MODELLED' },
  { key: 'cost.brokerage', label: 'עמלת תיווך', intent: 'עלות עסקה', coverage: 'MODELLED' },
  { key: 'cost.demolition', label: 'הריסה', intent: 'פינוי המבנה הקיים', coverage: 'MODELLED' },
  { key: 'cost.construction', label: 'עלות בנייה', intent: 'העלות הישירה הגדולה', coverage: 'MODELLED' },
  { key: 'cost.reinforcement', label: 'עלות חיזוק ותוספות לדירה קיימת', intent: 'מה שמקבלים הדיירים שנשארים', coverage: 'MODELLED' },
  { key: 'cost.guarantees', label: 'ערבויות', intent: 'חוק מכר, שכירות ומיסים', coverage: 'MODELLED' },
  { key: 'cost.bettermentLevy', label: 'היטל השבחה', intent: 'היטל במימוש', coverage: 'MODELLED' },
  { key: 'cost.upgrade', label: 'עלויות השבחה', intent: 'תכנון, אגרות ויועצים — בלי בנייה', coverage: 'MODELLED' },
  { key: 'financing', label: 'תנאי מימון', intent: 'ליווי בנייה', coverage: 'MODELLED' },
  { key: 'timeline', label: 'לוח זמנים', intent: 'מה שמניע ריבית ושכר דירה חלופי', coverage: 'MODELLED' },
  { key: 'considerationInKind', label: 'שווי התמורה בעין', intent: 'מה שניתן ולא במזומן', coverage: 'MODELLED' },
  { key: 'combinationShare', label: 'אחוז הקומבינציה ובסיסו', intent: 'המספר שמנהלים עליו משא ומתן', coverage: 'PLANNED' },
  { key: 'resaleValue', label: 'מחיר המכירה הצפוי של הקרקע', intent: 'התוצר במסלול שאין בו בנייה', coverage: 'PLANNED' },
] as const

const REQUIREMENTS: Readonly<Record<FeasibilityProjectType, Readonly<Record<string, InputRequirement>>>> = {
  PINUY_BINUY: {
    parcels: 'REQUIRED', areas: 'REQUIRED', planningRights: 'REQUIRED',
    'unitMix.developerSale': 'REQUIRED', 'unitMix.ownerReplacement': 'REQUIRED',
    compensations: 'REQUIRED', 'compensations.relocation': 'REQUIRED',
    'cost.land': 'NOT_APPLICABLE', 'cost.purchaseTax': 'NOT_APPLICABLE', 'cost.brokerage': 'NOT_APPLICABLE',
    'cost.demolition': 'REQUIRED', 'cost.construction': 'REQUIRED', 'cost.reinforcement': 'NOT_APPLICABLE',
    'cost.guarantees': 'REQUIRED', 'cost.bettermentLevy': 'OPTIONAL', 'cost.upgrade': 'NOT_APPLICABLE',
    financing: 'REQUIRED', timeline: 'REQUIRED',
    considerationInKind: 'NOT_APPLICABLE', combinationShare: 'NOT_APPLICABLE', resaleValue: 'NOT_APPLICABLE',
  },
  TAMA_38_1: {
    parcels: 'REQUIRED', areas: 'REQUIRED', planningRights: 'REQUIRED',
    'unitMix.developerSale': 'REQUIRED', 'unitMix.ownerReplacement': 'NOT_APPLICABLE',
    compensations: 'REQUIRED',
    // הדיירים נשארים בבניין. אין פינוי, ולכן אין מה לשאול — לא שדה ריק.
    'compensations.relocation': 'NOT_APPLICABLE',
    'cost.land': 'NOT_APPLICABLE', 'cost.purchaseTax': 'NOT_APPLICABLE', 'cost.brokerage': 'NOT_APPLICABLE',
    'cost.demolition': 'NOT_APPLICABLE', 'cost.construction': 'REQUIRED', 'cost.reinforcement': 'REQUIRED',
    'cost.guarantees': 'REQUIRED', 'cost.bettermentLevy': 'OPTIONAL', 'cost.upgrade': 'NOT_APPLICABLE',
    financing: 'REQUIRED', timeline: 'REQUIRED',
    considerationInKind: 'NOT_APPLICABLE', combinationShare: 'NOT_APPLICABLE', resaleValue: 'NOT_APPLICABLE',
  },
  TAMA_38_2: {
    parcels: 'REQUIRED', areas: 'REQUIRED', planningRights: 'REQUIRED',
    'unitMix.developerSale': 'REQUIRED', 'unitMix.ownerReplacement': 'REQUIRED',
    compensations: 'REQUIRED', 'compensations.relocation': 'REQUIRED',
    'cost.land': 'NOT_APPLICABLE', 'cost.purchaseTax': 'NOT_APPLICABLE', 'cost.brokerage': 'NOT_APPLICABLE',
    'cost.demolition': 'REQUIRED', 'cost.construction': 'REQUIRED', 'cost.reinforcement': 'NOT_APPLICABLE',
    'cost.guarantees': 'REQUIRED', 'cost.bettermentLevy': 'OPTIONAL', 'cost.upgrade': 'NOT_APPLICABLE',
    financing: 'REQUIRED', timeline: 'REQUIRED',
    considerationInKind: 'NOT_APPLICABLE', combinationShare: 'NOT_APPLICABLE', resaleValue: 'NOT_APPLICABLE',
  },
  COMBINATION: {
    parcels: 'REQUIRED', areas: 'REQUIRED', planningRights: 'REQUIRED',
    'unitMix.developerSale': 'REQUIRED', 'unitMix.ownerReplacement': 'REQUIRED',
    compensations: 'NOT_APPLICABLE', 'compensations.relocation': 'NOT_APPLICABLE',
    // קומבינציה מעורבת: מזומן בנוסף לאחוז. נפוץ, ולכן אופציונלי ולא חסום.
    'cost.land': 'OPTIONAL', 'cost.purchaseTax': 'REQUIRED', 'cost.brokerage': 'OPTIONAL',
    'cost.demolition': 'OPTIONAL', 'cost.construction': 'REQUIRED', 'cost.reinforcement': 'NOT_APPLICABLE',
    'cost.guarantees': 'REQUIRED', 'cost.bettermentLevy': 'OPTIONAL', 'cost.upgrade': 'NOT_APPLICABLE',
    financing: 'REQUIRED', timeline: 'REQUIRED',
    considerationInKind: 'REQUIRED', combinationShare: 'REQUIRED', resaleValue: 'NOT_APPLICABLE',
  },
  NEW_CONSTRUCTION: {
    parcels: 'REQUIRED', areas: 'REQUIRED', planningRights: 'REQUIRED',
    'unitMix.developerSale': 'REQUIRED', 'unitMix.ownerReplacement': 'NOT_APPLICABLE',
    compensations: 'NOT_APPLICABLE', 'compensations.relocation': 'NOT_APPLICABLE',
    'cost.land': 'REQUIRED', 'cost.purchaseTax': 'REQUIRED', 'cost.brokerage': 'OPTIONAL',
    'cost.demolition': 'OPTIONAL', 'cost.construction': 'REQUIRED', 'cost.reinforcement': 'NOT_APPLICABLE',
    'cost.guarantees': 'REQUIRED', 'cost.bettermentLevy': 'OPTIONAL', 'cost.upgrade': 'NOT_APPLICABLE',
    financing: 'REQUIRED', timeline: 'REQUIRED',
    considerationInKind: 'NOT_APPLICABLE', combinationShare: 'NOT_APPLICABLE', resaleValue: 'NOT_APPLICABLE',
  },
  /*
   * קרקע: קונים ומוכרים הלאה בלי לבנות. אין בנייה, אין ליווי בנייה, אין
   * דיירים ואין ערבויות חוק מכר. המנוף היחיד הוא הזכויות והזמן, ולכן
   * `cost.upgrade` ו-`resaleValue` הם הקלטים שנושאים את כל העסקה.
   */
  LAND: {
    parcels: 'REQUIRED', areas: 'REQUIRED', planningRights: 'REQUIRED',
    'unitMix.developerSale': 'NOT_APPLICABLE', 'unitMix.ownerReplacement': 'NOT_APPLICABLE',
    compensations: 'NOT_APPLICABLE', 'compensations.relocation': 'NOT_APPLICABLE',
    'cost.land': 'REQUIRED', 'cost.purchaseTax': 'REQUIRED', 'cost.brokerage': 'OPTIONAL',
    'cost.demolition': 'NOT_APPLICABLE', 'cost.construction': 'NOT_APPLICABLE', 'cost.reinforcement': 'NOT_APPLICABLE',
    'cost.guarantees': 'NOT_APPLICABLE', 'cost.bettermentLevy': 'REQUIRED', 'cost.upgrade': 'REQUIRED',
    financing: 'OPTIONAL', timeline: 'REQUIRED',
    considerationInKind: 'NOT_APPLICABLE', combinationShare: 'NOT_APPLICABLE', resaleValue: 'REQUIRED',
  },
  /*
   * מסלול שלא הוגדר אינו מסלול, ולכן הוא אינו מוצג בבורר. הוא כן קיים
   * כערך, וכאן הוא מצהיר שאין לו דרישות — במקום לרשת בשקט את של אחר.
   */
  OTHER: Object.fromEntries(PROJECT_TYPE_INPUTS.map((input) => [input.key, 'OPTIONAL' as const])),
}

/** המסלולים שמוצגים לבחירה, בסדר שבו האשף מגיע אליהם. */
export const SELECTABLE_PROJECT_TYPES: readonly FeasibilityProjectType[] = [
  'PINUY_BINUY', 'TAMA_38_1', 'TAMA_38_2', 'COMBINATION', 'NEW_CONSTRUCTION', 'LAND',
] as const

export const PROJECT_TYPE_LABELS: Readonly<Record<FeasibilityProjectType, string>> = {
  TAMA_38_1: 'תמ״א 38/1 — חיזוק',
  TAMA_38_2: 'תמ״א 38/2 — הריסה ובנייה',
  PINUY_BINUY: 'פינוי־בינוי',
  COMBINATION: 'עסקת קומבינציה',
  NEW_CONSTRUCTION: 'רכישת קרקע ובנייה',
  LAND: 'קרקע — רכישה ומכירה ללא בנייה',
  OTHER: 'אחר',
}

export function requirementFor(projectType: FeasibilityProjectType, key: string): InputRequirement {
  return REQUIREMENTS[projectType]?.[key] ?? 'OPTIONAL'
}

export function inputsFor(projectType: FeasibilityProjectType) {
  return PROJECT_TYPE_INPUTS
    .map((input) => ({ ...input, requirement: requirementFor(projectType, input.key) }))
    .filter((input) => input.requirement !== 'NOT_APPLICABLE')
}

export function notApplicableFor(projectType: FeasibilityProjectType) {
  return PROJECT_TYPE_INPUTS.filter((input) => requirementFor(projectType, input.key) === 'NOT_APPLICABLE')
}

/*
 * ── האם הקלט נמסר בפועל ───────────────────────────────────────────────────
 *
 * הפותרים כאן קוראים את המודל הטעון, ולכן "נמסר" אינו דעה אלא בדיקה. קלט
 * בכיסוי `PLANNED` בכוונה אין לו פותר: הוא מדווח `NOT_ENFORCED`, לעולם לא
 * "קיים". בדיקה שמדווחת הצלחה על שדה שאינה יודעת לקרוא היא בדיוק מה
 * ש-`EQUITY_COMMITMENT_EXCEEDED` עשה כשהשווה מספר לעצמו.
 */
interface ReadableProfile {
  parcels: readonly unknown[]
  areas: readonly unknown[]
  planningRights: readonly unknown[]
}
interface ReadableScenario {
  unitMix: readonly { disposition: string; unitCount: number }[]
  costLines: readonly { category: string; label: string | null }[]
  compensations: readonly { monthlyRelocationRent: unknown; relocationMonths: number | null }[]
  cashFlowAllocations: readonly unknown[]
  considerationInKind: unknown
  financing: unknown
}

const anyCost = (scenario: ReadableScenario, category: string) => scenario.costLines.some((line) => line.category === category)
/** חיזוק מזוהה בתווית, כי `CONSTRUCTION` מכסה גם בנייה חדשה וגם חיזוק. */
const REINFORCEMENT_LABEL = /חיזוק|ממ״ד|ממ"ד|מעלית/

const RESOLVERS: Readonly<Record<string, (profile: ReadableProfile, scenario: ReadableScenario) => boolean>> = {
  parcels: (profile) => profile.parcels.length > 0,
  areas: (profile) => profile.areas.length > 0,
  planningRights: (profile) => profile.planningRights.length > 0,
  'unitMix.developerSale': (_p, s) => s.unitMix.some((line) => line.disposition === 'DEVELOPER_SALE' && line.unitCount > 0),
  'unitMix.ownerReplacement': (_p, s) => s.unitMix.some((line) => line.disposition === 'OWNER_REPLACEMENT' && line.unitCount > 0),
  compensations: (_p, s) => s.compensations.length > 0,
  'compensations.relocation': (_p, s) => s.compensations.some((line) => line.monthlyRelocationRent !== null && line.monthlyRelocationRent !== undefined && (line.relocationMonths ?? 0) > 0),
  'cost.land': (_p, s) => anyCost(s, 'LAND'),
  'cost.purchaseTax': (_p, s) => anyCost(s, 'TAXES'),
  'cost.brokerage': (_p, s) => anyCost(s, 'FEES'),
  'cost.demolition': (_p, s) => anyCost(s, 'DEMOLITION'),
  'cost.construction': (_p, s) => s.costLines.some((line) => line.category === 'CONSTRUCTION' && !REINFORCEMENT_LABEL.test(line.label ?? '')),
  'cost.reinforcement': (_p, s) => s.costLines.some((line) => line.category === 'CONSTRUCTION' && REINFORCEMENT_LABEL.test(line.label ?? '')),
  'cost.guarantees': (_p, s) => anyCost(s, 'GUARANTEES'),
  'cost.bettermentLevy': (_p, s) => anyCost(s, 'BETTERMENT_LEVY'),
  'cost.upgrade': (_p, s) => anyCost(s, 'PLANNING') || anyCost(s, 'LEVIES'),
  financing: (_p, s) => Boolean(s.financing),
  timeline: (_p, s) => s.cashFlowAllocations.length > 0,
  considerationInKind: (_p, s) => s.considerationInKind !== null && s.considerationInKind !== undefined,
}

export type InputStatus = 'PRESENT' | 'MISSING' | 'NOT_ENFORCED'

export interface InputReadiness extends ProjectTypeInputSpec {
  requirement: InputRequirement
  status: InputStatus
}

/**
 * מה המסלול דורש, מה נמסר, ומה עדיין אין לו שדה.
 *
 * הסדר הוא סדר הטיפול: מה שחסר וחובה קודם, ואז מה שהוצהר ואין לו עדיין
 * שדה, ואז מה שחסר ואופציונלי. מה שנמסר יורד לסוף — הוא כבר לא שאלה.
 */
const STATUS_ORDER: Record<string, number> = { 'REQUIRED:MISSING': 0, 'REQUIRED:NOT_ENFORCED': 1, 'OPTIONAL:NOT_ENFORCED': 2, 'OPTIONAL:MISSING': 3 }

export function inputReadiness(projectType: FeasibilityProjectType, profile: ReadableProfile, scenario: ReadableScenario): InputReadiness[] {
  return inputsFor(projectType)
    .map((input) => {
      const resolver = RESOLVERS[input.key]
      const status: InputStatus = input.coverage === 'PLANNED' || !resolver ? 'NOT_ENFORCED' : resolver(profile, scenario) ? 'PRESENT' : 'MISSING'
      return { ...input, status }
    })
    .sort((a, b) => (STATUS_ORDER[`${a.requirement}:${a.status}`] ?? 9) - (STATUS_ORDER[`${b.requirement}:${b.status}`] ?? 9))
}
