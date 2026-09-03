'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Check, ExternalLink, History, Loader2, RotateCcw, Save, Send, Globe, EyeOff,
} from 'lucide-react'
import {
  cmsApi, type CmsContentDetail, type CmsRevisionSummary, type PublicationCheck,
} from '@/lib/cms-api'
import { ExposureBanner } from './exposure'
import { PublishConfirmDialog, UnpublishConfirmDialog } from './project/publish-confirm-dialog'

/**
 * The Save / Preview / Publish / History shell, factored out for Pass 4G.
 *
 * ── WHY A NEW SHARED COMPONENT RATHER THAN REUSING `PageEditor` ────────────
 *
 * `PageEditor` is approved, live, and edits the one shape every migrated page
 * uses: a block tree walked by `findLocalizedLeaves`. FAQ and Knowledge Center
 * documents are a different shape (an items array; per-article fields), and
 * bending `PageEditor` to also understand those shapes risks the working
 * pages this pass is explicitly told not to reopen. This is new code for two
 * new content types, sharing only what genuinely does not depend on the
 * shape: the save/dirty/publish/history mechanics every `CmsContent` row has
 * regardless of what its `draft` contains.
 *
 * The caller owns the content area entirely via `children`, and reads/writes
 * the draft through `draft`/`setDraft` — this component never looks inside it.
 */
export function ContentEditorShell<TDraft>({
  contentId, title, typeLabel, children,
}: {
  contentId: string
  /** Shown in the header. */
  title: string
  /** "עמוד" / "כתבה" / "שאלות ותשובות" — names what kind of thing this is. */
  typeLabel: string
  children: (props: {
    content: CmsContentDetail
    draft: TDraft
    setDraft: (updater: (d: TDraft) => TDraft) => void
    dirty: boolean
  }) => React.ReactNode
}) {
  const [content, setContent] = useState<CmsContentDetail | null>(null)
  const [draft, setDraftState] = useState<TDraft | null>(null)
  const [baseline, setBaseline] = useState<string>('')
  const [saveState, setSaveState] = useState<'clean' | 'dirty' | 'saving' | 'saved' | 'error'>('clean')
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [revisions, setRevisions] = useState<CmsRevisionSummary[]>([])
  const [check, setCheck] = useState<PublicationCheck | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)

  const load = useCallback(async () => {
    const [c, revs] = await Promise.all([cmsApi.get(contentId), cmsApi.revisions(contentId)])
    setContent(c)
    setDraftState(c.draft as unknown as TDraft)
    setBaseline(JSON.stringify(c.draft))
    setRevisions(revs)
    setSaveState('clean')
    setError(null)
    cmsApi.publicationCheck(contentId).then(setCheck).catch(() => setCheck(null))
  }, [contentId])

  useEffect(() => { void load() }, [load])

  const dirty = draft !== null && JSON.stringify(draft) !== baseline

  useEffect(() => {
    if (dirty && saveState !== 'saving') setSaveState('dirty')
    if (!dirty && saveState === 'dirty') setSaveState('clean')
  }, [dirty, saveState])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const setDraft = (updater: (d: TDraft) => TDraft) => {
    setDraftState((d) => (d === null ? d : updater(d)))
  }

  const save = async () => {
    if (!content || !dirty || draft === null) return
    setSaveState('saving')
    setError(null)
    try {
      await cmsApi.save(contentId, {
        draft: draft as unknown as Record<string, unknown>,
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

  if (!content || draft === null) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-gray-600">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        טוען…
      </div>
    )
  }

  const live = content.state === 'PUBLISHED' && content.livePublicationId

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {typeLabel} · /{content.slug} · גרסה {revisions[0]?.sequence ?? 1}
          </p>
        </div>
        <StatusPill state={saveState} savedAt={savedAt} live={!!live} />
      </div>

      <ExposureBanner level={content.exposure}>
        {live
          ? `ה${typeLabel} מפורסם. שמירה כאן אינה משנה את מה שמופיע באתר עד לפרסום.`
          : `ה${typeLabel} אינו מפורסם כרגע. האתר אינו מציג אותו.`}
      </ExposureBanner>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3.5">
          <AlertTriangle size={17} className="mt-0.5 flex-shrink-0 text-red-700" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-red-800">{error}</p>
        </div>
      )}

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
          onClick={() => setConfirmPublish(true)}
          disabled={busy === 'publish' || dirty || check?.canPublish === false}
          title={
            dirty ? 'יש שינויים שלא נשמרו' :
            check?.canPublish === false ? 'יש חסמים לפרסום' : undefined
          }
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
            onClick={() => setConfirmUnpublish(true)}
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
        </div>
      )}

      {showHistory && (
        <RevisionList
          revisions={revisions}
          currentId={content.currentRevisionId}
          busy={busy}
          onRestore={(revId) => act('restore', () => cmsApi.restore(contentId, revId))}
        />
      )}

      {children({ content, draft, setDraft, dirty })}

      <PublishConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        onConfirm={() => { setConfirmPublish(false); act('publish', () => cmsApi.publish(contentId)) }}
        targetName={title}
        busy={busy === 'publish'}
      />
      <UnpublishConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        onConfirm={() => { setConfirmUnpublish(false); act('unpublish', () => cmsApi.unpublish(contentId)) }}
        targetName={title}
        busy={busy === 'unpublish'}
      />
    </div>
  )
}

function StatusPill({
  state, savedAt, live,
}: {
  state: 'clean' | 'dirty' | 'saving' | 'saved' | 'error'
  savedAt: Date | null
  live: boolean
}) {
  const MAP: Record<typeof state, { label: string; cls: string; icon: React.ReactNode }> = {
    clean: { label: 'נשמר', cls: 'border-teal-300 bg-teal-50 text-teal-700', icon: <Check size={14} aria-hidden="true" /> },
    dirty: { label: 'שינויים שלא נשמרו', cls: 'border-gray-300 text-gray-600', icon: <AlertTriangle size={14} aria-hidden="true" /> },
    saving: { label: 'שומר…', cls: 'border-gray-300 text-gray-600', icon: <Loader2 size={14} className="animate-spin" aria-hidden="true" /> },
    saved: { label: 'נשמר', cls: 'border-teal-300 bg-teal-50 text-teal-700', icon: <Check size={14} aria-hidden="true" /> },
    error: { label: 'השמירה נכשלה', cls: 'border-red-300 bg-red-50 text-red-800', icon: <AlertTriangle size={14} aria-hidden="true" /> },
  }
  const s = MAP[state]
  return (
    <div className="flex items-center gap-2">
      <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold ${s.cls}`}>
        {s.icon}
        {s.label}
      </span>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold ${live ? 'border-teal-300 bg-white text-teal-700' : 'border-gray-300 text-gray-600'}`}>
        {live ? <Globe size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
        {live ? 'מפורסם' : 'לא מפורסם'}
      </span>
      {savedAt && state === 'clean' && (
        <span className="text-[11.5px] text-gray-500">
          {savedAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}

function RevisionList({
  revisions, currentId, busy, onRestore,
}: {
  revisions: CmsRevisionSummary[]
  currentId: string | null
  busy: string | null
  onRestore: (revisionId: string) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h2 className="text-[15px] font-bold text-gray-900">היסטוריית גרסאות</h2>
      <ul className="mt-3 space-y-2">
        {revisions.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5">
            <div>
              <span className="text-[13px] font-semibold text-gray-900">גרסה {r.sequence}</span>
              <span className="ms-2 text-[12px] text-gray-600">
                {r.reason === 'PUBLISH' ? 'פרסום' : r.reason === 'RESTORE' ? 'שחזור' : r.reason === 'UNPUBLISH' ? 'הסרה' : 'שמירה'}
                {' · '}{new Date(r.createdAt).toLocaleString('he-IL')}
                {r.summary ? ` · ${r.summary}` : ''}
              </span>
            </div>
            {r.id !== currentId && (
              <button
                type="button"
                onClick={() => onRestore(r.id)}
                disabled={busy === 'restore'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <RotateCcw size={12} aria-hidden="true" />
                שחזור
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
