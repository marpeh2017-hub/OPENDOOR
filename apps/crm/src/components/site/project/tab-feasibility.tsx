'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Calculator, Check, FileWarning, Loader2, Lock, Pencil,
  Plus, RotateCcw, Sigma, X,
} from 'lucide-react'
import {
  cmsApi,
  type FeasibilityEdit, type FeasibilityField, type FeasibilityResponse,
  type FeasibilityWorkspace, type FieldCategory, type NumericKind,
} from '@/lib/cms-api'
import { PrivateBanner, Section, Callout } from './fields'

/**
 * בדיקת היתכנות — four areas, editable, deliberately not one form.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY THE SPLIT IS THE WHOLE POINT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Flattened into a single table, every number here looks equally solid. They
 * are not remotely equal:
 *
 *   נתוני מקור    what somebody measured or was told. May be wrong, and for
 *                 this project several entries are known to be.
 *   הנחות תרחיש   what the scenario ASSUMED. Not approvals, not a plan, not
 *                 an agreement. Someone chose these.
 *   פלטים         what the arithmetic produced FROM the two above, or what
 *                 arrived from a model nobody here has seen.
 *   כלכלה         money. The most private area in the product.
 *
 * A reader who cannot see which is which will quote an output as a fact, and
 * "337.18 יח״ד" becomes "337 apartments" in a resident meeting. The separation
 * is what stops the arithmetic from laundering its inputs.
 *
 * ── NOTHING HERE IS PUBLISHABLE, AT ANY VERIFICATION LEVEL ─────────────────
 *
 * That is the distinction from INTERNAL. An internal figure may one day be
 * verified and published; a scenario output may not, ever, because it is a
 * projection rather than a claim about the world. There is no publish control
 * on this tab — not hidden, absent — and the gateway's `projectProjection`
 * never reads `feasibility` at all, so the promise holds even if somebody
 * later adds a button here by mistake.
 *
 * ── SAVING IS PER FIELD, AND ON PURPOSE ────────────────────────────────────
 *
 * Every edit is one server operation that recomputes what depends on it and
 * appends one revision. A batched form would either lie about what had
 * persisted or hide which change caused which recalculation; here the value
 * you can see is the value in Postgres, and the audit trail reads as a list of
 * decisions rather than a list of form submissions.
 */
export function TabFeasibility({
  contentId, canEdit,
}: {
  contentId: string
  /** `canFeasibility`, NOT `canEdit`. Editing public copy is a different act. */
  canEdit: boolean
}) {
  const [data, setData] = useState<FeasibilityResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    cmsApi.feasibility(contentId)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'טעינת בדיקת ההיתכנות נכשלה')
      })
    return () => { cancelled = true }
  }, [contentId])

  /** The server is authoritative: its response replaces the workspace whole,
   *  recalculated dependents included. */
  const applyResult = useCallback((workspace: FeasibilityWorkspace) => {
    setData((d) => (d ? { ...d, workspace } : d))
  }, [])

  if (loadError) {
    return (
      <div className="space-y-5">
        <PrivateBanner level="FEASIBILITY" />
        <Callout tone="blocking" title="לא ניתן לטעון את בדיקת ההיתכנות">
          {loadError}
        </Callout>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-5">
        <PrivateBanner level="FEASIBILITY" />
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          טוען…
        </div>
      </div>
    )
  }

  const workspace = data.workspace
  if (!workspace) {
    return (
      <div className="space-y-5">
        <PrivateBanner level="FEASIBILITY" />
        <Callout tone="info" title="אין בדיקת היתכנות לפרויקט הזה">
          זה מצב תקין. פרויקט אינו חייב תרחיש היתכנות כדי להתקיים במערכת.
        </Callout>
      </div>
    )
  }

  const scenario = workspace.scenarios.find((s) => s.id === workspace.activeScenarioId)
    ?? workspace.scenarios[0]!

  const byCategory = (c: FieldCategory) =>
    Object.values(scenario.fields)
      .filter((f) => f.category === c)
      // Inputs before the figures derived from them, so a section reads top to
      // bottom in the order the arithmetic actually happens.
      .sort((a, b) => (a.role === b.role ? a.label.localeCompare(b.label, 'he') : a.role === 'INPUT' ? -1 : 1))

  const flagById = new Map(data.dataQualityFlags.map((f) => [f.id, f]))
  const warningById = new Map((workspace.sourceWarnings ?? []).map((w) => [w.id, w]))
  const explain = (id: string) => flagById.get(id) ?? warningById.get(id)

  const shared = {
    contentId, scenarioId: scenario.id, canEdit, onResult: applyResult, explain,
  }

  return (
    <div className="space-y-5">
      <PrivateBanner level="FEASIBILITY" />

      <div className="rounded-xl border border-[#d8cdb8] bg-[#f4f1ec] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Lock size={15} className="flex-shrink-0 text-[#7d6234]" aria-hidden="true" />
          <span className="text-[14px] font-bold text-gray-900">{scenario.label}</span>
          <span className="rounded-full border border-[#d8cdb8] bg-white px-2 py-0.5 text-[11.5px] font-semibold text-[#7d6234]">
            {SCENARIO_KIND_LABEL[scenario.kind]}
          </span>
          {workspace.scenarios.length > 1 && (
            <span className="text-[12px] text-gray-600">
              {workspace.scenarios.length} תרחישים
            </span>
          )}
        </div>
        {scenario.note && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#7d6234]">{scenario.note}</p>
        )}
      </div>

      <Callout tone="warning" title="איך לקרוא את המספרים בלשונית הזאת">
        נתוני מקור הם מה שנמדד או נמסר. הנחות הן מה שהתרחיש הניח, ואינן אישור
        תכנוני. פלטים הם תוצאת החישוב, או ערך שהתקבל ממודל חיצוני, והם אמינים
        בדיוק כמו הנתונים שמתחתיהם. מספר מכאן אינו הופך לעובדה על העולם, גם לא
        אחרי אימות.
      </Callout>

      {/* §15 · Warnings about the SOURCE survive the import. */}
      {(workspace.sourceWarnings ?? []).length > 0 && (
        <div className="rounded-xl border border-[#d8cdb8] bg-white p-4">
          <div className="flex items-center gap-2">
            <FileWarning size={16} className="flex-shrink-0 text-[#7d6234]" aria-hidden="true" />
            <h3 className="text-[13.5px] font-bold text-gray-900">מה ידוע על מקור המספרים</h3>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
            הבעיות האלה נמצאו בקובץ המקור. הן אינן נעלמות מכיוון שהערכים יובאו
            למערכת.
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {workspace.sourceWarnings!.map((w) => (
              <li key={w.id} className="rounded-lg border border-[#d8cdb8] bg-[#f4f1ec] p-2.5">
                <span className="text-[12.5px] font-semibold text-[#7d6234]">{w.label}</span>
                <p className="mt-0.5 text-[12px] leading-relaxed text-gray-700">{w.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section
        title="נתוני מקור"
        description="מה שנמדד או נמסר במסמכים. ערך כאן אינו מאומת מעצם היותו רשום, ומצב הבדיקה אומר מי הספיק להסתכל עליו."
      >
        <FieldList fields={byCategory('SOURCE_DATA')} {...shared} />
        <AddField category="SOURCE_DATA" {...shared} />
      </Section>

      <Section
        title="הנחות תרחיש"
        description="מה שהתרחיש הניח כדי לחשב. אלה אינן זכויות בנייה מאושרות, אינן מספר מבנים מאושר, אינן מספר יחידות מאושר ואינן אישור עירייה."
      >
        <Callout tone="warning" title="הנחה אינה אישור">
          כל ערך בחלק הזה נבחר לצורך המודל. אין להציג אותו, בשום מסמך, כזכות
          מאושרת או כהחלטה של גורם תכנוני.
        </Callout>
        <div className="mt-4">
          <FieldList fields={byCategory('ASSUMPTION')} {...shared} />
          <AddField category="ASSUMPTION" {...shared} />
        </div>
      </Section>

      <Section
        title="פלטים"
        description="ערכים שחושבו כאן מהנתונים וההנחות שמעליהם, או שהתקבלו מהמודל החיצוני. ליד כל ערך כתוב מאיפה הוא."
      >
        <FieldList fields={byCategory('OUTPUT')} {...shared} />
        <AddField category="OUTPUT" {...shared} />
      </Section>

      <Section
        title="כלכלה"
        description="התוצאה הכספית של התרחיש. זהו החלק הפרטי ביותר במערכת: הוא אינו מגיע לאתר, לתצוגה מקדימה, ל-SEO או לכל ממשק ציבורי."
      >
        <FieldList fields={byCategory('ECONOMICS')} {...shared} />
        <AddField category="ECONOMICS" {...shared} />
      </Section>
    </div>
  )
}

const SCENARIO_KIND_LABEL: Record<string, string> = {
  BASELINE: 'תרחיש בסיס',
  ALTERNATIVE_PLANNING: 'חלופה תכנונית',
  DEVELOPER_PROPOSAL: 'הצעת יזם',
  OWNER_PREFERRED: 'העדפת בעלים',
}

const REVIEW_LABEL: Record<string, string> = {
  UNREVIEWED: 'טרם נבדק',
  IN_REVIEW: 'בבדיקה',
  ACCEPTED: 'התקבל',
  REJECTED: 'נדחה',
}

const KIND_LABEL: Record<NumericKind, string> = {
  AREA_SQM: 'שטח (מ״ר)',
  CURRENCY_ILS: 'סכום (₪)',
  PERCENT: 'אחוז',
  COUNT: 'מספר',
  DECIMAL: 'מספר עשרוני',
  BOOLEAN: 'כן/לא',
  TEXT: 'טקסט',
}

/**
 * How many decimals to SHOW. Storage is never rounded; this is presentation.
 *
 * COUNT is deliberately exact: 337.18 units must never render as 337, which is
 * the single most consequential rounding in this product. A quotient like a
 * percentage carries forty significant digits in storage and two on screen,
 * with the exact value one line below so nothing is hidden.
 */
const DISPLAY_DECIMALS: Record<NumericKind, number | null> = {
  AREA_SQM: 2,
  CURRENCY_ILS: 2,
  PERCENT: 2,
  COUNT: null,
  DECIMAL: 4,
  BOOLEAN: null,
  TEXT: null,
}

/**
 * Round for READING only, and say so when it happened.
 *
 * Returns the shortened form plus whether it differs from the stored value, so
 * the caller can show the exact figure beside it. Implemented on strings, not
 * by parsing to a number, because parsing is the drift.
 */
function display(kind: NumericKind, value: string): { shown: string; exact: boolean } {
  const places = DISPLAY_DECIMALS[kind]
  if (places === null || !value.includes('.')) return { shown: value, exact: true }
  const [whole, frac = ''] = value.split('.')
  if (frac.length <= places) return { shown: value, exact: true }
  // Truncation, not rounding: this is a reading aid, and a rounded-up display
  // beside an exact stored value would be two different numbers on one row.
  const cut = `${whole}.${frac.slice(0, places)}`
  return { shown: cut, exact: false }
}

/** Thousands separators for readability. Never stored, never parsed back. */
function grouped(v: string): string {
  const [whole, frac] = v.split('.')
  const sign = whole!.startsWith('-') ? '-' : ''
  const digits = sign ? whole!.slice(1) : whole!
  const withSeps = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${withSeps}${frac ? `.${frac}` : ''}`
}

interface SharedProps {
  contentId: string
  scenarioId: string
  canEdit: boolean
  onResult: (w: FeasibilityWorkspace) => void
  explain: (id: string) => { label: string; detail: string } | undefined
}

function FieldList({ fields, ...shared }: { fields: FeasibilityField[] } & SharedProps) {
  if (fields.length === 0) {
    return <p className="text-[12.5px] text-gray-600">אין ערכים בחלק הזה.</p>
  }
  return (
    <div className="space-y-2.5">
      {fields.map((f) => <FieldRow key={f.key} field={f} {...shared} />)}
    </div>
  )
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function FieldRow({
  field, contentId, scenarioId, canEdit, onResult, explain,
}: { field: FeasibilityField } & SharedProps) {
  const [editing, setEditing] = useState<null | 'value' | 'override'>(null)
  const [draft, setDraft] = useState('')
  const [reason, setReason] = useState('')
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)

  const isFormula = field.role === 'FORMULA'
  const overridden = Boolean(field.override)
  const value = overridden ? field.override!.value : isFormula ? field.calculatedValue : field.value

  const send = async (edit: FeasibilityEdit) => {
    setState('saving')
    setError(null)
    try {
      const res = await cmsApi.saveFeasibility(contentId, edit)
      onResult(res.workspace)
      setEditing(null)
      setState('saved')
      setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 2500)
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    }
  }

  const shownValue = useMemo(() => {
    if (value === undefined || value === '') return null
    if (field.kind === 'TEXT') return { shown: value, exact: true }
    const d = display(field.kind, value)
    return { shown: grouped(d.shown), exact: d.exact }
  }, [value, field.kind])

  return (
    <div className={`rounded-lg border p-3.5 ${overridden ? 'border-[#d8cdb8] bg-[#f4f1ec]' : 'border-border bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-gray-900">{field.label}</span>
            <RoleChip field={field} />
            {field.reviewState && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-gray-600">
                {REVIEW_LABEL[field.reviewState]}
              </span>
            )}
          </div>

          {/* The value */}
          {editing === null && (
            <div className="mt-1.5">
              {shownValue ? (
                <>
                  <span className="font-mono text-[16px] font-semibold text-gray-900" dir="ltr">
                    {shownValue.shown}
                  </span>
                  {field.unit && (
                    <span className="ms-1.5 text-[12.5px] text-gray-600">{field.unit}</span>
                  )}
                  {!shownValue.exact && (
                    <p className="mt-0.5 text-[11.5px] text-gray-600">
                      מעוגל לתצוגה. הערך המדויק:{' '}
                      <span className="font-mono" dir="ltr">{value}</span>
                    </p>
                  )}
                </>
              ) : (
                <MissingValue field={field} />
              )}
            </div>
          )}

          {/* Editing an input value */}
          {editing === 'value' && (
            <form
              className="mt-2 flex flex-wrap items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); void send({ op: 'setValue', scenarioId, key: field.key, value: draft }) }}
            >
              <label className="sr-only" htmlFor={`v-${field.key}`}>{field.label}</label>
              <input
                id={`v-${field.key}`}
                type="text"
                inputMode={field.kind === 'TEXT' ? 'text' : 'decimal'}
                dir={field.kind === 'TEXT' ? 'rtl' : 'ltr'}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                className="w-56 rounded-lg border border-border px-3 py-1.5 font-mono text-[14px] text-gray-900 focus:border-teal-600"
              />
              {field.unit && <span className="text-[12.5px] text-gray-600">{field.unit}</span>}
              <SaveButtons state={state} onCancel={() => { setEditing(null); setState('idle'); setError(null) }} />
            </form>
          )}

          {/* Declaring an override */}
          {editing === 'override' && (
            <form
              className="mt-2 space-y-2"
              onSubmit={(e) => { e.preventDefault(); void send({ op: 'setOverride', scenarioId, key: field.key, value: draft, reason }) }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`o-${field.key}`}>ערך עוקף עבור {field.label}</label>
                <input
                  id={`o-${field.key}`}
                  type="text" inputMode="decimal" dir="ltr" value={draft} autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-56 rounded-lg border border-border px-3 py-1.5 font-mono text-[14px] text-gray-900 focus:border-teal-600"
                />
                {field.unit && <span className="text-[12.5px] text-gray-600">{field.unit}</span>}
              </div>
              <div>
                <label htmlFor={`r-${field.key}`} className="block text-[12px] font-semibold text-gray-800">
                  נימוק (חובה)
                </label>
                <input
                  id={`r-${field.key}`}
                  type="text" value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="למה הערך המחושב אינו מתאים כאן"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600"
                />
                <p className="mt-1 text-[11.5px] text-gray-600">
                  הערך המחושב יישמר לצד העקיפה ולא יימחק.
                </p>
              </div>
              <SaveButtons state={state} onCancel={() => { setEditing(null); setState('idle'); setError(null) }} />
            </form>
          )}
        </div>

        {/* Actions */}
        {canEdit && editing === null && (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {state === 'saved' && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-teal-700">
                <Check size={13} aria-hidden="true" />
                נשמר
              </span>
            )}
            {!isFormula && (
              <button
                type="button"
                onClick={() => { setDraft(field.value ?? ''); setEditing('value') }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Pencil size={12} aria-hidden="true" />
                עריכה
              </button>
            )}
            {isFormula && !overridden && (
              <button
                type="button"
                onClick={() => { setDraft(field.calculatedValue ?? ''); setReason(''); setEditing('override') }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Pencil size={12} aria-hidden="true" />
                עקיפה ידנית
              </button>
            )}
            {overridden && (
              <button
                type="button"
                onClick={() => void send({ op: 'clearOverride', scenarioId, key: field.key })}
                disabled={state === 'saving'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <RotateCcw size={12} aria-hidden="true" />
                חזרה לערך המחושב
              </button>
            )}
          </div>
        )}
      </div>

      {/* An override shows BOTH numbers, always. */}
      {overridden && (
        <div className="mt-2.5 rounded-lg border border-[#d8cdb8] bg-white p-2.5">
          <p className="text-[12px] font-semibold text-[#7d6234]">ערך זה נקבע ידנית</p>
          <dl className="mt-1 space-y-0.5 text-[12px] text-gray-700">
            <div className="flex gap-2">
              <dt className="text-gray-600">המערכת חישבה:</dt>
              <dd className="font-mono" dir="ltr">{field.calculatedValue ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-600">נימוק:</dt>
              <dd>{field.override!.reason}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* What a formula does, in words. */}
      {isFormula && field.formulaId && (
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-gray-600">
          <Sigma size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{FORMULA_EXPLAIN[field.formulaId] ?? 'ערך מחושב.'}</span>
        </p>
      )}

      {field.importedFrom && (
        <p className="mt-2 text-[11.5px] text-gray-600">
          התקבל מ{field.importedFrom}. המערכת לא חישבה אותו ואינה יודעת באיזו שיטה הוא הופק.
        </p>
      )}

      {field.note && <p className="mt-2 text-[12px] leading-relaxed text-gray-600">{field.note}</p>}

      {/* §15 · quality warnings, attached to the figure they bear on. */}
      {(field.warnings ?? []).length > 0 && (
        <ul className="mt-2 space-y-1">
          {field.warnings!.map((id) => {
            const w = explain(id)
            return (
              <li key={id} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-[#7d6234]">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{w ? `${w.label}: ${w.detail}` : id}</span>
              </li>
            )
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-red-800">{error}</p>
      )}
    </div>
  )
}

/** Never a blank cell: say WHY there is no number. */
function MissingValue({ field }: { field: FeasibilityField }) {
  if (field.calcStatus === 'MISSING_INPUTS') {
    return (
      <p className="text-[12.5px] leading-relaxed text-[#7d6234]">
        לא ניתן לחשב. חסר:{' '}
        <span className="font-semibold">{(field.missingInputs ?? []).join(', ')}</span>
      </p>
    )
  }
  if (field.calcStatus === 'NOT_CALCULATED') {
    return <p className="text-[12.5px] text-gray-600">טרם חושב.</p>
  }
  return <p className="text-[12.5px] text-gray-600">אין ערך.</p>
}

function RoleChip({ field }: { field: FeasibilityField }) {
  if (field.override) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#d8cdb8] bg-white px-2 py-0.5 text-[11.5px] font-semibold text-[#7d6234]">
        <Pencil size={10} aria-hidden="true" />
        עקיפה ידנית
      </span>
    )
  }
  if (field.role === 'FORMULA') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 text-[11.5px] font-semibold text-teal-800">
        <Calculator size={10} aria-hidden="true" />
        מחושב
      </span>
    )
  }
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-gray-600">
      {field.importedFrom ? 'ערך מיובא' : 'קלט'}
    </span>
  )
}

function SaveButtons({ state, onCancel }: { state: SaveState; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="submit"
        disabled={state === 'saving'}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-teal-700 disabled:opacity-50"
      >
        {state === 'saving'
          ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          : <Check size={13} aria-hidden="true" />}
        שמירה
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <X size={13} aria-hidden="true" />
        ביטול
      </button>
    </div>
  )
}

/**
 * Record a value the workbook mentions that the import did not carry.
 *
 * INPUT fields only. A browser that could create calculated fields would be
 * choosing which arithmetic this system asserts, and that belongs in reviewed
 * code rather than in a form.
 */
function AddField({
  category, contentId, scenarioId, canEdit, onResult,
}: { category: FieldCategory } & SharedProps) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<NumericKind>('DECIMAL')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!canEdit) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setError(null); setState('idle') }}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-gray-800 transition-colors hover:bg-gray-50"
      >
        <Plus size={13} aria-hidden="true" />
        הוספת ערך
      </button>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('saving')
    setError(null)
    try {
      const res = await cmsApi.saveFeasibility(contentId, {
        op: 'addField', scenarioId, key: key.trim(), category,
        label: label.trim() || undefined,
        kind,
        value: value.trim() || undefined,
        unit: unit.trim() || undefined,
      })
      onResult(res.workspace)
      setOpen(false)
      setKey(''); setLabel(''); setValue(''); setUnit('')
      setState('idle')
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'ההוספה נכשלה')
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`nk-${category}`} className="block text-[12px] font-semibold text-gray-800">
            מזהה (באנגלית)
          </label>
          <input
            id={`nk-${category}`} type="text" dir="ltr" value={key} required
            onChange={(e) => setKey(e.target.value)}
            placeholder="buildingCount"
            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 font-mono text-[13px] text-gray-900 focus:border-teal-600"
          />
          <p className="mt-1 text-[11.5px] text-gray-600">
            למזהים מוכרים הכותרת והיחידה נקבעות אוטומטית.
          </p>
        </div>
        <div>
          <label htmlFor={`nl-${category}`} className="block text-[12px] font-semibold text-gray-800">
            כותרת בעברית
          </label>
          <input
            id={`nl-${category}`} type="text" value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600"
          />
        </div>
        <div>
          <label htmlFor={`nt-${category}`} className="block text-[12px] font-semibold text-gray-800">
            סוג הערך
          </label>
          <select
            id={`nt-${category}`} value={kind}
            onChange={(e) => setKind(e.target.value as NumericKind)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600"
          >
            {(Object.keys(KIND_LABEL) as NumericKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`nv-${category}`} className="block text-[12px] font-semibold text-gray-800">
            ערך
          </label>
          <input
            id={`nv-${category}`} type="text" dir={kind === 'TEXT' ? 'rtl' : 'ltr'} value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 font-mono text-[13px] text-gray-900 focus:border-teal-600"
          />
        </div>
      </div>

      {error && <p role="alert" className="mt-2 text-[12px] font-medium text-red-800">{error}</p>}

      <div className="mt-3">
        <SaveButtons state={state} onCancel={() => { setOpen(false); setError(null); setState('idle') }} />
      </div>
    </form>
  )
}

/**
 * What each formula does, in Hebrew.
 *
 * Mirrors `explain` on each `FormulaSpec` in the gateway's
 * `feasibility-model.ts`. Duplicated rather than sent over the wire because
 * these are UI copy: they are read by a person deciding whether to trust a
 * number, and they belong beside the screen that shows it.
 */
const FORMULA_EXPLAIN: Record<string, string> = {
  areaDiscrepancy: 'שטח המגרש הרשום פחות המדידה בפועל. הפרש שאינו אפס מצביע על אי-התאמה שדורשת בירור.',
  buildableRatio: 'מעטפת הבנייה בתרחיש חלקי שטח המגרש הרשום. יחס תרחיש, אינו זכויות בנייה מאושרות.',
  saleAreaPerScenarioUnit: 'שטח המכירה למגורים חלקי מספר היחידות בתרחיש. שטח ממוצע ליחידה בתרחיש בלבד.',
  averageExistingUnitArea: 'שטח בנוי קיים חלקי מספר היחידות הקיימות. לא ניתן לחישוב כל עוד מספר היחידות אינו חד-משמעי.',
  ownerUnits: 'סך היחידות בתרחיש פחות יחידות היזם. זהות חשבונית, לא הקצאה מאושרת.',
  developerUnitShare: 'חלקו של היזם מסך היחידות בתרחיש.',
  cost: 'מכירות פחות רווח, לפי ההגדרה רווח = מכירות פחות עלות. נגזר, ולא תקציב שנבנה.',
  returnOnCost: 'רווח חלקי עלות. נשען על העלות הנגזרת שמעליו.',
  profitOnSales: 'רווח היזם כאחוז מהמכירות.',
}
