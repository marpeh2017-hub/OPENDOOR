'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BookOpen, Globe, EyeOff, Loader2, Plus } from 'lucide-react'
import { cmsApi, type CmsListItem } from '@/lib/cms-api'

/**
 * Every Knowledge Center article, and a way to start a new one.
 *
 * One `CmsContent` row per article (kind ARTICLE), unlike FAQ's single array —
 * an article needs its own slug, its own SEO, and its own independent publish
 * date, which is exactly the case a separate row exists for.
 */
export function KnowledgeList() {
  const [items, setItems] = useState<CmsListItem[] | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = () => {
    cmsApi.list({ kind: 'ARTICLE' })
      .then(async (list) => {
        setItems(list)
        const entries = await Promise.all(list.map(async (i) => {
          try {
            const full = await cmsApi.get(i.id)
            const t = (full.draft as { title?: { he?: string } })?.title?.he
            return [i.id, t || i.slug] as const
          } catch { return [i.id, i.slug] as const }
        }))
        setTitles(Object.fromEntries(entries))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'טעינת הכתבות נכשלה'))
  }

  useEffect(load, [])

  const createArticle = async () => {
    setCreating(true)
    setError(null)
    try {
      const slug = `article-${Date.now().toString(36)}`
      await cmsApi.create({
        kind: 'ARTICLE', slug,
        draft: { title: { he: 'כתבה חדשה' }, summary: { he: '' }, body: { he: '' } },
      })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'יצירת הכתבה נכשלה')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">מרכז ידע</h1>
          <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-gray-600">
            הכתבות במרכז הידע. כתבה מתפרסמת רק כשמישהו מחליט לפרסם אותה — אין
            פעולה אחת שמפרסמת את כולן.
          </p>
        </div>
        <button
          type="button"
          onClick={createArticle}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-teal-700 disabled:opacity-50"
        >
          {creating ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
          כתבה חדשה
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3.5">
          <AlertTriangle size={17} className="mt-0.5 flex-shrink-0 text-red-700" aria-hidden="true" />
          <p className="text-[13px] text-red-800">{error}</p>
        </div>
      )}

      {items === null && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          טוען…
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <BookOpen size={22} className="mx-auto text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-[13.5px] text-gray-600">אין עדיין כתבות. הציבור רואה מרכז ידע ריק, לא שגיאה.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => {
            const live = item.state === 'PUBLISHED' && item.livePublicationId
            return (
              <li key={item.id}>
                <Link
                  href={`/site/knowledge/${item.slug}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen size={17} className="flex-shrink-0 text-teal-700" aria-hidden="true" />
                    <span className="text-[14.5px] font-semibold text-gray-900">{titles[item.id] ?? item.slug}</span>
                    <span className="text-[12px] text-gray-500">/{item.slug}</span>
                  </div>
                  <span className={
                    live
                      ? 'inline-flex items-center gap-1.5 rounded-full border border-teal-300 bg-teal-50 px-2.5 py-0.5 text-[12px] font-semibold text-teal-800'
                      : 'inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-2.5 py-0.5 text-[12px] font-semibold text-gray-700'
                  }>
                    {live ? <Globe size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
                    {live ? 'מפורסם' : item.state === 'IN_REVIEW' ? 'בבדיקה' : 'טיוטה'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
