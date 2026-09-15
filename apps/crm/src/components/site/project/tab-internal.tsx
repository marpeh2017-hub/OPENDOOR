'use client'

import { AlertTriangle, Check, FileSearch, MapPin, Plus, Trash2, X } from 'lucide-react'
import { PrivateBanner, Section, Callout, Row } from './fields'
import {
  SOURCE_TYPE_LABEL, QUALITY_LABEL, REVIEW_STATE_LABEL, factLabel,
  type ProjectDocument, type ProjectSource,
} from './types'

/**
 * מידע פנימי — the project's real workspace.
 *
 * ── THIS TAB HAS NO PUBLISHING ACTION, ON PURPOSE ──────────────────────────
 *
 * Not "the publish button is hidden here". There is no control on this tab,
 * and no field in this subtree, that any publication path reads: the gateway's
 * `projectProjection` never reads `internal` at all. So the promise in the
 * banner is a statement about the architecture rather than about this screen's
 * buttons, and it stays true if somebody later adds a button by mistake.
 *
 * ── WHY THE CANDIDATE ADDRESSES ARE THE CENTREPIECE ────────────────────────
 *
 * For Tchernichovsky the boundary IS the open question. Ten addresses appear
 * in the workbook, one more (טשרניחובסקי 42) conspicuously does not, and a
 * parcel exists whose address nobody can resolve. Presenting that as a settled
 * list with a map would answer the question by drawing it. So it is presented
 * as what it is: candidates, with the one absence written down explicitly.
 */
export function TabInternal({
  doc, onChange, canEdit,
}: {
  doc: ProjectDocument
  onChange: (next: ProjectDocument) => void
  canEdit: boolean
}) {
  const internal = doc.internal ?? {}
  const candidates = internal.candidateAddresses ?? []
  const inWorkbook = candidates.filter((c) => c.inWorkbook)
  const notInWorkbook = candidates.filter((c) => !c.inWorkbook)
  const flags = internal.dataQualityFlags ?? []
  const blocking = flags.filter((f) => !f.resolved && f.severity === 'BLOCKING')
  const nonBlocking = flags.filter((f) => !f.resolved && f.severity !== 'BLOCKING')

  const empty =
    candidates.length === 0 && (internal.blocks ?? []).length === 0 &&
    flags.length === 0 && !internal.notes && (internal.observations ?? []).length === 0

  const sources = doc.sources ?? []

  const writeSources = (next: ProjectSource[]) => onChange({ ...doc, sources: next })

  const patchSource = (id: string, p: Partial<ProjectSource>) =>
    writeSources(sources.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const addSource = () =>
    writeSources([
      ...sources,
      {
        id: `src-${Date.now().toString(36)}`,
        type: 'OTHER', label: '', quality: 'UNKNOWN', reviewState: 'UNREVIEWED',
      },
    ])

  const removeSource = (id: string) => writeSources(sources.filter((s) => s.id !== id))

  /**
   * Which facts point at this source, by dotted path.
   *
   * Computed by scanning the document rather than stored on the source,
   * because a fact's `sourceId` is the single place that relationship is
   * recorded — keeping a second, denormalised list here would let the two
   * disagree the first time a fact's source changes without this list being
   * updated in step.
   */
  const dependentFacts = (sourceId: string): string[] => {
    const out: string[] = []
    if (doc.public.currentStage?.sourceId === sourceId) out.push(factLabel('public.currentStage'))
    for (const [key, fact] of Object.entries(doc.public.facts ?? {})) {
      if (fact.sourceId === sourceId) out.push(factLabel(`public.facts.${key}`))
    }
    for (const m of doc.milestones ?? []) {
      if (m.fact?.sourceId === sourceId) out.push(`אבן דרך: ${m.title.he}`)
    }
    return out
  }

  return (
    <div className="space-y-5">
      <PrivateBanner level="INTERNAL" />

      {empty && (
        <Callout tone="info" title="אין מידע פנימי לפרויקט הזה">
          זה מצב תקין. פרויקט אינו חייב מידע פנימי כדי להתקיים במערכת.
        </Callout>
      )}

      {internal.boundaryNote && (
        <Callout tone="warning" title="גבול המתחם">
          {internal.boundaryNote}
        </Callout>
      )}

      {candidates.length > 0 && (
        <Section
          title="כתובות מועמדות"
          description="הכתובות שנבדקות כחלק מהמתחם. זו רשימת מועמדות ולא גבול מאושר, ולכן העמוד הציבורי מציג עיר בלבד."
        >
          <ul className="space-y-1.5">
            {inWorkbook.map((c) => (
              <li
                key={c.address}
                className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
              >
                <MapPin size={15} className="flex-shrink-0 text-gray-600" aria-hidden="true" />
                <span className="text-[13px] text-gray-900">{c.address}</span>
                <span className="ms-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11.5px] text-gray-600">
                  <Check size={11} aria-hidden="true" />
                  מופיע בקובץ
                </span>
              </li>
            ))}
          </ul>

          {/*
            The absence, written down.
            A gap in a numbered street reads as an oversight, and the next
            person to look would "helpfully" add it. Recording that the
            workbook does not mention it turns a silent gap into a fact.
          */}
          {notInWorkbook.length > 0 && (
            <div className="mt-4">
              <h4 className="text-[13px] font-bold text-gray-900">נבדק ואינו בקובץ</h4>
              <ul className="mt-2 space-y-2">
                {notInWorkbook.map((c) => (
                  <li key={c.address} className="rounded-lg border border-[#d8cdb8] bg-[#f4f1ec] p-3">
                    <div className="flex items-center gap-2">
                      <X size={14} className="flex-shrink-0 text-[#7d6234]" aria-hidden="true" />
                      <span className="text-[13px] font-semibold text-gray-900">{c.address}</span>
                    </div>
                    {c.note && (
                      <p className="mt-1 text-[12px] leading-relaxed text-[#7d6234]">{c.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {(internal.blocks ?? []).length > 0 && (
        <Section
          title="גוש וחלקה"
          description="רישום מקרקעין. אינו מתפרסם בשום מצב."
        >
          <ul className="space-y-2">
            {internal.blocks!.map((b, i) => (
              <li key={`${b.block}-${i}`} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-gray-900">
                    {b.block}{b.parcel ? ` · ${b.parcel}` : ''}
                  </span>
                  {b.needsInvestigation && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#d8cdb8] bg-[#f4f1ec] px-2 py-0.5 text-[11.5px] font-semibold text-[#7d6234]">
                      <FileSearch size={11} aria-hidden="true" />
                      דורש בדיקה
                    </span>
                  )}
                </div>
                {b.note && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-gray-700">{b.note}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {internal.existingConditions && Object.keys(internal.existingConditions).length > 0 && (
        <Section
          title="מצב קיים"
          description="נתוני המצב הקיים כפי שהם מופיעים במקורות. לא נבדקו מול מקור עצמאי."
        >
          <dl>
            {Object.entries(internal.existingConditions).map(([k, v]) => (
              <Row key={k} label={EXISTING_LABEL[k] ?? k}>
                <span className="font-mono" dir="ltr">{String(v)}</span>
              </Row>
            ))}
          </dl>
        </Section>
      )}

      {/* ── §16 · Data quality ─────────────────────────────────────────── */}
      {flags.length > 0 && (
        <Section
          title="בעיות איכות נתונים"
          description="בעיה חוסמת מונעת אימות של הנתונים שהיא מציינת בשמם, ורק שלהם. היא אינה מקפיאה נתוני תהליך שאין לה קשר אליהם."
        >
          <div className="space-y-2.5">
            {blocking.map((f) => (
              <div key={f.id} className="rounded-lg border border-red-300 bg-red-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-red-700" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-red-800">
                      חוסם · {f.label}
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-red-800">{f.detail}</p>
                    {(f.blocks ?? []).length > 0 && (
                      <p className="mt-1.5 text-[12px] text-red-800">
                        <span className="font-semibold">חוסם את: </span>
                        {f.blocks!.map((b) => b.replace('public.facts.', '')).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {nonBlocking.map((f) => (
              <div key={f.id} className="rounded-lg border border-[#d8cdb8] bg-[#f4f1ec] p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-[#7d6234]" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#7d6234]">{f.label}</div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#7d6234]">{f.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(internal.observations ?? []).length > 0 && (
        <Section title="תצפיות מהמקור" description="מה נראה בקובץ עצמו בזמן הבדיקה.">
          <ul className="list-disc space-y-1.5 ps-5 text-[13px] leading-relaxed text-gray-700">
            {internal.observations!.map((o) => <li key={o}>{o}</li>)}
          </ul>
        </Section>
      )}

      {/* §15 · Sources — editable, kept internal by architecture rather than by omission */}
      <Section
        title="מקורות"
        description="מאיפה מגיעים הנתונים. אוצר המילים הזה פנימי ואינו מופיע באתר: הציבור רואה שנתון אומת, לא לפי איזה מקור."
      >
        {canEdit && (
          <button
            type="button"
            onClick={addSource}
            className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-gray-800 transition-colors hover:bg-gray-50"
          >
            <Plus size={13} aria-hidden="true" />
            הוספת מקור
          </button>
        )}

        {sources.length === 0 ? (
          <p className="text-[12.5px] text-gray-600">אין מקורות רשומים לפרויקט הזה.</p>
        ) : (
          <div className="space-y-3">
            {sources.map((s) => {
              const dependents = dependentFacts(s.id)
              return (
                <div key={s.id} className="rounded-lg border border-border p-3.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`src-label-${s.id}`} className="block text-[12px] font-semibold text-gray-800">
                        שם המקור
                      </label>
                      <input
                        id={`src-label-${s.id}`}
                        type="text"
                        value={s.label}
                        disabled={!canEdit}
                        onChange={(e) => patchSource(s.id, { label: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label htmlFor={`src-type-${s.id}`} className="block text-[12px] font-semibold text-gray-800">
                        סוג
                      </label>
                      <select
                        id={`src-type-${s.id}`}
                        value={s.type}
                        disabled={!canEdit}
                        onChange={(e) => patchSource(s.id, { type: e.target.value as ProjectSource['type'] })}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                      >
                        {Object.entries(SOURCE_TYPE_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`src-quality-${s.id}`} className="block text-[12px] font-semibold text-gray-800">
                        איכות
                      </label>
                      <select
                        id={`src-quality-${s.id}`}
                        value={s.quality}
                        disabled={!canEdit}
                        onChange={(e) => patchSource(s.id, { quality: e.target.value as ProjectSource['quality'] })}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                      >
                        {Object.entries(QUALITY_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`src-review-${s.id}`} className="block text-[12px] font-semibold text-gray-800">
                        מצב בדיקה
                      </label>
                      <select
                        id={`src-review-${s.id}`}
                        value={s.reviewState}
                        disabled={!canEdit}
                        onChange={(e) => patchSource(s.id, { reviewState: e.target.value as ProjectSource['reviewState'] })}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                      >
                        {Object.entries(REVIEW_STATE_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`src-ref-${s.id}`} className="block text-[12px] font-semibold text-gray-800">
                        אסמכתא (לא חובה)
                      </label>
                      <input
                        id={`src-ref-${s.id}`}
                        type="text"
                        placeholder="לדוגמה: שם קובץ, גיליון, מספר מסמך בספריית המסמכים"
                        value={s.reference ?? ''}
                        disabled={!canEdit}
                        onChange={(e) => patchSource(s.id, { reference: e.target.value || undefined })}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`src-note-${s.id}`} className="block text-[12px] font-semibold text-gray-800">
                        הערות פנימיות (לא חובה)
                      </label>
                      <textarea
                        id={`src-note-${s.id}`}
                        rows={2}
                        value={s.note ?? ''}
                        disabled={!canEdit}
                        onChange={(e) => patchSource(s.id, { note: e.target.value || undefined })}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] leading-relaxed text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`src-issues-${s.id}`} className="block text-[12px] font-semibold text-gray-800">
                        בעיות ידועות (לא חובה, שורה לכל בעיה)
                      </label>
                      <textarea
                        id={`src-issues-${s.id}`}
                        rows={2}
                        value={(s.issues ?? []).join('\n')}
                        disabled={!canEdit}
                        onChange={(e) => patchSource(s.id, {
                          issues: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
                        })}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] leading-relaxed text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
                    <p className="text-[12px] text-gray-600">
                      {dependents.length > 0
                        ? <span><span className="font-semibold text-gray-800">נתונים תלויים במקור זה: </span>{dependents.join(', ')}</span>
                        : 'אין נתונים שמפנים למקור זה כרגע.'}
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeSource(s.id)}
                        disabled={dependents.length > 0}
                        title={dependents.length > 0 ? 'לא ניתן להסיר מקור שנתונים מפנים אליו' : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        הסרה
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {internal.notes && (
        <Section title="הערות פנימיות">
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-gray-700">
            {internal.notes}
          </p>
        </Section>
      )}
    </div>
  )
}

const EXISTING_LABEL: Record<string, string> = {
  note: 'הערה',
  existingBuiltAreaSqm: 'שטח בנוי קיים (מ״ר)',
  averageApartmentAreaSqm: 'שטח דירה ממוצע (מ״ר)',
  existingUnitsAmbiguous: 'מספר יחידות קיימות',
}
