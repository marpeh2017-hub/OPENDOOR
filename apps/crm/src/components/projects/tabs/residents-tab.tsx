'use client'

import Link from 'next/link'
import { Phone, MessageSquare } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useResidents } from '@/hooks/use-residents'

const STATUS_CONFIG = {
  SIGNED:        { label: 'חתם',           className: 'bg-green-100 text-green-700 border-green-200' },
  INTERESTED:    { label: 'מעוניין',        className: 'bg-blue-100 text-blue-700 border-blue-200' },
  CONTACTED:     { label: 'נוצר קשר',      className: 'bg-teal-100 text-teal-700 border-teal-200' },
  UNDECIDED:     { label: 'מתלבט',         className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  OBJECTING:     { label: 'מתנגד',         className: 'bg-red-100 text-red-700 border-red-200' },
  NOT_CONTACTED: { label: 'לא נוצר קשר',  className: 'bg-gray-100 text-gray-600 border-gray-200' },
  UNREACHABLE:   { label: 'לא זמין',       className: 'bg-orange-100 text-orange-700 border-orange-200' },
} as const

function RiskBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full', score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-orange-400' : 'bg-green-500')}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{score}</span>
    </div>
  )
}

export function ProjectResidentsTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useResidents({ projectId, limit: 200 })

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={6} /></div>

  if (isError || !data) {
    return <QueryError message="שגיאה בטעינת הדיירים" error={error} onRetry={() => refetch()} />
  }

  if (data.data.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState message="אין דיירים רשומים בפרויקט" hint="דיירים יופיעו לאחר שיוך דירות" />
      </div>
    )
  }

  return (
    <div className="card-surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">דייר</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">דירה</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">טלפון</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">סטטוס</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">סיכון</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map(r => {
            const status = STATUS_CONFIG[r.signatureStatus as keyof typeof STATUS_CONFIG]
              ?? { label: r.signatureStatus, className: 'bg-gray-100 text-gray-600 border-gray-200' }
            const apt = r.apartment
            return (
              <TableRow key={r.id} className="group hover:bg-muted/20">
                <TableCell>
                  <Link href={`/residents/${r.id}`} className="font-medium text-foreground hover:text-primary">
                    {r.firstName} {r.lastName}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {apt ? `דירה ${apt.apartmentNumber}${apt.floor != null ? ` · קומה ${apt.floor}` : ''}` : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono" dir="ltr">{r.phone ?? '—'}</TableCell>
                <TableCell>
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border', status.className)}>
                    {status.label}
                  </span>
                </TableCell>
                <TableCell><RiskBar score={r.riskScore ?? 0} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {r.phone && !r.doNotContact && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="שיחה" asChild>
                          <a href={`tel:${r.phone}`}><Phone size={13} /></a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="WhatsApp" asChild>
                          <a
                            href={`https://wa.me/${r.phone.replace(/\D/g, '').replace(/^0/, '972')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageSquare size={13} />
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
