/**
 * The rule for every password a person chooses or is given in the CRM: a
 * temporary password an admin sets, and a user's own new one.
 *
 * The same floor as the production bootstrap (src/scripts/bootstrap-tenant.ts):
 * twelve characters with a lowercase and an uppercase English letter and a
 * digit, and none of the passwords every wordlist starts with. The CRM checks
 * the same rule before it submits, so this is the backstop, not the first
 * line, and its message is written for the person typing.
 */
export const PASSWORD_MIN_LENGTH = 12

const COMMON_PASSWORDS = new Set([
  'password', 'password123', 'admin1234', 'demo1234', 'changeme123',
  'administrator', 'opendoor123', '123456789012',
])

/** What is wrong with the password, in Hebrew, or null when it passes. */
export function passwordProblem(password: string): string | null {
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'הסיסמה הזאת נפוצה מדי. בחרו סיסמה אחרת.'
  }
  const missing: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) missing.push(`לפחות ${PASSWORD_MIN_LENGTH} תווים`)
  if (!/[a-z]/.test(password)) missing.push('אות אנגלית קטנה')
  if (!/[A-Z]/.test(password)) missing.push('אות אנגלית גדולה')
  if (!/\d/.test(password)) missing.push('ספרה')
  return missing.length > 0 ? `הסיסמה צריכה לכלול ${missing.join(', ')}.` : null
}
