import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'
import { REPORT_TYPES } from '../report-catalog'

/**
 * A report to run or export. `filters` is checked key by key against the
 * report's own filter list in ReportsService, so an unknown key or a value
 * outside a list is refused there with the filter's Hebrew name.
 */
export class RunReportDto {
  @IsIn(REPORT_TYPES as unknown as string[])
  type!: string

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>

  /** Column keys, in any order; the report's own order is kept. Empty: its default columns. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  columns?: string[]
}

/** A saved report configuration: only these fields, never the row's own. */
export class SaveReportDto {
  @IsString()
  @MaxLength(120)
  name!: string

  @IsIn(REPORT_TYPES as unknown as string[])
  type!: string

  @IsObject()
  config!: Record<string, unknown>

  @IsOptional()
  @IsString()
  projectId?: string
}
