'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, CheckCircle2, Clock, AlertCircle, Circle, XCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useSignaturePackages } from '@/hooks/use-signatures'
import { useProjects } from '@/hooks/use-projects'

/**
 * Mirrors the documented SignaturePackage.status lifecycle in
 * packages/db/prisma/schema.postgres.prisma:
 *   DRAFT → INTERNAL_REVIEW → APPROVED → SENT → PARTIALLY_SIGNED
 *   → COMPLETED | DECLINED | EXPIRED | CANCELLED | SUPERSEDED
 *
 * Any status missing from this map falls through to the raw enum string, which
 * is how untranslated values such as DECLINED previously leaked into the UI.
 */
const STATUS_CFG: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  DRAFT:            { label: 'טיוטה',        icon: Circle,       badge: 'bg-gray-100 text-gray-500 border-gray-200' },
  INTERNAL_REVIEW:  { label: 'בבדיקה פנימית', icon: Clock,       badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  APPROVED:         { label: 'מאושר',        icon: CheckCircle2, badge: 'bg-teal-100 text-teal-700 border-teal-200' },
  SENT:             { label: 'נשלח',         icon: Send,         badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  PARTIALLY_SIGNED: { label: 'נחתם חלקית',   icon: Eye,          badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  COMPLETED:        { label: 'הושלם',        icon: CheckCircle2, badge: 'bg-green-100 text-green-700 border-green-200' },
  DECLINED:         { label: 'נדחה',          icon: XCircle,      badge: 'bg-red-100 text-red-700 border-red-200' },
  EXPIRED:          { label: 'פג תוקף',      icon: AlertCircle,  badge: 'bg-red-100 text-red-700 border-red-200' },
  CANCELLED:        { label: 'בוטל',         icon: XCircle,      badge: 'bg-gray-100 text-gray-500 border-gray-200' },
  SUPERSEDED:       { label: 'הוחלף',        icon: Circle,       badge: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('he-IL')
}

export function SignaturesTable() {
  const router = useRouter()
  const { data, isLoading, isError, error, refetch } = useSignaturePackages()
  // Used only to resolve projectId → project name for display.
  const { data: projects } = useProjects({ limit: 200 })

  if (isLoading) return <RowsSkeleton rows={6} />

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת חבילות החתימה" error={error} onRetry={() => refetch()} />
  }

  if (data.length === 0) {
    return <EmptyState message="אין חבילות חתימה" hint="צרו חבילה חדשה כדי להתחיל תהליך חתימות" />
  }

  const projectName = new Map((projects?.data ?? []).map(p => [p.id, p.name]))

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-right font-semibold">חבילה</TableHead>
          <TableHead className="text-right font-semibold">פרויקט</TableHead>
          <TableHead className="text-right font-semibold">סטטוס</TableHead>
          <TableHead className="text-right font-semibold w-48">חותמים</TableHead>
          <TableHead className="text-right font-semibold">נוצר</TableHead>
          <TableHead className="text-right font-semibold">הושלם</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map(pkg => {
          const status = STATUS_CFG[pkg.status]
            ?? { label: pkg.status, icon: Circle, badge: 'bg-gray-100 text-gray-500 border-gray-200' }
          const StatusIcon = status.icon
          const total  = pkg.records?.length ?? 0
          const signed = pkg.records?.filter(r => r.status === 'SIGNED').length ?? 0
          const pct    = total > 0 ? Math.round((signed / total) * 100) : 0
          return (
            // The whole row navigates to the package detail. The <Link> in the
            // first cell is kept so keyboard focus, middle-click and "open in
            // new tab" still work — the row handler is a convenience on top.
            <TableRow
              key={pkg.id}
              className="group cursor-pointer"
              onClick={() => router.push(`/signatures/${pkg.id}`)}
            >
              <TableCell>
                <Link href={`/signatures/${pkg.id}`} className="flex items-center gap-2.5">
                  <StatusIcon size={15} className="text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {pkg.title}
                    </p>
                    <p className="text-xs text-muted-foreground">גרסה {pkg.version}</p>
                  </div>
                </Link>
              </TableCell>

              <TableCell className="text-sm text-muted-foreground">
                {projectName.get(pkg.projectId) ?? '—'}
              </TableCell>

              <TableCell>
                <span className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  status.badge,
                )}>
                  {status.label}
                </span>
              </TableCell>

              <TableCell>
                {total === 0 ? (
                  <span className="text-sm text-muted-foreground">אין חותמים</span>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {signed}/{total}
                    </span>
                  </div>
                )}
              </TableCell>

              <TableCell className="text-sm text-muted-foreground">{formatDate(pkg.createdAt)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(pkg.completedAt)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
