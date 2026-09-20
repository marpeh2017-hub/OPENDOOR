/**
 * P1-8 — מפל ההון.
 *
 * הטענה שצריך להוכיח כאן אינה "רץ" אלא **ששתי שכבות הון מקבלות תשואות
 * שונות**. אם ה-IRR של שתיהן זהה, המפל לא חילק לפי עדיפות אלא יחסית — וזו
 * בדיוק הטעות שמספר משוקלל יחיד עושה, ושבגללה נבנה המפל מלכתחילה.
 *
 * המספרים בתרחיש הבסיס עגולים בכוונה כדי שכל שורה בטבלה תהיה בדיקה ביד:
 * senior מזרים 10,000,000 ברף 8%, sponsor מזרים 10,000,000 בלי רף, וחלוקת
 * השארית 50/50. התזרים נמשך שנתיים בדיוק (1.1.2026 → 1.1.2028).
 */
import Decimal from 'decimal.js'
import { computeEquityWaterfall, type EquityFlow, type EquityTrancheTerms } from './equity-waterfall'

const SENIOR: EquityTrancheTerms = {
  id: 'senior', name: 'הון בכיר', kind: 'SENIOR', priority: 1,
  commitment: '10000000', preferredReturnRate: '0.08', preferredReturnAccrual: 'COMPOUNDED',
  profitSharePercent: '0.5',
}

const SPONSOR: EquityTrancheTerms = {
  id: 'sponsor', name: 'הון יזם', kind: 'SPONSOR', priority: 2,
  commitment: '10000000', preferredReturnRate: null, preferredReturnAccrual: 'COMPOUNDED',
  profitSharePercent: '0.5',
}

const flow = (date: string, amount: string, trancheId: string | null): EquityFlow =>
  ({ date, amount: new Decimal(amount), trancheId })

/** שתי הזרמות ביום אחד, וחלוקה אחת בסוף — הצורה הפשוטה ביותר שעדיין מבחינה בין השכבות. */
const standardFlows = (distribution: string): EquityFlow[] => [
  flow('2026-01-01', '10000000', 'senior'),
  flow('2026-01-01', '10000000', 'sponsor'),
  flow('2028-01-01', `-${distribution}`, null),
]

const byId = (result: ReturnType<typeof computeEquityWaterfall>, id: string) =>
  result.tranches.find((tranche) => tranche.id === id)!
const codes = (result: ReturnType<typeof computeEquityWaterfall>) => result.issues.map((issue) => issue.code)

describe('P1-8 — מפל ההון', () => {
  it('נותן לשתי השכבות תשואות שונות — וזו ההוכחה שהחלוקה לפי עדיפות ולא יחסית', () => {
    // 26,000,000 לחלוקה: 20,000,000 החזר הון, 1,664,000 רף מועדף לבכיר
    // (10m × 1.08² − 10m), והשארית 4,336,000 מתחלקת 50/50.
    const result = computeEquityWaterfall([SENIOR, SPONSOR], standardFlows('26000000'))
    const senior = byId(result, 'senior')
    const sponsor = byId(result, 'sponsor')

    expect(result.applicable).toBe(true)
    expect(result.structure).toBe('RETURN_OF_CAPITAL_THEN_PREFERRED_THEN_SPLIT')

    expect(senior.returnOfCapital).toBe('10000000.00')
    expect(sponsor.returnOfCapital).toBe('10000000.00')
    // 1.1.2026 → 1.1.2028 הם 730 יום בדיוק: 2028 מעוברת אך ה-29.2 שלה נופל
    // אחרי התאריך. לכן (1.08)^(730/365) − 1 על 10m הוא 1,664,000 עגול.
    expect(Number(senior.preferredReturnPaid)).toBeCloseTo(1664000, 0)
    expect(sponsor.preferredReturnPaid).toBe('0.00')

    // השארית מתחלקת שווה בשווה — ובכל זאת השכבות לא מקבלות אותו דבר.
    expect(Number(senior.residualProfit)).toBeCloseTo(Number(sponsor.residualProfit), 2)
    expect(Number(senior.equityDistributed)).toBeGreaterThan(Number(sponsor.equityDistributed))

    // זו הטענה המרכזית: תשואות שונות, לא זהות.
    expect(senior.equityIrrAnnual).not.toBeNull()
    expect(sponsor.equityIrrAnnual).not.toBeNull()
    expect(Number(senior.equityIrrAnnual)).toBeGreaterThan(Number(sponsor.equityIrrAnnual))
    expect(Number(senior.equityIrrAnnual) - Number(sponsor.equityIrrAnnual)).toBeGreaterThan(0.03)

    // ושום שקל לא אבד בדרך.
    expect(result.totals.contributed).toBe('20000000.00')
    expect(result.totals.distributed).toBe('26000000.00')
    expect(result.totals.undistributed).toBe('0.00')
    expect(codes(result)).not.toContain('WATERFALL_CASH_UNALLOCATED')
  })

  it('כשאין מספיק מזומן לכסות את הרף המועדף — הבכיר סופג פחות, והיזם סופג הכול', () => {
    // 21,000,000 בלבד: מספיק להחזר ההון (20m) ורק 1,000,000 מתוך רף של
    // כ-1,664,000. אין שארית כלל, ולכן היזם מקבל אפס מעבר להון שלו.
    const result = computeEquityWaterfall([SENIOR, SPONSOR], standardFlows('21000000'))
    const senior = byId(result, 'senior')
    const sponsor = byId(result, 'sponsor')

    expect(senior.returnOfCapital).toBe('10000000.00')
    expect(sponsor.returnOfCapital).toBe('10000000.00')
    expect(senior.preferredReturnPaid).toBe('1000000.00')
    expect(Number(senior.preferredReturnUnpaid)).toBeGreaterThan(600000)
    expect(senior.residualProfit).toBe('0.00')
    expect(sponsor.residualProfit).toBe('0.00')

    // היזם קיבל בדיוק את כספו בחזרה ולא יותר: מכפיל 1, ו-IRR אפס.
    expect(sponsor.equityMultiple).toBe('1.00000000')
    expect(Number(sponsor.equityIrrAnnual)).toBeCloseTo(0, 6)
    expect(Number(senior.equityIrrAnnual)).toBeGreaterThan(0.04)

    // והחוסר מדווח במפורש — לא נבלע.
    expect(codes(result)).toContain('WATERFALL_PREFERRED_SHORTFALL')
    expect(codes(result)).not.toContain('WATERFALL_CAPITAL_NOT_RETURNED')
  })

  it('כשגם ההון עצמו אינו חוזר — הנחיתות של השכבה הנדחית היא הפסד בפועל', () => {
    // 15,000,000 בלבד. הבכיר מקבל את מלוא ההון שלו לפי סדר העדיפות; היזם
    // מקבל 5,000,000 מתוך 10,000,000 ומפסיד מחצית מכספו.
    const result = computeEquityWaterfall([SENIOR, SPONSOR], standardFlows('15000000'))
    const senior = byId(result, 'senior')
    const sponsor = byId(result, 'sponsor')

    expect(senior.returnOfCapital).toBe('10000000.00')
    expect(senior.capitalNotReturned).toBe('0.00')
    expect(sponsor.returnOfCapital).toBe('5000000.00')
    expect(sponsor.capitalNotReturned).toBe('5000000.00')
    expect(sponsor.equityMultiple).toBe('0.50000000')
    expect(Number(sponsor.profit)).toBe(-5000000)
    expect(Number(sponsor.equityIrrAnnual)).toBeLessThan(-0.25)
    expect(codes(result)).toContain('WATERFALL_CAPITAL_NOT_RETURNED')
  })

  /**
   * ההשוואה שהמפרט מבקש: אותו סכום השקעה בדיוק, ההבדל היחיד הוא הרף המועדף
   * והעדיפות. ההוכחה שההבדל הגיוני היא שהוא מתהפך: בתרחיש טוב הנדחה מרוויח
   * פחות מהבכיר, ובתרחיש רע הוא מפסיד יותר — כלומר הוא נושא את הסיכון.
   */
  it('אותו סכום השקעה, בלי רף מועדף — ההבדל מתהפך בין תרחיש טוב לרע', () => {
    const good = computeEquityWaterfall([SENIOR, SPONSOR], standardFlows('26000000'))
    const bad = computeEquityWaterfall([SENIOR, SPONSOR], standardFlows('15000000'))

    expect(byId(good, 'senior').equityInvested).toBe(byId(good, 'sponsor').equityInvested)

    const goodGap = Number(byId(good, 'senior').equityIrrAnnual) - Number(byId(good, 'sponsor').equityIrrAnnual)
    const badGap = Number(byId(bad, 'senior').equityIrrAnnual) - Number(byId(bad, 'sponsor').equityIrrAnnual)

    // בתרחיש הטוב הבכיר מקדים — אך בפער מתון, כי הרף הוא תקרה על היתרון שלו.
    expect(goodGap).toBeGreaterThan(0)
    // בתרחיש הרע הפער עצום, כי הנדחה הוא זה שסופג את ההפסד כולו.
    expect(badGap).toBeGreaterThan(goodGap * 3)
    expect(Number(byId(bad, 'sponsor').equityIrrAnnual)).toBeLessThan(0)
    // הבכיר יוצא באפס בדיוק, לא ברווח: החזר ההון של *כל* השכבות קודם לרף
    // המועדף של כל אחת מהן, ולכן 15m מכסים הון ולא מגיעים כלל לרף.
    expect(Number(byId(bad, 'senior').equityIrrAnnual)).toBeCloseTo(0, 8)
    expect(byId(bad, 'senior').preferredReturnPaid).toBe('0.00')
    expect(Number(byId(bad, 'senior').preferredReturnUnpaid)).toBeGreaterThan(1600000)
  })

  it('שכבה אחת בלבד מתנהגת בדיוק כמו החישוב המשוקלל — אין מפל שמשנה מספר בלי סיבה', () => {
    const single: EquityTrancheTerms = { ...SENIOR, profitSharePercent: '1' }
    const result = computeEquityWaterfall([single], [
      flow('2026-01-01', '10000000', 'senior'),
      flow('2028-01-01', '-13000000', null),
    ])
    const senior = byId(result, 'senior')
    expect(senior.equityDistributed).toBe('13000000.00')
    expect(senior.equityMultiple).toBe('1.30000000')
    // 13/10 על 730 יום, כלומר שנתיים בדיוק: (1.3)^(1/2) − 1.
    expect(Number(senior.equityIrrAnnual)).toBeCloseTo(Math.sqrt(1.3) - 1, 8)
  })

  it('הרף המועדף נצבר על ההון שטרם הוחזר — החזר ביניים מקטין את הצבירה', () => {
    // אותו סכום סופי, אבל מחצית ההון חוזרת אחרי שנה. הרף על השנה השנייה
    // נצבר על 5m במקום על 10m, ולכן סך הרף קטן ממש.
    const late = computeEquityWaterfall([SENIOR], [
      flow('2026-01-01', '10000000', 'senior'),
      flow('2028-01-01', '-12000000', null),
    ])
    const early = computeEquityWaterfall([SENIOR], [
      flow('2026-01-01', '10000000', 'senior'),
      flow('2027-01-01', '-5000000', null),
      flow('2028-01-01', '-7000000', null),
    ])
    expect(Number(byId(early, 'senior').preferredReturnPaid))
      .toBeLessThan(Number(byId(late, 'senior').preferredReturnPaid))
    // ובכל זאת ה-IRR של המוקדם גבוה יותר — כסף שחזר מוקדם שווה יותר.
    expect(Number(byId(early, 'senior').equityIrrAnnual))
      .toBeGreaterThan(Number(byId(late, 'senior').equityIrrAnnual))
  })

  it('צבירה מצטברת עולה על צבירה פשוטה כשהרף נדחה', () => {
    // חמש שנים ללא אירוע ביניים. זה בדיוק המקרה שבו צבירה פשוטה וצבירה
    // מצטברת חייבות להיפרד — ובמקרה שלהן רק צורת הצבירה שונה, כי בלי
    // אירוע ביניים אין רף שנדחה כדי להצטבר על עצמו.
    //
    // הטווח הוא 1,826 יום ולא 1,825: הוא מכיל את ה-29.2.2028. בבסיס
    // ימים-בפועל/365 זה יותר מחמש שנים עגולות, וזו בדיוק הסיבה לחשב את
    // הציפייה מהימים ולא לכתוב מספר עגול שנראה נכון.
    const simple = computeEquityWaterfall(
      [{ ...SENIOR, preferredReturnAccrual: 'SIMPLE' }],
      [flow('2026-01-01', '10000000', 'senior'), flow('2031-01-01', '-20000000', null)],
    )
    const compounded = computeEquityWaterfall(
      [SENIOR],
      [flow('2026-01-01', '10000000', 'senior'), flow('2031-01-01', '-20000000', null)],
    )
    const years = 1826 / 365
    expect(Number(byId(simple, 'senior').preferredReturnPaid)).toBeCloseTo(10000000 * 0.08 * years, 1)
    expect(Number(byId(compounded, 'senior').preferredReturnPaid)).toBeCloseTo(10000000 * (Math.pow(1.08, years) - 1), 1)
    expect(Number(byId(compounded, 'senior').preferredReturnPaid))
      .toBeGreaterThan(Number(byId(simple, 'senior').preferredReturnPaid))
  })

  it('מסרב למבנה שאינו מסתכם למלוא הרווח, ומדווח עדיפות כפולה', () => {
    const broken = computeEquityWaterfall(
      [SENIOR, { ...SPONSOR, priority: 1, profitSharePercent: '0.3' }],
      standardFlows('26000000'),
    )
    expect(codes(broken)).toContain('WATERFALL_PROFIT_SHARE_NOT_WHOLE')
    expect(codes(broken)).toContain('WATERFALL_PRIORITY_TIE')
  })

  it('הזרמה ללא שכבה אינה מתפזרת בשקט על השכבות', () => {
    const result = computeEquityWaterfall([SENIOR, SPONSOR], [
      flow('2026-01-01', '10000000', 'senior'),
      flow('2026-01-01', '10000000', null),
      flow('2028-01-01', '-26000000', null),
    ])
    expect(codes(result)).toContain('WATERFALL_CONTRIBUTION_UNATTRIBUTED')
    expect(byId(result, 'sponsor').equityInvested).toBe('0.00')
  })

  it('ללא שכבות מוגדרות — אומר שאין מבנה, ולא ממציא אחד', () => {
    const result = computeEquityWaterfall([], standardFlows('26000000'))
    expect(result.applicable).toBe(false)
    expect(result.reason).toBe('NO_TRANCHES_DEFINED')
    expect(result.tranches).toEqual([])
  })
})
