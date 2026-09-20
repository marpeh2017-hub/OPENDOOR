'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, CheckCircle2, EyeOff, History,
  Lightbulb, PlayCircle, RotateCcw, Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useCanManageDq, useDqIssue, useDqTransition,
} from '@/hooks/use-data-quality'
import {
  CATEGORY_LABEL, ENTITY_LABEL, SEVERITY_CFG, STATUS_CFG, formatDateTime,
} from './dq-constants'

export function DqIssueDetail({ issueId }: { issueId: string }) {
  const { data, isLoading, isError, error, refetch } = useDqIssue(issueId)
  const canManage = useCanManageDq()
  const [note, setNote] = useState('')

  const resolve = useDqTransition('resolve')
  const ignore  = useDqTransition('ignore')
  const reopen  = useDqTransition('reopen')
  const start   = useDqTransition('start')
  const pending = resolve.isPending || ignore.isPending || reopen.isPending || start.isPending
  const failure = [resolve, ignore, reopen, start].find(m => m.isError)

  if (isLoading) {
    return <div className="card-surface p-8 text-center text-sm text-muted-foreground">טוען פרטי בעיה...</div>
  }

  if (isError || !data) {
    return (
      <div className="card-surface p-8 text-center space-y-2" role="alert">
        <AlertTriangle className="mx-auto text-red-600" size={20} />
        <p className="text-sm text-foreground">לא ניתן לטעון את פרטי הבעיה</p>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : 'ייתכן שהבעיה נמחקה או שאין לכם הרשאה'}
        </p>
        <button onClick={() => refetch()} className="text-sm text-teal-600 hover:underline">נסו שוב</button>
      </div>
    )
  }

  const sev = SEVERITY_CFG[data.severity]
  const st  = STATUS_CFG[data.status]
  const run = (m: { mutate: (v: { id: string; note?: string }) => void }) =>
    m.mutate({ id: data.id, note: note.trim() || undefined })

  return (
    <div className="space-y-4">
      <Link href="../data-quality" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight size={15} />
        חזרה לרשימת הבעיות
      </Link>

      <div className="card-surface p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sev.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                {sev.label}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${st.badge}`}>
                {st.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {CATEGORY_LABEL[data.category] ?? data.category}
              </span>
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600" dir="ltr">
                {data.issueType}
              </code>
            </div>
            <h1 className="text-xl font-bold text-foreground">{data.title}</h1>
          </div>

          {data.deepLink && (
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link href={data.deepLink}>
                <Target size={14} />
                מעבר לרשומה
              </Link>
            </Button>
          )}
        </div>

        <section className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">מה הבעיה</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.description}</p>
        </section>

        {data.impact && (
          <section className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle size={15} />
              למה זה חשוב
            </h2>
            <p className="text-sm text-amber-800 leading-relaxed">{data.impact}</p>
          </section>
        )}

        {data.recommendation && (
          <section className="space-y-1 rounded-lg border border-teal-200 bg-teal-50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-teal-900">
              <Lightbulb size={15} />
              פעולה מומלצת
            </h2>
            <p className="text-sm text-teal-800 leading-relaxed">{data.recommendation}</p>
            <p className="text-xs text-teal-700/80">
              המערכת אינה מבצעת תיקונים אוטומטיים — איחוד, מחיקה ושינוי בעלות מחייבים פעולה ידנית.
            </p>
          </section>
        )}

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">רשומה מושפעת</dt>
            <dd className="font-medium text-foreground">{data.entityLabel}</dd>
            <dd className="text-xs text-muted-foreground">{ENTITY_LABEL[data.entityType] ?? data.entityType}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">פרויקט</dt>
            <dd className="font-medium text-foreground">{data.projectName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">אותרה לראשונה</dt>
            <dd className="font-medium text-foreground">{formatDateTime(data.detectedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">נצפתה לאחרונה</dt>
            <dd className="font-medium text-foreground">{formatDateTime(data.lastSeenAt)}</dd>
          </div>
        </dl>

        {data.resolvedAt && (
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            נסגרה ב-{formatDateTime(data.resolvedAt)}
            {data.resolvedBy ? ` על ידי ${data.resolvedBy.firstName} ${data.resolvedBy.lastName}` : ''}
            {data.resolutionType === 'AUTO' ? ' (סגירה אוטומטית בסריקה)' : ''}
            {data.resolutionNote ? ` — ${data.resolutionNote}` : ''}
          </p>
        )}
      </div>

      {/* Actions — manager roles only */}
      {canManage ? (
        <div className="card-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">עדכון סטטוס</h2>
          <Input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="הערה (אופציונלי) — תישמר ביומן הביקורת"
            className="h-9 text-sm"
            dir="rtl"
            aria-label="הערת טיפול"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-2" disabled={pending || data.status === 'RESOLVED'} onClick={() => run(resolve)}>
              <CheckCircle2 size={14} /> סימון כטופל
            </Button>
            <Button size="sm" variant="outline" className="gap-2" disabled={pending || data.status === 'IN_PROGRESS'} onClick={() => run(start)}>
              <PlayCircle size={14} /> העברה לטיפול
            </Button>
            <Button size="sm" variant="outline" className="gap-2" disabled={pending || data.status === 'IGNORED'} onClick={() => run(ignore)}>
              <EyeOff size={14} /> התעלמות
            </Button>
            <Button size="sm" variant="outline" className="gap-2" disabled={pending || data.status === 'OPEN'} onClick={() => run(reopen)}>
              <RotateCcw size={14} /> פתיחה מחדש
            </Button>
          </div>
          {failure && (
            <p className="text-xs text-red-700" role="alert">
              הפעולה נכשלה: {failure.error instanceof Error ? failure.error.message : 'שגיאה לא ידועה'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            בעיה שסומנה כ״התעלמות״ לא תיפתח מחדש על ידי סריקות עתידיות.
          </p>
        </div>
      ) : (
        <p className="card-surface p-4 text-xs text-muted-foreground">
          עדכון סטטוס בעיות איכות נתונים מותר למנהלי פרויקט ומעלה.
        </p>
      )}

      {/* Resolution history */}
      <div className="card-surface p-5 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History size={15} className="text-muted-foreground" />
          היסטוריית טיפול
        </h2>
        {data.history.length === 0 ? (
          <p className="text-xs text-muted-foreground">לא בוצעו שינויי סטטוס ידניים בבעיה זו.</p>
        ) : (
          <ol className="space-y-3">
            {data.history.map(h => (
              <li key={h.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                <div>
                  <p className="text-foreground">
                    {h.changes?.before?.status ?? '—'} ← {h.changes?.after?.status ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(h.createdAt)}
                    {h.user ? ` · ${h.user.firstName} ${h.user.lastName}` : ' · מערכת'}
                  </p>
                  {typeof h.metadata?.['note'] === 'string' && h.metadata['note'] && (
                    <p className="text-xs text-muted-foreground">״{h.metadata['note'] as string}״</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
