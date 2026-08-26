'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowRight, RefreshCw, Download, Users, FileText,
  CheckCircle2, XCircle, Clock, Eye, Send, AlertCircle,
  MoreHorizontal, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { api, ApiError } from '@/lib/api-client'

type RecordStatus = 'PENDING' | 'SIGNED' | 'DECLINED' | 'EXPIRED'
type PackageStatus =
  | 'DRAFT' | 'INTERNAL_REVIEW' | 'APPROVED' | 'SENT'
  | 'PARTIALLY_SIGNED' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED'

const RECORD_STATUS: Record<RecordStatus, { label: string; icon: React.ElementType; cls: string }> = {
  PENDING:  { label: 'ממתין',   icon: Clock,        cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  SIGNED:   { label: 'חתם',     icon: CheckCircle2, cls: 'bg-green-50 text-green-700 border-green-200' },
  DECLINED: { label: 'סירב',    icon: XCircle,      cls: 'bg-red-50 text-red-700 border-red-200' },
  EXPIRED:  { label: 'פג תוקף', icon: AlertCircle,  cls: 'bg-gray-50 text-gray-700 border-gray-200' },
}

const PKG_STATUS: Record<PackageStatus, { label: string; cls: string }> = {
  DRAFT:            { label: 'טיוטה',            cls: 'bg-gray-100 text-gray-600' },
  INTERNAL_REVIEW:  { label: 'בבדיקה פנימית',   cls: 'bg-blue-100 text-blue-700' },
  APPROVED:         { label: 'מאושר',            cls: 'bg-teal-100 text-teal-700' },
  SENT:             { label: 'נשלח',             cls: 'bg-purple-100 text-purple-700' },
  PARTIALLY_SIGNED: { label: 'חלקית חתום',      cls: 'bg-orange-100 text-orange-700' },
  COMPLETED:        { label: 'הושלם',            cls: 'bg-green-100 text-green-700' },
  DECLINED:         { label: 'נדחה',             cls: 'bg-red-100 text-red-700' },
  EXPIRED:          { label: 'פג תוקף',          cls: 'bg-gray-100 text-gray-600' },
  CANCELLED:        { label: 'בוטל',             cls: 'bg-gray-100 text-gray-600' },
}

function formatDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('he-IL')
}
function formatDateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('he-IL')
}

export default function PackageDetailPage() {
  const params    = useParams()
  const router    = useRouter()
  const id        = params.id as string

  const [pkg,      setPkg]      = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [sending,  setSending]  = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Progress is supplementary — a failure there must not blank the page.
      const [pkgData, progData] = await Promise.all([
        api.get<any>(`/signatures/packages/${id}`),
        api.get<any>(`/signatures/packages/${id}/progress`).catch(() => null),
      ])
      setPkg(pkgData)
      setProgress(progData)
    } catch (e: unknown) {
      setError(e instanceof ApiError && e.status === 404
        ? 'חבילה לא נמצאה'
        : e instanceof Error ? e.message : 'שגיאה בטעינת הנתונים')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function doAction(action: string) {
    setSending(action)
    try {
      await api.patch(`/signatures/packages/${id}/${action}`)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'שגיאה בביצוע הפעולה')
    } finally {
      setSending(null)
    }
  }

  async function sendReminder(recordId: string) {
    setSending(`remind-${recordId}`)
    try {
      await api.post(`/signatures/packages/${id}/remind/${recordId}`)
      alert('תזכורת נשלחה בהצלחה')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'שגיאה בשליחת תזכורת')
    } finally {
      setSending(null)
    }
  }

  async function downloadEvidence() {
    try {
      // The API returns a short-lived signed URL; the storage key itself is
      // never sent to the browser.
      const body = await api.get<{ url?: string }>(`/signatures/packages/${id}/download`)
      if (body?.url) window.open(body.url, '_blank')
      else alert('קובץ ראיות אינו זמין')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'קובץ ראיות אינו זמין')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-primary" size={28} />
      </div>
    )
  }

  if (error || !pkg) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive font-medium">{error ?? 'שגיאה בטעינת הנתונים'}</p>
        <Button variant="outline" onClick={() => router.back()}>חזור</Button>
      </div>
    )
  }

  const status      = pkg.status as PackageStatus
  const statusCfg   = PKG_STATUS[status] ?? PKG_STATUS['DRAFT']
  const canSubmit   = status === 'DRAFT'
  const canApprove  = status === 'INTERNAL_REVIEW'
  const canSend     = status === 'APPROVED'
  const canCancel   = !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(status)
  const isActive    = ['SENT', 'PARTIALLY_SIGNED'].includes(status)
  const isCompleted = status === 'COMPLETED'

  const signed  = progress?.signed ?? 0
  const total   = progress?.total ?? 0
  const pct     = progress?.percentComplete ?? 0

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{pkg.title}</h1>
          <p className="text-sm text-muted-foreground">
            פרויקט:{' '}
            {pkg.project?.name ? (
              <Link href={`/projects/${pkg.project.id}`} className="text-primary hover:underline">
                {pkg.project.name}
              </Link>
            ) : (
              '—'
            )}
            {' · '}גרסה {pkg.version}
          </p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-sm font-medium', statusCfg.cls)}>
          {statusCfg.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="card-surface p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">
            {signed} מתוך {total} חתמו
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex gap-6 text-xs text-muted-foreground">
          <span>חובה: {progress?.signedRequired ?? 0}/{progress?.required ?? 0}</span>
          <span>דחיות: {progress?.declined ?? 0}</span>
          <span>ממתינים: {progress?.pending ?? 0}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canSubmit && (
          <Button onClick={() => doAction('submit')} disabled={!!sending}>
            {sending === 'submit' ? <RefreshCw size={14} className="animate-spin ml-1" /> : null}
            שלח לבדיקה
          </Button>
        )}
        {canApprove && (
          <Button onClick={() => doAction('approve')} disabled={!!sending}>
            {sending === 'approve' ? <RefreshCw size={14} className="animate-spin ml-1" /> : null}
            אשר חבילה
          </Button>
        )}
        {canSend && (
          <Button onClick={() => doAction('send')} disabled={!!sending}>
            {sending === 'send' ? <RefreshCw size={14} className="animate-spin ml-1" /> : null}
            <Send size={14} className="ml-1" />
            שלח לחתימה
          </Button>
        )}
        {isCompleted && (
          <Button variant="outline" onClick={downloadEvidence}>
            <Download size={14} className="ml-1" />
            הורד ראיות
          </Button>
        )}
        {canCancel && (
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => { if (confirm('לבטל את החבילה?')) doAction('cancel') }}
            disabled={!!sending}
          >
            בטל חבילה
          </Button>
        )}
      </div>

      {/* Signers list */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Users size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">חותמים</h2>
        </div>
        <div className="divide-y divide-border">
          {pkg.records?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">אין חותמים — הוסף דרך "הוסף חותם"</p>
          )}
          {pkg.records?.map((record: any) => {
            const rStatus = (record.status ?? 'PENDING') as RecordStatus
            const rCfg    = RECORD_STATUS[rStatus] ?? RECORD_STATUS['PENDING']
            const RIcon   = rCfg.icon
            return (
              <div key={record.id} className="flex items-center gap-4 px-5 py-4 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {record.owner?.fullName ?? record.ownerId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {/* Do NOT slice the id — apartment ids are not fixed-width,
                        so a blind slice(-6) turned "apt_001" into "pt_001". */}
                    {record.signerRole} · דירה {record.apartmentId}
                    {record.required ? '' : ' · לא חובה'}
                  </p>
                  {record.openedAt && (
                    <p className="text-xs text-muted-foreground">
                      נפתח: {formatDateTime(record.openedAt)}
                    </p>
                  )}
                  {record.signedAt && (
                    <p className="text-xs text-green-600 font-medium">
                      חתם: {formatDateTime(record.signedAt)}
                    </p>
                  )}
                  {record.declineReason && (
                    <p className="text-xs text-red-600">סיבת סירוב: {record.declineReason}</p>
                  )}
                </div>
                <span className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                  rCfg.cls,
                )}>
                  <RIcon size={12} />
                  {rCfg.label}
                </span>
                {isActive && rStatus === 'PENDING' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100"
                    onClick={() => sendReminder(record.id)}
                    disabled={sending === `remind-${record.id}`}
                  >
                    {sending === `remind-${record.id}`
                      ? <RefreshCw size={11} className="animate-spin" />
                      : <Send size={11} />
                    }
                    תזכורת
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Event log */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <FileText size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">יומן אירועים</h2>
        </div>
        <div className="divide-y divide-border max-h-80 overflow-y-auto">
          {pkg.events?.map((ev: any) => (
            <div key={ev.id} className="px-5 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{ev.type}</p>
                <p className="text-xs text-muted-foreground">
                  {ev.actorType}
                  {ev.ip ? ` · ${ev.ip}` : ''}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDateTime(ev.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="card-surface p-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">שיטת חתימה</p>
          <p className="font-medium">{pkg.signingOrder}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">אימות</p>
          <p className="font-medium">{pkg.verificationMethod}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">ספק</p>
          <p className="font-medium">{(pkg as any).providerName ?? 'NATIVE'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">תאריך תפוגה</p>
          <p className="font-medium">{formatDate(pkg.expiresAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">נוצר</p>
          <p className="font-medium">{formatDate(pkg.createdAt)}</p>
        </div>
        {pkg.completedAt && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">הושלם</p>
            <p className="font-medium text-green-600">{formatDate(pkg.completedAt)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
