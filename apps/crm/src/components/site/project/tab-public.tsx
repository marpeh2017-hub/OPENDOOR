'use client'

import { Globe, Lock } from 'lucide-react'
import { ExposureBanner } from '../exposure'
import { LocalizedField, Section, Callout, StatusBadge, StatusEffect } from './fields'
import {
  PHASE_LABEL, STAGE_LABEL, factLabel,
  type ProjectDocument, type LocalizedContent,
} from './types'

/**
 * מידע ציבורי — the only tab whose contents can reach the website.
 *
 * ── WHY THE FACTS ARE READ-ONLY HERE ───────────────────────────────────────
 *
 * Editorial sentences (summary, description, role) are edited on this tab and
 * saved like any other draft content. Material FACTS — unit counts, areas,
 * planning status, the process stage — are shown here but edited on the
 * verification tab.
 *
 * That is not tidiness. Editing a material fact has a consequence editing a
 * sentence does not: it invalidates a verification somebody signed. Putting
 * the two side by side in one form would make that consequence look like a
 * typo correction. So this tab shows what each fact currently says and whether
 * it will reach the site, and sends you elsewhere to change it.
 *
 * ── WHY THE PHASE IS NOT EDITABLE AT ALL ───────────────────────────────────
 *
 * The public phase is DERIVED from the stage. Storing it separately would let
 * the two disagree, and the version a resident reads would be the one nobody
 * checked. Shown here as a consequence of the stage, never as a field.
 */
export function TabPublic({
  doc, onChange, canEdit,
}: {
  doc: ProjectDocument
  onChange: (next: ProjectDocument) => void
  canEdit: boolean
}) {
  const p = doc.public

  const setPublic = (patch: Partial<ProjectDocument['public']>) =>
    onChange({ ...doc, public: { ...p, ...patch } })

  const setLocation = (patch: Partial<ProjectDocument['public']['location']>) =>
    onChange({ ...doc, public: { ...p, location: { ...p.location, ...patch } } })

  const clean = (v: { he: string; en?: string }): LocalizedContent =>
    v.en ? { he: v.he, en: v.en } : { he: v.he }

  const stage = p.currentStage
  const stagePublishable = stage
    ? stage.status === 'VERIFIED' || stage.status === 'SELF_VERIFIED'
    : false
  // Mirrors STAGE_PHASE in the contracts. Shown so an editor can see which
  // public phase their stage produces, because that is what a resident reads.
  const PHASE_OF: Record<string, string> = {
    INITIAL_REVIEW: 'ORGANISING', FEASIBILITY: 'ORGANISING',
    OWNER_ORGANIZATION: 'ORGANISING', REPRESENTATION_FORMED: 'ORGANISING',
    PROFESSIONAL_SELECTION: 'EVALUATION', DEVELOPER_TENDER: 'EVALUATION',
    DEVELOPER_SELECTED: 'EVALUATION', AGREEMENTS: 'PLANNING', PLANNING: 'PLANNING',
    PERMIT_AND_BUILD: 'EXECUTION', DELIVERY: 'EXECUTION',
  }

  const addressFact = p.facts?.['address']
  const addressVerified =
    addressFact?.status === 'VERIFIED' || addressFact?.status === 'SELF_VERIFIED'

  return (
    <div className="space-y-5">
      <ExposureBanner level="PUBLIC">
        מה שמופיע בלשונית הזאת יכול להגיע לאתר, אחרי אימות ואחרי פרסום. שמירה כאן
        אינה מפרסמת.
      </ExposureBanner>

      <Section
        title="זהות הפרויקט"
        description="השם והמיקום כפי שיופיעו באתר."
      >
        <div className="space-y-5">
          <LocalizedField
            label="שם הפרויקט"
            value={p.name}
            fallback="SOURCE"
            disabled={!canEdit}
            hint="שמות רחובות ומתחמים אינם מתורגמים אוטומטית. אם אין שם אנגלי מאושר, האתר יציג את העברי."
            onChange={(v) => setPublic({ name: clean(v) })}
          />
          <LocalizedField
            label="עיר"
            value={p.location.city}
            fallback="SOURCE"
            disabled={!canEdit}
            onChange={(v) => setLocation({ city: clean(v) })}
          />
          <LocalizedField
            label="שכונה (לא חובה)"
            value={p.location.neighborhood}
            fallback="SOURCE"
            disabled={!canEdit}
            onChange={(v) => setLocation({ neighborhood: v.he ? clean(v) : undefined })}
          />

          {/*
            The street is gated on a verified address, and says so rather than
            silently discarding what somebody types. An editor who fills this
            in and sees nothing on the site would conclude the CMS is broken.
          */}
          <div>
            <LocalizedField
              label="רחוב ומספר"
              value={p.location.street}
              fallback="SOURCE"
              disabled={!canEdit}
              hint="מופיע באתר רק אם הנתון ״כתובת״ מאומת בלשונית אימות נתונים."
              onChange={(v) => setLocation({ street: v.he ? clean(v) : undefined })}
            />
            <div className="mt-2">
              {addressVerified ? (
                <Callout tone="info">
                  <span className="inline-flex items-center gap-1.5">
                    <Globe size={13} aria-hidden="true" />
                    הכתובת מאומתת, ולכן הרחוב יופיע באתר.
                  </span>
                </Callout>
              ) : (
                <Callout tone="warning" title="הרחוב לא יופיע באתר">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock size={13} aria-hidden="true" />
                    הנתון ״כתובת״ אינו מאומת. האתר יציג עיר בלבד.
                  </span>
                </Callout>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="טקסטים"
        description="הטקסטים שמופיעים בעמוד הפרויקט. אלה משפטים עריכתיים ולא נתונים, ולכן הם אינם עוברים אימות."
      >
        <div className="space-y-5">
          <LocalizedField
            label="תקציר"
            value={p.summary}
            fallback="SOURCE"
            multiline
            disabled={!canEdit}
            hint="משפט או שניים. מופיע בכרטיס הפרויקט וברשימה."
            onChange={(v) => setPublic({ summary: v.he ? clean(v) : undefined })}
          />
          <LocalizedField
            label="תיאור"
            value={p.description}
            fallback="OMIT"
            multiline
            disabled={!canEdit}
            hint="הטקסט המלא בעמוד הפרויקט."
            onChange={(v) => setPublic({ description: v.he ? clean(v) : undefined })}
          />
          <LocalizedField
            label="תפקיד OpenDoor בפרויקט"
            value={p.role}
            fallback="OMIT"
            multiline
            disabled={!canEdit}
            hint="מה אנחנו עושים במתחם הזה. אין לנסח כאן ייעוץ משפטי או הבטחה לתוצאה."
            onChange={(v) => setPublic({ role: v.he ? clean(v) : undefined })}
          />
        </div>
      </Section>

      <Section
        title="שלב התהליך"
        description="השלב הוא נתון מהותי ולכן נערך בלשונית אימות נתונים. הפרק המוצג באתר נגזר ממנו."
      >
        {stage ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-gray-900">
                {STAGE_LABEL[String(stage.value)] ?? String(stage.value)}
              </span>
              <StatusBadge status={stage.status} />
            </div>
            <StatusEffect status={stage.status} />
            <div className="rounded-lg border border-border bg-gray-50 p-3">
              <p className="text-[12.5px] text-gray-700">
                <span className="font-semibold">הפרק שיופיע באתר: </span>
                {stagePublishable
                  ? (PHASE_LABEL[PHASE_OF[String(stage.value)] ?? ''] ?? 'לא ידוע')
                  : 'לא יופיע פרק, כי השלב אינו מאומת'}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
                הפרק אינו שדה נפרד. הוא נגזר מהשלב, כדי ששניהם לא יוכלו לסתור זה את זה.
              </p>
            </div>
          </div>
        ) : (
          <Callout tone="info">
            לא נקבע שלב. פרויקט ללא שלב הוא מצב תקין: האתר פשוט לא יציג פרק.
          </Callout>
        )}
      </Section>

      <Section
        title="נתונים מהותיים"
        description="נתונים עובדתיים על המתחם. הם נערכים ומאומתים בלשונית אימות נתונים, ומופיעים כאן כדי שיהיה ברור מה יגיע לאתר."
      >
        {p.facts && Object.keys(p.facts).length > 0 ? (
          <ul className="space-y-2.5">
            {Object.entries(p.facts).map(([key, fact]) => (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-gray-900">
                    {factLabel(`public.facts.${key}`)}
                  </div>
                  <div className="mt-0.5 font-mono text-[12.5px] text-gray-700" dir="ltr">
                    {fact.value === null || fact.value === undefined
                      ? '—'
                      : String(fact.value)}
                  </div>
                </div>
                <StatusBadge status={fact.status} />
              </li>
            ))}
          </ul>
        ) : (
          <Callout tone="info">
            אין נתונים מהותיים בפרויקט הזה. זה מצב תקין: עמוד פרויקט עובד גם בלי מספרים.
          </Callout>
        )}
      </Section>
    </div>
  )
}
