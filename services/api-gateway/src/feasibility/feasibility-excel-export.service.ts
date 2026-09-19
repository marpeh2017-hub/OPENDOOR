import { Injectable } from '@nestjs/common'
import { DomainError } from '../common/errors/domain-error'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { PrismaService } from '../prisma.service'
import { FeasibilityReportVersionService } from './feasibility-report-version.service'

function auditTargets(input: any, report: any) {
  const targets: Array<{ entity: string; entityId: string }> = []
  const add = (entity: string, row: any) => { if (row?.id) targets.push({ entity, entityId: row.id }) }
  add('FeasibilityProfile', input)
  ;(input.parcels ?? []).forEach((row: any) => add('GushChelkaRecord', row))
  ;(input.sources ?? []).forEach((row: any) => add('FeasibilitySource', row))
  ;(input.assumptions ?? []).forEach((row: any) => add('FeasibilityAssumption', row))
  ;(input.areas ?? []).forEach((row: any) => add('FeasibilityAreaLine', row))
  ;(input.planningRights ?? []).forEach((row: any) => add('PlanningRight', row))
  ;(input.comparableTransactions ?? []).forEach((row: any) => { add('ComparableTransaction', row); (row.adjustments ?? []).forEach((adjustment: any) => add('ComparableAdjustment', adjustment)) })
  ;(input.scenarios ?? []).forEach((scenario: any) => {
    add('FeasibilityScenario', scenario); add('FeasibilityFinancing', scenario.financing)
    ;(scenario.unitMix ?? []).forEach((row: any) => add('FeasibilityUnitMixLine', row))
    ;(scenario.revenueLines ?? []).forEach((row: any) => add('FeasibilityRevenueLine', row))
    ;(scenario.costLines ?? []).forEach((row: any) => add('FeasibilityCostLine', row))
    ;(scenario.timelinePhases ?? []).forEach((row: any) => add('FeasibilityTimelinePhase', row))
    ;(scenario.cashFlowAllocations ?? []).forEach((row: any) => add('FeasibilityCashFlowAllocation', row))
    ;(scenario.compensations ?? []).forEach((row: any) => add('FeasibilityCompensationLine', row))
  })
  add('FeasibilityCalculationSnapshot', report.snapshot)
  add('FeasibilityReportVersion', report)
  return targets
}

function auditJson(value: unknown) {
  if (!value) return '—'
  const rendered = JSON.stringify(value)
  return rendered.length > 1800 ? `${rendered.slice(0, 1797)}…` : rendered
}
function numberOrBlank(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : ''
}
function percentageChangeOrBlank(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric / 100 : ''
}

/**
 * Creates an Excel workbook from a LOCKED report version only.  Inputs in the
 * workbook are the frozen snapshot values; totals are Excel formulas so the
 * reviewer can inspect their composition without the browser becoming a
 * second calculation authority.
 */
@Injectable()
export class FeasibilityExcelExportService {
  constructor(private readonly reports: FeasibilityReportVersionService, private readonly audit: AuditService, private readonly prisma: PrismaService) {}

  async build(projectId: string, reportId: string, actor: AuditActor) {
    const report = await this.reports.find(projectId, reportId, actor.tenantId)
    if (report.status !== 'LOCKED') {
      throw DomainError.conflict('FEASIBILITY_EXPORT_REQUIRES_LOCKED_REPORT', 'ניתן לייצא רק גרסת דוח נעולה.')
    }
     
    const ExcelJS = require('exceljs') as any
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'OpenDoor Urban Renewal OS'
    workbook.created = new Date()
    workbook.calcProperties.fullCalcOnLoad = true
    const output = report.snapshot.outputSnapshot as any
    const input = report.snapshot.inputSnapshot as any
    const auditRows = await this.prisma.auditLog.findMany({
      where: { tenantId: actor.tenantId, OR: auditTargets(input, report) },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const comparison = report.comparisonSnapshot as { scenarios?: Array<{ scenarioName?: string; snapshotId?: string; engineVersion?: string; calculatedAt?: string; output?: any; validation?: Array<{ severity?: string }> }> } | null
    const currencyFormat = '₪#,##0;[Red](₪#,##0);-'
    const percentFormat = '0.0%;[Red](0.0%);-'

    const style = (sheet: any) => {
      sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
      sheet.properties.defaultRowHeight = 20
      sheet.eachRow((row: any) => row.font = { name: 'Arial', size: 10 })
      sheet.getRow(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
      sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.max(1, sheet.columnCount))}1` }
    }
    const table = (name: string, columns: Array<{ header: string; width?: number; numFmt?: string }>, values: unknown[][]) => {
      const sheet = workbook.addWorksheet(name)
      sheet.columns = columns.map((column) => ({ width: column.width ?? 22 }))
      sheet.addRow(columns.map((column) => column.header))
      for (const row of values) sheet.addRow(row)
      columns.forEach((column, index) => { if (column.numFmt) sheet.getColumn(index + 1).numFmt = column.numFmt })
      style(sheet)
      return sheet
    }
    const summary = workbook.addWorksheet('01_Summary')
    summary.columns = [{ width: 30 }, { width: 22 }, { width: 32 }]
    summary.addRow(['מדד', 'ערך', 'מקור / נוסחה'])
    summary.addRows([
      ['שם הדוח', report.title, 'גרסת דוח נעולה'],
      ['גרסה', report.version, 'מערכת'],
      ['הכנסות כוללות', { formula: "=SUM('07_Sales'!D2:D1000)" }, 'Σ שורות הכנסה'],
      ['עלויות כוללות', { formula: "=SUM('09_Costs'!D2:D1000)" }, 'Σ שורות עלות'],
      ['רווח יזמי', { formula: '=B4-B5' }, 'הכנסות פחות עלויות'],
      ['מרווח רווח', { formula: '=IFERROR(B6/B4,0)' }, 'רווח / הכנסות'],
      ['IRR פרויקט', output.returns?.projectIrrAnnual ?? null, 'חישוב שרת מצילום התזרים'],
      ['NPV פרויקט', output.returns?.projectNpv ?? null, 'חישוב שרת מצילום התזרים'],
      ['שווי קרקע שיורי', output.valuation?.residualLandValue ?? null, 'חישוב שרת מצילום הדוח'],
      ['מצב כדאיות', output.feasibility?.status ?? 'DATA_INCOMPLETE', 'מנוע חישוב'],
    ])
    for (const cell of ['B4', 'B5', 'B6', 'B9', 'B10']) summary.getCell(cell).numFmt = currencyFormat
    for (const cell of ['B7', 'B8']) summary.getCell(cell).numFmt = percentFormat
    style(summary)

    table('02_Project', [
      { header: 'שדה', width: 30 }, { header: 'ערך', width: 36 }, { header: 'סיווג', width: 20 }, { header: 'צילום מקור', width: 28 },
    ], [
      ['שם פרויקט', input.project?.name ?? '—', 'FACT', 'צילום פרויקט'],
      ['קוד פרויקט', input.project?.code ?? '—', 'FACT', 'צילום פרויקט'],
      ['כתובת פרויקט', [input.project?.address, input.project?.city].filter(Boolean).join(', ') || '—', 'FACT', 'צילום פרויקט'],
      ['סוג פרויקט', input.projectType ?? '—', 'FACT', 'פרופיל דוח אפס'],
      ['סוג דוח', input.reportType ?? '—', 'FACT', 'פרופיל דוח אפס'],
      ['מטרה', input.purpose ?? '—', 'FACT', 'פרופיל דוח אפס'],
      ['תאריך קובע', input.valuationDate ?? '—', 'FACT', 'פרופיל דוח אפס'],
      ['תאריך דוח', input.reportDate ?? '—', 'FACT', 'פרופיל דוח אפס'],
      ['לקוח', input.clientName ?? '—', 'FACT', 'פרופיל דוח אפס'],
      ['יזם', input.developerName ?? '—', 'FACT', 'פרופיל דוח אפס'],
      ['שמאי', input.appraiserName ?? '—', 'FACT', 'פרופיל דוח אפס'],
      ['שכונה', input.neighborhood ?? '—', 'FACT', 'פרופיל דוח אפס'],
    ])
    table('03_Existing', [
      { header: 'גוש', width: 18 }, { header: 'חלקה', width: 18 }, { header: 'תת־חלקה', width: 18 }, { header: 'שטח חלקה במ״ר', width: 22 }, { header: 'כתובת', width: 42 }, { header: 'אימות', width: 18 },
    ], (input.parcels ?? []).map((row: any) => [row.gush, row.chelka, row.subChelka ?? '—', row.landAreaSqm ?? '', row.address ?? '—', row.isVerified ? 'מאומת' : 'לא מאומת']))
    table('04_Planning_Rights', [
      { header: 'קטגוריה', width: 24 }, { header: 'סטטוס', width: 20 }, { header: 'שטח במ״ר', width: 20 }, { header: 'יח״ד', width: 14 }, { header: 'קומות', width: 14 }, { header: 'תכנית', width: 22 }, { header: 'ייעוד', width: 26 }, { header: 'ודאות', width: 16 },
    ], (input.planningRights ?? []).map((row: any) => [row.category, row.status, row.areaSqm ?? '', row.unitCount ?? '', row.floorLimit ?? '', row.planNumber ?? '—', row.landUse ?? '—', row.confidence ?? 'UNKNOWN']))
    table('05_Area_Schedule', [
      { header: 'סוג שטח', width: 26 }, { header: 'תיאור', width: 30 }, { header: 'שטח במ״ר', width: 20 }, { header: 'סיווג', width: 18 }, { header: 'ודאות', width: 16 }, { header: 'מקור/אימות', width: 24 },
    ], (input.areas ?? []).map((row: any) => [row.areaType, row.label ?? '—', row.valueSqm, row.classification ?? 'FACT', row.confidence, row.sourceId ? 'מקור מקושר' : row.isVerified ? 'אומת מקצועית' : 'ללא מקור']))
    table('06_Unit_Mix', [
      { header: 'תרחיש', width: 24 }, { header: 'סוג יחידה', width: 26 }, { header: 'יח״ד', width: 14 }, { header: 'שטח מכירה במ״ר', width: 22 }, { header: 'מחיר למ״ר', width: 22, numFmt: currencyFormat }, { header: 'מחיר יחידה', width: 22, numFmt: currencyFormat }, { header: 'ודאות', width: 16 },
    ], (input.scenarios ?? []).flatMap((scenario: any) => (scenario.unitMix ?? []).map((row: any) => [scenario.name, row.label, row.unitCount, row.saleableAreaSqm ?? '', row.pricePerSqm ?? '', row.fixedUnitPrice ?? '', row.confidence ?? 'UNKNOWN'])))

    const sales = workbook.addWorksheet('07_Sales')
    sales.columns = [{ width: 34 }, { width: 20 }, { width: 38 }, { width: 22 }]
    sales.addRow(['תיאור', 'קטגוריה', 'נוסחה', 'הכנסה לפני מע״מ'])
    for (const line of output.revenue?.lines ?? []) sales.addRow([line.label, line.category, line.formula, Number(line.amount)])
    sales.getColumn(4).numFmt = currencyFormat
    style(sales)

    const comps = workbook.addWorksheet('08_Comps')
    comps.columns = [{ width: 34 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 22 }, { width: 22 }, { width: 22 }]
    comps.addRow(['כתובת', 'תאריך עסקה', 'מחיר עסקה', 'שטח מכירה במ״ר', 'מחיר מקור למ״ר', 'מקדם התאמה מצטבר', 'מחיר מתואם למ״ר', 'מקור', 'ודאות'])
    const frozenComparables = output.valuation?.comparison?.comparables ?? []
    for (const comparable of input.comparableTransactions ?? []) {
      const frozen = frozenComparables.find((row: any) => row.id === comparable.id)
      const row = comps.addRow([comparable.address, comparable.transactionDate, Number(comparable.transactionPrice), Number(comparable.saleableAreaSqm), { formula: `=C${comps.rowCount + 1}/D${comps.rowCount + 1}` }, frozen ? Number(frozen.adjustmentFactor) : '', { formula: `=E${comps.rowCount + 1}*F${comps.rowCount + 1}` }, comparable.sourceId ? 'מקור מקושר' : 'ללא מקור', comparable.reliability])
      row.getCell(2).numFmt = 'dd/mm/yyyy'
    }
    for (const column of [3, 5, 7]) comps.getColumn(column).numFmt = currencyFormat
    comps.getColumn(6).numFmt = '0.0000x'
    style(comps)

    const costs = workbook.addWorksheet('09_Costs')
    costs.columns = [{ width: 34 }, { width: 24 }, { width: 42 }, { width: 22 }]
    costs.addRow(['תיאור', 'קטגוריה', 'נוסחה', 'עלות לפני מע״מ'])
    for (const line of output.costs?.lines ?? []) costs.addRow([line.label, line.category, line.formula, Number(line.amount)])
    costs.getColumn(4).numFmt = currencyFormat
    style(costs)

    table('10_Owner_Consideration', [
      { header: 'תרחיש', width: 24 }, { header: 'רישום בעלות', width: 28 }, { header: 'סטטוס', width: 18 }, { header: 'פיצוי מזומן', width: 22, numFmt: currencyFormat }, { header: 'שכירות חודשית', width: 22, numFmt: currencyFormat }, { header: 'חודשי פינוי', width: 16 }, { header: 'מעבר', width: 20, numFmt: currencyFormat },
    ], (input.scenarios ?? []).flatMap((scenario: any) => (scenario.compensations ?? []).map((row: any) => [scenario.name, row.ownerApartmentId, row.status, row.cashCompensation ?? '', row.monthlyRelocationRent ?? '', row.relocationMonths ?? '', row.movingCost ?? ''])))
    table('11_Taxes', [
      { header: 'תיאור', width: 34 }, { header: 'קטגוריה', width: 24 }, { header: 'נוסחה', width: 42 }, { header: 'סכום לפני מע״מ', width: 22, numFmt: currencyFormat },
    ], (output.costs?.lines ?? []).filter((line: any) => ['TAXES', 'LEVIES', 'BETTERMENT_LEVY', 'FEES'].includes(line.category)).map((line: any) => [line.label, line.category, line.formula, Number(line.amount)]))
    table('12_Financing', [
      { header: 'תרחיש', width: 24 }, { header: 'חוב', width: 22, numFmt: currencyFormat }, { header: 'הון עצמי', width: 22, numFmt: currencyFormat }, { header: 'ריבית שנתית', width: 20, numFmt: percentFormat }, { header: 'חודשי מימון', width: 18 }, { header: 'עלות מימון בצילום', width: 26, numFmt: currencyFormat },
    ], (input.scenarios ?? []).map((scenario: any) => [scenario.name, scenario.financing?.debtAmount ?? '', scenario.financing?.equityAmount ?? '', scenario.financing?.annualInterestRate ?? '', scenario.financing?.financingMonths ?? '', scenario.id === report.snapshot.scenarioId ? Number(output.financing?.accumulatedInterest ?? 0) : '']))
    table('13_Cash_Flow', [
      { header: 'תקופה', width: 20 }, { header: 'כניסות', width: 22, numFmt: currencyFormat }, { header: 'יציאות', width: 22, numFmt: currencyFormat }, { header: 'נטו', width: 22, numFmt: currencyFormat }, { header: 'מצטבר', width: 22, numFmt: currencyFormat },
    ], (output.cashFlow?.periods ?? []).map((row: any) => [row.periodStart, Number(row.inflows), Number(row.outflows), Number(row.net), Number(row.cumulative)]))
    const profitabilitySheet = table('14_Profitability', [
      { header: 'מדד', width: 34 }, { header: 'ערך', width: 24 }, { header: 'סיווג', width: 22 },
    ], [
      ['רווח לפני מימון', Number(output.profitability?.profitBeforeFinancing ?? 0), 'CALCULATED'],
      ['רווח לאחר מימון', Number(output.profitability?.profit ?? 0), 'CALCULATED'],
      ['רווח על עלות', output.profitability?.profitOnCost ?? '', 'CALCULATED'],
      ['מרווח רווח', output.profitability?.profitMargin ?? '', 'CALCULATED'],
      ['IRR פרויקט שנתי', output.returns?.projectIrrAnnual ?? '', 'CALCULATED'],
      ['NPV פרויקט', output.returns?.projectNpv ?? '', 'CALCULATED'],
      ['מכפיל הון', output.returns?.equityMultiple ?? '', 'CALCULATED'],
      ['הון עצמי נדרש', Number(output.cashFlow?.peakFundingRequirement ?? 0), 'CALCULATED'],
    ])
    ;['B2', 'B3', 'B7', 'B9'].forEach((cell) => { profitabilitySheet.getCell(cell).numFmt = currencyFormat })
    ;['B4', 'B5', 'B6'].forEach((cell) => { profitabilitySheet.getCell(cell).numFmt = percentFormat })
    profitabilitySheet.getCell('B8').numFmt = '0.00x'
    const valuationSheet = table('15_Valuation', [
      { header: 'מדד', width: 36 }, { header: 'ערך', width: 24, numFmt: currencyFormat }, { header: 'נוסחה / מקור', width: 54 },
    ], [
      ['שווי קרקע שיורי', output.valuation?.residualLandValue === null || output.valuation?.residualLandValue === undefined ? '' : Number(output.valuation.residualLandValue), 'GDV פחות עלויות פיתוח, מימון ורווח יזמי נדרש'],
      ['רווח יזמי נדרש', output.valuation?.requiredDeveloperProfit === null || output.valuation?.requiredDeveloperProfit === undefined ? '' : Number(output.valuation.requiredDeveloperProfit), 'הנחת שיעור רווח יזמי נדרש'],
      ['שיעור רווח יזמי נדרש', output.valuation?.requiredDeveloperProfitMargin ?? '', 'Assumption Registry'],
      ['מחיר השוואה מתואם ממוצע למ״ר', output.valuation?.comparison?.averageAdjustedPricePerSqm === null || output.valuation?.comparison?.averageAdjustedPricePerSqm === undefined ? '' : Number(output.valuation.comparison.averageAdjustedPricePerSqm), 'ממוצע פשוט של עסקאות השוואה מתואמות'],
      ['שטח נושא השומה להשוואה', output.valuation?.comparison?.subjectAreaSqm ?? '', 'Assumption Registry'],
      ['שווי בגישת השוואה', output.valuation?.comparison?.value === null || output.valuation?.comparison?.value === undefined ? '' : Number(output.valuation.comparison.value), output.valuation?.comparison?.method ?? '—'],
    ])
    valuationSheet.getCell('B4').numFmt = percentFormat
    valuationSheet.getCell('B6').numFmt = '0.00'
    const frozenSensitivity = report.snapshot.sensitivitySnapshot as { primaryVariable?: string; secondaryVariable?: string | null; rows?: any[]; notes?: string[] } | null
    const sensitivityRows = frozenSensitivity?.rows?.length
      ? frozenSensitivity.rows.flatMap((row: any) => row.values?.length
        ? row.values.map((value: any) => [percentageChangeOrBlank(row.primaryChangePercent), percentageChangeOrBlank(value.secondaryChangePercent), numberOrBlank(value.revenue), numberOrBlank(value.costs), numberOrBlank(value.profit), numberOrBlank(value.profitMargin), numberOrBlank(value.projectIrrAnnual), numberOrBlank(value.projectNpv), numberOrBlank(value.equityRequirement)])
        : [[percentageChangeOrBlank(row.primaryChangePercent), '—', numberOrBlank(row.revenue), numberOrBlank(row.costs), numberOrBlank(row.profit), numberOrBlank(row.profitMargin), numberOrBlank(row.projectIrrAnnual), numberOrBlank(row.projectNpv), numberOrBlank(row.equityRequirement)]])
      : [['לא נכלל בצילום זה', '—', '', '', '', '', '', '', '']]
    table('17_Sensitivity', [
      { header: frozenSensitivity?.primaryVariable ?? 'משתנה ראשון', width: 18, numFmt: '0.0%;[Red](0.0%);-' }, { header: frozenSensitivity?.secondaryVariable ?? 'משתנה שני', width: 18, numFmt: '0.0%;[Red](0.0%);-' }, { header: 'הכנסות', width: 22, numFmt: currencyFormat }, { header: 'עלויות', width: 22, numFmt: currencyFormat }, { header: 'רווח', width: 22, numFmt: currencyFormat }, { header: 'מרווח רווח', width: 18, numFmt: percentFormat }, { header: 'IRR שנתי', width: 18, numFmt: percentFormat }, { header: 'NPV', width: 22, numFmt: currencyFormat }, { header: 'הון עצמי נדרש', width: 22, numFmt: currencyFormat },
    ], sensitivityRows)

    const assumptions = workbook.addWorksheet('18_Assumptions')
    assumptions.columns = [{ width: 28 }, { width: 35 }, { width: 22 }, { width: 18 }, { width: 20 }]
    assumptions.addRow(['מפתח', 'הנחה', 'ערך', 'יחידה', 'מצב מקור'])
    for (const row of input.assumptions ?? []) assumptions.addRow([row.key, row.label, row.value ?? row.textValue ?? '', row.unit ?? '', row.sourceId ? 'מקור מקושר' : row.isVerified ? 'אומת מקצועית' : 'ללא מקור'])
    style(assumptions)

    table('19_Sources', [
      { header: 'כותרת מקור', width: 42 }, { header: 'סוג', width: 22 }, { header: 'מנפיק', width: 28 }, { header: 'תאריך', width: 20 }, { header: 'אמינות', width: 16 }, { header: 'מסמך מקושר', width: 24 },
    ], (input.sources ?? []).map((row: any) => [row.title, row.type, row.issuer ?? '—', row.sourceDate ?? '—', row.reliability, row.appendix ? `${row.appendix.title} · v${row.appendix.version}` : row.documentId ? 'מסמך מקושר' : 'ללא מסמך']))

    const quality = workbook.addWorksheet('20_Data_Quality')
    quality.columns = [{ width: 34 }, { width: 18 }, { width: 80 }]
    quality.addRow(['קוד', 'חומרה', 'תיאור'])
    for (const issue of report.snapshot.validationSnapshot as any[]) quality.addRow([issue.code, issue.severity, issue.message])
    style(quality)

    table('21_Audit', [
      { header: 'מועד', width: 25 }, { header: 'משתמש', width: 24 }, { header: 'פעולה', width: 18 }, { header: 'ישות', width: 30 }, { header: 'מזהה ישות', width: 28 }, { header: 'לפני/אחרי', width: 70 }, { header: 'הקשר', width: 50 },
    ], auditRows.map((row) => [
      row.createdAt.toISOString(), row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : 'פעולה מערכתית', row.action, row.entity, row.entityId ?? '—', auditJson(row.changes), auditJson(row.metadata),
    ]))

    // This sheet is deliberately fed from the report's immutable comparison
    // snapshot rather than querying the current project scenarios.
    const scenarioComparison = workbook.addWorksheet('16_Scenarios')
    scenarioComparison.columns = [{ width: 28 }, { width: 18 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 18 }, { width: 22 }, { width: 16 }]
    scenarioComparison.addRow(['תרחיש', 'מנוע', 'מועד חישוב', 'הכנסות', 'עלויות', 'רווח', 'NPV', 'שגיאות קריטיות'])
    for (const scenario of comparison?.scenarios ?? []) {
      const scenarioOutput = scenario.output ?? {}
      const criticalCount = (scenario.validation ?? []).filter((issue) => issue.severity === 'CRITICAL').length
      scenarioComparison.addRow([
        scenario.scenarioName ?? 'תרחיש',
        scenario.engineVersion ?? '—',
        scenario.calculatedAt ?? '—',
        Number(scenarioOutput.revenue?.total ?? 0),
        Number(scenarioOutput.costs?.total ?? 0),
        Number(scenarioOutput.profitability?.profit ?? 0),
        scenarioOutput.returns?.projectNpv === null || scenarioOutput.returns?.projectNpv === undefined ? null : Number(scenarioOutput.returns.projectNpv),
        criticalCount,
      ])
    }
    for (const column of [4, 5, 6, 7]) scenarioComparison.getColumn(column).numFmt = currencyFormat
    style(scenarioComparison)

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    await this.audit.record(actor, { action: 'EXPORT', entity: 'FeasibilityReportVersion', entityId: report.id, metadata: { format: 'XLSX', version: report.version, snapshotId: report.snapshotId } })
    return { fileName: `zero-report-v${report.version}.xlsx`, buffer }
  }
}
