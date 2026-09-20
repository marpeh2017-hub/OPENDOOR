'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { LocalizedField, Section, Callout, StatusBadge } from './fields'
import { MILESTONE_STATE_LABEL, type ProjectDocument, type ProjectMilestone } from './types'

/**
 * אבני דרך — the timeline.
 *
 * ── A MILESTONE WITH NO DATE IS COMPLETE ───────────────────────────────────
 *
 * The date field is optional and stays optional, and the screen says why. For
 * Tchernichovsky the representations were chosen and a developer is being
 * selected, and NEITHER date is verified. A CMS that treats a blank date as an
 * incomplete record teaches people to put in an approximate one, and an
 * approximate date on a public timeline is a claim nobody checked.
 *
 * ── NO GENERATED FUTURE MILESTONES ─────────────────────────────────────────
 *
 * There is deliberately no "add the standard OpenDoor process" action. It
 * would fill the timeline with steps nobody has committed to for THIS complex,
 * and a resident reading it would see a plan rather than a template.
 *
 * ── WHY EACH MILESTONE CARRIES A FACT ──────────────────────────────────────
 *
 * "The representations were chosen" is a claim about the world, so it goes
 * through verification like any other. An entry with no fact is editorial
 * ordering and travels without one; an entry that asserts something needs
 * somebody behind it.
 */
export function TabTimeline({
  doc, onChange, canEdit,
}: {
  doc: ProjectDocument
  onChange: (next: ProjectDocument) => void
  canEdit: boolean
}) {
  const milestones = [...(doc.milestones ?? [])].sort((a, b) => a.order - b.order)

  const write = (next: ProjectMilestone[]) =>
    onChange({ ...doc, milestones: next.map((m, i) => ({ ...m, order: i + 1 })) })

  const patch = (id: string, p: Partial<ProjectMilestone>) =>
    write(milestones.map((m) => (m.id === id ? { ...m, ...p } : m)))

  const move = (id: string, delta: number) => {
    const i = milestones.findIndex((m) => m.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= milestones.length) return
    const next = [...milestones]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    write(next)
  }

  const add = () =>
    write([
      ...milestones,
      {
        id: `ms-${Date.now().toString(36)}`,
        title: { he: '' },
        state: 'upcoming',
        order: milestones.length + 1,
      },
    ])

  return (
    <div className="space-y-5">
      <Callout tone="info" title="תאריך אינו חובה">
        אבן דרך בלי תאריך היא אבן דרך שלמה. תאריך משוער על ציר זמן ציבורי הוא
        טענה שאיש לא בדק, ולכן עדיף להשאיר ריק.
      </Callout>

      {canEdit && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-gray-800 transition-colors hover:bg-gray-50"
        >
          <Plus size={14} aria-hidden="true" />
          הוספת אבן דרך
        </button>
      )}

      {milestones.length === 0 ? (
        <Callout tone="info" title="אין אבני דרך">
          זה מצב תקין. עמוד פרויקט עובד גם בלי ציר זמן, ופרויקט אינו חייב ציר
          זמן כדי להתקיים.
        </Callout>
      ) : (
        milestones.map((m, i) => (
          <Section key={m.id} title={`אבן דרך ${i + 1}`}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {m.fact
                  ? <StatusBadge status={m.fact.status} />
                  : (
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-gray-600">
                      עריכתי, ללא אימות
                    </span>
                  )}
                {m.hidden && (
                  <span className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-0.5 text-[12px] font-semibold text-gray-700">
                    מוסתר
                  </span>
                )}
                <div className="ms-auto flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!canEdit || i === 0}
                    onClick={() => move(m.id, -1)}
                    aria-label={`העברת ${m.title.he || 'אבן הדרך'} למעלה`}
                    className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ArrowUp size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit || i === milestones.length - 1}
                    onClick={() => move(m.id, 1)}
                    aria-label={`העברת ${m.title.he || 'אבן הדרך'} למטה`}
                    className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ArrowDown size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => write(milestones.filter((x) => x.id !== m.id))}
                    aria-label={`מחיקת ${m.title.he || 'אבן הדרך'}`}
                    className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <LocalizedField
                label="כותרת"
                value={m.title}
                fallback="SOURCE"
                disabled={!canEdit}
                onChange={(v) => patch(m.id, { title: v.en ? { he: v.he, en: v.en } : { he: v.he } })}
              />

              <LocalizedField
                label="הערה (לא חובה)"
                value={m.note}
                fallback="OMIT"
                multiline
                disabled={!canEdit}
                onChange={(v) => patch(m.id, { note: v.he ? (v.en ? { he: v.he, en: v.en } : { he: v.he }) : undefined })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`st-${m.id}`}
                    className="block text-[12.5px] font-semibold text-gray-800"
                  >
                    מצב
                  </label>
                  <select
                    id={`st-${m.id}`}
                    value={m.state}
                    disabled={!canEdit}
                    onChange={(e) => patch(m.id, { state: e.target.value as ProjectMilestone['state'] })}
                    className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                  >
                    {Object.entries(MILESTONE_STATE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`dt-${m.id}`}
                    className="block text-[12.5px] font-semibold text-gray-800"
                  >
                    תאריך (לא חובה)
                  </label>
                  <input
                    id={`dt-${m.id}`}
                    type="date"
                    value={m.occurredAt?.slice(0, 10) ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => patch(m.id, { occurredAt: e.target.value || undefined })}
                    className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                  />
                  <p className="mt-1 text-[11.5px] leading-relaxed text-gray-600">
                    אם התאריך לא אומת, השאירו ריק. אל תמלאו הערכה.
                  </p>
                </div>
              </div>

              {m.fact && (
                <div className="rounded-lg border border-border bg-gray-50 p-3">
                  <p className="text-[12px] leading-relaxed text-gray-700">
                    אבן הדרך הזאת טוענת שמשהו קרה, ולכן היא נתון מהותי. מצב
                    האימות שלה נערך בלשונית אימות נתונים.
                  </p>
                </div>
              )}
            </div>
          </Section>
        ))
      )}
    </div>
  )
}
