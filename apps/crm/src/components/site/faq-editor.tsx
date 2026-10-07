'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { FAQ_SEED, FAQ_TOPICS, isFaqTopicId, type FaqTopicId } from '@urban-renewal/api-contracts'
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
 *
 * ── TOPICS, AND WHERE THE FIRST DRAFT COMES FROM ───────────────────────────
 *
 * The website's /faq opens on one card per topic and groups the questions
 * under them, so every question here carries a `topic` from the shared
 * `FAQ_TOPICS`. A question without one still publishes, but the site then
 * drops the cards, which is why it is flagged on screen.
 *
 * Until something is published, the site shows `FAQ_SEED`. A new FAQ row
 * starts as a draft of exactly those questions, not an empty list: an editor
 * who publishes without touching anything changes nothing on the site, and
 * one who fixes a word does not first have to retype the other eight. A row
 * created empty before this existed gets a button that loads them.
 */
interface FaqDocEntry {
  id: string
  question: { he: string; en?: string }
  answer: { he: string; en?: string }
  order: number
  topic?: FaqTopicId
  hidden?: boolean
}
interface FaqDoc {
  title: { he: string; en?: string }
  items: FaqDocEntry[]
}

const SLUG = 'faq'

/** The questions the site shows today, as editor entries. */
const seedItems = (): FaqDocEntry[] =>
  FAQ_SEED.map(({ id, topic, question, answer }, i) => ({
    id, topic, question: { ...question }, answer: { ...answer }, order: i + 1,
  }))

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
          draft: { title: { he: 'שאלות ותשובות' }, items: seedItems() } satisfies FaqDoc,
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
            description="באתר השאלות מקובצות לפי נושא, בסדר שבו הן מופיעות כאן. לכל שאלה צריך נושא: בלי נושא, כרטיסי הנושאים לא יוצגו באתר. שאלה מוסתרת נשארת בעריכה אך אינה מוצגת."
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
              <div className="space-y-2">
                <p className="text-[13px] text-gray-600">
                  אין עדיין שאלות. אפשר לטעון את השאלות שמופיעות היום באתר, או להוסיף שאלה חדשה.
                </p>
                <button
                  type="button"
                  onClick={() => write(seedItems())}
                  className="inline-flex items-center gap-2 rounded-lg border border-teal-600 px-3 py-1.5 text-[12.5px] font-semibold text-teal-700 transition-colors hover:bg-teal-50"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  טעינת השאלות שמופיעות היום באתר
                </button>
              </div>
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
                        {!it.topic && (
                          <span className="rounded-full border border-[#d8cdb8] bg-[#f4f1ec] px-2 py-0.5 text-[11.5px] font-semibold text-[#7d6234]">
                            חסר נושא
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
                        <div className="sm:col-span-2">
                          <label htmlFor={`topic-${it.id}`} className="block text-[12px] font-semibold text-gray-800">נושא</label>
                          <select
                            id={`topic-${it.id}`} value={it.topic ?? ''}
                            onChange={(e) => patch(it.id, { topic: isFaqTopicId(e.target.value) ? e.target.value : undefined })}
                            className="mt-1 w-full max-w-xs rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600"
                          >
                            <option value="" disabled>בחרו נושא</option>
                            {FAQ_TOPICS.map((topic) => (
                              <option key={topic.id} value={topic.id}>{topic.label.he}</option>
                            ))}
                          </select>
                        </div>
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
