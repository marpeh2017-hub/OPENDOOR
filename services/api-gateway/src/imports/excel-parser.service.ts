import { Injectable, Logger } from '@nestjs/common'
import { DomainError } from '../common/errors/domain-error'
import {
  IMPORT_ERRORS, MAX_IMPORT_ROWS, looksLikeXlsx,
} from './excel-import.constants'

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */

/**
 * Workbook reader.
 *
 * LIBRARY CHOICE — exceljs 4.4.0
 * ------------------------------
 * The two realistic options were `exceljs` and `xlsx` (SheetJS).
 *
 *   - SheetJS's npm-published `xlsx` package carries a prototype-pollution
 *     history (CVE-2023-30533) and, more importantly, the maintained line moved
 *     OFF the public npm registry to the vendor's own CDN, so the registry copy
 *     is not the patched one. Depending on it would mean pinning a package the
 *     ecosystem's audit tooling cannot see updates for.
 *   - `exceljs` is on npm, actively published, and — decisively — reading a
 *     worksheet through it never evaluates anything. It exposes a formula
 *     cell's cached RESULT as a separate property; there is no evaluator in the
 *     read path to be tricked.
 *
 * SECURITY POSTURE OF THIS READER
 * -------------------------------
 *   1. `.xlsm` is refused before we get here (see the constants module), so no
 *      macro payload is ever stored, let alone opened.
 *   2. A ZIP magic-number check runs before the buffer reaches exceljs.
 *   3. `readCellValue` below reads VALUES ONLY. For a formula cell it takes the
 *      cached `result` and NEVER the `formula` string — the formula text is not
 *      parsed, not evaluated, and not stored.
 *   4. Hyperlink and rich-text cells are flattened to their display text, so an
 *      `=HYPERLINK(...)` or an embedded `javascript:` target cannot travel into
 *      the CRM as a live link.
 *   5. Anything the parser cannot make sense of becomes an empty string and a
 *      row-level validation error, never a thrown 500.
 */
@Injectable()
export class ExcelParserService {
  private readonly logger = new Logger(ExcelParserService.name)

  /**
   * Reads the workbook into a plain string matrix.
   *
   * Returns the header row and the data rows, each row carrying the 1-based
   * Excel row number so every error the user sees points at the row number
   * printed down the side of their spreadsheet.
   */
  async parse(buffer: Buffer, sheetName?: string): Promise<ParsedSheet> {
    if (!buffer?.length) {
      throw DomainError.validation('IMPORT_FILE_EMPTY', IMPORT_ERRORS.emptyFile)
    }
    if (!looksLikeXlsx(buffer)) {
      throw DomainError.validation('IMPORT_FILE_NOT_XLSX', IMPORT_ERRORS.notAZip)
    }

    const ExcelJS = require('exceljs') as any
    const workbook = new ExcelJS.Workbook()
    try {
      await workbook.xlsx.load(buffer)
    } catch (err) {
      // The parser's own error text can contain file internals — log a bare
      // note and give the user the generic Hebrew message.
      this.logger.warn(`Workbook parse failed: ${(err as Error)?.name ?? 'unknown'}`)
      throw DomainError.validation('IMPORT_FILE_CORRUPT', IMPORT_ERRORS.corrupt)
    }

    const sheets: string[] = (workbook.worksheets ?? []).map((w: any) => String(w.name))
    if (!sheets.length) {
      throw DomainError.validation('IMPORT_NO_SHEETS', IMPORT_ERRORS.noSheets)
    }

    const sheet = sheetName
      ? workbook.worksheets.find((w: any) => String(w.name) === sheetName)
      : workbook.worksheets[0]
    if (!sheet) {
      throw DomainError.validation('IMPORT_SHEET_NOT_FOUND', IMPORT_ERRORS.noSheets)
    }

    // ── Header row ────────────────────────────────────────────────────────
    // Not always row 1: exported sheets routinely carry a title row, a blank
    // row, then the headers. We take the first row within the first 10 that has
    // at least two non-empty cells.
    const scanLimit = Math.min(sheet.rowCount || 0, 10)
    let headerRowNumber = 0
    let headers: string[] = []
    for (let r = 1; r <= scanLimit; r++) {
      const values = this.rowValues(sheet.getRow(r))
      if (values.filter((v) => v !== '').length >= 2) {
        headerRowNumber = r
        headers = values
        break
      }
    }
    if (!headerRowNumber) {
      throw DomainError.validation('IMPORT_NO_HEADERS', IMPORT_ERRORS.noHeaders)
    }

    // Trailing empty header cells are an artefact of Excel's used-range; drop
    // them so the mapping UI does not show a dozen blank columns.
    while (headers.length && headers[headers.length - 1] === '') headers.pop()

    // Blank INTERIOR headers keep a placeholder so column indexes stay aligned
    // with the data rows.
    const displayHeaders = headers.map((h, i) => (h === '' ? `עמודה ${i + 1}` : h))

    // ── Data rows ─────────────────────────────────────────────────────────
    const rows: ParsedRow[] = []
    let truncated = false
    const lastRow = sheet.rowCount || 0
    for (let r = headerRowNumber + 1; r <= lastRow; r++) {
      const values = this.rowValues(sheet.getRow(r), headers.length)
      // A fully blank row is a spacer, not a record. Skipping it silently is
      // correct — it is not data the user believes they are importing.
      if (values.every((v) => v === '')) continue

      if (rows.length >= MAX_IMPORT_ROWS) { truncated = true; break }
      rows.push({ rowNumber: r, values })
    }

    if (truncated) {
      throw DomainError.validation('IMPORT_TOO_MANY_ROWS', IMPORT_ERRORS.tooManyRows)
    }
    if (!rows.length) {
      throw DomainError.validation('IMPORT_NO_ROWS', IMPORT_ERRORS.noRows)
    }

    return {
      sheetName: String(sheet.name),
      availableSheets: sheets,
      headerRowNumber,
      headers: displayHeaders,
      rows,
    }
  }

  /** Sheet names only — used to let the user pick before a full parse. */
  async listSheets(buffer: Buffer): Promise<string[]> {
    const parsed = await this.parse(buffer)
    return parsed.availableSheets
  }

  private rowValues(row: any, width?: number): string[] {
    const count = width ?? Math.max(row?.cellCount ?? 0, row?.actualCellCount ?? 0)
    const out: string[] = []
    for (let c = 1; c <= count; c++) {
      out.push(this.readCellValue(row?.getCell(c)))
    }
    return out
  }

  /**
   * One cell → one trimmed string. NEVER evaluates anything.
   *
   * exceljs models a cell's `value` as a union. The branches that matter:
   *
   *   - `{ formula, result }`  — we take `result` and DISCARD `formula`. If the
   *     workbook carries no cached result (a formula never calculated by Excel)
   *     the cell reads as empty and the row fails validation with a message
   *     telling the user to paste values. We do not compute it.
   *   - `{ richText: [...] }`  — concatenated display text.
   *   - `{ text, hyperlink }`  — the display text only; the target is dropped.
   *   - `{ error: '#N/A' }`    — empty, so a broken formula does not import the
   *     literal string "#N/A" as somebody's phone number.
   *   - `Date`                 — ISO date portion. Import has no date fields
   *     today, but a date-formatted apartment number ("3/4" becomes a date in
   *     Excel) must not silently read as an epoch number.
   *   - `number`               — rendered WITHOUT scientific notation, because
   *     a 9-digit national ID stored as a number must not become "3.12345e+8".
   */
  private readCellValue(cell: any): string {
    if (!cell) return ''
    const v = cell.value

    if (v === null || v === undefined) return ''
    if (typeof v === 'string') return v.trim()
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    if (typeof v === 'number') return numberToPlainString(v)
    if (v instanceof Date) return v.toISOString().slice(0, 10)

    if (typeof v === 'object') {
      // Formula: cached result ONLY.
      if ('formula' in v || 'sharedFormula' in v) {
        const r = (v as any).result
        if (r === null || r === undefined) return ''
        if (typeof r === 'object' && 'error' in r) return ''
        if (typeof r === 'number') return numberToPlainString(r)
        if (r instanceof Date) return r.toISOString().slice(0, 10)
        if (typeof r === 'object' && 'richText' in r) return flattenRichText(r)
        return String(r).trim()
      }
      if ('error' in v) return ''
      if ('richText' in v) return flattenRichText(v)
      // Hyperlink cell — display text only, target discarded.
      if ('text' in v) {
        const t = (v as any).text
        return typeof t === 'object' && t && 'richText' in t ? flattenRichText(t) : String(t ?? '').trim()
      }
    }

    return String(v).trim()
  }
}

function flattenRichText(v: any): string {
  const parts = (v?.richText ?? []) as { text?: string }[]
  return parts.map((p) => p?.text ?? '').join('').trim()
}

/**
 * A number as the user sees it, never in exponential form.
 *
 * `String(312345678)` is fine, but `String(3.12345678e8)` is not what a
 * national ID column should produce, and `String(0.1+0.2)` must not leak
 * float noise into a share cell. `toFixed(20)` then trimming zeros gives the
 * exact decimal expansion of the double, which the fraction parser then
 * consumes as a STRING.
 */
function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return n.toFixed(0)
  const fixed = n.toFixed(20).replace(/0+$/, '').replace(/\.$/, '')
  return fixed
}

export interface ParsedRow {
  /** 1-based, exactly the number shown in Excel's row gutter. */
  rowNumber: number
  values: string[]
}

export interface ParsedSheet {
  sheetName: string
  availableSheets: string[]
  headerRowNumber: number
  headers: string[]
  rows: ParsedRow[]
}
