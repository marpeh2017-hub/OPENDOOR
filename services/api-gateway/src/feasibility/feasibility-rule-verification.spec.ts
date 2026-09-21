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
})
