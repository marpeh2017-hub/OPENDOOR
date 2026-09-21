import { PROJECT_TYPE_LABELS } from './project-type-inputs'
import { Injectable } from '@nestjs/common'
import { existsSync } from 'fs'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawn } from 'child_process'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import { FeasibilityReportVersionService } from './feasibility-report-version.service'

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!))
}
function money(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Number(value))
}

/** RTL PDF renderer. Chrome/Edge's bidi engine is used deliberately: PDFKit
 * does not provide reliable Hebrew shaping and mixed number directionality. */
@Injectable()
export class FeasibilityPdfExportService {
  constructor(private readonly reports: FeasibilityReportVersionService, private readonly audit: AuditService) {}

  async build(projectId: string, reportId: string, actor: AuditActor) {
    const report = await this.reports.find(projectId, reportId, actor.tenantId)
    if (report.status !== 'LOCKED') throw DomainError.conflict('FEASIBILITY_EXPORT_REQUIRES_LOCKED_REPORT', 'ניתן לייצא רק גרסת דוח נעולה.')
    const output = report.snapshot.outputSnapshot as any
    const input = report.snapshot.inputSnapshot as any
    const validation = Array.isArray(report.snapshot.validationSnapshot) ? report.snapshot.validationSnapshot as any[] : []
    const comparison = report.comparisonSnapshot as { scenarios?: any[]; capturedAt?: string } | null
    const sensitivity = report.snapshot.sensitivitySnapshot as { primaryVariable?: string; secondaryVariable?: string | null; rows?: any[]; notes?: string[] } | null
    const html = this.withCoverDetails(this.html(report, input, output, validation, comparison, sensitivity), input)
    const dir = await mkdtemp(join(tmpdir(), 'opendoor-zero-report-'))
    const htmlPath = join(dir, 'report.html')
    const pdfPath = join(dir, 'report.pdf')
    try {
      await writeFile(htmlPath, html, 'utf8')
      await this.render(htmlPath, pdfPath)
      const buffer = await readFile(pdfPath)
      if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) throw new Error('PDF renderer did not produce a valid document')
      await this.audit.record(actor, { action: 'EXPORT', entity: 'FeasibilityReportVersion', entityId: report.id, metadata: { format: 'PDF', version: report.version, snapshotId: report.snapshotId } })
      return { fileName: `zero-report-v${report.version}.pdf`, buffer }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  /** Project/profile identifiers are frozen in inputSnapshot.  Enriching the
   * already-rendered template here keeps the main financial body focused on
   * the model while ensuring a locked report remains historically accurate. */
  private withCoverDetails(html: string, input: any) {
    const project = input?.project ?? {}
    // התוויות מגיעות מטבלת המסלולים, לא מעותק שלישי שלהן. עותק לכל צרכן
    // הוא מה שמבטיח שתוספת מסלול תיגע בשלושה מקומות ותישכח באחד.
    const projectType: Record<string, string> = PROJECT_TYPE_LABELS
    const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString('he-IL') : '—'
    const value = (label: string, content: unknown) => `<div><b>${escapeHtml(label)}</b><span>${escapeHtml(content || '—')}</span></div>`
    const details = `<div class="cover-details">${[
      value('פרויקט', project.name), value('קוד פרויקט', project.code), value('כתובת', [project.address, project.city].filter(Boolean).join(', ')),
      value('שכונה', input?.neighborhood), value('סוג פרויקט', projectType[input?.projectType] ?? input?.projectType), value('לקוח', input?.clientName),
      value('יזם', input?.developerName), value('שמאי', input?.appraiserName), value('תאריך קובע', date(input?.valuationDate)), value('תאריך דוח', date(input?.reportDate)),
    ].join('')}</div>`
    const styles = '.cover-details{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 20px;margin-top:22px;padding-top:14px;border-top:1px solid #c9d7e5;font-size:10pt}.cover-details b{display:block;color:#526174;font-size:8.5pt}.cover-details span{display:block;font-weight:600}'
    return html
      .replace('</style>', `${styles}</style>`)
      .replace(/<\/section>\s*<h2>תקציר מנהלים<\/h2>/, `${details}</section>\n    <h2>תקציר מנהלים</h2>`)
  }

  private html(report: any, input: any, output: any, validation: any[], comparison: { scenarios?: any[]; capturedAt?: string } | null, sensitivity: { primaryVariable?: string; secondaryVariable?: string | null; rows?: any[]; notes?: string[] } | null) {
    const rows = (items: any[], value: (item: any) => unknown) => items.length ? items.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.category ?? '')}</td><td>${escapeHtml(item.formula ?? '')}</td><td class="num">${escapeHtml(money(value(item)))}</td></tr>`).join('') : '<tr><td colspan="4">אין נתונים</td></tr>'
    const status: Record<string, string> = { DATA_INCOMPLETE: 'נתונים חסרים', FEASIBLE: 'כדאי', CONDITIONAL: 'כדאי בתנאים', NOT_FEASIBLE: 'לא כדאי' }
    const simpleRows = (items: any[], cells: (item: any) => unknown[]) => items?.length ? items.map((item) => `<tr>${cells(item).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('') : '<tr><td colspan="5">אין נתונים</td></tr>'
    const scenario = (input.scenarios ?? []).find((row: any) => row.id === report.snapshot.scenarioId) ?? {}
    const comparableRows = (input.comparableTransactions ?? []).length ? (input.comparableTransactions ?? []).map((comparable: any) => {
      const frozen = output.valuation?.comparison?.comparables?.find((row: any) => row.id === comparable.id)
      return `<tr><td>${escapeHtml(comparable.address)}</td><td>${escapeHtml(comparable.transactionDate?.slice?.(0, 10) ?? '—')}</td><td class="num">${escapeHtml(money(comparable.transactionPrice))}</td><td class="num">${escapeHtml(comparable.saleableAreaSqm ?? '—')}</td><td class="num">${escapeHtml(money(frozen?.observedPricePerSqm))}</td><td class="num">${escapeHtml(money(frozen?.adjustedPricePerSqm))}</td></tr>`
    }).join('') : '<tr><td colspan="6">לא נכללו עסקאות השוואה בצילום זה.</td></tr>'
    const sourceRows = (input.sources ?? []).length ? (input.sources ?? []).map((source: any) => `<tr><td>${escapeHtml(source.title)}</td><td>${escapeHtml(source.sourceType ?? source.type ?? '—')}</td><td>${escapeHtml(source.issuer ?? '—')}</td><td>${escapeHtml(source.sourceDate?.slice?.(0, 10) ?? '—')}</td><td>${escapeHtml(source.reliability ?? '—')}</td><td>${escapeHtml(source.appendix ? `${source.appendix.title} · v${source.appendix.version}` : source.documentId ? 'מסמך מקושר' : source.sourceUrl ? 'כתובת מקור' : 'ללא קישור')}</td></tr>`).join('') : '<tr><td colspan="6">לא נכללו מקורות בצילום זה.</td></tr>'
    const frozenScenarioRows = comparison?.scenarios?.length ? comparison.scenarios.map((item) => {
      const frozen = item.output ?? {}
      const critical = (item.validation ?? []).filter((issue: any) => issue.severity === 'CRITICAL').length
      return `<tr><td>${escapeHtml(item.scenarioName ?? 'תרחיש')}</td><td class="num">${escapeHtml(money(frozen.revenue?.total))}</td><td class="num">${escapeHtml(money(frozen.costs?.total))}</td><td class="num">${escapeHtml(money(frozen.profitability?.profit))}</td><td class="num">${frozen.returns?.projectIrrAnnual === null || frozen.returns?.projectIrrAnnual === undefined ? '—' : `${(Number(frozen.returns.projectIrrAnnual) * 100).toFixed(1)}%`}</td><td>${critical ? `${critical} קריטיות` : 'ללא קריטיות'}</td></tr>`
    }).join('') : '<tr><td colspan="6">לא נשמרה השוואת תרחישים בגרסה זו.</td></tr>'
    const sensitivityMetrics = (value: any) => `<td class="num">${value.profitMargin === null ? '—' : `${(Number(value.profitMargin) * 100).toFixed(1)}%`}</td><td class="num">${value.projectIrrAnnual === null || value.projectIrrAnnual === undefined ? '—' : `${(Number(value.projectIrrAnnual) * 100).toFixed(1)}%`}</td><td class="num">${escapeHtml(money(value.projectNpv))}</td><td class="num">${escapeHtml(money(value.equityRequirement))}</td>`
    const sensitivityRows = sensitivity?.rows?.length ? sensitivity.rows.flatMap((row: any) => row.values?.length
      ? row.values.map((value: any) => `<tr><td class="num">${escapeHtml(row.primaryChangePercent)}%</td><td class="num">${escapeHtml(value.secondaryChangePercent)}%</td><td class="num">${escapeHtml(money(value.revenue))}</td><td class="num">${escapeHtml(money(value.costs))}</td><td class="num">${escapeHtml(money(value.profit))}</td>${sensitivityMetrics(value)}</tr>`)
      : [`<tr><td class="num">${escapeHtml(row.primaryChangePercent)}%</td><td>—</td><td class="num">${escapeHtml(money(row.revenue))}</td><td class="num">${escapeHtml(money(row.costs))}</td><td class="num">${escapeHtml(money(row.profit))}</td>${sensitivityMetrics(row)}</tr>`]).join('') : '<tr><td colspan="9">לא נכללה רגישות בצילום זה.</td></tr>'
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
      @page { size:A4; margin:18mm 16mm; } body { font-family:Arial,"Arial Hebrew",sans-serif; direction:rtl; color:#172033; font-size:11pt; line-height:1.55; } h1 { font-size:26pt; margin:0; } h2 { color:#1e3a5f; border-bottom:2px solid #1e3a5f; padding-bottom:5px; margin-top:25px; font-size:16pt; } .meta { color:#526174; margin:8px 0 20px; } .cover { min-height:220px; padding:22px; background:#f0f5fa; border-right:7px solid #1e3a5f; } .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; } .card { border:1px solid #d8e0ea; padding:10px; border-radius:5px; background:#fff; } .card b { display:block; color:#526174; font-size:9pt; } .card span { display:block; margin-top:3px; font-size:13pt; font-weight:bold; } table { width:100%; border-collapse:collapse; margin:10px 0; } th { background:#1e3a5f; color:white; } th,td { border:1px solid #d7dee8; padding:7px 9px; text-align:right; vertical-align:top; } .num { direction:ltr; unicode-bidi:isolate; text-align:left; white-space:nowrap; } .warning { border-right:4px solid #c58a00; background:#fff8e7; padding:9px; margin:7px 0; } .critical { border-right:4px solid #b42318; background:#fff0ef; padding:9px; margin:7px 0; } footer { position:fixed; bottom:-10mm; font-size:8pt; color:#667085; }
    </style></head><body><section class="cover"><h1>דוח אפס דיגיטלי</h1><p class="meta">${escapeHtml(report.title)} · גרסה ${escapeHtml(report.version)} · Snapshot קפוא · מנוע ${escapeHtml(report.snapshot.engineVersion)}</p><p>דוח זה מבוסס על צילום חישוב נעול. כל הנתונים והנוסחאות המוצגים בו משחזרים את מצב המודל במועד הקיבוע.</p></section>
    <h2>תקציר מנהלים</h2><div class="grid"><div class="card"><b>סך הכנסות</b><span class="num">${money(output.revenue?.total)}</span></div><div class="card"><b>סך עלויות</b><span class="num">${money(output.costs?.total)}</span></div><div class="card"><b>רווח יזמי</b><span class="num">${money(output.profitability?.profit)}</span></div><div class="card"><b>IRR פרויקט</b><span class="num">${output.returns?.projectIrrAnnual === null ? '—' : `${(Number(output.returns?.projectIrrAnnual) * 100).toFixed(1)}%`}</span></div><div class="card"><b>NPV</b><span class="num">${money(output.returns?.projectNpv)}</span></div><div class="card"><b>שווי קרקע שיורי</b><span class="num">${money(output.valuation?.residualLandValue)}</span></div><div class="card"><b>מסקנת כדאיות</b><span>${escapeHtml(status[output.feasibility?.status] ?? output.feasibility?.status)}</span></div></div>
    <h2>מצב קיים, גוש וחלקה</h2><table><thead><tr><th>גוש</th><th>חלקה</th><th>תת־חלקה</th><th>שטח חלקה במ״ר</th><th>כתובת</th></tr></thead><tbody>${simpleRows(input.parcels ?? [], (row) => [row.gush, row.chelka, row.subChelka ?? '—', row.landAreaSqm ?? '—', row.address ?? '—'])}</tbody></table>
    <h2>שטחים וזכויות תכנון</h2><table><thead><tr><th>סוג שטח</th><th>שטח במ״ר</th><th>סיווג</th><th>מקור/אימות</th></tr></thead><tbody>${simpleRows(input.areas ?? [], (row) => [row.areaType, row.valueSqm, row.classification, row.sourceId ? 'מקור מקושר' : row.isVerified ? 'אומת מקצועית' : 'ללא מקור'])}</tbody></table><table><thead><tr><th>קטגוריה</th><th>סטטוס זכות</th><th>שטח</th><th>יח״ד</th><th>תכנית</th></tr></thead><tbody>${simpleRows(input.planningRights ?? [], (row) => [row.category, row.status, row.areaSqm ?? '—', row.unitCount ?? '—', row.planNumber ?? '—'])}</tbody></table>
    <h2>תמהיל מוצע</h2><table><thead><tr><th>סוג יחידה</th><th>יח״ד</th><th>שטח מכירה</th><th>מחיר למ״ר</th><th>מקור/אימות</th></tr></thead><tbody>${simpleRows(scenario.unitMix ?? [], (row) => [row.label, row.unitCount, row.saleableAreaSqm ?? '—', row.pricePerSqm ?? '—', row.sourceId ? 'מקור מקושר' : row.isVerified ? 'אומת מקצועית' : 'ללא מקור'])}</tbody></table>
    <h2>הכנסות</h2><table><thead><tr><th>תיאור</th><th>קטגוריה</th><th>נוסחה</th><th>סכום לפני מע״מ</th></tr></thead><tbody>${rows(output.revenue?.lines ?? [], (item) => item.amount)}</tbody></table>
    <h2>עסקאות השוואה ושווי</h2><table><thead><tr><th>כתובת</th><th>תאריך</th><th>מחיר עסקה</th><th>שטח מכירה</th><th>מחיר מקור למ״ר</th><th>מחיר מתואם למ״ר</th></tr></thead><tbody>${comparableRows}</tbody></table><div class="grid"><div class="card"><b>מחיר מתואם ממוצע למ״ר</b><span class="num">${money(output.valuation?.comparison?.averageAdjustedPricePerSqm)}</span></div><div class="card"><b>שטח נושא השומה</b><span class="num">${escapeHtml(output.valuation?.comparison?.subjectAreaSqm ?? '—')} מ״ר</span></div><div class="card"><b>שווי בגישת השוואה</b><span class="num">${money(output.valuation?.comparison?.value)}</span></div></div>
    <h2>עלויות</h2><table><thead><tr><th>תיאור</th><th>קטגוריה</th><th>נוסחה</th><th>סכום לפני מע״מ</th></tr></thead><tbody>${rows(output.costs?.lines ?? [], (item) => item.amount)}</tbody></table>
    <h2>תמורות לבעלי זכויות</h2><table><thead><tr><th>רישום בעלות</th><th>שטח דירה חלופית</th><th>פיצוי מזומן</th><th>שכירות חודשית</th><th>חודשי פינוי</th></tr></thead><tbody>${simpleRows(scenario.compensations ?? [], (row) => [row.ownerApartmentId, row.replacementAreaSqm ?? '—', money(row.cashCompensation), money(row.monthlyRelocationRent), row.relocationMonths ?? '—'])}</tbody></table><p>עלות תמורות ישירה שנכללה במודל: <span class="num">${money(output.compensation?.directCashCost)}</span>. שווי דירת התמורה אינו נספר שנית אם הוא כבר מגולם בעלויות הבנייה.</p>
    <h2>מימון ותזרים</h2><div class="grid"><div class="card"><b>חוב שיא</b><span class="num">${money(output.financing?.peakDebt)}</span></div><div class="card"><b>עלות מימון</b><span class="num">${money(output.financing?.accumulatedInterest)}</span></div><div class="card"><b>הון עצמי נדרש</b><span class="num">${money(output.cashFlow?.peakFundingRequirement)}</span></div></div><table><thead><tr><th>תקופה</th><th>כניסות</th><th>יציאות</th><th>נטו</th><th>מצטבר</th></tr></thead><tbody>${simpleRows(output.cashFlow?.periods ?? [], (row) => [row.periodStart, money(row.inflows), money(row.outflows), money(row.net), money(row.cumulative)])}</tbody></table>
    <h2>השוואת תרחישים</h2><p class="meta">השוואה זו הוקפאה עם פתיחת הגרסה${comparison?.capturedAt ? `, במועד ${escapeHtml(new Date(comparison.capturedAt).toLocaleString('he-IL'))}` : ''}.</p><table><thead><tr><th>תרחיש</th><th>הכנסות</th><th>עלויות</th><th>רווח</th><th>IRR שנתי</th><th>איכות</th></tr></thead><tbody>${frozenScenarioRows}</tbody></table>
    <h2>ניתוח רגישות</h2><p class="meta">${sensitivity ? `מטריצה קפואה: ${escapeHtml(sensitivity.primaryVariable ?? '')}${sensitivity.secondaryVariable ? ` מול ${escapeHtml(sensitivity.secondaryVariable)}` : ''}.` : 'לא נכלל ניתוח רגישות בצילום החישוב.'}</p><table><thead><tr><th>שינוי משתנה 1</th><th>שינוי משתנה 2</th><th>הכנסות</th><th>עלויות</th><th>רווח</th><th>מרווח</th><th>IRR שנתי</th><th>NPV</th><th>הון עצמי נדרש</th></tr></thead><tbody>${sensitivityRows}</tbody></table>
    <h2>הנחות ומקורות</h2><table><thead><tr><th>הנחה</th><th>ערך</th><th>יחידה</th><th>אמינות</th><th>מקור/אימות</th></tr></thead><tbody>${simpleRows(input.assumptions ?? [], (row) => [row.label, row.value ?? row.textValue ?? '—', row.unit ?? '—', row.confidence, row.sourceId ? 'מקור מקושר' : row.isVerified ? 'אומת מקצועית' : 'ללא מקור'])}</tbody></table><table><thead><tr><th>כותרת מקור</th><th>סוג</th><th>מנפיק</th><th>תאריך</th><th>אמינות</th><th>אסמכתה</th></tr></thead><tbody>${sourceRows}</tbody></table>
    <h2>גרסה ושחזור</h2><table><tbody><tr><th>גרסת דוח</th><td>${escapeHtml(report.version)}</td><th>תרחיש</th><td>${escapeHtml(scenario.name ?? scenario.label ?? report.snapshot.scenarioId)}${scenario.projectType && scenario.projectType !== input?.projectType ? ` · ${escapeHtml(PROJECT_TYPE_LABELS[scenario.projectType as keyof typeof PROJECT_TYPE_LABELS] ?? scenario.projectType)}` : ''}</td></tr><tr><th>גרסת מנוע</th><td>${escapeHtml(report.snapshot.engineVersion)}</td><th>מועד צילום חישוב</th><td class="num">${escapeHtml(new Date(report.snapshot.createdAt).toLocaleString('he-IL'))}</td></tr><tr><th>נוצר</th><td class="num">${escapeHtml(new Date(report.createdAt).toLocaleString('he-IL'))}</td><th>ננעל</th><td class="num">${report.lockedAt ? escapeHtml(new Date(report.lockedAt).toLocaleString('he-IL')) : '—'}</td></tr></tbody></table><p>הדוח מבוסס על צילום חישוב בלתי־משתנה. עריכה נוספת של המודל מחייבת יצירת גרסת דוח חדשה; גרסה זו אינה משתנה בדיעבד.</p>
    <h2>בקרת איכות והנחות</h2>${validation.length ? validation.map((issue) => `<div class="${issue.severity === 'CRITICAL' ? 'critical' : 'warning'}"><strong>${escapeHtml(issue.code)}</strong><br>${escapeHtml(issue.message)}</div>`).join('') : '<p>לא נמצאו חריגות בצילום החישוב.</p>'}
    <footer>OpenDoor Urban Renewal OS · דוח קפוא · לא מחליף חוות דעת שמאית חתומה</footer></body></html>`
  }

  private async render(htmlPath: string, pdfPath: string) {
    const candidates = [process.env.PDF_BROWSER_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].filter((path): path is string => Boolean(path && existsSync(path)))
    const browser = candidates[0]
    if (!browser) throw new Error('No local Chrome/Edge browser is available for RTL PDF rendering')
    await new Promise<void>((resolve, reject) => {
      const child = spawn(browser, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, `file:///${htmlPath.replace(/\\/g, '/')}`], { windowsHide: true })
      const timer = setTimeout(() => { child.kill(); reject(new Error('PDF rendering timed out')) }, 30_000)
      child.once('error', (error) => { clearTimeout(timer); reject(error) })
      child.once('exit', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`PDF renderer failed with exit code ${code}`)) })
    })
  }
}
