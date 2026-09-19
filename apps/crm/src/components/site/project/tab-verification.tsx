'use client'

import { useEffect, useState } from 'react'
import { History, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { cmsApi, type FactAuditEntry } from '@/lib/cms-api'
import { Section, Callout, StatusBadge, StatusEffect } from './fields'
import {
  SOURCE_TYPE_LABEL, STAGE_LABEL, factLabel,
  type ProjectDocument, type ProjectFact, type VerificationStatus,
} from './types'

/**
 * אימות נתונים — where somebody stands behind a number.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  EDITING AND VERIFYING ARE TWO ACTS, SO THEY ARE TWO BUTTONS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Typing a value correctly is not the same as checking it against a source and
 * standing behind it, and collapsing the two would make SELF_VERIFIED
 * meaningless. So each fact has a value field (EDIT permission) and a separate
 * signing action (VERIFY permission), and the screen says what each does.
 *
 * Editing a verified value invalidates it. The editor says so BEFORE the edit
 * rather than reporting it afterwards, because an editor who discovers that a
 * correction silently unpublished a figure learns to avoid corrections.
 *
 * ── WHAT THE PUBLIC NEVER SEES ─────────────────────────────────────────────
 *
 * Everything in the right-hand column of this screen: who verified, when,
 * against which source, and the whole audit trail. The public learns that a
 * figure was verified, never by whom. That is enforced in the gateway's
 * projection, not here — this screen only has to avoid implying otherwise.
 */

interface FactRow {
  field: string
  label: string
  fact: ProjectFact
  blockedBy: string[]
}

export function TabVerification({
  doc, contentId, canEdit, canVerify, onChanged,
}: {
  doc: ProjectDocument
  contentId: string
  canEdit: boolean
  canVerify: boolean
  onChanged: () => void
}) {
  const [history, setHistory] = useState<FactAuditEntry[]>([])
  const [openHistory, setOpenHistory] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    cmsApi.factHistory(contentId).then(setHistory).catch(() => setHistory([]))
  }, [contentId])

  const flags = doc.internal?.dataQualityFlags ?? []
  const blockingFor = (field: string) =>
    flags.filter((f) => !f.resolved && f.severity === 'BLOCKING' && (f.blocks ?? []).includes(field))

  const rows: FactRow[] = []
  if (doc.public.currentStage) {
    rows.push({
      field: 'public.currentStage', label: factLabel('public.currentStage'),
      fact: doc.public.currentStage as ProjectFact,
      blockedBy: blockingFor('public.currentStage').map((f) => f.label),
    })
  }
  for (const [key, fact] of Object.entries(doc.public.facts ?? {})) {
    rows.push({
      field: `public.facts.${key}`, label: factLabel(`public.facts.${key}`),
      fact, blockedBy: blockingFor(`public.facts.${key}`).map((f) => f.label),
    })
  }
  for (const m of doc.milestones ?? []) {
    if (!m.fact) continue
    rows.push({
      field: `milestones.${m.id}`, label: `אבן דרך: ${m.title.he}`,
      fact: m.fact as ProjectFact, blockedBy: blockingFor(`milestones.${m.id}`).map((f) => f.label),
    })
  }

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      const h = await cmsApi.factHistory(contentId)
      setHistory(h)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הפעולה נכשלה')
    } finally {
      setBusy(null)
    }
  }

  const sourceLabel = (id?: string) => {
    const s = doc.sources?.find((x) => x.id === id)
    return s ? `${s.label} (${SOURCE_TYPE_LABEL[s.type]})` : id ?? '—'
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-5">
        <Callout tone="info" title="אין נתונים מהותיים בפרויקט הזה">
          זה מצב תקין. משפטים עריכתיים כמו תקציר ותיאור אינם נתונים מהותיים
          ואינם עוברים אימות. נתון נוצר כאן כשמוסיפים אותו לפרויקט.
        </Callout>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Callout tone="info" title="מה זה אימות">
        אימות אינו ״הקלדתי נכון״. הוא ״בדקתי מול המקור ואני עומד מאחורי זה״.
        לכן עריכה ואימות הן שתי פעולות נפרדות עם שתי הרשאות נפרדות, ושינוי ערך
        מאומת מבטל את האימות אוטומטית.
      </Callout>

      {!canVerify && (
        <Callout tone="warning" title="אין לך הרשאת אימות">
          אפשר לערוך ערכים, אבל לא לאמת אותם. אימות שמור למי שמחזיק במקורות.
        </Callout>
      )}

      {error && <Callout tone="blocking" title="שגיאה">{error}</Callout>}

      {rows.map((row) => {
        const { field, label, fact, blockedBy } = row
        const isBlocked = blockedBy.length > 0
        const publishable = fact.status === 'VERIFIED' || fact.status === 'SELF_VERIFIED'
        const stale =
          fact.verifiedValue !== undefined &&
          JSON.stringify(fact.verifiedValue) !== JSON.stringify(fact.value)
        const isStage = field === 'public.currentStage'
        const draftValue = drafts[field]
        const currentText =
          fact.value === null || fact.value === undefined ? '' : String(fact.value)
        const dirty = draftValue !== undefined && draftValue !== currentText
        const factHistory = history.filter((h) => h.field === field)

        return (
          <Section key={field} title={label}>
            <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
              {/* ── value + actions ─────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={fact.status} />
                  {stale && publishable && (
                    <span className="rounded-full border border-[#d8cdb8] bg-[#f4f1ec] px-2 py-0.5 text-[11.5px] font-semibold text-[#7d6234]">
                      שונה מאז האימות
                    </span>
                  )}
                </div>
                <StatusEffect status={fact.status} />

                <div>
                  <label
                    htmlFor={`v-${field}`}
                    className="block text-[12.5px] font-semibold text-gray-800"
                  >
                    ערך
                  </label>
                  {isStage ? (
                    <select
                      id={`v-${field}`}
                      value={draftValue ?? currentText}
                      disabled={!canEdit}
                      onChange={(e) => setDrafts((d) => ({ ...d, [field]: e.target.value }))}
                      className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                    >
                      {Object.entries(STAGE_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`v-${field}`}
                      type="text"
                      dir="auto"
                      value={draftValue ?? currentText}
                      disabled={!canEdit}
                      placeholder="ריק"
                      onChange={(e) => setDrafts((d) => ({ ...d, [field]: e.target.value }))}
                      className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 font-mono text-sm text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                    />
                  )}
                  {publishable && dirty && (
                    <p className="mt-1.5 text-[12px] font-semibold text-[#7d6234]">
                      שמירת הערך הזה תבטל את האימות הקיים. האימות הישן יישאר ביומן.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!canEdit || !dirty || busy === `set-${field}`}
                    onClick={() =>
                      act(`set-${field}`, () =>
                        cmsApi.setFact(contentId, field, {
                          value: coerce(draftValue ?? '', fact.value),
                        }).then(() => setDrafts((d) => {
                          const n = { ...d }; delete n[field]; return n
                        })))
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === `set-${field}` && (
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    )}
                    שמירת ערך
                  </button>

                  <button
                    type="button"
                    disabled={!canVerify || isBlocked || dirty || busy === `verify-${field}`}
                    title={
                      isBlocked ? 'חסום בגלל בעיית איכות נתונים' :
                      dirty ? 'יש ערך שלא נשמר' :
                      !canVerify ? 'אין הרשאת אימות' : undefined
                    }
                    onClick={() =>
                      act(`verify-${field}`, () =>
                        cmsApi.verifyFact(contentId, field, {
                          ...(fact.sourceId ? { sourceId: fact.sourceId } : {}),
                        }))
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === `verify-${field}`
                      ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      : <ShieldCheck size={13} aria-hidden="true" />}
                    אימות
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenHistory(openHistory === field ? null : field)}
                    aria-expanded={openHistory === field}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <History size={13} aria-hidden="true" />
                    היסטוריה ({factHistory.length})
                  </button>
                </div>

                {isBlocked && (
                  <Callout tone="blocking" title="לא ניתן לאמת">
                    <span className="inline-flex items-center gap-1.5">
                      <Lock size={12} aria-hidden="true" />
                      {blockedBy.join(' · ')}
                    </span>
                    <p className="mt-1">
                      הבעיה נחסמת בשלב האימות ולא בשלב הפרסום, כדי שלא לבזבז חתימה
                      על נתון שממילא יידחה.
                    </p>
                  </Callout>
                )}
              </div>

              {/* ── provenance, all of it internal ──────────────────── */}
              <aside className="rounded-lg border border-border bg-gray-50 p-3.5">
                <h4 className="text-[12.5px] font-bold text-gray-900">מקור ואחריות</h4>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-gray-600">
                  כל מה שכאן פנימי. באתר מופיע שהנתון אומת, לא מי אימת אותו.
                </p>
                <dl className="mt-2.5 space-y-1.5 text-[12px]">
                  <div>
                    <dt className="inline font-semibold text-gray-700">מקור: </dt>
                    <dd className="inline text-gray-900">{sourceLabel(fact.sourceId)}</dd>
                  </div>
                  {fact.sourceReference && (
                    <div>
                      <dt className="inline font-semibold text-gray-700">אסמכתא: </dt>
                      <dd className="inline text-gray-900">{fact.sourceReference}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline font-semibold text-gray-700">אומת בתאריך: </dt>
                    <dd className="inline text-gray-900">
                      {fact.verifiedAt ? new Date(fact.verifiedAt).toLocaleDateString('he-IL') : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-gray-700">נערך לאחרונה: </dt>
                    <dd className="inline text-gray-900">
                      {fact.editedAt ? new Date(fact.editedAt).toLocaleDateString('he-IL') : '—'}
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>

            {openHistory === field && (
              <div className="mt-4 border-t border-border pt-3">
                <h4 className="text-[12.5px] font-bold text-gray-900">יומן הנתון</h4>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-gray-600">
                  היומן נוסף בלבד. שחזור גרסה אינו מוחק ממנו דבר, והערכים מופיעים
                  כתיאור ולא כערך גולמי.
                </p>
                {factHistory.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-gray-600">אין רשומות.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border">
                    {factHistory.map((h) => (
                      <li key={h.id} className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] font-semibold text-gray-900">
                            {EVENT_LABEL[h.event] ?? h.event}
                          </span>
                          <StatusBadge status={h.status as VerificationStatus} />
                          <span className="text-[11.5px] text-gray-600">
                            {new Date(h.occurredAt).toLocaleString('he-IL')}
                            {h.actor && ` · ${h.actor.firstName} ${h.actor.lastName}`}
                          </span>
                        </div>
                        {(h.previousValueLabel || h.newValueLabel) && (
                          <p className="mt-0.5 text-[12px] text-gray-700">
                            {h.previousValueLabel && <span>{h.previousValueLabel} ← </span>}
                            {h.newValueLabel}
                          </p>
                        )}
                        {h.note && <p className="mt-0.5 text-[12px] text-gray-600">{h.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Section>
        )
      })}
    </div>
  )
}

const EVENT_LABEL: Record<string, string> = {
  EDITED: 'נערך',
  VERIFIED: 'אומת',
  INVALIDATED: 'האימות בוטל',
  REVIEW_REQUESTED: 'נדרשה בדיקה נוספת',
}

/**
 * Keep the value's TYPE stable across an edit.
 *
 * Every input returns a string. Writing "120" where the fact held the number
 * 120 would change its type, and the projection compares `value` with
 * `verifiedValue` using JSON equality — so a type change would silently
 * invalidate a verification that nothing had actually altered.
 */
function coerce(raw: string, previous: unknown): unknown {
  if (raw === '') return null
  if (typeof previous === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }
  if (typeof previous === 'boolean') return raw === 'true' || raw === 'כן'
  return raw
}
