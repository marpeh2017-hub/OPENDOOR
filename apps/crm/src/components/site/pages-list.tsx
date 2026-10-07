'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Globe, EyeOff, Loader2, AlertTriangle } from 'lucide-react'
import { cmsApi, type CmsListItem } from '@/lib/cms-api'
import { ExposureBanner } from './exposure'

/**
 * The website's pages, split by whether the CMS actually controls them.
 *
 * ── WHY THE UNMIGRATED PAGES ARE LISTED AT ALL ─────────────────────────────
 *
 * They could be hidden, and the screen would look tidier and more finished.
 * It would also be lying by omission: the site has thirteen fixed pages, an
 * editor who cannot find /services here will conclude the CMS is broken
 * rather than that /services has not been migrated, and the person who has
 * to answer that question is not in the room.
 *
 * So both groups are shown, and the second says plainly what it is: still in
 * code, editable by a developer, migrating in a later pass. That is the same
 * honesty the public site applies to a project with no verified figures.
 *
 * A page with a screen of its own (`editHref`, today only the FAQ) is never
 * in the second group: it is editable before its first save, so it is listed
 * with the managed pages from the start.
 */

/**
 * The site's fixed pages in menu order, named as the site names them, so the
 * second group can say what is missing. Projects and the knowledge centre
 * have their own screens and are not pages here.
 */
const SITE_PAGES: { slug: string; label: string; editHref?: string; firstSaveNote?: string }[] = [
  { slug: 'home', label: 'עמוד הבית' },
  { slug: 'about', label: 'מי אנחנו' },
  { slug: 'why-organizer', label: 'למה חברה מארגנת' },
  { slug: 'how-we-work', label: 'כך אנחנו עובדים' },
  { slug: 'services', label: 'השירותים שלנו' },
  { slug: 'stalled-projects', label: 'פרויקטים תקועים' },
  { slug: 'trust', label: 'שקיפות ואמון' },
  {
    slug: 'faq', label: 'שאלות ותשובות', editHref: '/site/faq',
    firstSaveNote: 'האתר מציג את השאלות המאושרות עד שיתפרסמו שאלות מכאן',
  },
  { slug: 'eligibility', label: 'דברו איתנו על הבניין שלכם' },
  { slug: 'contact', label: 'יצירת קשר' },
  { slug: 'privacy', label: 'מדיניות פרטיות' },
  { slug: 'terms', label: 'תנאי שימוש' },
  { slug: 'accessibility', label: 'הצהרת נגישות' },
]

export function PagesList() {
  const [items, setItems] = useState<CmsListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    cmsApi
      .list({ kind: 'PAGE' })
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'טעינת העמודים נכשלה'))
  }, [])

  const managedSlugs = new Set((items ?? []).map((i) => i.slug))
  const unmigrated = SITE_PAGES.filter((p) => !managedSlugs.has(p.slug) && !p.editHref)
  // Pages with a screen of their own that have not been saved yet.
  const notYetSaved = SITE_PAGES.filter((p) => p.editHref && !managedSlugs.has(p.slug))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">עמודים</h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-gray-600">
          העמודים הקבועים של האתר. עמוד שנוהל כאן נערך ומתפרסם בלי פריסת קוד.
        </p>
      </div>

      <ExposureBanner level="PUBLIC" />

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3.5"
        >
          <AlertTriangle
            size={17}
            className="mt-0.5 flex-shrink-0 text-red-700"
            aria-hidden="true"
          />
          <p className="text-[13px] text-red-800">{error}</p>
        </div>
      )}

      {items === null && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          טוען…
        </div>
      )}

      {items && (items.length > 0 || notYetSaved.length > 0) && (
        <section className="rounded-xl border border-border bg-white">
          <h2 className="border-b border-border px-5 py-3 text-[15px] font-bold text-gray-900">
            מנוהל במערכת
          </h2>
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const live = item.state === 'PUBLISHED' && item.livePublicationId
              const page = SITE_PAGES.find((p) => p.slug === item.slug)
              const label = page?.label ?? item.slug
              return (
                <li key={item.id}>
                  <Link
                    href={page?.editHref ?? `/site/pages/${item.slug}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-3">
                      <FileText
                        size={18}
                        className="flex-shrink-0 text-teal-500"
                        aria-hidden="true"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">{label}</span>
                        <span className="block text-[12.5px] text-gray-600">
                          /{item.slug} · עודכן{' '}
                          {new Date(item.updatedAt).toLocaleDateString('he-IL')}
                          {item.updatedBy &&
                            ` · ${item.updatedBy.firstName} ${item.updatedBy.lastName}`}
                        </span>
                      </span>
                    </span>
                    <span
                      className={
                        live
                          ? 'inline-flex items-center gap-1.5 rounded-full border border-teal-300 px-2.5 py-0.5 text-[12px] font-semibold text-teal-700'
                          : 'inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-2.5 py-0.5 text-[12px] font-semibold text-gray-600'
                      }
                    >
                      {live ? (
                        <Globe size={12} aria-hidden="true" />
                      ) : (
                        <EyeOff size={12} aria-hidden="true" />
                      )}
                      {live ? 'מפורסם' : 'טיוטה'}
                    </span>
                  </Link>
                </li>
              )
            })}
            {notYetSaved.map((page) => (
              <li key={page.slug}>
                <Link
                  href={page.editHref!}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50"
                >
                  <span className="flex items-center gap-3">
                    <FileText size={18} className="flex-shrink-0 text-teal-500" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">{page.label}</span>
                      <span className="block text-[12.5px] text-gray-600">
                        /{page.slug}
                        {page.firstSaveNote && ` · ${page.firstSaveNote}`}
                      </span>
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-2.5 py-0.5 text-[12px] font-semibold text-gray-600">
                    <EyeOff size={12} aria-hidden="true" />
                    טרם נערך
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unmigrated.length > 0 && (
        <section className="rounded-xl border border-border bg-gray-50 p-5">
          <h2 className="text-[15px] font-bold text-gray-900">עמודים בעריכה טכנית</h2>
          <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-gray-600">
            לעדכון התוכן בעמודים האלה יש לפנות למי שמתחזק את האתר. עריכתם אינה זמינה במסך זה.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {unmigrated.map((p) => (
              <li
                key={p.slug}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[12.5px] text-gray-600"
              >
                {p.label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
