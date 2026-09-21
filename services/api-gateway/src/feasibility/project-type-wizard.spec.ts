/**
 * אשף ההפניה — מעבר מלא בכל ששת המסלולים.
 *
 * הטענה שהאשף קיים בשבילה: אדם שאינו יודע לנקוב בשם המסלול יגיע אליו
 * בארבע שאלות, ומי שלא יודע לענות על אחת מהן יקבל את ההבדל המעשי במקום
 * ניחוש שנראה כמו החלטה.
 */
import { resolveRoute, ROUTE_QUESTIONS, type RouteAnswers } from './project-type-wizard'

const route = (answers: RouteAnswers) => resolveRoute(answers)

describe('אשף ההפניה', () => {
  it('מגיע לכל ששת המסלולים, כל אחד בנתיב שלו', () => {
    const paths: [string, RouteAnswers][] = [
      ['NEW_CONSTRUCTION', { landHolder: 'SELLER_EXITS', buildIntent: 'BUILD' }],
      ['LAND', { landHolder: 'SELLER_EXITS', buildIntent: 'RESELL' }],
      ['COMBINATION', { landHolder: 'LANDOWNER_PARTNER' }],
      ['TAMA_38_1', { landHolder: 'EXISTING_OWNERS', demolition: 'NO' }],
      ['TAMA_38_2', { landHolder: 'EXISTING_OWNERS', demolition: 'YES', buildingCount: 'SINGLE' }],
      ['PINUY_BINUY', { landHolder: 'EXISTING_OWNERS', demolition: 'YES', buildingCount: 'MULTIPLE', declaration: 'DECLARED_OR_IN_PROGRESS' }],
    ]
    for (const [expected, answers] of paths) {
      const outcome = route(answers)
      expect(outcome.status).toBe('RESOLVED')
      expect(outcome.projectType).toBe(expected)
      expect(outcome.projectTypeLabel).toBeTruthy()
      expect(outcome.blockedBy).toBeNull()
      // כל מסלול נושא את הנימוק שהוביל אליו, ולא רק את שמו.
      expect(outcome.reasoning.length).toBeGreaterThan(0)
    }
  })

  it('מתחם רב-בנייני בלי הכרזה מוכרע — ועם התרעה, לא בשקט', () => {
    const outcome = route({ landHolder: 'EXISTING_OWNERS', demolition: 'YES', buildingCount: 'MULTIPLE', declaration: 'NOT_DECLARED' })
    expect(outcome.status).toBe('RESOLVED')
    expect(outcome.projectType).toBe('TAMA_38_2')
    expect(outcome.warnings).toHaveLength(1)
    expect(outcome.warnings[0]).toContain('הכרזה')
  })

  it('"לא יודע" עוצר את ההכרעה ומציג את ההבדל המעשי — לא ברירת מחדל סבירה', () => {
    const outcome = route({ landHolder: 'EXISTING_OWNERS', demolition: 'UNKNOWN' })
    expect(outcome.status).toBe('UNDECIDED')
    // ובעיקר: לא מוצע שום מסלול. אין כאן "הסביר ביותר".
    expect(outcome.projectType).toBeNull()
    expect(outcome.projectTypeLabel).toBeNull()

    expect(outcome.blockedBy).not.toBeNull()
    expect(outcome.blockedBy!.question).toBe(ROUTE_QUESTIONS.demolition.question)
    // ההבדל המעשי, לא רק שמות האפשרויות.
    expect(outcome.blockedBy!.difference).toContain('שכר דירה חלופי')
    expect(outcome.blockedBy!.options.map((option) => option.value).sort()).toEqual(['NO', 'YES'])
    for (const option of outcome.blockedBy!.options) expect(option.leadsTo).toBeTruthy()
    // ומה שכבר נענה נשמר — "לא יודע" אינו מאפס את מה שכן ידוע.
    expect(outcome.reasoning).toHaveLength(1)
  })

  it('כל שאלה באשף חוסמת בתורה, ולכל אחת יש הבדל מעשי כתוב', () => {
    const stages: [keyof typeof ROUTE_QUESTIONS, RouteAnswers][] = [
      ['landHolder', {}],
      ['buildIntent', { landHolder: 'SELLER_EXITS' }],
      ['demolition', { landHolder: 'EXISTING_OWNERS' }],
      ['buildingCount', { landHolder: 'EXISTING_OWNERS', demolition: 'YES' }],
      ['declaration', { landHolder: 'EXISTING_OWNERS', demolition: 'YES', buildingCount: 'MULTIPLE' }],
    ]
    for (const [key, answers] of stages) {
      const outcome = route(answers)
      expect(outcome.status).toBe('UNDECIDED')
      expect(outcome.nextQuestion).toBe(ROUTE_QUESTIONS[key].question)
      expect(outcome.blockedBy!.difference.length).toBeGreaterThan(40)
      expect(outcome.blockedBy!.options.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('שאלה שלא נשאלה ו"לא יודע" עוצרות באותו מקום', () => {
    // אותה תוצאה, ובכוונה: שתיהן אומרות שההכרעה אינה נתמכת.
    expect(route({ landHolder: 'EXISTING_OWNERS' })).toEqual(route({ landHolder: 'EXISTING_OWNERS', demolition: 'UNKNOWN' }))
  })

  it('תשובות מאוחרות אינן מדלגות על שאלה מוקדמת שלא נענתה', () => {
    // מישהו שענה על השאלה האחרונה בלבד עדיין לא ענה על הראשונה.
    const outcome = route({ declaration: 'DECLARED_OR_IN_PROGRESS' })
    expect(outcome.status).toBe('UNDECIDED')
    expect(outcome.nextQuestion).toBe(ROUTE_QUESTIONS.landHolder.question)
  })

  it('חקירה אינה החלטה: `apply` הוא מה שמבדיל ביניהן', () => {
    /*
     * הפותר עצמו אינו יודע על `apply` — הוא מחזיר את אותה תוצאה בדיוק בכל
     * מקרה, והשאלה אם לקבוע את המסלול בפרופיל נשארת החלטה מפורשת אצל
     * הקורא. זה מה שהופך בחינת מסלולים לפעולה בטוחה.
     */
    const answers: RouteAnswers = { landHolder: 'SELLER_EXITS', buildIntent: 'RESELL' }
    expect(route(answers)).toEqual(route({ ...answers }))
    expect(Object.keys(route(answers))).not.toContain('apply')
  })

  it('מסלול שלא הוכרע אינו ניתן להחלה, כי אין מה להחיל', () => {
    const outcome = route({ landHolder: 'UNKNOWN' })
    expect(outcome.status).toBe('UNDECIDED')
    expect(outcome.projectType).toBeNull()
  })
})
