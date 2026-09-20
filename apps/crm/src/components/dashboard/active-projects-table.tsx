'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useDashboardStats } from '@/hooks/use-dashboard'

const STAGE_LABELS: Record<string, string> = {
  DISCOVERY:            'גילוי',
  FEASIBILITY:          'היתכנות',
  RESIDENT_ORGANIZATION:'התארגנות',
  SIGNATURES:           'חתימות',
  DEVELOPER_SELECTION:  'בחירת יזם',
  PLANNING:             'תכנון',
  MUNICIPAL_APPROVAL:   'אישור עירוני',
  PERMIT:               'היתר',
  EVACUATION:           'פינוי',
  CONSTRUCTION:         'בנייה',
  DELIVERY:             'מסירה',
  POST_DELIVERY:        'לאחר מסירה',
}

const STAGE_COLORS: Record<string, string> = {
  SIGNATURES:    'bg-purple-100 text-purple-700',
  CONSTRUCTION:  'bg-green-100 text-green-700',
  PLANNING:      'bg-cyan-100 text-cyan-700',
  DELIVERY:      'bg-teal-100 text-teal-700',
  EVACUATION:    'bg-orange-100 text-orange-700',
}

export function ActiveProjectsTable() {
  const { data, isLoading, isError, error, refetch } = useDashboardStats()

  return (
    <div className="card-surface overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-base font-semibold text-gray-800">פרויקטים פעילים</h3>
      </div>

      {isLoading && <RowsSkeleton rows={5} />}

      {!isLoading && (isError || !data) && (
        <QueryError message="שגיאה בטעינת הפרויקטים" error={error} onRetry={() => refetch()} />
      )}

      {!isLoading && data && data.activeProjects.length === 0 && (
        <EmptyState message="אין פרויקטים פעילים" hint="פרויקטים פעילים יופיעו כאן" />
      )}

      {!isLoading && data && data.activeProjects.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">פרויקט</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">שלב</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">חתימות</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">יחידות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.activeProjects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <Link href={`/projects/${p.id}`} className="hover:text-teal-600">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      STAGE_COLORS[p.stage] ?? 'bg-gray-100 text-gray-700',
                    )}>
                      {STAGE_LABELS[p.stage] ?? p.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 min-w-[60px]">
                        <div
                          className="h-1.5 rounded-full bg-teal-500"
                          style={{ width: `${Math.min(100, Math.max(0, p.signatures))}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 tabular-nums w-8">{p.signatures}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.totalUnits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
