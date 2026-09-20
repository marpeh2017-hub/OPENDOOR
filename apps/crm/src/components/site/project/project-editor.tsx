'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileText,
  Globe,
  History,
  Image as ImageIcon,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  EyeOff,
  Milestone,
  Calculator,
} from 'lucide-react'
import {
  cmsApi,
  type CmsContentDetail,
  type CmsRevisionSummary,
  type PublicationCheck,
} from '@/lib/cms-api'
import { cn } from '@/lib/utils'
import type { ProjectDocument } from './types'
import { TabPublic } from './tab-public'
import { TabInternal } from './tab-internal'
import { TabVerification } from './tab-verification'
import { TabFeasibility } from './tab-feasibility'
import { TabTimeline } from './tab-timeline'
import { TabMedia } from './tab-media'
import { TabSeo } from './tab-seo'
import { TabPublication } from './tab-publication'

/**
 * The Project Editor.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  EIGHT TABS, GROUPED BY HOW FAR THEIR CONTENTS MAY TRAVEL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The tabs are not ordered by workflow. They are ordered and grouped by
 * EXPOSURE, because that is the distinction an editor has to hold in their
 * head at every moment, and a tab strip that mixes public and confidential
 * areas in one undifferentiated row makes it a memory exercise.
 *
 *   ציבורי       מידע ציבורי · אבני דרך · תמונות · SEO
 *   פנימי        מידע פנימי · אימות נתונים
 *   היתכנות      בדיקת היתכנות
 *   פרסום        פרסום
 *
 * Each group carries a word and an icon as well as a surface, so the grouping
 * survives a colourblind editor and a monochrome print.
 *
 * ── ONE SAVE, ACROSS ALL TABS ──────────────────────────────────────────────
 *
 * The document is one row, so it is one draft and one Save. Switching tabs
 * with unsaved work does NOT discard it — losing an edit because somebody
 * looked at another tab would be indefensible — and the dirty state stays
 * visible in the header no matter which tab is open.
 *
 * Facts are the exception: they are saved individually through their own
 * endpoint, because editing one has a consequence (invalidating a signature)
 * that must not ride along inside an unrelated bulk save.
 */

type TabId =
  | 'public'
  | 'internal'
  | 'verification'
  | 'feasibility'
  | 'timeline'
  | 'media'
  | 'seo'
  | 'publication'

type Exposure = 'PUBLIC' | 'INTERNAL' | 'FEASIBILITY' | 'PUBLISH'

const TABS: { id: TabId; label: string; icon: typeof FileText; exposure: Exposure }[] = [
  { id: 'public', label: 'מידע ציבורי', icon: FileText, exposure: 'PUBLIC' },
  { id: 'timeline', label: 'אבני דרך', icon: Milestone, exposure: 'PUBLIC' },
  { id: 'media', label: 'תמונות ומדיה', icon: ImageIcon, exposure: 'PUBLIC' },
  { id: 'seo', label: 'SEO', icon: Search, exposure: 'PUBLIC' },
  { id: 'internal', label: 'מידע פנימי', icon: Lock, exposure: 'INTERNAL' },
  { id: 'verification', label: 'אימות נתונים', icon: ShieldCheck, exposure: 'INTERNAL' },
  { id: 'feasibility', label: 'בדיקת היתכנות', icon: Calculator, exposure: 'FEASIBILITY' },
  { id: 'publication', label: 'פרסום', icon: Globe, exposure: 'PUBLISH' },
]

const EXPOSURE_STYLE: Record<Exposure, { active: string; idle: string; group: string }> = {
  PUBLIC: {
    active: 'border-teal-600 bg-teal-50 text-teal-800',
    idle: 'border-transparent text-gray-700 hover:bg-gray-50',
    group: 'ציבורי',
  },
  INTERNAL: {
    active: 'border-gray-700 bg-gray-100 text-gray-900',
    idle: 'border-transparent text-gray-700 hover:bg-gray-50',
    group: 'פנימי',
  },
  FEASIBILITY: {
    active: 'border-[#7d6234] bg-[#f4f1ec] text-[#7d6234]',
    idle: 'border-transparent text-gray-700 hover:bg-gray-50',
    group: 'היתכנות',
  },
  PUBLISH: {
    active: 'border-teal-800 bg-teal-50 text-teal-900',
    idle: 'border-transparent text-gray-700 hover:bg-gray-50',
    group: 'פרסום',
  },
}

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error'

export function ProjectEditor({
  contentId,
  permissions,
}: {
  contentId: string
  permissions: {
    canEdit: boolean
    canVerify: boolean
    canPublish: boolean
    canFeasibility: boolean
  }
}) {
  const [content, setContent] = useState<CmsContentDetail | null>(null)
  const [doc, setDoc] = useState<ProjectDocument | null>(null)
  const [baseline, setBaseline] = useState('')
  const [tab, setTab] = useState<TabId>('public')
  const [saveState, setSaveState] = useState<SaveState>('clean')
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [revisions, setRevisions] = useState<CmsRevisionSummary[]>([])
  const [check, setCheck] = useState<PublicationCheck | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [focusIntent, setFocusIntent] = useState<TabId | null>(null)

  // Apply a keyboard-driven focus move AFTER the re-render that selected it.
  useEffect(() => {
    if (!focusIntent) return
    tabRefs.current[focusIntent]?.focus()
    setFocusIntent(null)
  }, [focusIntent])

  const load = useCallback(async () => {
    const [c, revs] = await Promise.all([cmsApi.get(contentId), cmsApi.revisions(contentId)])
    setContent(c)
    setDoc(c.draft as unknown as ProjectDocument)
    setBaseline(JSON.stringify(c.draft))
    setRevisions(revs)
    setSaveState('clean')
    setError(null)
    cmsApi
      .publicationCheck(contentId)
      .then(setCheck)
      .catch(() => setCheck(null))
  }, [contentId])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = doc !== null && JSON.stringify(doc) !== baseline

  useEffect(() => {
    if (dirty && saveState !== 'saving') setSaveState('dirty')
    if (!dirty && saveState === 'dirty') setSaveState('clean')
  }, [dirty, saveState])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const save = async () => {
    if (!content || !doc || !dirty) return
    setSaveState('saving')
    setError(null)
    try {
      await cmsApi.save(contentId, {
        draft: doc as unknown as Record<string, unknown>,
        ...(content.currentRevisionId ? { expectedRevisionId: content.currentRevisionId } : {}),
      })
      await load()
      setSaveState('saved')
      setSavedAt(new Date())
    } catch (e) {
      setSaveState('error')
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
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
      setPreviewUrl(`${base}/he/preview/${token}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן ליצור קישור תצוגה')
    } finally {
      setBusy(null)
    }
  }

  /**
   * Arrow-key navigation across the tab strip, per the WAI-ARIA tabs pattern.
   *
   * ArrowLeft advances and ArrowRight retreats because the strip is RTL: the
   * "next" tab is the one to the left of the current one.
   *
   * The focus move is recorded as INTENT and applied in an effect below, not
   * called here. Calling `.focus()` synchronously ran against the pre-render
   * DOM, so focus stayed on the old tab while the panel changed underneath it
   * — the keyboard user ended up on a tab that no longer matched what they
   * were reading.
   */
  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    const keys: Record<string, number> = { ArrowRight: -1, ArrowLeft: 1 }
    if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    let next: number
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else next = (index + keys[e.key]! + TABS.length) % TABS.length
    const target = TABS[next]!
    setTab(target.id)
    setFocusIntent(target.id)
  }

  if (!content || !doc) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-gray-600">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        טוען את הפרויקט…
      </div>
    )
  }

  const live = content.state === 'PUBLISHED' && content.livePublicationId
  const current = TABS.find((t) => t.id === tab)!
  const grouped = TABS.reduce<Record<Exposure, typeof TABS>>(
    (acc, t) => {
      ;(acc[t.exposure] ??= []).push(t)
      return acc
    },
    {} as Record<Exposure, typeof TABS>,
  )

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {doc.public?.name?.he || content.slug}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {doc.public?.location?.city?.he}
            {' · '}/{content.slug}
            {' · '}גרסה {revisions[0]?.sequence ?? 1}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveBadge state={saveState} savedAt={savedAt} />
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold',
              live ? 'border-teal-300 bg-white text-teal-800' : 'border-gray-300 text-gray-700',
            )}
          >
            {live ? (
              <Globe size={14} aria-hidden="true" />
            ) : (
              <EyeOff size={14} aria-hidden="true" />
            )}
            {live ? 'מפורסם' : 'לא מפורסם'}
          </span>
        </div>
      </div>

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
          <p className="text-[13px] leading-relaxed text-red-800">{error}</p>
        </div>
      )}

      {/* ── Toolbar. No Publish here, deliberately. ────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
        <button
          type="button"
          onClick={save}
          disabled={!permissions.canEdit || !dirty || saveState === 'saving'}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveState === 'saving' ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={15} aria-hidden="true" />
          )}
          שמירה
        </button>

        <button
          type="button"
          onClick={openPreview}
          disabled={!permissions.canEdit || busy === 'preview'}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <ExternalLink size={15} aria-hidden="true" />
          תצוגה מקדימה
        </button>

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          <History size={15} aria-hidden="true" />
          היסטוריה ({revisions.length})
        </button>

        <p className="ms-auto text-[12px] text-gray-600">פרסום נמצא בלשונית ״פרסום״ בלבד.</p>
      </div>

      <div aria-live="polite">
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-3 text-sm font-semibold text-teal-800 underline"
          >
            פתיחת התצוגה המקדימה בלשונית חדשה
          </a>
        )}
      </div>
      {showHistory && (
        <RevisionHistory
          revisions={revisions}
          currentId={content.currentRevisionId}
          busy={busy}
          canRestore={permissions.canPublish}
          onRestore={(revId) => act('restore', () => cmsApi.restore(contentId, revId))}
        />
      )}

      {/* ── Tabs, grouped by exposure ─────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-2">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(['PUBLIC', 'INTERNAL', 'FEASIBILITY', 'PUBLISH'] as Exposure[]).map((exp) => (
            <div key={exp}>
              <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                {EXPOSURE_STYLE[exp].group}
              </p>
              <div
                role="tablist"
                aria-label={EXPOSURE_STYLE[exp].group}
                className="flex flex-wrap gap-1"
              >
                {(grouped[exp] ?? []).map((t) => {
                  const index = TABS.findIndex((x) => x.id === t.id)
                  const active = tab === t.id
                  return (
                    <button
                      key={t.id}
                      ref={(el) => {
                        tabRefs.current[t.id] = el
                      }}
                      role="tab"
                      id={`tab-${t.id}`}
                      aria-selected={active}
                      aria-controls="project-tabpanel"
                      tabIndex={active ? 0 : -1}
                      onKeyDown={(e) => onTabKeyDown(e, index)}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-[13px] font-medium transition-colors',
                        active ? EXPOSURE_STYLE[exp].active : EXPOSURE_STYLE[exp].idle,
                      )}
                    >
                      <t.icon size={14} aria-hidden="true" />
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel ─────────────────────────────────────────────────── */}
      {/*
        ONE panel element with a stable id, whose content swaps.
        Per-tab panel ids meant every inactive tab's `aria-controls` pointed at
        an element that was not in the document — invalid, and invisible to
        anyone not running an audit. A single panel is the honest description
        of what is actually rendered.
      */}
      <div role="tabpanel" id="project-tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
        <h2 className="sr-only">{current.label}</h2>

        {tab === 'public' && (
          <TabPublic doc={doc} onChange={setDoc} canEdit={permissions.canEdit} />
        )}
        {tab === 'timeline' && (
          <TabTimeline doc={doc} onChange={setDoc} canEdit={permissions.canEdit} />
        )}
        {tab === 'media' && (
          <TabMedia
            doc={doc}
            onChange={setDoc}
            canEdit={permissions.canEdit}
            contentId={contentId}
          />
        )}
        {tab === 'seo' && (
          <TabSeo doc={doc} onChange={setDoc} canEdit={permissions.canEdit} isPublished={!!live} />
        )}
        {tab === 'internal' && (
          <TabInternal doc={doc} onChange={setDoc} canEdit={permissions.canEdit} />
        )}
        {tab === 'verification' && (
          <TabVerification
            doc={doc}
            contentId={contentId}
            canEdit={permissions.canEdit}
            canVerify={permissions.canVerify}
            onChanged={load}
          />
        )}
        {/* `canFeasibility`, not `canEdit`: its own tier on the server too. */}
        {tab === 'feasibility' && (
          <TabFeasibility contentId={contentId} canEdit={permissions.canFeasibility} />
        )}
        {tab === 'publication' && (
          <TabPublication
            content={content}
            check={check}
            revisions={revisions}
            dirty={dirty}
            busy={busy}
            canPublish={permissions.canPublish}
            onPublish={() => act('publish', () => cmsApi.publish(contentId))}
            onUnpublish={() => act('unpublish', () => cmsApi.unpublish(contentId))}
          />
        )}
      </div>
    </div>
  )
}

function SaveBadge({ state, savedAt }: { state: SaveState; savedAt: Date | null }) {
  const MAP: Record<SaveState, { label: string; cls: string; Icon: typeof Check }> = {
    clean: {
      label: savedAt ? `נשמר ב-${savedAt.toLocaleTimeString('he-IL')}` : 'אין שינויים',
      cls: 'border-gray-300 text-gray-700',
      Icon: Check,
    },
    dirty: {
      label: 'שינויים שלא נשמרו',
      cls: 'border-[#d8cdb8] bg-[#f4f1ec] text-[#7d6234]',
      Icon: AlertTriangle,
    },
    saving: { label: 'שומר…', cls: 'border-gray-300 text-gray-700', Icon: Loader2 },
    saved: { label: 'נשמר', cls: 'border-teal-300 bg-teal-50 text-teal-800', Icon: Check },
    error: {
      label: 'השמירה נכשלה',
      cls: 'border-red-300 bg-red-50 text-red-800',
      Icon: AlertTriangle,
    },
  }
  const s = MAP[state]
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold',
        s.cls,
      )}
    >
      <s.Icon
        size={14}
        className={state === 'saving' ? 'animate-spin' : undefined}
        aria-hidden="true"
      />
      {s.label}
    </span>
  )
}

function RevisionHistory({
  revisions,
  currentId,
  busy,
  canRestore,
  onRestore,
}: {
  revisions: CmsRevisionSummary[]
  currentId: string | null
  busy: string | null
  canRestore: boolean
  onRestore: (id: string) => void
}) {
  const REASON: Record<string, string> = {
    SAVE: 'שמירה',
    PUBLISH: 'פרסום',
    UNPUBLISH: 'הסרה מהאתר',
    RESTORE: 'שחזור',
  }
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h2 className="text-[15px] font-bold text-gray-900">היסטוריית שינויים</h2>
      <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-gray-600">
        כל גרסה שומרת את מצב הפרויקט המלא, כולל המידע הפנימי וההיתכנות, כדי שאפשר יהיה להבין מה היה
        נכון באותו רגע. שחזור יוצר גרסה חדשה ואינו מוחק דבר, ויומן האימותים נשאר שלם גם אחריו. שחזור
        אינו מפרסם.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {revisions.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-gray-900">
                גרסה {r.sequence} · {REASON[r.reason] ?? r.reason}
                {r.id === currentId && (
                  <span className="ms-2 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
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
            {r.id !== currentId && canRestore && (
              <button
                type="button"
                onClick={() => onRestore(r.id)}
                disabled={busy === 'restore'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50"
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
