/**
 * The password rule for passwords chosen or given in the CRM. Its messages are
 * shown to the person typing, so they are tested word for word.
 */
import { passwordProblem } from './password-policy'

describe('passwordProblem', () => {
  it('accepts twelve characters with both cases and a digit', () => {
    expect(passwordProblem('Shalom2026Ok')).toBeNull()
  })

  it('names everything that is missing, in Hebrew', () => {
    expect(passwordProblem('short')).toBe('הסיסמה צריכה לכלול לפחות 12 תווים, אות אנגלית גדולה, ספרה.')
    expect(passwordProblem('alllowercase123')).toBe('הסיסמה צריכה לכלול אות אנגלית גדולה.')
  })

  it('refuses the demo seed password whatever its case', () => {
    expect(passwordProblem('Demo1234')).toBe('הסיסמה הזאת נפוצה מדי. בחרו סיסמה אחרת.')
  })

  it('does not count Hebrew letters as English ones', () => {
    expect(passwordProblem('שלוםשלוםשלום12')).toBe('הסיסמה צריכה לכלול אות אנגלית קטנה, אות אנגלית גדולה.')
  })
})
