import { useMutation, useQuery } from '@tanstack/react-query'
import { api, download } from '@/lib/api-client'

/**
 * The report engine (services/api-gateway/src/reports): the reports this user
 * may run, a preview, and the Excel export. The export buttons on the owners,
 * leads and form screens and the report generator all go through here.
 */

export type ReportType = 'owners' | 'leads' | 'form-signatures' | 'projects'
export type ReportFilterKind = 'project' | 'complex' | 'building' | 'form' | 'select' | 'date' | 'text' | 'boolean'

export interface ReportFilterSpec {
  key: string
  label: string
  kind: ReportFilterKind
  options?: { value: string; label: string }[]
  required?: boolean
}

export interface ReportColumnSpec {
  key: string
  label: string
  width: number
  default: boolean
}

export interface ReportTypeInfo {
  type: ReportType
  label: string
  description: string
  filters: ReportFilterSpec[]
  columns: ReportColumnSpec[]
}

export type ReportFilters = Record<string, string | boolean | undefined>

export interface ReportRequest {
  type: ReportType
  filters?: ReportFilters
  columns?: string[]
}

export interface ReportPreview {
  type: ReportType
  label: string
  columns: { key: string; label: string }[]
  rows: Record<string, string | number | null>[]
  total: number
  truncated: boolean
  summary: [string, string][]
}

/** Only the reports the user's role may run; a 403 (no report at all) is an empty list. */
export function useReportTypes() {
  return useQuery({
    queryKey: ['reports', 'types'],
    queryFn: async () => {
      try {
        return await api.get<ReportTypeInfo[]>('/reports/types')
      } catch (e) {
        if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 403) return []
        throw e
      }
    },
    staleTime: 10 * 60_000,
  })
}

export function useRunReport() {
  return useMutation({ mutationFn: (request: ReportRequest) => api.post<ReportPreview>('/reports/run', request) })
}

/** Downloads the report as an Excel file, under the name the API gives it. */
export async function exportReport(request: ReportRequest): Promise<void> {
  const { blob, fileName } = await download('/reports/export', request)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Drops empty values, so a request carries only the filters actually chosen. */
export function chosenFilters(filters: ReportFilters): ReportFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && value !== false && value !== 'ALL'))
}
