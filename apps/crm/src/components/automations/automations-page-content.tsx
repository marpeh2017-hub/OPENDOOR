'use client'

import { useState } from 'react'
import { Zap, AlertTriangle, Radio, FlaskConical, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import {
  useAutomations, useArmedAutomations, useAutomationCatalog,
  useDeleteAutomation, useUpdateAutomation, useSetAutomationDryRun,
  useCanWriteAutomations, useCanGoLive,
  TRIGGER_LABELS, ACTION_LABELS, UNWIRED_TRIGGERS,
  type Automation,
} from '@/hooks/use-automations'
import { AutomationEditorDialog } from './automation-editor-dialog'

/**
 * Automations screen.
 *
 * The design priority here is that a person can answer, at a glance, the only
 * question that carries real-world consequences: WILL THIS CONTACT A RESIDENT?
 * An automation can be active and still send nothing (dry run), so "active" on
 * its own is a misleading signal and is never shown alone for an outbound
 * automation.
 */
export function AutomationsPageContent() {
  const [editing, setEditing] = useState<Automation | 'new' | null>(null)

  const { data, isLoading, error, refetch } = useAutomations()
  const { data: armed } = useArmedAutomations()
  const { data: catalog } = useAutomationCatalog()

  const remove = useDeleteAutomation()
  const update = useUpdateAutomation()
  const setDryRun = useSetAutomationDryRun()

  const canWrite = useCanWriteAutomations()
  const canGoLive = useCanGoLive()

  const liveSenders = armed?.filter((a) => a.willActuallySend) ?? []

  const onDelete = async (a: Automation) => {
    if (!window.confirm(`למחוק את האוטומציה "${a.name}"?`)) return
    try { await remove.mutateAsync(a.id) } catch (err) {
      window.alert(err instanceof Error ? err.message : 'המחיקה נכשלה')
    }
  }

  const onGoLive = async (a: Automation) => {
    const msg = a.dryRun
      ? `להוציא את "${a.name}" משידור יבש?\n\nמרגע זה דיירים אמיתיים יקבלו הודעות אמיתיות. לא ניתן לבטל הודעה שנשלחה.`
      : `להחזיר את "${a.name}" לשידור יבש? היא תפסיק לשלוח בפועל.`
    if (!window.confirm(msg)) return
    try { await setDryRun.mutateAsync({ id: a.id, dryRun: !a.dryRun }) } catch (err) {
      window.alert(err instanceof Error ? err.message : 'הפעולה נכשלה')
    }
  }

  return (
    <div className="space-y-4">
      {/* The operational summary, from GET /automations/armed. */}
      {liveSenders.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <Radio className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              {liveSenders.length} אוטומציות פעילות שולחות כרגע לדיירים אמיתיים
            </p>
            <p className="mt-0.5">
              {liveSenders.map((a) => a.name).join(' · ')}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        {canWrite && (
          <Button onClick={() => setEditing('new')} className="gap-1.5">
            <Plus className="h-4 w-4" />
            אוטומציה חדשה
          </Button>
        )}
      </div>

      {isLoading && <RowsSkeleton rows={3} />}
      {error && <QueryError message="טעינת האוטומציות נכשלה" error={error} onRetry={() => void refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          message="אין עדיין אוטומציות"
          hint={canWrite
            ? 'אוטומציה מגיבה לאירוע במערכת — למשל יצירת ליד — ומבצעת פעולה אוטומטית.'
            : 'אין לכם הרשאה ליצור אוטומציות.'}
        />
      )}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((a) => {
            const outbound = a.actions.some(
              (act) => act.type.startsWith('SEND_') || act.type === 'WEBHOOK',
            )
            const unwired = UNWIRED_TRIGGERS.has(a.trigger)

            return (
              <article key={a.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Zap className="h-4 w-4 text-teal-600" />
                      <h3 className="font-semibold text-foreground">{a.name}</h3>

                      {a.isActive
                        ? <Badge className="bg-green-100 text-green-800">פעילה</Badge>
                        : <Badge variant="outline">כבויה</Badge>}

                      {/* For an outbound automation, "active" alone is not the
                          whole story — say explicitly whether it sends. */}
                      {outbound && (
                        a.dryRun
                          ? <Badge className="gap-1 bg-blue-100 text-blue-800">
                              <FlaskConical className="h-3 w-3" /> שידור יבש — לא שולחת
                            </Badge>
                          : <Badge className="gap-1 bg-red-100 text-red-800">
                              <Radio className="h-3 w-3" /> חי — שולחת לדיירים
                            </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      כאשר: <strong className="text-foreground">
                        {TRIGGER_LABELS[a.trigger] ?? a.trigger}
                      </strong>
                    </p>

                    {unwired && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        הטריגר הזה עדיין לא מחובר לשום אירוע במערכת — האוטומציה
                        לא תופעל בפועל.
                      </p>
                    )}

                    <p className="text-sm text-muted-foreground">
                      פעולות: {a.actions.map((act) => ACTION_LABELS[act.type] ?? act.type).join(' → ')}
                    </p>

                    {a.actions.some((act) => act.delayMinutes > 0) && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        השהיה מוגדרת אך אינה נתמכת עדיין — הפעולות ירוצו מיד.
                      </p>
                    )}

                    {outbound && (a.sendCapPerHour || a.sendCapPerDay) && (
                      <p className="text-xs text-muted-foreground">
                        מגבלת שליחה:{' '}
                        {a.sendCapPerHour ? `${a.sendCapPerHour} לשעה` : null}
                        {a.sendCapPerHour && a.sendCapPerDay ? ' · ' : null}
                        {a.sendCapPerDay ? `${a.sendCapPerDay} ליום` : null}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {/* Hebrew does not take a plural noun after 1, so
                          "הופעלה 1 פעמים" is ungrammatical. */}
                      {a.runCount === 1 ? 'הופעלה פעם אחת' : `הופעלה ${a.runCount} פעמים`}
                      {a.lastRunAt
                        ? ` · לאחרונה ${new Date(a.lastRunAt).toLocaleString('he-IL')}`
                        : ' · טרם רצה'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {canWrite && (
                      <Button
                        variant="outline" size="sm"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: a.id, isActive: !a.isActive })}
                      >
                        {a.isActive ? 'כיבוי' : 'הפעלה'}
                      </Button>
                    )}

                    {canGoLive && outbound && (
                      <Button
                        variant="outline" size="sm"
                        disabled={setDryRun.isPending}
                        className={a.dryRun ? 'text-red-600 hover:bg-red-50' : ''}
                        onClick={() => void onGoLive(a)}
                      >
                        {a.dryRun ? 'הוצאה לאוויר' : 'חזרה לשידור יבש'}
                      </Button>
                    )}

                    {canWrite && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                          עריכה
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-red-600 hover:bg-red-50"
                          disabled={remove.isPending}
                          onClick={() => void onDelete(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Honest about what the engine cannot do, sourced from the server. */}
      {catalog && catalog.actionTypes.some((t) => !t.enabled) && (
        <section className="rounded-lg border border-border bg-muted/40 p-4">
          <h2 className="text-sm font-semibold text-foreground">
            פעולות שאינן זמינות עדיין
          </h2>
          <ul className="mt-2 space-y-1.5">
            {catalog.actionTypes.filter((t) => !t.enabled).map((t) => (
              <li key={t.type} className="text-xs text-muted-foreground">
                <strong className="text-foreground">
                  {ACTION_LABELS[t.type] ?? t.type}
                </strong>
                {t.disabledReason ? ` — ${t.disabledReason}` : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <AutomationEditorDialog
          automation={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
