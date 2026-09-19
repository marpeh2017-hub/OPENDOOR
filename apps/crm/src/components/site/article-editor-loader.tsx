'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import { cmsApi } from '@/lib/cms-api'
import { ArticleEditor } from './article-editor'

/** Resolves an article slug to a content id, then hands over to the editor —
 *  same pattern as `ProjectEditorLoader`. */
export function ArticleEditorLoader({ slug }: { slug: string }) {
  const [id, setId] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    cmsApi.list({ kind: 'ARTICLE' })
      .then((items) => {
        const match = items.find((i) => i.slug === slug)
        if (!match) { setState('missing'); return }
        setId(match.id)
        setState('ready')
      })
      .catch((e) => {
        setState('error')
        setMessage(e instanceof Error ? e.message : 'טעינת הכתבה נכשלה')
      })
  }, [slug])

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-gray-600">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        טוען…
      </div>
    )
  }

  if (state === 'missing') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">הכתבה לא נמצאה</h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-gray-600">
          אין כתבה עם המזהה <span className="font-mono text-[13px]">/{slug}</span> במערכת.
        </p>
        <Link href="/site/knowledge" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:underline">
          <ArrowRight size={15} aria-hidden="true" />
          חזרה לרשימת הכתבות
        </Link>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3.5">
        <AlertTriangle size={17} className="mt-0.5 flex-shrink-0 text-red-700" aria-hidden="true" />
        <p className="text-[13px] text-red-800">{message}</p>
      </div>
    )
  }

  return <ArticleEditor contentId={id!} slug={slug} />
}
