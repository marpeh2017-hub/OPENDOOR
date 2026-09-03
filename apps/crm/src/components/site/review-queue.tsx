'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ClipboardCheck, Loader2, ShieldAlert } from 'lucide-react'
import { cmsApi, type CmsListItem, type PublicationCheck } from '@/lib/cms-api'
import { ExposureBanner } from './exposure'
import type { ProjectDocument } from './project/types'

/**
 * Everything currently marked IN_REVIEW, across pages and projects.
 *
 * ── WHY ONE SCREEN FOR BOTH KINDS ──────────────────────────────────────────
 *
 * A reviewer's question is "what is waiting for me", not "what pages are
 * waiting" and separately "what projects are waiting". Splitting it by kind
 * would make the reviewer check two screens to answer one question.
 *
 * ── V1, DELIBERATELY ────────────────────────────────────────────────────────
 *
 * No assignment, no notification, no due date. `setState` already exists;
 * this screen only makes what it moved into visible and gives it an
 * open-the-editor link. A reviewer opens the item and uses the tools already
 * built — Publication Check, verification, restore — to decide.
 */
interface Row {
  item: CmsListItem
  title: string
  check: PublicationCheck | null
  checkError: boolean
}

export function ReviewQueue() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    cmsApi.list({ state: 'IN_REVIEW' })
      .then(async (items) => {
        const withDetail = await Promise.all(items.map(async (item) => {
          let title = item.slug
          if (item.kind === 'PROJECT') {
            try {
              const full = await cmsApi.get(item.id)
              title = (full.draft as unknown as ProjectDocument).public?.name?.he || item.slug
            } catch { /* fall back to slug */ }
          }
          let check: PublicationCheck | null = null
          let checkError = false
          try { check = await cmsApi.publicationCheck(item.id) }
          catch { checkError = true }
          return { item, title, check, checkError }
        }))
        if (!cancelled) setRows(withDetail)
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'טעינת הבדיקה נכשלה') })
    return () => { cancelled = true }
  }, [])

  const KIND_LABEL: Record<string, string> = {
    PAGE: 'עמוד', PROJECT: 'פרויקט', ARTICLE: 'כתבה', FAQ_ITEM: 'שאלה',
    NAVIGATION: 'תפריט', SETTINGS: 'הגדרות',
  }

  const editorHref = (item: CmsListItem) =>
    item.kind === 'PROJECT' ? `/site/projects/${item.slug}` : `/site/pages/${item.slug}`

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">בדיקה</h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-gray-600">
          תוכן שנשלח לבדיקה, מכל הסוגים. פתיחה מעבירה ישירות לעורך של הפריט.
        </p>
      </div>

      <ExposureBanner level="PUBLIC">
        המסך מציג רק פריטים במצב ״בבדיקה״. פרסום עדיין דורש מעבר בבדיקת פרסום
        ומעבר להרשאת פרסום, בדיוק כמו בכל עורך.
      </ExposureBanner>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3.5">
          <AlertTriangle size={17} className="mt-0.5 flex-shrink-0 text-red-700" aria-hidden="true" />
          <p className="text-[13px] text-red-800">{error}</p>
        </div>
      )}

      {rows === null && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          טוען…
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-[13.5px] text-gray-700">אין כרגע פריטים בבדיקה.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => {
            const blockers = r.check?.blockers ?? []
            return (
              <li key={r.item.id}>
                <Link
                  href={editorHref(r.item)}
                  className="block rounded-xl border border-border bg-white p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <ClipboardCheck size={18} className="flex-shrink-0 text-teal-700" aria-hidden="true" />
                        <span className="text-[15px] font-bold text-gray-900">{r.title}</span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-gray-600">
                          {KIND_LABEL[r.item.kind] ?? r.item.kind}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-gray-600">
                        /{r.item.slug}
                        {' · '}עודכן לאחרונה {new Date(r.item.updatedAt).toLocaleDateString('he-IL')}
                        {r.item.updatedBy && ` על ידי ${r.item.updatedBy.firstName} ${r.item.updatedBy.lastName}`}
                      </p>
                    </div>

                    {r.checkError ? (
                      <span className="rounded-full border border-gray-300 px-2.5 py-0.5 text-[12px] text-gray-600">
                        לא ניתן היה לבדוק חסמים
                      </span>
                    ) : blockers.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-[12px] font-semibold text-red-800">
                        <ShieldAlert size={12} aria-hidden="true" />
                        {blockers.length} חסמים לפרסום
                      </span>
                    ) : (
                      <span className="rounded-full border border-teal-300 bg-teal-50 px-2.5 py-0.5 text-[12px] font-semibold text-teal-800">
                        ללא חסמים
                      </span>
                    )}
                  </div>

                  {blockers.length > 0 && (
                    <p className="mt-2 text-[12.5px] text-gray-700">
                      <span className="font-semibold">חסם ראשון: </span>{blockers[0]!.message}
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
