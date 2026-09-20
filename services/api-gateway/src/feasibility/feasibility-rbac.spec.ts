/**
 * P1-9 — מיפוי ההרשאות של דוח האפס.
 *
 * הטסטים כאן אינם בודקים שהמערכת "עובדת" אלא ששלוש טענות ספציפיות נכונות
 * ונשארות נכונות: שהצד שכנגד אינו רואה את עמדת היזם, שייצוא צר מצפייה, ושכל
 * אחת מתשע היכולות שהמפרט מנה ממופה למשהו אמיתי — או מוצהרת כלא קיימת.
 *
 * המיפוי ישב עד עכשיו כפסקה במסמך עיצוב. פסקה אי אפשר להפיל בבדיקה.
 */
import {
  FEASIBILITY_CAPABILITIES,
  FEASIBILITY_VIEW_ROLES,
  FEASIBILITY_EDIT_ROLES,
  FEASIBILITY_EXPORT_ROLES,
  FEASIBILITY_APPROVE_ROLES,
  FEASIBILITY_LOCK_ROLES,
  FEASIBILITY_SUBMIT_ROLES,
  FEASIBILITY_REPORT_TRANSITION_ROLES,
  STAFF_ROLES,
} from '../auth/roles.constants'

/** תשע היכולות שמסמך שלב 0 מנה, מילה במילה. */
const PHASE_0_CAPABILITIES = [
  'view', 'edit', 'run_calculations', 'manage_assumptions',
  'approve', 'lock', 'export', 'sign', 'distribute',
] as const

describe('P1-9 — הרשאות דוח אפס', () => {
  it('כל תשע היכולות מהמפרט קיימות במיפוי, ואף אחת לא הושמטה בשקט', () => {
    for (const capability of PHASE_0_CAPABILITIES) {
      expect(FEASIBILITY_CAPABILITIES).toHaveProperty(capability)
    }
  })

  it('יכולת בלי endpoint מוצהרת כלא קיימת ולא ממופה לרשימה סבירה', () => {
    // sign ו-distribute אינם קיימים בשום מסלול במודול. מיפוי שלהם לרשימת
    // תפקידים היה מתאר בקרת גישה לפעולה שאי אפשר לבצע — וזה נקרא ככיסוי.
    expect(FEASIBILITY_CAPABILITIES.sign).toBeNull()
    expect(FEASIBILITY_CAPABILITIES.distribute).toBeNull()
    for (const capability of PHASE_0_CAPABILITIES) {
      const roles = FEASIBILITY_CAPABILITIES[capability]
      if (roles === null) continue
      expect(roles.length).toBeGreaterThan(0)
    }
  })

  /** ההדרה הנושאת. */
  it('DEVELOPER_REP אינו רואה, אינו עורך, אינו מייצא ואינו מאשר', () => {
    expect(STAFF_ROLES).toContain('DEVELOPER_REP')
    for (const list of [FEASIBILITY_VIEW_ROLES, FEASIBILITY_EDIT_ROLES, FEASIBILITY_EXPORT_ROLES, FEASIBILITY_APPROVE_ROLES, FEASIBILITY_LOCK_ROLES, FEASIBILITY_SUBMIT_ROLES]) {
      expect(list as readonly string[]).not.toContain('DEVELOPER_REP')
    }
    expect(FEASIBILITY_REPORT_TRANSITION_ROLES).not.toContain('DEVELOPER_REP')
  })

  it('MUNICIPALITY_USER אינו רואה את הכלכלה הפנימית', () => {
    expect(STAFF_ROLES).toContain('MUNICIPALITY_USER')
    expect(FEASIBILITY_VIEW_ROLES as readonly string[]).not.toContain('MUNICIPALITY_USER')
    expect(FEASIBILITY_EXPORT_ROLES as readonly string[]).not.toContain('MUNICIPALITY_USER')
  })

  it('EXTERNAL_CONSULTANT רואה אך אינו מייצא — הקובץ יוצא מהחברה, לא מהיועץ', () => {
    expect(FEASIBILITY_VIEW_ROLES as readonly string[]).toContain('EXTERNAL_CONSULTANT')
    expect(FEASIBILITY_EXPORT_ROLES as readonly string[]).not.toContain('EXTERNAL_CONSULTANT')
  })

  it('ייצוא צר מצפייה — ולא יורש אותה', () => {
    // זו הייתה התקלה: המסלול ישב על רשימת הצפייה, ולכן כל תפקיד צוות —
    // הצד שכנגד בכללם — יכול היה להוריד את המודל הפיננסי המלא כקובץ.
    const view = FEASIBILITY_VIEW_ROLES as readonly string[]
    const exportRoles = FEASIBILITY_EXPORT_ROLES as readonly string[]
    expect(exportRoles.length).toBeLessThan(view.length)
    for (const role of exportRoles) expect(view).toContain(role)
  })

  it('כל מי שעורך יכול גם לראות — אין הרשאת כתיבה בלי קריאה', () => {
    for (const role of FEASIBILITY_EDIT_ROLES as readonly string[]) {
      expect(FEASIBILITY_VIEW_ROLES as readonly string[]).toContain(role)
    }
  })

  it('מי שבונה את המודל מגיש אותו אך אינו מאשר אותו', () => {
    // זו בדיוק הסיבה שמצב REVIEW קיים.
    expect(FEASIBILITY_SUBMIT_ROLES as readonly string[]).toContain('ENGINEER')
    expect(FEASIBILITY_SUBMIT_ROLES as readonly string[]).toContain('ARCHITECT')
    expect(FEASIBILITY_SUBMIT_ROLES as readonly string[]).toContain('LAWYER')
    for (const role of ['ENGINEER', 'ARCHITECT', 'LAWYER']) {
      expect(FEASIBILITY_APPROVE_ROLES as readonly string[]).not.toContain(role)
      expect(FEASIBILITY_LOCK_ROLES as readonly string[]).not.toContain(role)
    }
  })

  it('רשימת המסלול היא האיחוד של שלוש היכולות — ולכן רחבה מכל אחת מהן', () => {
    // ולכן היא לבדה אינה יכולה להיות הבדיקה: השירות בודק את היכולת הספציפית
    // מול מצב היעד, ובלי זה מהנדס שהורשה להגיש היה מורשה גם לאשר.
    for (const list of [FEASIBILITY_SUBMIT_ROLES, FEASIBILITY_APPROVE_ROLES, FEASIBILITY_LOCK_ROLES]) {
      for (const role of list as readonly string[]) expect(FEASIBILITY_REPORT_TRANSITION_ROLES).toContain(role)
    }
    expect(FEASIBILITY_REPORT_TRANSITION_ROLES.length).toBeGreaterThan((FEASIBILITY_APPROVE_ROLES as readonly string[]).length)
  })

  it('RESIDENT ו-CEO אינם נמצאים באף רשימה של דוח אפס', () => {
    for (const list of [FEASIBILITY_VIEW_ROLES, FEASIBILITY_EDIT_ROLES, FEASIBILITY_EXPORT_ROLES, FEASIBILITY_APPROVE_ROLES]) {
      expect(list as readonly string[]).not.toContain('RESIDENT')
      expect(list as readonly string[]).not.toContain('CEO')
    }
  })

  it('כל תפקיד בכל רשימה הוא תפקיד צוות קיים — אין מחרוזת שהודפסה שגוי', () => {
    const staff = STAFF_ROLES as readonly string[]
    for (const capability of PHASE_0_CAPABILITIES) {
      const roles = FEASIBILITY_CAPABILITIES[capability]
      if (roles === null) continue
      for (const role of roles) expect(staff).toContain(role)
    }
  })
})
