import type { Cell, ReportColumnSpec } from './report-catalog'

const TEAL = 'FF0B7A7A'

/** Excel's sheet names: at most 31 characters, none of : \ / ? * [ ]. */
function sheetName(title: string): string {
  return title.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'דוח'
}

/**
 * One report as a workbook: the rows on the first sheet, right to left, with
 * a frozen, filterable header in the brand teal; on the second, "פרטי הדוח":
 * what was run, when, by whom, with which filters, and the totals.
 *
 * Every value is written as a plain value, never as a formula, so text a
 * visitor typed into a lead form ("=HYPERLINK(...)") stays text in Excel.
 */
export async function buildWorkbook(input: {
  title: string
  columns: ReportColumnSpec[]
  rows: Record<string, Cell>[]
  details: [string, string][]
}): Promise<Buffer> {
  // exceljs is CommonJS-only; the same require as the feasibility export.
  const ExcelJS = require('exceljs') as typeof import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'OpenDoor CRM'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(sheetName(input.title), {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  })
  sheet.columns = input.columns.map((column) => ({ header: column.label, key: column.key, width: column.width }))
  for (const row of input.rows) {
    sheet.addRow(Object.fromEntries(input.columns.map((column) => [column.key, row[column.key] ?? ''])))
  }
  sheet.eachRow((row, index) => {
    row.font = index === 1
      ? { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      : { name: 'Arial', size: 10 }
    row.alignment = { horizontal: 'right', vertical: 'top', wrapText: index > 1 }
    if (index === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
  })
  if (input.columns.length) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: input.columns.length } }
  }

  const details = workbook.addWorksheet('פרטי הדוח', { views: [{ rightToLeft: true }] })
  details.columns = [{ width: 30 }, { width: 70 }]
  for (const [label, value] of input.details) {
    const row = details.addRow([label, value])
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true }
    row.getCell(2).font = { name: 'Arial', size: 10 }
    row.alignment = { horizontal: 'right', vertical: 'top', wrapText: true }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
