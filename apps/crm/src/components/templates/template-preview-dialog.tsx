'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  usePreviewTemplate, CHANNEL_LABELS,
  type CommunicationTemplate, type TemplatePreview,
} from '@/hooks/use-templates'

/**
 * Renders a template against values the user types.
 *
 * The rendering happens on the SERVER, not here, deliberately: the server's
 * renderer is the one that will actually produce the message, including its
 * strictness about missing values and its single-pass substitution. A
 * client-side approximation could show a clean preview for a template that
 * fails at send time.
 */
export function TemplatePreviewDialog({
  template, onClose,
}: { template: CommunicationTemplate; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(template.variables.map((v) => [v, ''])),
  )
  const [result, setResult] = useState<TemplatePreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const preview = usePreviewTemplate()

  const run = async () => {
    setError(null)
    setResult(null)
    try {
      setResult(await preview.mutateAsync({ id: template.id, values }))
    } catch (err) {
      /**
       * The server refuses to render a template with a missing value, which is
       * the correct behaviour — but its message is English and does not name
       * the variables, because `ApiError` only carries `message` and the
       * `missing` array in the response body is dropped by the client.
       *
       * Rather than widen the API client for one screen, name the empty
       * variables here: this dialog already knows which inputs the user left
       * blank, and the server stays the authority on whether the render is
       * allowed. If the server rejects for any OTHER reason, its message is
       * still shown as-is rather than being replaced by a guess.
       */
      const missing = template.variables.filter((v) => !values[v]?.trim())
      if (missing.length > 0) {
        setError(
          `חסרים ערכים למשתנים: ${missing.map((v) => `{{${v}}}`).join(', ')}. ` +
          'הודעה לא תישלח עם משתנה שלא הוחלף.',
        )
        return
      }
      setError(err instanceof Error ? err.message : 'התצוגה המקדימה נכשלה')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="תצוגה מקדימה של תבנית"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-bold text-foreground">
          תצוגה מקדימה — {template.name}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {CHANNEL_LABELS[template.channel]}
        </p>

        {template.variables.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            לתבנית זו אין משתנים.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-foreground">
              מלאו ערכים לדוגמה לכל משתנה:
            </p>
            {template.variables.map((v) => (
              <div key={v}>
                <Label htmlFor={`var-${v}`}>{`{{${v}}}`}</Label>
                <Input
                  id={`var-${v}`}
                  value={values[v] ?? ''}
                  onChange={(e) => setValues((s) => ({ ...s, [v]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          className="mt-4"
          onClick={() => void run()}
          disabled={preview.isPending}
        >
          {preview.isPending ? 'מרנדר…' : 'הצגת תוצאה'}
        </Button>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 space-y-2 rounded-lg border border-border bg-muted/40 p-4">
            {result.subject && (
              <p className="text-sm font-medium text-foreground">
                נושא: {result.subject}
              </p>
            )}
            <p dir="rtl" className="whitespace-pre-wrap text-sm text-foreground">
              {result.body}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            סגירה
          </Button>
        </div>
      </div>
    </div>
  )
}
