'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreateAutomation, useUpdateAutomation, useAutomationCatalog,
  TRIGGER_LABELS, ACTION_LABELS, UNWIRED_TRIGGERS,
  type Automation, type AutomationActionInput,
} from '@/hooks/use-automations'
import { useTemplates } from '@/hooks/use-templates'

const SEND_TYPES = ['SEND_SMS', 'SEND_WHATSAPP', 'SEND_EMAIL']
const CHANNEL_FOR_TYPE: Record<string, string> = {
  SEND_SMS: 'SMS', SEND_WHATSAPP: 'WHATSAPP', SEND_EMAIL: 'EMAIL',
}

/**
 * Single-action editor.
 *
 * The API accepts up to 20 ordered actions; this dialog deliberately edits ONE.
 * A multi-action builder with drag ordering is a substantially larger piece of
 * UI, and shipping a half-built one would produce automations whose execution
 * order is unclear to the person who created them. One action covers every
 * automation that can be usefully built today, and the API is ready for more.
 */
export function AutomationEditorDialog({
  automation, onClose,
}: { automation: Automation | null; onClose: () => void }) {
  const isEdit = automation !== null
  const first = automation?.actions[0]

  const [name, setName] = useState(automation?.name ?? '')
  const [trigger, setTrigger] = useState(automation?.trigger ?? 'LEAD_CREATED')
  const [actionType, setActionType] = useState(first?.type ?? 'CREATE_TASK')
  const [taskTitle, setTaskTitle] = useState(
    (first?.config as { title?: string } | undefined)?.title ?? '',
  )
  const [notifTitle, setNotifTitle] = useState(
    (first?.config as { title?: string } | undefined)?.title ?? '',
  )
  const [templateId, setTemplateId] = useState(
    (first?.config as { templateId?: string } | undefined)?.templateId ?? '',
  )
  const [audience, setAudience] = useState(
    (first?.config as { audience?: string } | undefined)?.audience ?? 'PROJECT_RESIDENTS',
  )
  const [webhookUrl, setWebhookUrl] = useState(
    (first?.config as { url?: string } | undefined)?.url ?? '',
  )
  const [capHour, setCapHour] = useState(automation?.sendCapPerHour?.toString() ?? '')
  const [capDay, setCapDay] = useState(automation?.sendCapPerDay?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  const { data: catalog } = useAutomationCatalog()
  const isSend = SEND_TYPES.includes(actionType)
  // Only templates matching the chosen channel are valid — the API refuses a
  // mismatch with AUTOMATION_TEMPLATE_CHANNEL_MISMATCH, so filter here too.
  const { data: templates } = useTemplates(
    isSend ? { channel: CHANNEL_FOR_TYPE[actionType] as never, isActive: true } : {},
  )

  const create = useCreateAutomation()
  const update = useUpdateAutomation()
  const pending = create.isPending || update.isPending

  const buildAction = (): AutomationActionInput => {
    if (actionType === 'CREATE_TASK') {
      return { order: 0, type: actionType, config: { title: taskTitle } }
    }
    if (actionType === 'CREATE_NOTIFICATION') {
      return { order: 0, type: actionType, config: { kind: 'SYSTEM', title: notifTitle } }
    }
    if (isSend) {
      return { order: 0, type: actionType, config: { templateId, audience } }
    }
    return { order: 0, type: actionType, config: { url: webhookUrl } }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload = {
      name,
      trigger,
      actions: [buildAction()],
      ...(capHour ? { sendCapPerHour: Number(capHour) } : {}),
      ...(capDay ? { sendCapPerDay: Number(capDay) } : {}),
    }
    try {
      if (isEdit) await update.mutateAsync({ id: automation.id, ...payload })
      else await create.mutateAsync(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת האוטומציה נכשלה')
    }
  }

  const enabledActions = catalog?.actionTypes.filter((t) => t.enabled) ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog" aria-modal="true"
      aria-label={isEdit ? 'עריכת אוטומציה' : 'אוטומציה חדשה'}
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-foreground">
          {isEdit ? 'עריכת אוטומציה' : 'אוטומציה חדשה'}
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="auto-name">שם</Label>
            <Input
              id="auto-name" value={name} required maxLength={160}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: משימת מעקב על כל ליד חדש"
            />
          </div>

          <div>
            <Label htmlFor="auto-trigger">כאשר (טריגר)</Label>
            <select
              id="auto-trigger" value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {(catalog?.triggers ?? []).map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_LABELS[t] ?? t}
                  {UNWIRED_TRIGGERS.has(t) ? ' (לא מחובר עדיין)' : ''}
                </option>
              ))}
            </select>
            {UNWIRED_TRIGGERS.has(trigger) && (
              <p className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-900">
                הטריגר הזה עדיין לא נורה משום מקום במערכת. אפשר לשמור את
                האוטומציה, אבל היא לא תופעל בפועל עד שהחיבור ייבנה.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="auto-action">בצע (פעולה)</Label>
            <select
              id="auto-action" value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {enabledActions.map((t) => (
                <option key={t.type} value={t.type}>{ACTION_LABELS[t.type] ?? t.type}</option>
              ))}
            </select>
          </div>

          {actionType === 'CREATE_TASK' && (
            <div>
              <Label htmlFor="auto-task">כותרת המשימה</Label>
              <Input
                id="auto-task" value={taskTitle} required
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>
          )}

          {actionType === 'CREATE_NOTIFICATION' && (
            <div>
              <Label htmlFor="auto-notif">כותרת ההתראה</Label>
              <Input
                id="auto-notif" value={notifTitle} required
                onChange={(e) => setNotifTitle(e.target.value)}
              />
            </div>
          )}

          {isSend && (
            <>
              <div>
                <Label htmlFor="auto-template">תבנית ההודעה</Label>
                <select
                  id="auto-template" value={templateId} required
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">— בחרו תבנית —</option>
                  {(templates ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {templates && templates.length === 0 && (
                  <p className="mt-1 text-xs text-amber-800">
                    אין תבניות פעילות בערוץ זה. צרו תבנית במסך &quot;תבניות הודעה&quot; תחילה.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="auto-audience">נמענים</Label>
                <select
                  id="auto-audience" value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="PROJECT_RESIDENTS">כל דיירי הפרויקט</option>
                  <option value="RESIDENT">הדייר שהאירוע נוגע אליו</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cap-hour">מגבלה לשעה</Label>
                  <Input
                    id="cap-hour" type="number" min={1} value={capHour}
                    onChange={(e) => setCapHour(e.target.value)}
                    placeholder="ללא מגבלה"
                  />
                </div>
                <div>
                  <Label htmlFor="cap-day">מגבלה ליום</Label>
                  <Input
                    id="cap-day" type="number" min={1} value={capDay}
                    onChange={(e) => setCapDay(e.target.value)}
                    placeholder="ללא מגבלה"
                  />
                </div>
              </div>

              <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                אוטומציה ששולחת לדיירים נשמרת תמיד ב<strong>שידור יבש</strong>:
                היא מחשבת נמענים ומרנדרת את ההודעה, ומתעדת מה הייתה שולחת — בלי
                לשלוח דבר. הוצאה לאוויר היא פעולה נפרדת של מנהל. גם הפעלה מחדש
                של אוטומציה שהייתה חיה מחזירה אותה לשידור יבש.
              </p>
            </>
          )}

          {actionType === 'WEBHOOK' && (
            <div>
              <Label htmlFor="auto-url">כתובת Webhook</Label>
              <Input
                id="auto-url" type="url" value={webhookUrl} required
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.example.com/..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                חובה https, והכתובת חייבת להופיע ברשימת ההיתר של השרת. כתובות
                פנימיות (localhost, 10.x, 169.254.x) נדחות תמיד.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            אוטומציה חדשה נשמרת <strong>כבויה</strong>. הפעילו אותה מהרשימה לאחר
            שבדקתם את ההגדרות.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'שומר…' : 'שמירה'}
          </Button>
        </div>
      </form>
    </div>
  )
}
