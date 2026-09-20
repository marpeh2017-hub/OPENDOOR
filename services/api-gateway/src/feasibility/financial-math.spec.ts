/**
 * מתמטיקה פיננסית — בדיקות יחידה.
 *
 * טהורות: בלי מסד נתונים ובלי HTTP. זה החלק שחייב להיות נכון לפני שכל
 * השאר נשען עליו, והוא ניתן לבדיקה במילישניות.
 */
import Decimal from 'decimal.js'
import {
  addMonthsToMonthlyPeriod, annualizeMonthlyRate, averageMonthlyDebtInterest,
  continuousMonthlyPeriodAxis, irr, isUniformMonthlyAxis, monthlyPeriodDistance,
  monthlyRateFromAnnual, npv, xirr, xnpv,
} from './financial-math'

describe('ציר חודשי רציף', () => {
  it('ממלא חודשים ללא תנועה, כולל מעבר שנה', () => {
    // נובמבר ופברואר בלבד בקלט. דצמבר וינואר קיימים בזמן גם אם לא היתה
    // בהם תנועה, ובלעדיהם משך הפרויקט מתקצר בשני חודשים.
    expect(continuousMonthlyPeriodAxis(['2026-11-01', '2027-02-01'])).toEqual([
      '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01',
    ])
  })

  it('מסיר כפילויות וממיין', () => {
    expect(continuousMonthlyPeriodAxis(['2027-01-01', '2026-12-01', '2027-01-01']))
      .toEqual(['2026-12-01', '2027-01-01'])
  })

  it('מחזיר ריק על קלט ריק, ואיבר יחיד על חודש בודד', () => {
    expect(continuousMonthlyPeriodAxis([])).toEqual([])
    expect(continuousMonthlyPeriodAxis(['2026-05-01'])).toEqual(['2026-05-01'])
  })

  it('דוחה תאריך שאינו תחילת חודש קנוני', () => {
    expect(() => continuousMonthlyPeriodAxis(['2026-11-15'])).toThrow(/YYYY-MM-01/)
    expect(() => continuousMonthlyPeriodAxis(['2026-13-01'])).toThrow(/invalid month/)
  })
})

describe('אריתמטיקה של חודשים', () => {
  it('מוסיף חודשים על פני מעבר שנה, לשני הכיוונים', () => {
    expect(addMonthsToMonthlyPeriod('2026-11-01', 3)).toBe('2027-02-01')
    expect(addMonthsToMonthlyPeriod('2027-02-01', -3)).toBe('2026-11-01')
    expect(addMonthsToMonthlyPeriod('2026-01-01', 0)).toBe('2026-01-01')
  })

  it('מודד מרחק בחודשים שלמים', () => {
    expect(monthlyPeriodDistance('2026-11-01', '2027-02-01')).toBe(3)
    expect(monthlyPeriodDistance('2027-02-01', '2026-11-01')).toBe(-3)
  })
})

describe('ריבית על יתרה ממוצעת', () => {
  it('משתמשת בימים בפועל — פברואר אינו ינואר', () => {
    const january = averageMonthlyDebtInterest(1_000_000, 0, '0.06', '2026-01-01')
    const february = averageMonthlyDebtInterest(1_000_000, 0, '0.06', '2026-02-01')
    // 1,000,000 × 6% × 31/365 מול × 28/365
    expect(january.toFixed(2)).toBe('5095.89')
    expect(february.toFixed(2)).toBe('4602.74')
    expect(january.gt(february)).toBe(true)
  })

  it('מחשבת על היתרה הממוצעת, לא על יתרת הפתיחה', () => {
    // פתיחה 0, משיכה של 1,000,000 → הממוצע הוא 500,000
    const interest = averageMonthlyDebtInterest(0, 1_000_000, '0.12', '2026-01-01')
    expect(interest.toFixed(2)).toBe('5095.89')
  })

  it('מזהה שנה מעוברת', () => {
    const leap = averageMonthlyDebtInterest(1_000_000, 0, '0.06', '2028-02-01')
    expect(leap.toFixed(2)).toBe('4767.12') // 29 ימים
  })
})

describe('NPV ו-IRR תקופתיים', () => {
  it('NPV של תזרים ידוע', () => {
    // -1000 היום, +1100 בתקופה הבאה, ב-10% → אפס בדיוק
    expect(npv([-1000, 1100], '0.1').toFixed(6)).toBe('0.000000')
  })

  it('IRR של תזרים ידוע', () => {
    expect(irr([-1000, 1100])!.toFixed(6)).toBe('0.100000')
  })

  it('מחזיר null כשאין היפוך סימן', () => {
    expect(irr([100, 200, 300])).toBeNull()
    expect(irr([-100, -200])).toBeNull()
  })

  it('דוחה שיעור היוון של 100%- ומטה', () => {
    expect(() => npv([100], -1)).toThrow(/greater than -100%/)
  })
})

describe('XNPV ו-XIRR לפי תאריכים בפועל', () => {
  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01'])('rejects an impossible calendar date: %s', (date) => {
    expect(() => xnpv([{ date, amount: 1 }], '0.1')).toThrow(/Invalid date/)
  })

  it('does not invent a return for offsetting cash flows on the same day', () => {
    expect(xirr([
      { date: '2026-01-01', amount: -1000 },
      { date: '2026-01-01', amount: 1000 },
    ])).toBeNull()
  })

  it('nets same-day flows before solving the annual return', () => {
    expect(xirr([
      { date: '2026-01-01', amount: -1200 },
      { date: '2026-01-01', amount: 200 },
      { date: '2027-01-01', amount: 1100 },
    ])!.toFixed(6)).toBe('0.100000')
  })

  it('XNPV מתלכד עם NPV כאשר המרווח הוא בדיוק שנה', () => {
    const value = xnpv([
      { date: '2026-01-01', amount: -1000 },
      { date: '2027-01-01', amount: 1100 },
    ], '0.1')
    expect(value.toFixed(6)).toBe('0.000000')
  })

  it('XIRR מחזיר את התשואה השנתית הידועה', () => {
    const rate = xirr([
      { date: '2026-01-01', amount: -1000 },
      { date: '2027-01-01', amount: 1100 },
    ])
    expect(rate!.toFixed(6)).toBe('0.100000')
  })

  it('מבחין בין תאריכים שהחישוב התקופתי היה משטח', () => {
    // אותם סכומים, פער של חודש מול פער של שנה. חישוב תקופתי היה נותן
    // לשניהם את אותה תשובה; זו בדיוק הטעות ש-XIRR קיים כדי למנוע.
    const nextMonth = xirr([
      { date: '2026-01-01', amount: -1000 },
      { date: '2026-02-01', amount: 1100 },
    ])
    const nextYear = xirr([
      { date: '2026-01-01', amount: -1000 },
      { date: '2027-01-01', amount: 1100 },
    ])
    expect(nextMonth!.gt(nextYear!)).toBe(true)
    expect(nextYear!.toFixed(4)).toBe('0.1000')
  })

  it('מחזיר null על תזרים קצר מדי לתשואה שנתית בעלת משמעות', () => {
    // 10% ביום אחד הם 10^15 בשנה. מספר כזה אינו ניתן לפירוש כלכלי,
    // ו-null עדיף עליו — ראו הערת גבול התחום ב-xirr.
    expect(xirr([
      { date: '2026-01-01', amount: -1000 },
      { date: '2026-01-02', amount: 1100 },
    ])).toBeNull()
  })

  it('ממיין לפי תאריך ואינו תלוי בסדר הקלט', () => {
    const ordered = xirr([
      { date: '2026-01-01', amount: -1000 },
      { date: '2027-01-01', amount: 1100 },
    ])
    const shuffled = xirr([
      { date: '2027-01-01', amount: 1100 },
      { date: '2026-01-01', amount: -1000 },
    ])
    expect(shuffled!.toFixed(10)).toBe(ordered!.toFixed(10))
  })

  it('מחזיר null בלי היפוך סימן או עם פחות משתי תנועות', () => {
    expect(xirr([{ date: '2026-01-01', amount: -1000 }])).toBeNull()
    expect(xirr([
      { date: '2026-01-01', amount: 100 },
      { date: '2027-01-01', amount: 200 },
    ])).toBeNull()
  })

  it('דוחה תאריך שאינו YYYY-MM-DD, ולא מחשב עליו בשקט', () => {
    expect(() => xnpv([{ date: '01/01/2026', amount: 1 }], '0.1')).toThrow(/YYYY-MM-DD/)
    expect(() => xnpv([
      { date: '2026-01-01', amount: -1 },
      { date: '01/01/2027', amount: 1 },
    ], '0.1')).toThrow(/YYYY-MM-DD/)
  })
})

describe('זיהוי ציר אחיד', () => {
  it('מזהה ציר חודשי רציף כאחיד', () => {
    expect(isUniformMonthlyAxis(['2026-01-01', '2026-02-01', '2026-03-01'])).toBe(true)
  })

  it('מזהה פער כלא אחיד — כאן חובה לעבור ל-XIRR', () => {
    expect(isUniformMonthlyAxis(['2026-01-01', '2026-03-01'])).toBe(false)
  })

  it('מזהה תאריך שאינו תחילת חודש כלא אחיד', () => {
    expect(isUniformMonthlyAxis(['2026-01-01', '2026-01-17'])).toBe(false)
  })
})

describe('המרות ריבית', () => {
  it('הלוך ושוב בין שנתי לחודשי', () => {
    const monthly = monthlyRateFromAnnual('0.06')
    expect(annualizeMonthlyRate(monthly).toFixed(10)).toBe(new Decimal('0.06').toFixed(10))
  })
})
