'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Check, ExternalLink, History, Loader2, RotateCcw, Save, Send, Globe, EyeOff,
} from 'lucide-react'
import {
  cmsApi, type CmsContentDetail, type CmsRevisionSummary, type PublicationCheck,
} from '@/lib/cms-api'
import { findLocalizedLeaves, setLocalizedLeaf } from './localized-fields'
import { ExposureBanner } from './exposure'
import { cn } from '@/lib/utils'

/**
 * Page Editor V1.
 *
 * ── SAVING IS EXPLICIT, AND THE STATE IS ALWAYS ON SCREEN ──────────────────
 *
 * No autosave. An autosaving editor over content that is one button away from
 * the public website means a half-finished sentence becomes the draft of
 * record, and "did that save?" becomes a question nobody can answer from
 * looking at the screen. So there is one Save button, it is disabled when
 * nothing has changed, and the status line says one of five things:
 *
 *   נשמר / שינויים שלא נשמרו / שומר… / נשמר לפני X / שמירה נכשלה
 *
 * ── SAVING IS NOT PUBLISHING ───────────────────────────────────────────────
 *
 * The two are separate buttons with separate permissions, and the editor says
 * so in words rather than relying on the user to infer it. After a save of a
 * PUBLISHED page the banner states plainly that the website still shows the
 * previous version — the single most confusing moment in any CMS, and the one
 * worth spending a sentence on.
 *
 * ── CONCURRENCY ────────────────────────────────────────────────────────────
 *
 * Every save sends the revision this editor loaded. If somebody else saved in
 * the meantime the gateway answers 409 and this refuses rather than silently
 * overwriting their work, telling the user to reload.
 */

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error'

export function PageEditor({ contentId }: { contentId: string }) {
  const [content, setContent] = useState<CmsContentDetail | null>(null)
  const [draft, setDraft] = useState<unknown>(null)
  const [baseline, setBaseline] = useState<string>('')
  const [saveState, setSaveState] = useState<SaveState>('clean')
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [revisions, setRevisions] = useState<CmsRevisionSummary[]>([])
  const [check, setCheck] = useState<PublicationCheck | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    const [c, revs] = await Promise.all([cmsApi.get(contentId), cmsApi.revisions(contentId)])
    setContent(c)
    setDraft(c.draft)
    setBaseline(JSON.stringify(c.draft))
    setRevisions(revs)
    setSaveState('clean')
    setError(null)
    cmsApi.publicationCheck(contentId).then(setCheck).catch(() => setCheck(null))
  }, [contentId])

  useEffect(() => { void load() }, [load])

  const leaves = useMemo(() => (draft ? findLocalizedLeaves(draft) : []), [draft])
  const dirty = draft !== null && JSON.stringify(draft) !== baseline

  useEffect(() => {
    if (dirty && saveState !== 'saving') setSaveState('dirty')
    if (!dirty && saveState === 'dirty') setSaveState('clean')
  }, [dirty, saveState])

  /**
   * Warn before losing unsaved work.
   *
   * The counterpart of "no autosave": if the editor will not save for you, it
   * owes you a warning before the tab closes on twenty minutes of typing.
   */
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const edit = (path: string, value: { he: string; en?: string }) => {
    setDraft((d: unknown) => setLocalizedLeaf(d, path, value))
  }

  const save = async () => {
    if (!content || !dirty) return
    setSaveState('saving')
    setError(null)
    try {
      await cmsApi.save(contentId, {
        draft: draft as Record<string, unknown>,
        ...(content.currentRevisionId ? { expectedRevisionId: content.currentRevisionId } : {}),
      })
      await load()
      setSaveState('saved')
      setSavedAt(new Date())
    } catch (e) {
      setSaveState('error')
      setError(
        e instanceof Error && e.message.includes('נערך על ידי מישהו אחר')
          ? e.message
          : `השמירה נכשלה. ${e instanceof Error ? e.message : ''}`,
      )
    }
  }

  const act = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הפעולה נכשלה')
    } finally {
      setBusy(null)
    }
  }

  const openPreview = async () => {
    setBusy('preview')
    try {
      const { token } = await cmsApi.previewToken(contentId)
      const base = process.env['NEXT_PUBLIC_WEBSITE_URL'] ?? 'http://localhost:3003'
      const url = `${base}/he/preview/${token}`
      setPreviewUrl(url)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן ליצור קישור תצוגה')
    } finally {
      setBusy(null)
    }
  }

  if (!content || !draft) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-gray-600">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        טוען את העמוד…
      </div>
    )
  }

  const live = content.state === 'PUBLISHED' && content.livePublicationId
  const grouped = leaves.reduce<Record<number, typeof leaves>>((acc, leaf) => {
    ;(acc[leaf.blockIndex] ??= []).push(leaf)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {content.slug === 'trust' ? 'שקיפות ואמון' : content.slug}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            /{content.slug} · {leaves.length} שדות טקסט · גרסה {revisions[0]?.sequence ?? 1}
          </p>
        </div>
        <StatusPill state={saveState} savedAt={savedAt} live={!!live} />
      </div>

      <ExposureBanner level={content.exposure}>
        {live
          ? 'העמוד מפורסם. שמירה כאן אינה משנה את מה שמופיע באתר עד לפרסום.'
          : 'העמוד אינו מפורסם כרגע. האתר מציג את הגרסה שבקוד.'}
      </ExposureBanner>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3.5">
          <AlertTriangle size={17} className="mt-0.5 flex-shrink-0 text-red-700" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-red-800">{error}</p>
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saveState === 'saving'}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveState === 'saving'
            ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            : <Save size={15} aria-hidden="true" />}
          שמירה
        </button>

        <button
          type="button"
          onClick={openPreview}
          disabled={busy === 'preview'}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <ExternalLink size={15} aria-hidden="true" />
          תצוגה מקדימה
        </button>

        <button
          type="button"
          onClick={() => act('publish', () => cmsApi.publish(contentId))}
          disabled={busy === 'publish' || dirty || check?.canPublish === false}
          title={
            dirty ? 'יש שינויים שלא נשמרו' :
            check?.canPublish === false ? 'יש חסמים לפרסום' : undefined
          }
          /* teal-700 rather than the primary token: publishing is a step beyond
             saving, and the darker swatch is HIERARCHY, not a contrast patch.
             7.34:1 with white. */
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'publish'
            ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            : <Globe size={15} aria-hidden="true" />}
          פרסום לאתר
        </button>

        {live && (
          <button
            type="button"
            onClick={() => act('unpublish', () => cmsApi.unpublish(contentId))}
            disabled={busy === 'unpublish'}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <EyeOff size={15} aria-hidden="true" />
            הסרה מהאתר
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <History size={15} aria-hidden="true" />
          היסטוריה ({revisions.length})
        </button>

        {content.state !== 'PUBLISHED' && (
          <button
            type="button"
            onClick={() =>
              act('state', () =>
                cmsApi.setState(contentId, content.state === 'IN_REVIEW' ? 'DRAFT' : 'IN_REVIEW'))
            }
            disabled={busy === 'state'}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Send size={15} aria-hidden="true" />
            {content.state === 'IN_REVIEW' ? 'החזרה לטיוטה' : 'שליחה לבדיקה'}
          </button>
        )}
      </div>

      {previewUrl && (
        <p className="text-[12.5px] text-gray-600">
          קישור התצוגה תקף לשעה אחת ואינו נכנס למנועי חיפוש.{' '}
          <span className="break-all font-mono text-[11px] text-gray-500">{previewUrl}</span>
        </p>
      )}

      {/* ── Publication check ──────────────────────────────────────── */}
      {check && (check.blockers.length > 0 || check.warnings.length > 0) && (
        <div className="rounded-xl border border-border bg-white p-4">
          <h2 className="text-[15px] font-bold text-gray-900">בדיקה לפני פרסום</h2>
          {check.blockers.map((b) => (
            <p key={b.code + b.message} className="mt-2 flex items-start gap-2 text-[13px] text-red-800">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span><span className="font-semibold">חסם:</span> {b.message}</span>
            </p>
          ))}
          {check.warnings.map((w) => (
            <p key={w.code + w.message} className="mt-2 flex items-start gap-2 text-[13px] text-gray-600">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-[#7d6234]" aria-hidden="true" />
              <span><span className="font-semibold">אזהרה:</span> {w.message}</span>
            </p>
          ))}
          {check.blockers.length === 0 && (
            <p className="mt-2 text-[12.5px] text-gray-600">
              אזהרות אינן מונעות פרסום. חסמים מונעים.
            </p>
          )}
        </div>
      )}

      {/* ── History ────────────────────────────────────────────────── */}
      {showHistory && (
        <RevisionList
          revisions={revisions}
          currentId={content.currentRevisionId}
          busy={busy}
          onRestore={(revId) => act('restore', () => cmsApi.restore(contentId, revId))}
        />
      )}

      {/* ── The fields ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([idx, blockLeaves]) => (
          <fieldset key={idx} className="rounded-xl border border-border bg-white p-5">
            <legend className="px-1 text-[13px] font-bold text-gray-900">
              חלק {Number(idx) + 1} · {blockLeaves[0]!.blockType}
            </legend>
            <div className="mt-2 space-y-4">
              {blockLeaves.map((leaf) => (
                <LocalizedField
                  key={leaf.path}
                  label={leaf.label}
                  he={leaf.he}
                  en={leaf.en}
                  onChange={(v) => edit(leaf.path, v)}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  )
}

/** One field, Hebrew required and English optional. */
function LocalizedField({
  label, he, en, onChange,
}: {
  label: string
  he: string
  en?: string
  onChange: (v: { he: string; en?: string }) => void
}) {
  const long = he.length > 90
  const heId = `he-${label.replace(/\s/g, '-')}-${he.slice(0, 8)}`
  const enId = `en-${heId}`

  return (
    <div>
      <label htmlFor={heId} className="block text-[12.5px] font-semibold text-gray-600">
        {label}
      </label>
      {long ? (
        <textarea
          id={heId}
          value={he}
          rows={Math.min(8, Math.ceil(he.length / 80) + 1)}
          onChange={(e) => onChange({ he: e.target.value, ...(en !== undefined ? { en } : {}) })}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-teal-500"
        />
      ) : (
        <input
          id={heId}
          type="text"
          value={he}
          onChange={(e) => onChange({ he: e.target.value, ...(en !== undefined ? { en } : {}) })}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-900 focus:border-teal-500"
        />
      )}

      {/*
        English is optional and says so. The localisation policy is that English
        never blocks Hebrew: an empty box here means "no approved translation",
        which the site handles per field — some fall back to Hebrew, others drop
        the section entirely. It is NOT a missing value to be chased.
      */}
      <label htmlFor={enId} className="mt-2 block text-[12px] text-gray-600">
        אנגלית (לא חובה)
      </label>
      <input
        id={enId}
        type="text"
        dir="ltr"
        value={en ?? ''}
        placeholder="ללא תרגום מאושר"
        onChange={(e) => onChange({ he, en: e.target.value })}
        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-500"
      />
    </div>
  )
}

function RevisionList({
  revisions, currentId, busy, onRestore,
}: {
  revisions: CmsRevisionSummary[]
  currentId: string | null
  busy: string | null
  onRestore: (id: string) => void
}) {
  const REASON: Record<string, string> = {
    SAVE: 'שמירה', PUBLISH: 'פרסום', UNPUBLISH: 'הסרה מהאתר', RESTORE: 'שחזור',
  }
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h2 className="text-[15px] font-bold text-gray-900">היסטוריית שינויים</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">
        שחזור אינו מוחק היסטוריה: הוא יוצר גרסה חדשה עם התוכן הישן, והגרסה
        שממנה שוחזר נשארת ברשימה. שחזור אינו מפרסם.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {revisions.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-gray-900">
                גרסה {r.sequence} · {REASON[r.reason] ?? r.reason}
                {r.id === currentId && (
                  <span className="ms-2 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                    נוכחית
                  </span>
                )}
              </p>
              <p className="text-[12px] text-gray-600">
                {new Date(r.createdAt).toLocaleString('he-IL')}
                {r.author && ` · ${r.author.firstName} ${r.author.lastName}`}
                {r.summary && ` · ${r.summary}`}
              </p>
            </div>
            {r.id !== currentId && (
              <button
                type="button"
                onClick={() => onRestore(r.id)}
                disabled={busy === 'restore'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <RotateCcw size={13} aria-hidden="true" />
                שחזור
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The save state, in words. Colour is never the only signal. */
function StatusPill({
  state, savedAt, live,
}: {
  state: SaveState
  savedAt: Date | null
  live: boolean
}) {
  const MAP: Record<SaveState, { label: string; cls: string; icon: React.ReactNode }> = {
    clean: {
      label: savedAt ? `נשמר ב-${savedAt.toLocaleTimeString('he-IL')}` : 'אין שינויים',
      cls: 'border-gray-300 text-gray-600',
      icon: <Check size={14} aria-hidden="true" />,
    },
    dirty: {
      label: 'שינויים שלא נשמרו',
      cls: 'border-[#d8cdb8] bg-[#f4f1ec] text-[#7d6234]',
      icon: <AlertTriangle size={14} aria-hidden="true" />,
    },
    saving: {
      label: 'שומר…',
      cls: 'border-gray-300 text-gray-600',
      icon: <Loader2 size={14} className="animate-spin" aria-hidden="true" />,
    },
    saved: {
      label: 'נשמר',
      cls: 'border-teal-300 bg-teal-50 text-teal-700',
      icon: <Check size={14} aria-hidden="true" />,
    },
    error: {
      label: 'השמירה נכשלה',
      cls: 'border-red-300 bg-red-50 text-red-800',
      icon: <AlertTriangle size={14} aria-hidden="true" />,
    },
  }
  const s = MAP[state]
  return (
    <div className="flex items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold', s.cls)}
      >
        {s.icon}
        {s.label}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold',
          live ? 'border-teal-300 bg-white text-teal-700' : 'border-gray-300 text-gray-600',
        )}
      >
        {live ? <Globe size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
        {live ? 'מפורסם' : 'לא מפורסם'}
      </span>
    </div>
  )
}
