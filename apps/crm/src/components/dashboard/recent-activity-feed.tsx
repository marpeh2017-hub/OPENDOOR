'use client'

import { FileSignature, MessageSquare, UserPlus, CheckCircle2, Upload, FolderKanban, ShieldCheck, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useDashboardStats } from '@/hooks/use-dashboard'

/** Audit-log entity → icon + Hebrew label. */
const ENTITY_CONFIG: Record<string, { icon: typeof Activity; color: string; bg: string; label: string }> = {
  SignaturePackage:   { icon: FileSignature, color: 'text-purple-600', bg: 'bg-purple-50', label: 'חבילת חתימות' },
  SignatureRecord:    { icon: FileSignature, color: 'text-purple-600', bg: 'bg-purple-50', label: 'רשומת חתימה' },
  Communication:      { icon: MessageSquare, color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'תקשורת' },
  Lead:               { icon: UserPlus,      color: 'text-teal-600',   bg: 'bg-teal-50',   label: 'ליד' },
  Task:               { icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50',  label: 'משימה' },
  Document:           { icon: Upload,        color: 'text-orange-600', bg: 'bg-orange-50', label: 'מסמך' },
  Project:            { icon: FolderKanban,  color: 'text-teal-600',   bg: 'bg-teal-50',   label: 'פרויקט' },
  Resident:           { icon: UserPlus,      color: 'text-blue-600',   bg: 'bg-blue-50',   label: 'דייר' },
  DataQualityIssue:   { icon: ShieldCheck,   color: 'text-amber-600',  bg: 'bg-amber-50',  label: 'בעיית איכות נתונים' },
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'יצר',
  UPDATE: 'עדכן',
  DELETE: 'מחק',
  LOGIN:  'התחבר',
  LOGOUT: 'התנתק',
  VIEW:   'צפה ב',
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMin = Math.round((Date.now() - then) / 60000)
  if (diffMin < 1)  return 'הרגע'
  if (diffMin < 60) return `לפני ${diffMin} ד׳`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24)   return `לפני ${diffH} ש׳`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30)   return `לפני ${diffD} י׳`
  return new Date(iso).toLocaleDateString('he-IL')
}

export function RecentActivityFeed() {
  const { data, isLoading, isError, error, refetch } = useDashboardStats()

  return (
    <div className="card-surface h-full">
      <div className="p-4 border-b border-border">
        <h3 className="text-base font-semibold text-gray-800">פעילות אחרונה</h3>
      </div>

      {isLoading && <RowsSkeleton rows={5} />}

      {!isLoading && (isError || !data) && (
        <QueryError message="שגיאה בטעינת הפעילות" error={error} onRetry={() => refetch()} />
      )}

      {!isLoading && data && data.recentActivity.length === 0 && (
        <EmptyState message="אין פעילות אחרונה" hint="פעולות במערכת יופיעו כאן" />
      )}

      {!isLoading && data && data.recentActivity.length > 0 && (
        <ul className="divide-y divide-border">
          {data.recentActivity.map((a) => {
            const cfg = ENTITY_CONFIG[a.entity] ?? {
              icon: Activity, color: 'text-gray-500', bg: 'bg-gray-50', label: a.entity,
            }
            const Icon = cfg.icon
            return (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0', cfg.bg)}>
                  <Icon size={15} className={cfg.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{a.userName ?? 'המערכת'}</span>
                    {' '}{ACTION_LABELS[a.action] ?? a.action}
                    <span className="text-teal-600"> · {cfg.label}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{relativeTime(a.createdAt)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
