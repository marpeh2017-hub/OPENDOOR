'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import { cmsApi } from '@/lib/cms-api'
import { PageEditor } from './page-editor'

/** Resolves a slug to a content id, then hands over to the editor. */
export function PageEditorLoader({ slug }: { slug: string }) {
  const [id, setId] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    cmsApi.list({ kind: 'PAGE' })
      .then((items) => {
        const match = items.find((i) => i.slug === slug)
        if (!match) { setState('missing'); return }
        setId(match.id)
        setState('ready')
      })
      .catch((e) => {
        setState('error')
        setMessage(e instanceof Error ? e.message : 'טעינת העמוד נכשלה')
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">העמוד אינו מנוהל כאן</h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-gray-600">
          העמוד <span className="font-mono text-[13px]">/{slug}</span> מופיע באתר,
          אבל התוכן שלו עדיין נמצא בקוד ולא במערכת. עריכה שלו דורשת מפתח.
        </p>
        <Link
          href="/site/pages"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:underline"
        >
          <ArrowRight size={15} aria-hidden="true" />
          חזרה לרשימת העמודים
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

  return (
    <div className="space-y-4">
      <Link
        href="/site/pages"
        className="inline-flex items-center gap-2 text-[13px] font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowRight size={14} aria-hidden="true" />
        כל העמודים
      </Link>
      <PageEditor contentId={id!} />
    </div>
  )
}
