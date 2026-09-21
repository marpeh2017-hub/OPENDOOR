import type { FeasibilityProjectType } from '@prisma/client'
import { PROJECT_TYPE_LABELS } from './project-type-inputs'

/**
 * אשף ההפניה: ארבע שאלות שמצמצמות למסלול אחד.
 *
 * ── למה זה פונקציה טהורה ──────────────────────────────────────────────────
 *
 * אותו היגיון בדיוק נדרש בשלושה מקומות — הטופס בזמן אמת, השרת כשהוא רושם
 * את ההחלטה, והבדיקה. שלושה עותקים של עץ החלטה הם שלוש הזדמנויות שהוא
 * יתפצל, ולכן יש אחד, והשניים האחרים קוראים לו.
 *
 * ── "לא יודע" הוא תשובה ───────────────────────────────────────────────────
 *
 * `UNKNOWN` אינו דילוג ואינו ברירת מחדל. הוא עוצר את ההכרעה, מחזיר
 * `UNDECIDED`, ומחזיר לצדו את ההבדל המעשי בין האפשרויות שנחסמו — מה משתנה
 * בתזרים ומה במיסוי — כדי שההחלטה תתקבל מתוך ידיעה ולא מניחוש. מסלול
 * שנבחר בניחוש גרוע ממסלול שלא נבחר, כי הוא נראה כמו החלטה.
 */
export type LandHolder = 'SELLER_EXITS' | 'LANDOWNER_PARTNER' | 'EXISTING_OWNERS' | 'UNKNOWN'
export type BuildIntent = 'BUILD' | 'RESELL' | 'UNKNOWN'
export type Demolition = 'YES' | 'NO' | 'UNKNOWN'
export type BuildingCount = 'SINGLE' | 'MULTIPLE' | 'UNKNOWN'
export type Declaration = 'DECLARED_OR_IN_PROGRESS' | 'NOT_DECLARED' | 'UNKNOWN'

export interface RouteAnswers {
  landHolder?: LandHolder | null
  buildIntent?: BuildIntent | null
  demolition?: Demolition | null
  buildingCount?: BuildingCount | null
  declaration?: Declaration | null
}

export type RouteStatus = 'RESOLVED' | 'UNDECIDED'

export interface RouteOutcome {
  status: RouteStatus
  projectType: FeasibilityProjectType | null
  projectTypeLabel: string | null
  /** השאלה הבאה שצריך לענות עליה, או null כשהושגה הכרעה. */
  nextQuestion: string | null
  /** מה הוביל לכאן — התשובות, בסדר, בשפה שקוראים אותה בעוד חודשיים. */
  reasoning: string[]
  /** מה חוסם את ההכרעה, ומה ההבדל המעשי בין האפשרויות. */
  blockedBy: { question: string; difference: string; options: { value: string; label: string; leadsTo: string }[] } | null
  /** אזהרות על המסלול שנבחר — נכון ודורש שימת לב אינם סותרים. */
  warnings: string[]
}

export const ROUTE_QUESTIONS = {
  landHolder: {
    id: 'landHolder',
    question: 'מי מחזיק בקרקע היום?',
    difference: 'זהות הצד השני קובעת את כל מבנה התמורה: מזומן למוכר שיוצא, אחוז מהתוצר לבעל קרקע שנשאר שותף, או דירות לבעלי דירות קיימות. משם נגזרים גם המיסוי וגם התזרים.',
    options: [
      { value: 'SELLER_EXITS', label: 'מוכר שייצא מהעסקה', leadsTo: 'רכישה במזומן — נמשיך לשאלה אם בונים או מוכרים הלאה' },
      { value: 'LANDOWNER_PARTNER', label: 'בעל קרקע שיישאר שותף ויקבל דירות', leadsTo: 'עסקת קומבינציה' },
      { value: 'EXISTING_OWNERS', label: 'בעלי דירות בבניין קיים', leadsTo: 'התחדשות עירונית — נמשיך לשאלת ההריסה' },
    ],
  },
  buildIntent: {
    id: 'buildIntent',
    question: 'אתה מתכוון לבנות בעצמך, או למכור את הקרקע והזכויות הלאה?',
    difference: 'בנייה מוסיפה עלות בנייה, ליווי בנקאי, ערבויות חוק מכר ולוח זמנים של שנים. מכירה הלאה היא השבחה בלבד: המנוף היחיד הוא הזכויות והזמן, ומס השבח מתנהג אחרת.',
    options: [
      { value: 'BUILD', label: 'לבנות ולמכור דירות', leadsTo: 'רכישת קרקע ובנייה' },
      { value: 'RESELL', label: 'למכור את הקרקע או הזכויות הלאה', leadsTo: 'קרקע — רכישה ומכירה ללא בנייה' },
    ],
  },
  demolition: {
    id: 'demolition',
    question: 'המבנה הקיים ייהרס?',
    difference: 'חיזוק משאיר את הדיירים בבניין — אין שכר דירה חלופי ואין הריסה, אבל העבודה בבניין מאוכלס יקרה ואיטית יותר. הריסה מפנה את הדיירים, ולכן מוסיפה שכר דירה חלופי לאורך כל הבנייה, הובלות ואחסנה.',
    options: [
      { value: 'NO', label: 'לא, יחוזק ויורחב', leadsTo: 'תמ״א 38/1 — חיזוק' },
      { value: 'YES', label: 'כן, ייהרס וייבנה מחדש', leadsTo: 'המשך לשאלת מספר הבניינים' },
    ],
  },
  buildingCount: {
    id: 'buildingCount',
    question: 'כמה בניינים במתחם?',
    difference: 'בניין בודד הוא מסלול תמ״א 38/2. מתחם רב-בנייני יכול להיות פינוי-בינוי, ואז ההשלכות המיסויות והרגולטוריות שונות מהותית — לרבות היטל ההשבחה ומסלול האישור.',
    options: [
      { value: 'SINGLE', label: 'בניין אחד', leadsTo: 'תמ״א 38/2 — הריסה ובנייה' },
      { value: 'MULTIPLE', label: 'כמה בניינים / מתחם', leadsTo: 'המשך לשאלת ההכרזה' },
    ],
  },
  declaration: {
    id: 'declaration',
    question: 'יש הכרזה על מתחם פינוי-בינוי?',
    difference: 'הכרזה היא מה שמפעיל את מסלול פינוי-בינוי על הטבותיו ועל חובותיו. בלעדיה מתחם רב-בנייני מתנהל כתמ״א 38/2 לכל בניין, וההשלכות המיסויות שונות מהותית.',
    options: [
      { value: 'DECLARED_OR_IN_PROGRESS', label: 'כן, או בתהליך', leadsTo: 'פינוי־בינוי' },
      { value: 'NOT_DECLARED', label: 'לא', leadsTo: 'תמ״א 38/2, עם התרעה' },
    ],
  },
} as const

const blocked = (key: keyof typeof ROUTE_QUESTIONS) => {
  const question = ROUTE_QUESTIONS[key]
  return { question: question.question, difference: question.difference, options: question.options.map((option) => ({ ...option })) }
}

const undecided = (key: keyof typeof ROUTE_QUESTIONS, reasoning: string[], warnings: string[] = []): RouteOutcome => ({
  status: 'UNDECIDED', projectType: null, projectTypeLabel: null,
  nextQuestion: ROUTE_QUESTIONS[key].question,
  reasoning, blockedBy: blocked(key), warnings,
})

const resolved = (projectType: FeasibilityProjectType, reasoning: string[], warnings: string[] = []): RouteOutcome => ({
  status: 'RESOLVED', projectType, projectTypeLabel: PROJECT_TYPE_LABELS[projectType],
  nextQuestion: null, reasoning, blockedBy: null, warnings,
})

/**
 * מריץ את האשף על התשובות שניתנו עד כה.
 *
 * תשובה חסרה ותשובת "לא יודע" מובילות לאותה תוצאה — `UNDECIDED` על אותה
 * שאלה — ובכוונה: שתיהן אומרות שההכרעה אינה נתמכת, וההבדל ביניהן הוא
 * בשאלה אם כבר הוצגה לשואל, לא במה שמותר להסיק.
 */
export function resolveRoute(answers: RouteAnswers): RouteOutcome {
  const reasoning: string[] = []
  const say = (key: keyof typeof ROUTE_QUESTIONS, value: string) => {
    const question = ROUTE_QUESTIONS[key]
    const option = question.options.find((entry) => entry.value === value)
    reasoning.push(`${question.question} — ${option?.label ?? value}`)
  }

  const landHolder = answers.landHolder ?? 'UNKNOWN'
  if (landHolder === 'UNKNOWN') return undecided('landHolder', reasoning)
  say('landHolder', landHolder)

  if (landHolder === 'LANDOWNER_PARTNER') return resolved('COMBINATION', reasoning)

  if (landHolder === 'SELLER_EXITS') {
    const intent = answers.buildIntent ?? 'UNKNOWN'
    if (intent === 'UNKNOWN') return undecided('buildIntent', reasoning)
    say('buildIntent', intent)
    return resolved(intent === 'BUILD' ? 'NEW_CONSTRUCTION' : 'LAND', reasoning)
  }

  const demolition = answers.demolition ?? 'UNKNOWN'
  if (demolition === 'UNKNOWN') return undecided('demolition', reasoning)
  say('demolition', demolition)
  if (demolition === 'NO') return resolved('TAMA_38_1', reasoning)

  const buildingCount = answers.buildingCount ?? 'UNKNOWN'
  if (buildingCount === 'UNKNOWN') return undecided('buildingCount', reasoning)
  say('buildingCount', buildingCount)
  if (buildingCount === 'SINGLE') return resolved('TAMA_38_2', reasoning)

  const declaration = answers.declaration ?? 'UNKNOWN'
  if (declaration === 'UNKNOWN') return undecided('declaration', reasoning)
  say('declaration', declaration)
  if (declaration === 'DECLARED_OR_IN_PROGRESS') return resolved('PINUY_BINUY', reasoning)

  /*
   * מתחם רב-בנייני בלי הכרזה הוא מסלול תקף — ולכן `RESOLVED` ולא
   * `UNDECIDED` — אבל הוא גם השאלה שכדאי לחזור אליה. אזהרה היא הדרך לומר
   * את שניהם; הכרעה שקטה היתה אומרת רק את הראשון.
   */
  return resolved('TAMA_38_2', reasoning, [
    'מתחם רב-בנייני בלי הכרזה על פינוי-בינוי. כדאי לבדוק את כדאיות ההכרזה — ההשלכות המיסויות שונות מהותית.',
  ])
}
