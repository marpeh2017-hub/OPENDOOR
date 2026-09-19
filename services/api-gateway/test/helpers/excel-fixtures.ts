 

/**
 * Real `.xlsx` fixtures, generated at test time.
 *
 * Generated rather than checked in as binaries for two reasons: a committed
 * binary cannot be reviewed in a diff (so a fixture silently drifting from what
 * the test claims it contains is invisible), and the 5,000-row performance file
 * would add megabytes to the repository for something reproducible in
 * milliseconds.
 *
 * These ARE genuine workbooks — written by exceljs and read back through the
 * same `exceljs.Workbook.xlsx.load` path production uses, including the ZIP
 * container. Nothing here fakes the parse.
 */

const ExcelJS = require('exceljs')

/** Israeli IDs with VALID check digits — generated, not real people's numbers. */
export function validNationalId(seed: number): string {
  // NOTE the multiplier. An earlier version built the base as
  // `String(100000000 + seed).slice(0, 8)`, which discards the very digit the
  // seed varies — so seeds 501/502/503 all produced the SAME id and the
  // three-heir fixtures collided as "duplicate national ID in file". Spreading
  // the seed across the high digits with a prime keeps them distinct.
  const base = String(10000000 + (seed * 7919) % 89999999).slice(0, 8)
  for (let d = 0; d <= 9; d++) {
    const candidate = base + d
    if (checkDigitValid(candidate)) return candidate
  }
  throw new Error('unreachable: some check digit always fits')
}

/** An ID whose check digit is deliberately wrong. */
export function invalidNationalId(seed: number): string {
  const good = validNationalId(seed)
  const last = Number(good[8])
  return good.slice(0, 8) + String((last + 1) % 10)
}

function checkDigitValid(digits: string): boolean {
  const padded = digits.padStart(9, '0')
  let sum = 0
  for (let i = 0; i < 9; i++) {
    let n = Number(padded[i]) * ((i % 2) + 1)
    if (n > 9) n -= 9
    sum += n
  }
  return sum % 10 === 0
}

export interface SheetSpec {
  headers: string[]
  rows: (string | number | null)[][]
  sheetName?: string
  /** Rows inserted above the header row, to exercise header detection. */
  preamble?: (string | number | null)[][]
}

/** Builds a real .xlsx buffer. */
export async function buildWorkbook(spec: SheetSpec): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(spec.sheetName ?? 'Sheet1')
  for (const p of spec.preamble ?? []) ws.addRow(p)
  ws.addRow(spec.headers)
  for (const r of spec.rows) ws.addRow(r)
  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out)
}

/**
 * A workbook whose share column is a real Excel FORMULA.
 *
 * Used to prove the parser reads the cached RESULT and never evaluates. The
 * cached result is set explicitly, which is exactly what Excel itself writes.
 */
export async function buildFormulaWorkbook(
  headers: string[],
  rows: { values: (string | number | null)[]; formulaCol: number; formula: string; result: string | number }[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  ws.addRow(headers)
  for (const r of rows) {
    const row = ws.addRow(r.values)
    row.getCell(r.formulaCol).value = { formula: r.formula, result: r.result }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

// ─── Named fixtures ─────────────────────────────────────────────────────────

export const HEBREW_OWNER_HEADERS = [
  'שם בעלים', 'ת.ז.', 'טלפון', 'אימייל', 'דירה', 'אחוז בעלות', 'הערות',
]

export const ENGLISH_OWNER_HEADERS = [
  'Owner Name', 'ID Number', 'Phone', 'Email', 'Apartment', 'Ownership Share', 'Notes',
]

/** Every row valid; three heirs at exact thirds on one apartment. */
export function allValidRows(apartmentNumbers: string[]): (string | number | null)[][] {
  return [
    [`ישראל ישראלי`, validNationalId(11), '0501234567', 'israel@example.com', apartmentNumbers[0], '1/1', 'בעלים יחיד'],
    [`שרה כהן`,       validNationalId(22), '0502234567', 'sara@example.com',   apartmentNumbers[1], '1/3', 'יורשת'],
    [`דוד כהן`,       validNationalId(33), '0503234567', 'david@example.com',  apartmentNumbers[1], '1/3', 'יורש'],
    [`רות כהן`,       validNationalId(44), '0504234567', 'ruth@example.com',   apartmentNumbers[1], '1/3', 'יורשת'],
  ]
}

/** One defect per row, so each assertion pins exactly one rule. */
export function mixedInvalidRows(apartmentNumbers: string[]): (string | number | null)[][] {
  return [
    // valid control
    ['תקין גמור',      validNationalId(55), '0505234567', 'ok@example.com',   apartmentNumbers[0], '1/1', ''],
    // invalid phone
    ['טלפון שגוי',     validNationalId(66), '12345',      'p@example.com',    apartmentNumbers[2], '1/1', ''],
    // invalid email
    ['מייל שגוי',      validNationalId(77), '0506234567', 'not-an-email',     apartmentNumbers[3], '1/1', ''],
    // invalid national id check digit
    ['תז שגויה',       invalidNationalId(88), '0507234567', 'i@example.com',  apartmentNumbers[4], '1/1', ''],
    // apartment not in the project
    ['דירה חסרה',      validNationalId(99), '0508234567', 'm@example.com',    '99999',             '1/1', ''],
    // missing name
    ['',               validNationalId(12), '0509234567', 'n@example.com',    apartmentNumbers[5], '1/1', ''],
    // ownership share over 100%
    ['אחוז שגוי',      validNationalId(13), '0510234567', 'o@example.com',    apartmentNumbers[0], '150%', ''],
  ]
}
