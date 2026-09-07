'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { cmsApi } from '@/lib/cms-api'
import { ContentEditorShell } from './content-editor-shell'
import { CLAIM_LABEL, type ImageClaim } from './project/types'

/**
 * The website's Media Library — Pass 4G.
 *
 * ── WHY THIS IS ONE CMS ROW, NOT A NEW TABLE ───────────────────────────────
 *
 * `MediaLibraryItem[]` lives inside one `CmsContent` (kind SETTINGS, slug
 * "media-library"), exactly the way a project's own media lives inside its
 * document. That means the library gets revision history, Publication Check,
 * and the confirm-before-publish flow from Pass 4F for free — publishing the
 * library is what makes an uploaded image reachable by the public media URL
 * added this pass, since that route only serves objects whose key a visitor
 * could already have obtained from published HTML.
 *
 * Upload itself reuses the exact endpoints Pass 4D built for project media
 * (POST /cms/content/:id/media/upload, GET .../media/:mediaId/url) — they
 * were never actually restricted to projects, so pointing them at this
 * content's id instead of a project's needed no gateway change.
 *
 * ── NOT A DAM ───────────────────────────────────────────────────────────────
 *
 * No folders, no bulk actions, no search-by-metadata. Upload, classify,
 * caption, see where a picture is used, remove. That is what "keep V1
 * practical" means here.
 */
export interface MediaLibraryItem {
  id: string
  storageKey: string
  filename: string
  mimeType?: string
  title: string
  altHe: string
  altEn?: string
  caption?: string
  credit?: string
  classification: ImageClaim
  /** Human labels, appended wherever an editor assigns this image somewhere —
   *  a Knowledge article, an image slot. Best-effort, not a live index. */
  usageRefs?: string[]
}

export interface MediaLibraryDoc {
  title: { he: string }
  items: MediaLibraryItem[]
}

export const MEDIA_LIBRARY_SLUG = 'media-library'

/** Finds or lazily creates the one library row. Exported so the Knowledge
 *  article editor and the image-slot assignment screen can share it without
 *  each risking a duplicate-create race against the other. */
export async function getOrCreateMediaLibrary(): Promise<{ id: string; doc: MediaLibraryDoc }> {
  const items = await cmsApi.list({ kind: 'SETTINGS' })
  const existing = items.find((i) => i.slug === MEDIA_LIBRARY_SLUG)
  if (existing) {
    const full = await cmsApi.get(existing.id)
    return { id: existing.id, doc: full.draft as unknown as MediaLibraryDoc }
  }
  const created = await cmsApi.create({
    kind: 'SETTINGS',
    slug: MEDIA_LIBRARY_SLUG,
    draft: { title: { he: 'ספריית מדיה' }, items: [] } satisfies MediaLibraryDoc,
  })
  return { id: created.id, doc: created.draft as unknown as MediaLibraryDoc }
}

export function MediaLibrary() {
  const [contentId, setContentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getOrCreateMediaLibrary()
      .then(({ id }) => {
        if (!cancelled) setContentId(id)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'טעינת הספרייה נכשלה')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-4 text-[13px] text-red-800"
      >
        {error}
      </div>
    )
  }
  if (!contentId) return <div className="p-8 text-sm text-gray-600">טוען…</div>

  return (
    <ContentEditorShell<MediaLibraryDoc>
      contentId={contentId}
      title="ספריית מדיה"
      typeLabel="ספרייה"
    >
      {({ draft, setDraft }) => <LibraryGrid contentId={contentId} doc={draft} setDoc={setDraft} />}
    </ContentEditorShell>
  )
}

function LibraryGrid({
  contentId,
  doc,
  setDoc,
}: {
  contentId: string
  doc: MediaLibraryDoc
  setDoc: (updater: (d: MediaLibraryDoc) => MediaLibraryDoc) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    for (const item of doc.items) {
      if (previews[item.id]) continue
      cmsApi
        .mediaUrl(contentId, item.id)
        .then((r) => {
          if (!cancelled) setPreviews((p) => ({ ...p, [item.id]: r.url }))
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.items, contentId])

  const write = (items: MediaLibraryItem[]) => setDoc((d) => ({ ...d, items }))
  const patch = (id: string, p: Partial<MediaLibraryItem>) =>
    write(doc.items.map((it) => (it.id === id ? { ...it, ...p } : it)))

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const result = await cmsApi.uploadMedia(contentId, file)
      const id = `media-${Date.now().toString(36)}`
      setPreviews((p) => ({ ...p, [id]: URL.createObjectURL(file) }))
      write([
        ...doc.items,
        {
          id,
          storageKey: result.storageKey,
          filename: result.filename,
          mimeType: result.mimeType,
          title: file.name,
          altHe: '',
          classification: 'EDITORIAL_CONTEXT',
        },
      ])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'העלאה נכשלה')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-[13.5px] leading-relaxed text-gray-600">
        כל התמונות הזמינות לשימוש באתר. תמונה נעשית זמינה לציבור רק לאחר פרסום הספרייה, ורק דרך מקום
        שמפנה אליה בפועל — כתבת ידע או תמונת פתיחה מוגדרת.
      </p>

      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3"
        >
          <AlertTriangle
            size={16}
            className="mt-0.5 flex-shrink-0 text-red-700"
            aria-hidden="true"
          />
          <p className="text-[13px] text-red-800">{uploadError}</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onFileChosen}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <Upload size={15} aria-hidden="true" />
        )}
        העלאת תמונה
      </button>

      {doc.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <ImageIcon size={22} className="mx-auto text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-[13.5px] text-gray-600">אין עדיין תמונות בספרייה.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doc.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-white p-3.5">
              {previews[item.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[item.id]}
                  alt={item.altHe || item.title}
                  className="h-32 w-full rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[11.5px] text-gray-500">
                  טוען תצוגה מקדימה…
                </div>
              )}

              <input
                type="text"
                value={item.title}
                aria-label="שם התמונה"
                placeholder="שם התמונה"
                onChange={(e) => patch(item.id, { title: e.target.value })}
                className="mt-2.5 w-full rounded-lg border border-border px-2.5 py-1.5 text-[13px] font-semibold text-gray-900 focus:border-teal-600"
              />

              <select
                value={item.classification}
                onChange={(e) => patch(item.id, { classification: e.target.value as ImageClaim })}
                className="mt-2 w-full rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-gray-900 focus:border-teal-600"
              >
                {(Object.keys(CLAIM_LABEL) as ImageClaim[]).map((k) => (
                  <option key={k} value={k}>
                    {CLAIM_LABEL[k].label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                {CLAIM_LABEL[item.classification].detail}
              </p>

              <input
                type="text"
                value={item.altHe}
                aria-label="טקסט חלופי (חובה)"
                placeholder="טקסט חלופי (חובה)"
                onChange={(e) => patch(item.id, { altHe: e.target.value })}
                className="mt-2 w-full rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-gray-900 focus:border-teal-600"
              />
              <input
                type="text"
                value={item.caption ?? ''}
                aria-label="כיתוב (לא חובה)"
                placeholder="כיתוב (לא חובה)"
                onChange={(e) => patch(item.id, { caption: e.target.value || undefined })}
                className="mt-1.5 w-full rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-gray-900 focus:border-teal-600"
              />
              <input
                type="text"
                value={item.credit ?? ''}
                aria-label="קרדיט / מקור (לא חובה)"
                placeholder="קרדיט / מקור (לא חובה)"
                onChange={(e) => patch(item.id, { credit: e.target.value || undefined })}
                className="mt-1.5 w-full rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-gray-900 focus:border-teal-600"
              />

              {(item.usageRefs ?? []).length > 0 && (
                <p className="mt-2 text-[11px] text-gray-600">
                  <span className="font-semibold">בשימוש: </span>
                  {item.usageRefs!.join(', ')}
                </p>
              )}

              <button
                type="button"
                onClick={() => write(doc.items.filter((x) => x.id !== item.id))}
                disabled={(item.usageRefs ?? []).length > 0}
                title={
                  (item.usageRefs ?? []).length > 0
                    ? 'לא ניתן להסיר תמונה שנמצאת בשימוש'
                    : undefined
                }
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={12} aria-hidden="true" />
                הסרה
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
