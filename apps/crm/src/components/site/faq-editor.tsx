'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { cmsApi } from '@/lib/cms-api'
import { ContentEditorShell } from './content-editor-shell'
import { Section } from './project/fields'

/**
 * שאלות ותשובות — one CMS row, an array of questions.
 *
 * ── WHY ONE ROW AND NOT ONE ROW PER QUESTION ───────────────────────────────
 *
 * `FAQ_ITEM` exists as its own kind in the schema, and a row per question is
 * the more "correct" data model. It is also ten-odd rows each needing its own
 * publish/revision history for content that is, in practice, edited and
 * published as a set — nobody publishes half an FAQ. `ProjectDocument`
 * already holds an array of milestones the same way for the same reason:
 * some collections are edited together and belong in one document with one
 * publish action. Reordering, adding and hiding are all edits to that one
 * array; only actually publishing a NEW independent question would need the
 * heavier shape, and nothing here does yet.
 */
interface FaqDocEntry {
  id: string
  question: { he: string; en?: string }
  answer: { he: string; en?: string }
  order: number
  hidden?: boolean
}
interface FaqDoc {
  title: { he: string; en?: string }
  items: FaqDocEntry[]
}

const SLUG = 'faq'

export function FaqEditor() {
  const [contentId, setContentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    cmsApi.list({ kind: 'PAGE' })
      .then(async (items) => {
        const existing = items.find((i) => i.slug === SLUG)
        if (existing) { if (!cancelled) setContentId(existing.id); return }
        // First time this screen is opened: create the row. `create()` uses
        // the same EDIT capability every other write here requires, so a
        // viewer who reaches this screen still cannot bootstrap it.
        const created = await cmsApi.create({
          kind: 'PAGE', slug: SLUG,
          draft: { title: { he: 'שאלות ותשובות' }, items: [] } satisfies FaqDoc,
        })
        if (!cancelled) setContentId(created.id)
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'טעינה נכשלה') })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-[13px] text-red-800">
        {error}
      </div>
    )
  }
  if (!contentId) {
    return <div className="p-8 text-sm text-gray-600">טוען…</div>
  }

  return (
    <ContentEditorShell<FaqDoc> contentId={contentId} title="שאלות ותשובות" typeLabel="עמוד">
      {({ draft, setDraft, dirty: _dirty, content: _content }) => {
        const items = [...(draft.items ?? [])].sort((a, b) => a.order - b.order)

        const write = (next: FaqDocEntry[]) =>
          setDraft((d) => ({ ...d, items: next.map((it, i) => ({ ...it, order: i + 1 })) }))

        const patch = (id: string, p: Partial<FaqDocEntry>) =>
          write(items.map((it) => (it.id === id ? { ...it, ...p } : it)))

        const move = (id: string, delta: number) => {
          const i = items.findIndex((it) => it.id === id)
          const j = i + delta
          if (i < 0 || j < 0 || j >= items.length) return
          const next = [...items]
          ;[next[i], next[j]] = [next[j]!, next[i]!]
          write(next)
        }

        const addItem = () =>
          write([...items, {
            id: `faq-${Date.now().toString(36)}`,
            question: { he: '' }, answer: { he: '' }, order: items.length + 1,
          }])

        return (
          <Section
            title="שאלות"
            description="הסדר כאן הוא הסדר באתר. שאלה מוסתרת נשארת בעריכה אך אינה מוצגת."
          >
            <button
              type="button"
              onClick={addItem}
              className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-gray-800 transition-colors hover:bg-gray-50"
            >
              <Plus size={13} aria-hidden="true" />
              הוספת שאלה
            </button>

            {items.length === 0 ? (
              <p className="text-[13px] text-gray-600">אין עדיין שאלות. הוספת שאלה תתחיל את הרשימה.</p>
            ) : (
              <div className="space-y-3">
                {items.map((it, i) => {
                  const missing = !it.question.he.trim() || !it.answer.he.trim()
                  return (
                    <div key={it.id} className={`rounded-lg border p-3.5 ${it.hidden ? 'border-dashed border-gray-300 bg-gray-50' : 'border-border bg-white'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        {it.hidden && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-[11.5px] text-gray-600">
                            <EyeOff size={11} aria-hidden="true" />
                            מוסתר
                          </span>
                        )}
                        {missing && (
                          <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11.5px] font-semibold text-red-800">
                            חסרה שאלה או תשובה
                          </span>
                        )}
                        <div className="ms-auto flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => patch(it.id, { hidden: !it.hidden })}
                            aria-label={it.hidden ? 'הצגה' : 'הסתרה'}
                            className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            {it.hidden ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
                          </button>
                          <button
                            type="button" disabled={i === 0} onClick={() => move(it.id, -1)}
                            aria-label="העברה למעלה"
                            className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
                          ><ArrowUp size={13} aria-hidden="true" /></button>
                          <button
                            type="button" disabled={i === items.length - 1} onClick={() => move(it.id, 1)}
                            aria-label="העברה למטה"
                            className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
                          ><ArrowDown size={13} aria-hidden="true" /></button>
                          <button
                            type="button" onClick={() => write(items.filter((x) => x.id !== it.id))}
                            aria-label="הסרה"
                            className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50"
                          ><Trash2 size={13} aria-hidden="true" /></button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`q-he-${it.id}`} className="block text-[12px] font-semibold text-gray-800">שאלה (עברית)</label>
                          <input
                            id={`q-he-${it.id}`} type="text" value={it.question.he}
                            onChange={(e) => patch(it.id, { question: { ...it.question, he: e.target.value } })}
                            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600"
                          />
                        </div>
                        <div>
                          <label htmlFor={`q-en-${it.id}`} className="block text-[12px] font-semibold text-gray-800">שאלה (אנגלית, לא חובה)</label>
                          <input
                            id={`q-en-${it.id}`} type="text" dir="ltr" value={it.question.en ?? ''}
                            onChange={(e) => patch(it.id, { question: { ...it.question, en: e.target.value || undefined } })}
                            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor={`a-he-${it.id}`} className="block text-[12px] font-semibold text-gray-800">תשובה (עברית)</label>
                          <textarea
                            id={`a-he-${it.id}`} rows={2} value={it.answer.he}
                            onChange={(e) => patch(it.id, { answer: { ...it.answer, he: e.target.value } })}
                            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] leading-relaxed text-gray-900 focus:border-teal-600"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor={`a-en-${it.id}`} className="block text-[12px] font-semibold text-gray-800">תשובה (אנגלית, לא חובה)</label>
                          <textarea
                            id={`a-en-${it.id}`} rows={2} dir="ltr" value={it.answer.en ?? ''}
                            onChange={(e) => patch(it.id, { answer: { ...it.answer, en: e.target.value || undefined } })}
                            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] leading-relaxed text-gray-900 focus:border-teal-600"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        )
      }}
    </ContentEditorShell>
  )
}
