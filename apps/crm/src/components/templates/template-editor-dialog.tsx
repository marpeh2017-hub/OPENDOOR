'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreateTemplate, useUpdateTemplate,
  MESSAGE_CHANNELS, CHANNEL_LABELS, TEMPLATE_LANGUAGES, LANGUAGE_LABELS,
  type CommunicationTemplate, type MessageChannel, type TemplateLanguage,
} from '@/hooks/use-templates'

/** Mirrors `PLACEHOLDER` in services/api-gateway/src/templates/template-render.ts. */
const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g

/**
 * Client-side preview of the variables the server WILL derive.
 *
 * This is presentation only. The server re-extracts on write and its result is
 * authoritative — this exists so the author sees the effect of their typing
 * immediately, not so the client decides anything.
 */
function extractVariables(...parts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  for (const part of parts) {
    if (!part) continue
    for (const m of part.matchAll(PLACEHOLDER)) seen.add(m[1]!)
  }
  return [...seen]
}

export function TemplateEditorDialog({
  template, onClose,
}: { template: CommunicationTemplate | null; onClose: () => void }) {
  const isEdit = template !== null

  const [name, setName] = useState(template?.name ?? '')
  const [channel, setChannel] = useState<MessageChannel>(template?.channel ?? 'SMS')
  const [language, setLanguage] = useState<TemplateLanguage>(template?.language ?? 'he')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [isActive, setIsActive] = useState(template?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)

  const create = useCreateTemplate()
  const update = useUpdateTemplate()
  const pending = create.isPending || update.isPending

  const variables = useMemo(
    () => extractVariables(body, channel === 'EMAIL' ? subject : null),
    [body, subject, channel],
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      if (isEdit) {
        // `channel` and `language` are immutable server-side — they are part of
        // the uniqueness key and changing one would silently collide with a
        // different template. The inputs are disabled in edit mode to match.
        await update.mutateAsync({
          id: template.id,
          name,
          body,
          subject: channel === 'EMAIL' ? subject : undefined,
          isActive,
        })
      } else {
        await create.mutateAsync({
          name, channel, language, body, isActive,
          // Only EMAIL may carry a subject; the server 400s otherwise rather
          // than silently discarding the author's text.
          ...(channel === 'EMAIL' && subject ? { subject } : {}),
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת התבנית נכשלה')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'עריכת תבנית' : 'תבנית חדשה'}
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-foreground">
          {isEdit ? 'עריכת תבנית' : 'תבנית חדשה'}
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="tpl-name">שם התבנית</Label>
            <Input
              id="tpl-name" value={name} required maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: תזכורת לחתימה"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tpl-channel">ערוץ</Label>
              <select
                id="tpl-channel"
                value={channel}
                disabled={isEdit}
                onChange={(e) => setChannel(e.target.value as MessageChannel)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm disabled:opacity-60"
              >
                {MESSAGE_CHANNELS.map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                ))}
              </select>
              {isEdit && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ערוץ ושפה אינם ניתנים לשינוי — הם חלק מהמפתח הייחודי של התבנית.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="tpl-lang">שפה</Label>
              <select
                id="tpl-lang"
                value={language}
                disabled={isEdit}
                onChange={(e) => setLanguage(e.target.value as TemplateLanguage)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm disabled:opacity-60"
              >
                {TEMPLATE_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>

          {channel === 'EMAIL' && (
            <div>
              <Label htmlFor="tpl-subject">נושא (אימייל בלבד)</Label>
              <Input
                id="tpl-subject" value={subject} maxLength={300}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="tpl-body">גוף ההודעה</Label>
            <textarea
              id="tpl-body"
              value={body}
              required
              maxLength={4000}
              rows={8}
              onChange={(e) => setBody(e.target.value)}
              dir="rtl"
              className="w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="שלום {{firstName}}, נבקש את חתימתכם על מסמכי הפרויקט."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              השתמשו ב-<code className="rounded bg-gray-100 px-1">{'{{שם_משתנה}}'}</code>{' '}
              באנגלית כדי לשלב ערכים. ערך חסר בזמן שליחה יעצור את ההודעה — הדייר
              לעולם לא יקבל טקסט עם משתנה שלא הוחלף.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground">
              משתנים שזוהו ({variables.length})
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              נגזרים אוטומטית מהטקסט על ידי השרת — אינם ניתנים לעריכה ידנית.
            </p>
            {variables.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {variables.map((v) => (
                  <code key={v} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            תבנית פעילה
          </label>

          {channel === 'WHATSAPP' && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              תבנית וואטסאפ חדשה נשמרת כ<strong>לא מאושרת</strong>. אישור הספק
              מתועד בנפרד על ידי מנהל. עריכת הנוסח של תבנית מאושרת מבטלת את
              האישור אוטומטית — הספק אישר נוסח מסוים, לא שורה במסד הנתונים.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
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
