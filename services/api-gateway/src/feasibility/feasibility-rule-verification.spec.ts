/**
 * "מה ברישום הזה איש לא בדק?" חייבת להיות שאלה שהרישום יודע לענות עליה.
 *
 * `authority` אומר איזה סוג מקור נטען, ו-`sourceReference` נוקב בשמו — אבל
 * אף אחד משניהם אינו אומר אם מישהו קרא את המספר מתוך המקור הזה. הערה
 * חופשית אינה ניתנת לשאילתה, וזו בדיוק ההסתרה שממנה הוצאנו את `UNSET`,
 * `NOT_APPLICABLE`, `UNMAPPED` ו-`NOT_ENFORCED`.
 */
import { FeasibilityRulesService } from './feasibility-rules.service'

describe('מצב האימות של כלל', () => {
  const service = () => {
    const rows: Record<string, unknown>[] = []
    const prisma = {
      feasibilityRule: {
        findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
          rows.filter((row) => Object.entries(where).every(([key, value]) => value === undefined || row[key] === value))),
      },
    }
    return { service: new FeasibilityRulesService(prisma as never, null as never), rows, prisma }
  }

  it('ברירת המחדל אינה "מאומת": מי שלא הצהיר, לא אימת', () => {
    /*
     * הבדיקה על ה-DTO ועל הכתיבה: השמטת השדה אינה משדרגת את המצב. ערך
     * שהוקלד אינו ערך שנבדק, וזו הנחת היסוד ולא חומרה מיותרת.
     */
    const { service: rules } = service()
    const written = (rules as unknown as { validated: (dto: unknown) => Record<string, unknown> }).validated({
      code: 'demo-rule', authority: 'STATUTE', numericValue: '0.18',
      effectiveFrom: '2025-01-01', sourceReference: 'חוק כלשהו',
    })
    expect(written.verification).toBeUndefined()
    expect(written.verificationNote).toBeNull()
  })

  it('הצהרה מפורשת נשמרת כפי שנמסרה', () => {
    const { service: rules } = service()
    const written = (rules as unknown as { validated: (dto: unknown) => Record<string, unknown> }).validated({
      code: 'demo-rule', authority: 'STATUTE', numericValue: '0.18',
      effectiveFrom: '2025-01-01', sourceReference: 'חוק כלשהו',
      verification: 'DISPUTED', verificationNote: '  שני מקורות סותרים  ',
    })
    expect(written.verification).toBe('DISPUTED')
    expect(written.verificationNote).toBe('שני מקורות סותרים')
  })

  it('הרישום עונה על "מה לא מאומת" כשאילתה, ולא כקריאה של הערות', async () => {
    const { service: rules, rows, prisma } = service()
    rows.push(
      { tenantId: 't', code: 'checked', isActive: true, verification: 'VERIFIED_AGAINST_SOURCE' },
      { tenantId: 't', code: 'unchecked', isActive: true, verification: 'NEEDS_VERIFICATION' },
      { tenantId: 't', code: 'contested', isActive: true, verification: 'DISPUTED' },
    )
    const unverified = await rules.list('t', { verification: 'NEEDS_VERIFICATION' })
    expect(unverified.map((rule) => rule.code)).toEqual(['unchecked'])
    expect(prisma.feasibilityRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ verification: 'NEEDS_VERIFICATION' }) }),
    )
    // ובלי הסינון — הרישום כולו, ולא רק מה שאומת.
    expect((await rules.list('t', {})).map((rule) => rule.code)).toHaveLength(3)
  })

  it('חסר שהוצהר הוא מצב, לא משפט בשדה טקסט', () => {
    /*
     * עד כאן, לרשום "אין עדיין מספר" חייב לכתוב אותו כטקסט — שאינו ניתן
     * לשאילתה, ושנקרא כמו כלל שמצהיר משהו. זו אותה הסתרה שהרישום הוציא
     * מ-UNSET, NOT_APPLICABLE ו-UNMAPPED.
     */
    const { service: rules } = service()
    const written = (rules as unknown as { validated: (dto: unknown) => Record<string, unknown> }).validated({
      code: 'demo-gap', authority: 'MARKET_CONVENTION',
      effectiveFrom: '2026-01-01', sourceReference: 'טרם אותר מקור',
      valueStatus: 'DECLARED_MISSING',
    })
    expect(written.valueStatus).toBe('DECLARED_MISSING')
    expect(written.numericValue).toBeNull()
    expect(written.textValue).toBeNull()
  })

  it('כלל בלי ערך ובלי הצהרת חסר עדיין נדחה', () => {
    const { service: rules } = service()
    expect(() => (rules as unknown as { validated: (dto: unknown) => unknown }).validated({
      code: 'demo-empty', authority: 'STATUTE', effectiveFrom: '2026-01-01', sourceReference: 'מקור',
    })).toThrow(expect.objectContaining({ details: [expect.objectContaining({ code: 'RULE_VALUE_REQUIRED' })] }))
  })

  it('חסר שהוצהר ונושא ערך הוא שתי טענות בו זמנית, ונדחה', () => {
    const { service: rules } = service()
    expect(() => (rules as unknown as { validated: (dto: unknown) => unknown }).validated({
      code: 'demo-both', authority: 'STATUTE', effectiveFrom: '2026-01-01', sourceReference: 'מקור',
      valueStatus: 'DECLARED_MISSING', numericValue: '0.2',
    })).toThrow(expect.objectContaining({ details: [expect.objectContaining({ code: 'RULE_DECLARED_MISSING_WITH_VALUE' })] }))
  })

  it('תיקון חלקי אינו מוחק את מה שלא נשלח', async () => {
    /*
     * ה-DTO הוא מופע מחלקה והיעד ES2022, ולכן כל שדה מוצהר קיים על המופע
     * עם `undefined` גם כשלא נשלח. פריסה נאיבית שלו דרסה את כל השדות
     * שהקורא לא חזר עליהם. `sourceReference` הוא היחיד שחובה ולכן הוא זה
     * שצרח; jurisdiction, unit, sourceUrl ו-notes היו מתאפסים בשקט.
     */
    const before = {
      id: 'r1', code: 'demo', name: 'שם', authority: 'STATUTE', jurisdiction: 'ירושלים',
      valueStatus: 'STATED', numericValue: null, textValue: 'ערך', unit: '%',
      effectiveFrom: new Date('2026-01-01'), effectiveUntil: null,
      sourceReference: 'סעיף 1', sourceUrl: 'https://example.test/rule',
      verification: 'NEEDS_VERIFICATION', verificationNote: 'הערה', notes: 'פתק', isActive: true,
    }
    let written: Record<string, unknown> | null = null
    const prisma = {
      feasibilityRule: {
        findFirst: jest.fn(async () => before),
        findMany: jest.fn(async () => []),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { written = data; return { ...before, ...data } }),
      },
    }
    const rules = new FeasibilityRulesService(prisma as never, { record: jest.fn() } as never)

    // מופע מחלקה: כל שדה מוצהר קיים כ-undefined, בדיוק כמו מה ש-Nest מייצר.
    class UpdateDto {
      name?: string
      jurisdiction?: string | null
      unit?: string | null
      sourceUrl?: string | null
      notes?: string | null
      verificationNote?: string | null
    }
    const dto = new UpdateDto()
    Object.assign(dto, { name: 'שם מתוקן' })
    // (Object.assign בלבד — שאר השדות קיימים על המופע כ-undefined)
    for (const key of ['jurisdiction', 'unit', 'sourceUrl', 'notes', 'verificationNote']) {
      if (!(key in dto)) (dto as Record<string, unknown>)[key] = undefined
    }

    await rules.update('r1', 't', dto as never, { userId: 'u', tenantId: 't' } as never)
    expect(written).not.toBeNull()
    expect(written!.name).toBe('שם מתוקן')
    // וכל השאר שרד.
    expect(written!.jurisdiction).toBe('ירושלים')
    expect(written!.unit).toBe('%')
    expect(written!.sourceUrl).toBe('https://example.test/rule')
    expect(written!.notes).toBe('פתק')
    expect(written!.verificationNote).toBe('הערה')
    expect(written!.sourceReference).toBe('סעיף 1')
  })
})
