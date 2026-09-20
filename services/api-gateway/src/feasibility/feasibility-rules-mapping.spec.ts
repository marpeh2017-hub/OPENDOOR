/**
 * פער 4 — מיפוי בין אוצר המילים של מרשם החוקים לזה של המנוע.
 *
 * החוקים ממופתחים בשם הרגולטורי (`minimum-developer-profit-tama38`), המנוע
 * קורא הנחות בשם אחר לאותה כמות (`required-developer-profit-margin`), ושום
 * דבר לא חיבר ביניהם. התוצאה: כל חוק חזר `UNSET` על מחקר שכבר הצהיר את הערך,
 * והדרך היחידה להתאמה הייתה להזין את אותו מספר פעמיים.
 *
 * ── הבדיקה שמונעת רגרסיה ──────────────────────────────────────────────────
 *
 * חוק חדש שנוסף בלי החלטה מה הוא אומר במונחי המנוע **חייב להפיל טסט**, ולא
 * להיעלם בשקט ל-UNSET כמו שקרה עד עכשיו. הבדיקה הראשונה כאן קוראת את קובץ
 * ה-seed עצמו ולא רשימה מועתקת, כדי שלא ייווצר מקור אמת שני שיתיישן.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RULE_BINDINGS } from './feasibility-rules.service'

/** Every rule code the seed actually ships, read from the seed rather than restated. */
const seededCodes = (): string[] => {
  const source = readFileSync(join(__dirname, '../scripts/seed-feasibility-rules.ts'), 'utf8')
  const codes = [...source.matchAll(/^\s*code: '([a-z0-9-]+)'/gm)].map((m) => m[1]!)
  return [...new Set(codes)]
}

describe('פער 4 — מיפוי מרשם החוקים', () => {
  it('לכל חוק ב-seed יש הכרעה מפורשת במפת המיפוי', () => {
    const codes = seededCodes()
    expect(codes.length).toBeGreaterThan(0)
    for (const code of codes) {
      // כישלון כאן פירושו: נוסף חוק ואיש לא הכריע מה הוא אומר במונחי המנוע.
      // רשימת מפתחות ריקה היא הכרעה לגיטימית; היעדר רשומה אינו.
      expect(Object.prototype.hasOwnProperty.call(RULE_BINDINGS, code)).toBe(true)
    }
  })

  it('כל מפתח הנחה שהמיפוי מפנה אליו הוא מפתח שהמנוע באמת קורא', () => {
    const engine = readFileSync(join(__dirname, 'feasibility-calculation.service.ts'), 'utf8')
    const engineKeys = new Set(
      [...engine.matchAll(/key === '([a-z0-9-]+)'/g)].map((m) => m[1]!),
    )
    expect(engineKeys.size).toBeGreaterThan(0)
    for (const [code, binding] of Object.entries(RULE_BINDINGS)) {
      for (const key of binding.assumptionKeys) {
        // מיפוי למפתח שהמנוע אינו קורא הוא מיפוי שלא יתפוס לעולם — שקט
        // בדיוק כמו הבאג שהמפה הזאת נועדה לסגור.
        expect({ code, key, known: engineKeys.has(key) }).toEqual({ code, key, known: true })
      }
    }
  })

  it('שני חוקי הרווח היזמי חולקים מפתח מנוע אחד ומופרדים לפי סוג הפרויקט', () => {
    const tama = RULE_BINDINGS['minimum-developer-profit-tama38']!
    const pinuy = RULE_BINDINGS['minimum-developer-profit-pinuy-binuy']!
    // אותה כמות במנוע...
    expect(tama.assumptionKeys[0]).toBe('required-developer-profit-margin')
    expect(pinuy.assumptionKeys[0]).toBe('required-developer-profit-margin')
    // ...ולכן ההפרדה חייבת להיות לפי סוג הפרויקט, אחרת אחד מהם היה מסומן
    // OVERRIDES רק משום שקיים סוג פרויקט אחר בעולם.
    expect(tama.appliesTo).toEqual(['TAMA_38_1', 'TAMA_38_2'])
    expect(pinuy.appliesTo).toEqual(['PINUY_BINUY'])
    expect(tama.appliesTo!.some((t) => pinuy.appliesTo!.includes(t))).toBe(false)
  })

  it('חוק בלי מקבילה במנוע מוצהר כך במפורש, ולא נשמט', () => {
    // מע״מ: בסיס המודל הוא ללא מע״מ לכל אורכו, ולכן אין שיעור שהמנוע קורא.
    // היטל השבחה: שורת עלות, לא הנחה. רשימה ריקה אומרת את זה; היעדר רשומה
    // היה נקרא כשכחה.
    expect(RULE_BINDINGS['vat-rate']!.assumptionKeys).toEqual([])
    expect(RULE_BINDINGS['betterment-levy-rate-pinuy-binuy']!.assumptionKeys).toEqual([])
  })
})
