'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ContentEditorShell } from './content-editor-shell'
import { MediaPicker } from './media-picker'
import type { MediaLibraryItem } from './media-library'

interface ArticleDoc {
  title: { he: string; en?: string }
  summary?: { he: string; en?: string }
  category?: { he: string; en?: string }
  body?: { he: string; en?: string }
  featuredImage?: { mediaId: string; storageKey: string; alt: { he: string; en?: string }; classification: string } | null
  seo?: { he?: { title?: string; description?: string }; en?: { title?: string; description?: string } }
}

/**
 * One Knowledge Center article.
 *
 * Fields deliberately plain: two locales of title/summary/category/body, an
 * optional featured image chosen from the Media Library (never uploaded here
 * directly — see `MediaPicker`), and per-locale SEO. No rich text, no HTML:
 * `body` is plain paragraphs split on a blank line, matching the "no raw
 * HTML, no arbitrary layout" rule for every managed editor on this site.
 */
export function ArticleEditor({ contentId, slug }: { contentId: string; slug: string }) {
  return (
    <div className="space-y-4">
      <Link
        href="/site/knowledge"
        className="inline-flex items-center gap-2 text-[13px] font-medium text-gray-700 hover:text-gray-900"
      >
        <ArrowRight size={14} aria-hidden="true" />
        כל הכתבות
      </Link>

      <ContentEditorShell<ArticleDoc> contentId={contentId} title={`/${slug}`} typeLabel="כתבה">
        {({ draft, setDraft }) => (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-white p-5">
              <h2 className="text-[15px] font-bold text-gray-900">כותרת ותקציר</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="כותרת (עברית)" value={draft.title.he}
                  onChange={(v) => setDraft((d) => ({ ...d, title: { ...d.title, he: v } }))} />
                <Field label="כותרת (אנגלית, לא חובה)" dir="ltr" value={draft.title.en ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, title: { ...d.title, en: v || undefined } }))} />
                <Field label="קטגוריה (עברית, לא חובה)" value={draft.category?.he ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, category: { he: v, en: d.category?.en } }))} />
                <Field label="קטגוריה (אנגלית, לא חובה)" dir="ltr" value={draft.category?.en ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, category: { he: d.category?.he ?? '', en: v || undefined } }))} />
              </div>
              <div className="mt-3">
                <TextArea label="תקציר (עברית)" rows={2} value={draft.summary?.he ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, summary: { he: v, en: d.summary?.en } }))} />
              </div>
              <div className="mt-3">
                <TextArea label="תקציר (אנגלית, לא חובה)" dir="ltr" rows={2} value={draft.summary?.en ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, summary: { he: d.summary?.he ?? '', en: v || undefined } }))} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-5">
              <h2 className="text-[15px] font-bold text-gray-900">תמונה ראשית</h2>
              <p className="mt-1 text-[12.5px] text-gray-600">
                נבחרת מתוך ספריית המדיה בלבד. תמונת הקשר תסומן ככזו באתר ולא
                תוצג כצילום מהפרויקט.
              </p>
              <div className="mt-3">
                <MediaPicker
                  value={draft.featuredImage?.mediaId}
                  onChange={(item?: MediaLibraryItem) =>
                    setDraft((d) => ({
                      ...d,
                      featuredImage: item
                        ? {
                            mediaId: item.id, storageKey: item.storageKey,
                            alt: { he: item.altHe, en: item.altEn }, classification: item.classification,
                          }
                        : null,
                    }))
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-5">
              <h2 className="text-[15px] font-bold text-gray-900">גוף הכתבה</h2>
              <p className="mt-1 text-[12.5px] text-gray-600">
                טקסט רגיל בלבד. פסקה חדשה מתחילה בשורה ריקה. אין HTML ואין
                עיצוב חופשי.
              </p>
              <div className="mt-3">
                <TextArea label="עברית" rows={10} value={draft.body?.he ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, body: { he: v, en: d.body?.en } }))} />
              </div>
              <div className="mt-3">
                <TextArea label="אנגלית (לא חובה)" dir="ltr" rows={10} value={draft.body?.en ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, body: { he: d.body?.he ?? '', en: v || undefined } }))} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-5">
              <h2 className="text-[15px] font-bold text-gray-900">SEO</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="כותרת SEO (עברית, לא חובה)" value={draft.seo?.he?.title ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, seo: { ...d.seo, he: { ...d.seo?.he, title: v || undefined } } }))} />
                <Field label="כותרת SEO (אנגלית, לא חובה)" dir="ltr" value={draft.seo?.en?.title ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, seo: { ...d.seo, en: { ...d.seo?.en, title: v || undefined } } }))} />
              </div>
              <div className="mt-3">
                <TextArea label="תיאור SEO (עברית, לא חובה)" rows={2} value={draft.seo?.he?.description ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, seo: { ...d.seo, he: { ...d.seo?.he, description: v || undefined } } }))} />
              </div>
            </div>
          </div>
        )}
      </ContentEditorShell>
    </div>
  )
}

function Field({
  label, value, onChange, dir = 'rtl',
}: { label: string; value: string; onChange: (v: string) => void; dir?: 'rtl' | 'ltr' }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-gray-800">{label}</label>
      <input
        type="text" dir={dir} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600"
      />
    </div>
  )
}

function TextArea({
  label, value, onChange, rows = 3, dir = 'rtl',
}: { label: string; value: string; onChange: (v: string) => void; rows?: number; dir?: 'rtl' | 'ltr' }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-gray-800">{label}</label>
      <textarea
        dir={dir} rows={rows} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] leading-relaxed text-gray-900 focus:border-teal-600"
      />
    </div>
  )
}
