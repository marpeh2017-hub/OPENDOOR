/**
 * מסלול ברמת התרחיש — "יורש" ו"נקבע במפורש" הן שתי עובדות.
 *
 * העתקת ערך הפרופיל לתרחיש היתה נראית זהה ביום הראשון ומתיישנת ביום שבו
 * ברירת המחדל זזה, ואז אין דרך לדעת אם התרחיש התכוון לערך הזה או רק במקרה
 * הסכים איתו. זו אותה הבחנה שהחזיקה לאורך כל הסבב — `UNSET` מול
 * `NOT_APPLICABLE`, `UNKNOWN` מול null, `PLANNED` מול נבדק.
 */
import { effectiveProjectType, inputsFor } from './project-type-inputs'

describe('מסלול ברמת התרחיש', () => {
  it('תרחיש בלי ערך יורש, ומצהיר שירש', () => {
    const route = effectiveProjectType('NEW_CONSTRUCTION', null)
    expect(route.projectType).toBe('NEW_CONSTRUCTION')
    expect(route.source).toBe('PROFILE')
    expect(route.profileDefault).toBe('NEW_CONSTRUCTION')
  })

  it('תרחיש עם ערך דורס, וברירת המחדל נשארת קריאה לצדו', () => {
    const route = effectiveProjectType('NEW_CONSTRUCTION', 'COMBINATION')
    expect(route.projectType).toBe('COMBINATION')
    expect(route.source).toBe('SCENARIO')
    // הדריסה נקראת כדריסה רק אם רואים ממה היא חורגת.
    expect(route.profileDefault).toBe('NEW_CONSTRUCTION')
  })

  it('דריסה שמסכימה עם ברירת המחדל עדיין מסומנת כהחלטה', () => {
    /*
     * זה המקרה שהעתקה היתה מוחקת: תרחיש שנקבע לו במפורש אותו מסלול כמו
     * לתיק. היום זו החלטה; מחר, כשברירת המחדל תזוז, ההחלטה הזו תחזיק והתיק
     * יזוז בלעדיה — וזה בדיוק ההבדל שצריך להישמר.
     */
    const route = effectiveProjectType('COMBINATION', 'COMBINATION')
    expect(route.source).toBe('SCENARIO')
    expect(effectiveProjectType('COMBINATION', null).source).toBe('PROFILE')
  })

  it('שינוי ברירת המחדל של התיק מזיז את היורשים ולא את מי שהחליט', () => {
    const inherits = (profileType: 'NEW_CONSTRUCTION' | 'COMBINATION') => effectiveProjectType(profileType, null).projectType
    const decided = (profileType: 'NEW_CONSTRUCTION' | 'COMBINATION') => effectiveProjectType(profileType, 'COMBINATION').projectType
    expect(inherits('NEW_CONSTRUCTION')).toBe('NEW_CONSTRUCTION')
    expect(inherits('COMBINATION')).toBe('COMBINATION')
    expect(decided('NEW_CONSTRUCTION')).toBe('COMBINATION')
    expect(decided('COMBINATION')).toBe('COMBINATION')
  })

  it('הקלטים נגזרים מהמסלול האפקטיבי, ולכן שני תרחישים בתיק אחד שואלים שונה', () => {
    const profileType = 'NEW_CONSTRUCTION' as const
    const purchase = inputsFor(effectiveProjectType(profileType, null).projectType).map(input => input.key)
    const combination = inputsFor(effectiveProjectType(profileType, 'COMBINATION').projectType).map(input => input.key)

    // רכישה טהורה אינה שואלת על אחוז קומבינציה או תמורה בעין.
    expect(purchase).not.toContain('combinationShare')
    expect(purchase).not.toContain('considerationInKind')
    // והקומבינציה באותו תיק כן.
    expect(combination).toContain('combinationShare')
    expect(combination).toContain('considerationInKind')
  })
})
