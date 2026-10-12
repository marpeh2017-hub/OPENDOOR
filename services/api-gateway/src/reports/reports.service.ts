import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import {
  REPORTS, REPORT_TYPES, ReportCatalog, israelDate,
  type Filters, type ReportColumnSpec, type ReportDefinition, type ReportType,
} from './report-catalog'
import { buildWorkbook } from './report-excel'
import type { RunReportDto } from './dto/report.dto'

/** Rows a preview returns; the export always has them all. */
export const PREVIEW_ROWS = 200

/**
 * Runs the catalogue's reports for one user: checks the report is theirs to
 * run, cleans the filters, picks the columns, and either returns a preview or
 * builds the Excel file. Every export is audited (EXPORT, entity "Report"),
 * with the filters and the row count but no row content.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: ReportCatalog,
    private readonly audit: AuditService,
  ) {}

  /** The reports this role may run, with their filters and columns, for the generator. */
  types(role: string) {
    return REPORT_TYPES.map((type) => REPORTS[type])
      .filter((report) => report.roles.includes(role))
      .map(({ type, label, description, filters, columns }) => ({ type, label, description, filters, columns }))
  }

  async run(dto: RunReportDto, actor: AuditActor) {
    const report = this.report(dto.type, actor)
    const filters = this.clean(report, dto.filters)
    const columns = this.columnsOf(report, dto.columns)
    const { rows, summary } = await this.catalog.rows(report.type, filters, actor.tenantId)
    return {
      type: report.type,
      label: report.label,
      columns: columns.map(({ key, label }) => ({ key, label })),
      rows: rows.slice(0, PREVIEW_ROWS).map((row) => Object.fromEntries(columns.map((c) => [c.key, row[c.key] ?? '']))),
      total: rows.length,
      truncated: rows.length > PREVIEW_ROWS,
      summary,
    }
  }

  async export(dto: RunReportDto, actor: AuditActor): Promise<{ fileName: string; buffer: Buffer }> {
    const report = this.report(dto.type, actor)
    const filters = this.clean(report, dto.filters)
    const columns = this.columnsOf(report, dto.columns)
    const { rows, summary } = await this.catalog.rows(report.type, filters, actor.tenantId)
    const now = new Date()
    const user = await this.prisma.user.findFirst({
      where: { id: actor.userId, tenantId: actor.tenantId },
      select: { firstName: true, lastName: true },
    })
    const details: [string, string][] = [
      ['דוח', report.label],
      ['הופק', `${israelDate(now)} ${new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }).format(now)}`],
      ['הופק על ידי', user ? `${user.firstName} ${user.lastName}`.trim() : ''],
      ...(await this.describe(report, filters, actor.tenantId)),
      ...summary,
      ['שורות בדוח', String(rows.length)],
    ]
    const buffer = await buildWorkbook({ title: report.label, columns, rows, details })
    await this.audit.record(actor, {
      action: 'EXPORT',
      entity: 'Report',
      entityId: report.type,
      metadata: { type: report.type, filters, columns: columns.map((c) => c.key), rows: rows.length },
    })
    const stamp = now.toISOString().slice(0, 10)
    return { fileName: `${report.fileStem}-${stamp}.xlsx`, buffer }
  }

  private report(type: string, actor: AuditActor): ReportDefinition {
    if (!(REPORT_TYPES as readonly string[]).includes(type)) {
      throw DomainError.validation('REPORT_TYPE_UNKNOWN', 'סוג דוח לא מוכר')
    }
    const report = REPORTS[type as ReportType]
    if (!actor.role || !report.roles.includes(actor.role)) {
      throw DomainError.forbidden('REPORT_FORBIDDEN', 'אין לכם הרשאה להפיק את הדוח הזה')
    }
    return report
  }

  /** Only the report's own filters, each checked for its kind; required ones present. */
  private clean(report: ReportDefinition, raw: Record<string, unknown> | undefined): Filters {
    const filters: Filters = {}
    const invalid = (label: string) => DomainError.validation('REPORT_FILTER_INVALID', `הסינון "${label}" אינו תקין`)
    for (const spec of report.filters) {
      const value = raw?.[spec.key]
      if (value === undefined || value === null || value === '' || value === false) continue
      if (spec.kind === 'boolean') {
        if (value !== true) throw invalid(spec.label)
        filters[spec.key] = true
        continue
      }
      if (typeof value !== 'string' || value.length > 200) throw invalid(spec.label)
      const text = value.trim()
      if (spec.kind === 'select' && !spec.options?.some((option) => option.value === text)) throw invalid(spec.label)
      if (spec.kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw invalid(spec.label)
      if (text) filters[spec.key] = text
    }
    for (const spec of report.filters) {
      if (spec.required && filters[spec.key] === undefined) {
        throw DomainError.validation('REPORT_FILTER_REQUIRED', `צריך לבחור ${spec.label}`)
      }
    }
    return filters
  }

  /** The chosen columns in the report's order; none chosen means its defaults. */
  private columnsOf(report: ReportDefinition, requested: string[] | undefined): ReportColumnSpec[] {
    if (!requested?.length) return report.columns.filter((column) => column.default)
    const chosen = report.columns.filter((column) => requested.includes(column.key))
    if (!chosen.length) throw DomainError.validation('REPORT_COLUMNS_EMPTY', 'צריך לבחור לפחות עמודה אחת')
    return chosen
  }

  /** The filters as a reader understands them: names, not ids. Tenant-scoped. */
  private async describe(report: ReportDefinition, filters: Filters, tenantId: string): Promise<[string, string][]> {
    const lines: [string, string][] = []
    for (const spec of report.filters) {
      const value = filters[spec.key]
      if (value === undefined) continue
      let text = String(value)
      if (spec.kind === 'boolean') text = 'כן'
      else if (spec.kind === 'select') text = spec.options?.find((o) => o.value === value)?.label ?? text
      else if (spec.kind === 'date') text = israelDate(`${value}T12:00:00+03:00`)
      else if (spec.kind === 'project') {
        text = (await this.prisma.project.findFirst({ where: { id: text, tenantId }, select: { name: true } }))?.name ?? text
      } else if (spec.kind === 'complex') {
        text = (await this.prisma.complex.findFirst({ where: { id: text, project: { tenantId } }, select: { name: true } }))?.name ?? text
      } else if (spec.kind === 'building') {
        const building = await this.prisma.building.findFirst({
          where: { id: text, complex: { project: { tenantId } } },
          select: { address: true, streetNumber: true },
        })
        text = building ? [building.address, building.streetNumber].filter(Boolean).join(' ') : text
      } else if (spec.kind === 'form') {
        text = (await this.prisma.signaturePackage.findFirst({ where: { id: text, tenantId }, select: { title: true } }))?.title ?? text
      }
      lines.push([spec.label, text])
    }
    return lines.length ? lines : [['סינון', 'ללא']]
  }
}
