'use client'

import { AlertTriangle, CheckCircle2, ShieldCheck, Layers, FolderKanban } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/skeletons'
import { useDqSummary, type DqSeverity } from '@/hooks/use-data-quality'
import { CATEGORY_LABEL, SEVERITY_CFG, formatDateTime, scoreTone } from './dq-constants'

const SEVERITY_ORDER: DqSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

export function DqDashboard() {
  const { data, isLoading, isError, error, refetch } = useDqSummary()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="card-surface p-6 text-center space-y-3" role="alert">
        <AlertTriangle className="mx-auto text-red-600" size={22} />
        <p className="text-sm text-foreground">שגיאה בטעינת נתוני איכות</p>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : 'נסו שוב מאוחר יותר'}
        </p>
        <button onClick={() => refetch()} className="text-sm text-teal-600 hover:underline">
          נסו שוב
        </button>
      </div>
    )
  }

  const tone = scoreTone(data.score)
  const categories = Object.entries(data.byCategory).sort((a, b) => b[1] - a[1])
  const maxProject = Math.max(1, ...data.byProject.map(p => p.count))

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">ציון איכות נתונים</span>
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-teal-50 dark:bg-teal-900/20">
              <ShieldCheck size={18} className="text-teal-600" />
            </div>
          </div>
          <p className={`text-3xl font-bold ${tone.text}`}>{data.score}<span className="text-base font-normal text-muted-foreground">/100</span></p>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${data.score}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{tone.label} · {data.recordCount.toLocaleString('he-IL')} רשומות נבדקו</p>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">בעיות פתוחות</span>
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-900/20">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-foreground">{data.openIssues.toLocaleString('he-IL')}</p>
          <p className="text-xs text-muted-foreground">
            {data.bySeverity.CRITICAL} קריטיות · {data.bySeverity.HIGH} גבוהות
          </p>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">טופלו</span>
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-green-50 dark:bg-green-900/20">
              <CheckCircle2 size={18} className="text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-foreground">{data.resolvedIssues.toLocaleString('he-IL')}</p>
          <p className="text-xs text-muted-foreground">{data.ignoredIssues} הוסתרו ידנית</p>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">סריקה אחרונה</span>
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
              <Layers size={18} className="text-blue-600" />
            </div>
          </div>
          <p className="text-lg font-bold text-foreground">
            {data.lastScan ? formatDateTime(data.lastScan.startedAt) : 'טרם בוצעה'}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.lastScan
              ? `${data.lastScan.ruleCount} כללים · ${data.lastScan.durationMs ?? 0} מ״ש`
              : 'הריצו סריקה כדי לאתר בעיות'}
          </p>
        </div>
      </div>

      {/* Breakdown row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">לפי חומרה</h2>
          <ul className="space-y-2">
            {SEVERITY_ORDER.map(sev => {
              const count = data.bySeverity[sev] ?? 0
              const pct = data.openIssues > 0 ? (count / data.openIssues) * 100 : 0
              return (
                <li key={sev} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={`h-2 w-2 rounded-full ${SEVERITY_CFG[sev].dot}`} />
                      {SEVERITY_CFG[sev].label}
                    </span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${SEVERITY_CFG[sev].dot}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="card-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">לפי קטגוריה</h2>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">אין בעיות פתוחות</p>
          ) : (
            <ul className="space-y-2">
              {categories.map(([cat, count]) => (
                <li key={cat} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? cat}
                  </span>
                  <span className="font-semibold text-foreground">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FolderKanban size={15} className="text-muted-foreground" />
            לפי פרויקט
          </h2>
          {data.byProject.length === 0 ? (
            <p className="text-xs text-muted-foreground">אין בעיות פתוחות</p>
          ) : (
            <ul className="space-y-2">
              {data.byProject.slice(0, 6).map(p => (
                <li key={p.projectId ?? 'none'} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="truncate text-muted-foreground">{p.projectName ?? 'ללא פרויקט'}</span>
                    <span className="font-semibold text-foreground shrink-0">{p.count}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${(p.count / maxProject) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Trend */}
      {data.trend.length > 1 && (
        <div className="card-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">מגמה — בעיות שנמצאו מול בעיות שנסגרו</h2>
          <div className="flex items-end gap-1 h-24 overflow-x-auto">
            {data.trend.map(t => {
              const max = Math.max(1, ...data.trend.map(x => x.issuesFound))
              return (
                <div
                  key={t.id}
                  className="flex flex-col justify-end items-center gap-0.5 min-w-3 flex-1"
                  title={`${formatDateTime(t.startedAt)} · ${t.issuesFound} נמצאו, ${t.issuesResolved} נסגרו`}
                >
                  <div className="w-full rounded-t bg-red-400" style={{ height: `${(t.issuesFound / max) * 70}px` }} />
                  <div className="w-full rounded-b bg-green-400" style={{ height: `${(t.issuesResolved / max) * 70}px` }} />
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-400" /> נמצאו</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-green-400" /> נסגרו</span>
          </div>
        </div>
      )}
    </div>
  )
}
