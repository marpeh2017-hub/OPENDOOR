'use client'

import { Search } from 'lucide-react'
import { Section, Callout } from './fields'
import type { ProjectDocument } from './types'

/**
 * SEO — what Google and a shared link show.
 *
 * ── SEO IS BUILT FROM PUBLIC CONTENT, AND ONLY FROM PUBLIC CONTENT ─────────
 *
 * There is no "generate from project data" button, and that is deliberate.
 * The tempting version would summarise whatever text is nearest — which on
 * this screen's neighbours includes a candidate boundary, a workbook and an
 * economics table. A meta description assembled from those would put the most
 * private data in the product into the one place designed to be crawled,
 * cached and quoted.
 *
 * The gateway enforces the same thing structurally: `projectProjection` builds
 * `seo` only from `doc.seo`, and cannot read `internal` or `feasibility` at
 * all. This screen simply does not offer a path that the projection would have
 * had to refuse.
 *
 * ── AN UNPUBLISHED PROJECT IS NOT INDEXABLE, WHATEVER IS TYPED HERE ────────
 *
 * SEO lives on the project's public projection, and an unpublished project has
 * none. Nothing on this tab can make Tchernichovsky appear in a search result
 * while it is a draft, and the banner says so, because "I filled in the SEO
 * fields" is exactly the moment somebody would assume otherwise.
 */
export function TabSeo({
  doc, onChange, canEdit, isPublished,
}: {
  doc: ProjectDocument
  onChange: (next: ProjectDocument) => void
  canEdit: boolean
  isPublished: boolean
}) {
  const seo = doc.seo ?? {}

  const patch = (locale: 'he' | 'en', p: { title?: string; description?: string }) =>
    onChange({ ...doc, seo: { ...seo, [locale]: { ...(seo[locale] ?? {}), ...p } } })

  const fallbackTitle = doc.public.name?.he ?? ''
  const fallbackDescription = doc.public.summary?.he ?? ''

  return (
    <div className="space-y-5">
      {!isPublished && (
        <Callout tone="warning" title="הפרויקט אינו מפורסם">
          כל עוד הפרויקט בטיוטה הוא אינו קיים באתר, ולכן אינו נכנס למנועי חיפוש
          ואינו מופיע במפת האתר. עריכת השדות כאן אינה משנה זאת.
        </Callout>
      )}

      <Callout tone="info" title="מה מותר להיכנס לשדות האלה">
        רק תוכן שממילא ציבורי. אין למחזר לכאן נתונים מהלשוניות הפנימיות, מבדיקת
        ההיתכנות או מהתוצאות הכלכליות. אין כאן כפתור ״הפקה אוטומטית״ בדיוק מהסיבה
        הזאת.
      </Callout>

      {(['he', 'en'] as const).map((locale) => {
        const entry = seo[locale] ?? {}
        const isHe = locale === 'he'
        return (
          <Section
            key={locale}
            title={isHe ? 'עברית' : 'אנגלית (לא חובה)'}
            description={
              isHe
                ? 'אם לא ימולא, האתר ישתמש בשם הפרויקט ובתקציר שלו.'
                : 'אם לא ימולא, האתר באנגלית ישתמש בברירות המחדל שלו. אנגלית חסרה אינה מונעת פרסום.'
            }
          >
            <div className="space-y-4">
              <div>
                <label
                  htmlFor={`seo-title-${locale}`}
                  className="block text-[12.5px] font-semibold text-gray-800"
                >
                  כותרת
                </label>
                <input
                  id={`seo-title-${locale}`}
                  type="text"
                  dir={isHe ? 'rtl' : 'ltr'}
                  value={entry.title ?? ''}
                  disabled={!canEdit}
                  placeholder={isHe ? fallbackTitle : ''}
                  onChange={(e) => patch(locale, { title: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                />
                <p className="mt-1 text-[11.5px] text-gray-600">
                  {(entry.title ?? '').length} תווים. מומלץ עד 60.
                </p>
              </div>

              <div>
                <label
                  htmlFor={`seo-desc-${locale}`}
                  className="block text-[12.5px] font-semibold text-gray-800"
                >
                  תיאור
                </label>
                <textarea
                  id={`seo-desc-${locale}`}
                  rows={3}
                  dir={isHe ? 'rtl' : 'ltr'}
                  value={entry.description ?? ''}
                  disabled={!canEdit}
                  placeholder={isHe ? fallbackDescription : ''}
                  onChange={(e) => patch(locale, { description: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                />
                <p className="mt-1 text-[11.5px] text-gray-600">
                  {(entry.description ?? '').length} תווים. מומלץ עד 160.
                </p>
              </div>

              {isHe && (
                <div className="rounded-lg border border-border bg-gray-50 p-3.5">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-gray-700">
                    <Search size={12} aria-hidden="true" />
                    כך זה ייראה בערך בתוצאת חיפוש
                  </div>
                  <p className="mt-2 text-[15px] leading-snug text-teal-700">
                    {entry.title || fallbackTitle || 'כותרת העמוד'}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-700">
                    {entry.description || fallbackDescription || 'תיאור העמוד'}
                  </p>
                </div>
              )}
            </div>
          </Section>
        )
      })}
    </div>
  )
}
