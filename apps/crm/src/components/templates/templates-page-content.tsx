'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, Eye, ShieldCheck, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useTemplates, useDeleteTemplate, useSetTemplateApproval,
  useCanWriteTemplates, useCanApproveTemplates,
  CHANNEL_LABELS, LANGUAGE_LABELS, MESSAGE_CHANNELS,
  type CommunicationTemplate, type MessageChannel,
} from '@/hooks/use-templates'
import { TemplateEditorDialog } from './template-editor-dialog'
import { TemplatePreviewDialog } from './template-preview-dialog'

/**
 * The communication template library.
 *
 * Two things this screen is careful about, because both are easy to get wrong
 * in a way that only shows up when a resident receives something:
 *
 *   - `variables` is displayed as DERIVED output, never as an editable field.
 *     The server extracts it from the body text; showing it as an input would
 *     imply the two can disagree.
 *   - a WhatsApp template that is not provider-approved is marked clearly.
 *     Sending on an unapproved template fails at the provider, not here, so the
 *     warning has to be visible at authoring time.
 */
export function TemplatesPageContent() {
  const [channel, setChannel] = useState<MessageChannel | 'ALL'>('ALL')
  const [editing, setEditing] = useState<CommunicationTemplate | 'new' | null>(null)
  const [previewing, setPreviewing] = useState<CommunicationTemplate | null>(null)

  const filters = useMemo(
    () => (channel === 'ALL' ? {} : { channel }),
    [channel],
  )
  const { data, isLoading, error, refetch } = useTemplates(filters)
  const remove = useDeleteTemplate()
  const setApproval = useSetTemplateApproval()

  const canWrite = useCanWriteTemplates()
  const canApprove = useCanApproveTemplates()

  const onDelete = async (t: CommunicationTemplate) => {
    if (!window.confirm(`למחוק את התבנית "${t.name}"?`)) return
    try {
      await remove.mutateAsync(t.id)
    } catch (err) {
      // The server refuses to delete a template that has already sent messages
      // (409 TEMPLATE_IN_USE) so the message history keeps its provenance.
      // Surface that reason rather than a generic failure.
      window.alert(err instanceof Error ? err.message : 'מחיקת התבנית נכשלה')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={channel === 'ALL'} onClick={() => setChannel('ALL')}>
            הכול
          </FilterChip>
          {MESSAGE_CHANNELS.map((c) => (
            <FilterChip key={c} active={channel === c} onClick={() => setChannel(c)}>
              {CHANNEL_LABELS[c]}
            </FilterChip>
          ))}
        </div>

        {canWrite && (
          <Button onClick={() => setEditing('new')} className="gap-1.5">
            <Plus className="h-4 w-4" />
            תבנית חדשה
          </Button>
        )}
      </div>

      {isLoading && <RowsSkeleton rows={4} />}
      {error && <QueryError message="טעינת התבניות נכשלה" error={error} onRetry={() => void refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          message="אין עדיין תבניות"
          hint={canWrite
            ? 'תבנית מגדירה את נוסח ההודעה שנשלחת לדיירים, עם משתנים כמו {{firstName}}.'
            : 'אין לכם הרשאה ליצור תבניות.'}
        />
      )}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((t) => (
            <article
              key={t.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{t.name}</h3>
                    <Badge variant="secondary">{CHANNEL_LABELS[t.channel]}</Badge>
                    <Badge variant="outline">{LANGUAGE_LABELS[t.language]}</Badge>
                    {!t.isActive && <Badge variant="outline">לא פעילה</Badge>}
                    {t.channel === 'WHATSAPP' && (
                      t.isApproved
                        ? <Badge className="gap-1 bg-green-100 text-green-800">
                            <ShieldCheck className="h-3 w-3" /> מאושרת
                          </Badge>
                        : <Badge className="gap-1 bg-amber-100 text-amber-900">
                            <ShieldAlert className="h-3 w-3" /> ממתינה לאישור וואטסאפ
                          </Badge>
                    )}
                  </div>

                  {t.subject && (
                    <p className="text-sm text-muted-foreground">נושא: {t.subject}</p>
                  )}
                  <p className="whitespace-pre-wrap text-sm text-foreground/80 line-clamp-3">
                    {t.body}
                  </p>

                  {t.variables.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      משתנים (נגזרים אוטומטית מהטקסט):{' '}
                      {t.variables.map((v) => (
                        <code key={v} className="mx-0.5 rounded bg-gray-100 px-1 py-0.5">
                          {`{{${v}}}`}
                        </code>
                      ))}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="outline" size="sm" className="gap-1.5"
                    onClick={() => setPreviewing(t)}
                  >
                    <Eye className="h-4 w-4" />
                    תצוגה מקדימה
                  </Button>

                  {canApprove && t.channel === 'WHATSAPP' && (
                    <Button
                      variant="outline" size="sm"
                      disabled={setApproval.isPending}
                      onClick={() => setApproval.mutate({ id: t.id, isApproved: !t.isApproved })}
                    >
                      {t.isApproved ? 'בטלו אישור' : 'סמנו כמאושרת'}
                    </Button>
                  )}

                  {canWrite && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                        עריכה
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="text-red-600 hover:bg-red-50"
                        disabled={remove.isPending}
                        onClick={() => void onDelete(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditorDialog
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {previewing && (
        <TemplatePreviewDialog
          template={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-teal-600 bg-teal-600 text-white'
          : 'border-border text-muted-foreground hover:bg-gray-100',
      )}
    >
      {children}
    </button>
  )
}
