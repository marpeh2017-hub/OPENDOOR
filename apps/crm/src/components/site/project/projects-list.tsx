'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, EyeOff, FolderOpen, Globe, Loader2, Search, ShieldAlert, ShieldCheck,
} from 'lucide-react'
import { cmsApi, type CmsListItem } from '@/lib/cms-api'
import { ExposureBanner } from '../exposure'
import { PHASE_LABEL, STAGE_LABEL, type ProjectDocument } from './types'

/**
 * The projects a CMS user manages.
 *
 * ── WHAT THIS LIST DELIBERATELY DOES NOT SHOW ──────────────────────────────
 *
 * Any feasibility figure. Not the unit count, not the areas, not the
 * economics. A list is the screen most likely to be on somebody's monitor
 * during a meeting, screen-shared, or photographed over a shoulder, and a
 * scenario output sitting in a column reads as a project statistic.
 *
 * What it shows instead is EDITORIAL state: is this live, what does the public
 * currently see, and is anything waiting for a person. That is what somebody
 * opening this screen is actually deciding between.
 *
 * ── WHY THE VERIFICATION COLUMN COUNTS RATHER THAN LISTS ───────────────────
 *
 * "2 נתונים ממתינים" is a reason to open the project. The field names would be
 * the beginning of a summary of the project's data, on a screen that has
 * decided not to show data.
 */
export function ProjectsList() {
  const [items, setItems] = useState<CmsListItem[] | null>(null)
  const [docs, setDocs] = useState<Record<string, ProjectDocument>>({})
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [state, setState] = useState<'ALL' | 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED'>('ALL')

  useEffect(() => {
    cmsApi.list({ kind: 'PROJECT' })
      .then(async (list) => {
        setItems(list)
        // One extra fetch per project, for the editorial summary. Fine at this
        // scale (two projects) and honest: the list endpoint deliberately does
        // not return drafts, so there is nothing to widen for a bigger tenant
        // without deciding what a list-safe project summary contains.
        const entries = await Promise.all(
          list.map(async (i) => {
            try {
              const full = await cmsApi.get(i.id)
              return [i.id, full.draft as unknown as ProjectDocument] as const
            } catch { return [i.id, null] as const }
          }),
        )
        setDocs(Object.fromEntries(entries.filter(([, d]) => d)) as Record<string, ProjectDocument>)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'טעינת הפרויקטים נכשלה'))
  }, [])

  const PHASE_OF: Record<string, string> = {
    INITIAL_REVIEW: 'ORGANISING', FEASIBILITY: 'ORGANISING',
    OWNER_ORGANIZATION: 'ORGANISING', REPRESENTATION_FORMED: 'ORGANISING',
    PROFESSIONAL_SELECTION: 'EVALUATION', DEVELOPER_TENDER: 'EVALUATION',
    DEVELOPER_SELECTED: 'EVALUATION', AGREEMENTS: 'PLANNING', PLANNING: 'PLANNING',
    PERMIT_AND_BUILD: 'EXECUTION', DELIVERY: 'EXECUTION',
  }

  const rows = useMemo(() => {
    if (!items) return []
    return items
      .filter((i) => state === 'ALL' || i.state === state)
      .filter((i) => {
        if (!query.trim()) return true
        const doc = docs[i.id]
        const haystack = [
          i.slug,
          doc?.public?.name?.he ?? '',
          doc?.public?.name?.en ?? '',
          doc?.public?.location?.city?.he ?? '',
        ].join(' ').toLowerCase()
        return haystack.includes(query.trim().toLowerCase())
      })
  }, [items, docs, query, state])

  const summarise = (doc: ProjectDocument | undefined) => {
    if (!doc) return { unverified: 0, blocked: 0, stage: null as string | null, phase: null as string | null }
    const facts = [
      ...(doc.public?.currentStage ? [doc.public.currentStage] : []),
      ...Object.values(doc.public?.facts ?? {}),
      ...(doc.milestones ?? []).flatMap((m) => (m.fact ? [m.fact] : [])),
    ]
    const unverified = facts.filter((f) => f.status === 'UNVERIFIED').length
    const blocked = (doc.internal?.dataQualityFlags ?? [])
      .filter((f) => !f.resolved && f.severity === 'BLOCKING').length
    const stageFact = doc.public?.currentStage
    const publishable =
      stageFact && (stageFact.status === 'VERIFIED' || stageFact.status === 'SELF_VERIFIED')
    const stage = stageFact ? String(stageFact.value) : null
    return {
      unverified, blocked,
      stage: stage ? (STAGE_LABEL[stage] ?? stage) : null,
      phase: publishable && stage ? (PHASE_LABEL[PHASE_OF[stage] ?? ''] ?? null) : null,
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">פרויקטים</h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-gray-600">
          פרויקט מופיע באתר רק כשהוא מפורסם, וגם אז מוצג ממנו רק מה שאומת. מידע
          פנימי ובדיקת היתכנות אינם מתפרסמים בשום מצב.
        </p>
      </div>

      <ExposureBanner level="PUBLIC">
        הרשימה הזאת מציגה מצב עריכה בלבד. נתוני היתכנות וכלכלה אינם מופיעים כאן
        במכוון: רשימה היא המסך שהכי סביר שיוקרן בישיבה.
      </ExposureBanner>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3.5">
          <AlertTriangle size={17} className="mt-0.5 flex-shrink-0 text-red-700" aria-hidden="true" />
          <p className="text-[13px] text-red-800">{error}</p>
        </div>
      )}

      {/* ── Search + state filter. Nothing more, on purpose. ───────── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="proj-search" className="block text-[12px] font-semibold text-gray-800">
            חיפוש
          </label>
          <div className="relative mt-1">
            <Search
              size={15}
              className="pointer-events-none absolute inset-y-0 end-3 my-auto text-gray-600"
              aria-hidden="true"
            />
            <input
              id="proj-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="שם פרויקט, עיר או מזהה"
              className="w-full rounded-lg border border-border px-3 py-2 pe-9 text-sm text-gray-900 focus:border-teal-600"
            />
          </div>
        </div>
        <div>
          <label htmlFor="proj-state" className="block text-[12px] font-semibold text-gray-800">
            מצב פרסום
          </label>
          <select
            id="proj-state"
            value={state}
            onChange={(e) => setState(e.target.value as typeof state)}
            className="mt-1 rounded-lg border border-border px-3 py-2 text-sm text-gray-900 focus:border-teal-600"
          >
            <option value="ALL">הכל</option>
            <option value="DRAFT">טיוטה</option>
            <option value="IN_REVIEW">בבדיקה</option>
            <option value="PUBLISHED">מפורסם</option>
          </select>
        </div>
      </div>

      {items === null && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          טוען…
        </div>
      )}

      {items && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-[13.5px] text-gray-700">
            {items.length === 0 ? 'אין פרויקטים במערכת.' : 'אין פרויקטים שתואמים לסינון.'}
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((item) => {
            const doc = docs[item.id]
            const s = summarise(doc)
            const live = item.state === 'PUBLISHED' && item.livePublicationId
            return (
              <li key={item.id}>
                <Link
                  href={`/site/projects/${item.slug}`}
                  className="block rounded-xl border border-border bg-white p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <FolderOpen size={18} className="flex-shrink-0 text-teal-700" aria-hidden="true" />
                        <span className="text-[15px] font-bold text-gray-900">
                          {doc?.public?.name?.he ?? item.slug}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-gray-600">
                        {doc?.public?.location?.city?.he ?? '—'}
                        {' · '}/{item.slug}
                        {' · '}עודכן {new Date(item.updatedAt).toLocaleDateString('he-IL')}
                        {item.updatedBy && ` · ${item.updatedBy.firstName} ${item.updatedBy.lastName}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Publication state: word + icon + surface. */}
                      <span
                        className={
                          live
                            ? 'inline-flex items-center gap-1.5 rounded-full border border-teal-300 bg-teal-50 px-2.5 py-0.5 text-[12px] font-semibold text-teal-800'
                            : 'inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-0.5 text-[12px] font-semibold text-gray-700'
                        }
                      >
                        {live ? <Globe size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
                        {live ? 'מפורסם' : item.state === 'IN_REVIEW' ? 'בבדיקה' : 'טיוטה'}
                      </span>

                      {s.phase && (
                        <span className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-gray-700">
                          פרק מוצג: {s.phase}
                        </span>
                      )}

                      {s.unverified > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[12px] text-gray-700">
                          <ShieldCheck size={12} aria-hidden="true" />
                          {s.unverified} ממתינים לאימות
                        </span>
                      )}

                      {s.blocked > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-[12px] font-semibold text-red-800">
                          <ShieldAlert size={12} aria-hidden="true" />
                          {s.blocked} בעיות חוסמות
                        </span>
                      )}
                    </div>
                  </div>

                  {s.stage && (
                    <p className="mt-2 text-[12.5px] text-gray-700">
                      <span className="font-semibold">שלב: </span>{s.stage}
                      {!s.phase && (
                        <span className="text-gray-600"> (לא מאומת, ולכן לא יופיע באתר)</span>
                      )}
                    </p>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
