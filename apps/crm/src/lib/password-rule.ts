/**
 * The password rule, checked in the browser before anything is sent.
 *
 * Mirrors services/api-gateway/src/auth/password-policy.ts, which is the rule
 * that counts: the API refuses whatever fails it. Checking here first lets a
 * form say what is missing while the person is still typing. The API runs
 * compiled JavaScript and cannot load the TypeScript contracts package, so the
 * two are kept in step by hand: change both together.
 */
export const PASSWORD_MIN_LENGTH = 12

/** Shown beside every new-password field. */
export const PASSWORD_RULE_TEXT = 'לפחות 12 תווים, עם אות אנגלית גדולה, אות אנגלית קטנה וספרה.'

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
