'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import { cmsApi } from '@/lib/cms-api'
import { useCmsPermissions } from '@/hooks/use-auth'
import { ProjectEditor } from './project-editor'

/**
 * Resolves a project slug to a content id, then hands over to the editor.
 *
 * The slug is resolved against the list the caller is already permitted to
 * read, so a wrong or unauthorised slug produces "not found" from data they
 * could already see — rather than a lookup whose response would reveal whether
 * that id exists somewhere.
 */
export function ProjectEditorLoader({ slug }: { slug: string }) {
  const [id, setId] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const permissions = useCmsPermissions()

  useEffect(() => {
    cmsApi.list({ kind: 'PROJECT' })
      .then((items) => {
        const match = items.find((i) => i.slug === slug)
        if (!match) { setState('missing'); return }
        setId(match.id)
        setState('ready')
      })
      .catch((e) => {
        setState('error')
        setMessage(e instanceof Error ? e.message : 'טעינת הפרויקט נכשלה')
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">הפרויקט לא נמצא</h1>
        <p className="max-w-prose text-[15px] leading-relaxed text-gray-600">
          אין פרויקט עם המזהה <span className="font-mono text-[13px]">/{slug}</span> במערכת.
        </p>
        <Link
          href="/site/projects"
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:underline"
        >
          <ArrowRight size={15} aria-hidden="true" />
          חזרה לרשימת הפרויקטים
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
        href="/site/projects"
        className="inline-flex items-center gap-2 text-[13px] font-medium text-gray-700 hover:text-gray-900"
      >
        <ArrowRight size={14} aria-hidden="true" />
        כל הפרויקטים
      </Link>
      <ProjectEditor contentId={id!} permissions={permissions} />
    </div>
  )
}
