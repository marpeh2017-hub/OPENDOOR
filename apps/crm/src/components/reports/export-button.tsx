'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chosenFilters, exportReport, useReportTypes, type ReportFilters, type ReportType } from '@/hooks/use-reports'

/**
 * "ייצוא לאקסל" for a list screen: runs the same report the report generator
 * offers, with the filters already chosen on the screen, so the file holds
 * what the screen shows (every row, not one page). Hidden for a role the
 * report is not open to; the API refuses them regardless.
 */
export function ExportButton({
  type,
  filters,
  label = 'ייצוא לאקסל',
}: {
  type: ReportType
  filters: ReportFilters
  label?: string
}) {
  const { data: types } = useReportTypes()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!types?.some((t) => t.type === type)) return null

  async function run() {
    setBusy(true)
    setError(null)
    try {
      await exportReport({ type, filters: chosenFilters(filters) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הייצוא נכשל')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant="outline" onClick={run} disabled={busy}>
        {busy ? <Loader2 size={15} className="ml-1.5 animate-spin" /> : <FileSpreadsheet size={15} className="ml-1.5" />}
        {label}
      </Button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  )
}
