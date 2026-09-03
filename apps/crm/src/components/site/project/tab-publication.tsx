'use client'

import { AlertTriangle, Check, EyeOff, Globe, Loader2, Lock } from 'lucide-react'
import { Section, Callout } from './fields'
import type { CmsContentDetail, CmsRevisionSummary, PublicationCheck } from '@/lib/cms-api'

/**
 * פרסום — the only tab that can change what the public reads.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  TWO COLUMNS, BECAUSE "TRUST ME, IT IS FILTERED" IS NOT AN ANSWER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The person clicking Publish is holding a document that contains a candidate
 * boundary, a workbook and an economics table. Telling them the projection
 * handles it asks them to take the most consequential thing in the product on
 * faith, right at the moment they are least able to check.
 *
 * So the check names both halves: what WILL become public, field by field, and
 * what STAYS PRIVATE, area by area, with a sentence each. The second column is
 * the one that makes the button safe to press.
 *
 * ── WHY PUBLISH LIVES ONLY HERE ────────────────────────────────────────────
 *
 * There is deliberately no toolbar shortcut. Publishing a project is not a
 * save with a different label — it is the act that puts claims about somebody
 * else's building on the internet, and it should require arriving at the
 * screen that explains what is about to happen.
 *
 * ── BLOCKERS DISABLE, WARNINGS DO NOT ──────────────────────────────────────
 *
 * A warning that blocks teaches people to route around the check. An
 * unverified figure is a warning precisely because the projection was going to
 * drop it anyway: nothing unsafe can reach the site through it.
 */
export function TabPublication({
  content, check, revisions, dirty, busy, canPublish, onPublish, onUnpublish,
}: {
  content: CmsContentDetail
  check: PublicationCheck | null
  revisions: CmsRevisionSummary[]
  dirty: boolean
  busy: string | null
  canPublish: boolean
  onPublish: () => void
  onUnpublish: () => void
}) {
  const live = content.state === 'PUBLISHED' && content.livePublicationId
  const lastPublish = revisions.find((r) => r.reason === 'PUBLISH')
  const savesSincePublish = lastPublish
    ? revisions.filter((r) => r.sequence > lastPublish.sequence && r.reason === 'SAVE').length
    : revisions.filter((r) => r.reason === 'SAVE').length

  const blockers = check?.blockers ?? []
  const warnings = check?.warnings ?? []
  const blocked = blockers.length > 0

  return (
    <div className="space-y-5">
      {/* ── State ──────────────────────────────────────────────────── */}
      <Section title="מצב פרסום">
        <dl className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-[12.5px] font-medium text-gray-700">כרגע</dt>
            <dd>
              <span
                className={
                  live
                    ? 'inline-flex items-center gap-1.5 rounded-full border border-teal-300 bg-teal-50 px-2.5 py-0.5 text-[12px] font-semibold text-teal-800'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-0.5 text-[12px] font-semibold text-gray-700'
                }
              >
                {live ? <Globe size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
                {live ? 'מפורסם באתר' : 'טיוטה, אינו מופיע באתר'}
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-[12.5px] font-medium text-gray-700">פורסם לאחרונה</dt>
            <dd className="text-[13px] text-gray-900">
              {lastPublish ? new Date(lastPublish.createdAt).toLocaleString('he-IL') : 'מעולם לא'}
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-[12.5px] font-medium text-gray-700">שינויים שלא פורסמו</dt>
            <dd className="text-[13px] text-gray-900">
              {savesSincePublish === 0 ? 'אין' : `${savesSincePublish} שמירות`}
            </dd>
          </div>
        </dl>

        {dirty && (
          <div className="mt-3">
            <Callout tone="warning" title="יש שינויים שלא נשמרו">
              שמירה אינה פרסום, אבל פרסום מפרסם את מה שנשמר. שמרו קודם.
            </Callout>
          </div>
        )}
      </Section>

      {/* ── The two columns ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-teal-300 bg-white p-5">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
            <Globe size={16} className="text-teal-700" aria-hidden="true" />
            יהפוך לציבורי
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">
            בדיוק זה, ולא יותר. נתון שאינו מאומת אינו ברשימה כי הוא לא יגיע לאתר.
          </p>
          {check?.willBecomePublic?.length ? (
            <ul className="mt-3 space-y-1.5">
              {check.willBecomePublic.map((w) => (
                <li key={w.field} className="flex items-start gap-2 text-[13px] text-gray-900">
                  <Check size={14} className="mt-0.5 flex-shrink-0 text-teal-700" aria-hidden="true" />
                  {w.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-gray-600">אין תוכן שיהפוך לציבורי.</p>
          )}
        </section>

        <section className="rounded-xl border border-gray-300 bg-gray-50 p-5">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
            <Lock size={16} className="text-gray-700" aria-hidden="true" />
            נשאר פרטי
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">
            גם אחרי פרסום. אין פעולה במערכת שמפרסמת את האזורים האלה.
          </p>
          {check?.staysPrivate?.length ? (
            <ul className="mt-3 space-y-2.5">
              {check.staysPrivate.map((s) => (
                <li key={s.area}>
                  <div className="flex items-start gap-2">
                    <Lock size={13} className="mt-0.5 flex-shrink-0 text-gray-600" aria-hidden="true" />
                    <div>
                      <span className="block text-[13px] font-semibold text-gray-900">{s.label}</span>
                      <span className="block text-[12px] leading-relaxed text-gray-600">{s.detail}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-gray-600">אין מידע פרטי בפרויקט הזה.</p>
          )}
        </section>
      </div>

      {/* ── Blockers and warnings ──────────────────────────────────── */}
      {blockers.length > 0 && (
        <Section title="חסמים" description="חייבים להיפתר לפני פרסום.">
          <ul className="space-y-2">
            {blockers.map((b, i) => (
              <li key={`${b.code}-${i}`}>
                <Callout tone="blocking">{b.message}</Callout>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {warnings.length > 0 && (
        <Section
          title="אזהרות"
          description="אינן מונעות פרסום. אזהרה שחוסמת מלמדת אנשים לעקוף את הבדיקה."
        >
          <ul className="space-y-2">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>
                <Callout tone="warning">{w.message}</Callout>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── The action ─────────────────────────────────────────────── */}
      <Section
        title="פעולה"
        description="פרסום מקפיא את ההקרנה הציבורית ומעלה אותה לאתר. הוא אינו מפרסם מידע פנימי או היתכנות, בשום מצב."
      >
        {!canPublish && (
          <div className="mb-3">
            <Callout tone="warning" title="אין לך הרשאת פרסום">
              פרסום שמור למנהלים. אפשר לערוך ולשלוח לבדיקה.
            </Callout>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPublish}
            disabled={!canPublish || blocked || dirty || busy === 'publish'}
            title={
              !canPublish ? 'אין הרשאת פרסום'
                : blocked ? 'יש חסמים'
                : dirty ? 'יש שינויים שלא נשמרו' : undefined
            }
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'publish'
              ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              : <Globe size={15} aria-hidden="true" />}
            פרסום הפרויקט לאתר
          </button>

          {live && (
            <button
              type="button"
              onClick={onUnpublish}
              disabled={!canPublish || busy === 'unpublish'}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'unpublish'
                ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                : <EyeOff size={15} aria-hidden="true" />}
              הסרה מהאתר
            </button>
          )}
        </div>

        {blocked && (
          <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] text-red-800">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            הכפתור חסום, והשרת יסרב גם אם יופעל בדרך אחרת. כפתור מנוטרל הוא נימוס,
            לא בקרה.
          </p>
        )}
      </Section>
    </div>
  )
}
