'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { cmsApi } from '@/lib/cms-api'
import { LocalizedField, Section, Callout } from './fields'
import { CLAIM_LABEL, type ImageClaim, type ProjectDocument, type ProjectMedia } from './types'

/**
 * תמונות ומדיה — this project's images, and nothing more.
 *
 * ── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 *
 * Not the global Media Library. There is no cross-project browser, no upload
 * queue, no usage index and no bulk replace. Those belong to a later phase and
 * to a different screen; building half of them here would produce a library
 * that lists images it cannot manage.
 *
 * What this DOES is manage the references a project already holds, which is
 * everything the editor needs to be honest about its pictures today. Upload
 * lands on the existing MinIO/S3 abstraction (StorageService, tenant-scoped
 * keys, signed URLs) rather than a second storage path.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  CLASSIFICATION IS THE LOAD-BEARING FIELD
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Publishing an editorial photograph as though it depicted an OpenDoor project
 * is the specific failure this field exists to prevent, and it is a failure of
 * WORDING as much as of data: an editor who reads "EDITORIAL_CONTEXT" does not
 * necessarily understand they are being asked whether the site may say "this
 * is the project". So each option is written out in plain Hebrew, with its
 * consequence.
 *
 * A newly uploaded image defaults to EDITORIAL_CONTEXT, never to
 * VERIFIED_PROJECT_PHOTO — the safe claim is "this illustrates the text", and
 * upgrading it to "this is the project" is a decision the editor makes on
 * purpose, not one a form pre-selects for them.
 *
 * The distinction is preserved STRUCTURALLY, not by this screen: the public
 * projection carries `classification` through unchanged (see
 * project-document.ts), so nothing on the publish path can promote one value
 * into the other. This UI cannot make that claim true or false; it can only
 * ask the editor to state it honestly.
 *
 * Alt text in Hebrew is required, and the publication check treats its absence
 * as a blocker rather than a warning.
 *
 * ── WHY UPLOADING DOES NOT SAVE ─────────────────────────────────────────────
 *
 * Upload only stores bytes and returns a storage key; the reference itself
 * (classification, alt text, order) is added to the in-memory draft exactly
 * like adding a milestone, and travels through the SAME Save button as every
 * other tab. Two save paths for one document is two places that could
 * disagree about what "saved" means.
 */
export function TabMedia({
  doc, onChange, canEdit, contentId,
}: {
  doc: ProjectDocument
  onChange: (next: ProjectDocument) => void
  canEdit: boolean
  contentId: string
}) {
  const media = [...(doc.media ?? [])].sort((a, b) => a.order - b.order)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetRef = useRef<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // Object URLs for files uploaded THIS session — a freshly uploaded image has
  // no revision yet, so there is nothing on the server to fetch a signed URL
  // for. Revoked on unmount to avoid leaking blob URLs.
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({})

  useEffect(() => () => {
    Object.values(localPreviews).forEach((url) => URL.revokeObjectURL(url))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const write = (next: ProjectMedia[]) =>
    onChange({ ...doc, media: next.map((m, i) => ({ ...m, order: i + 1 })) })

  const patch = (id: string, p: Partial<ProjectMedia>) =>
    write(media.map((m) => (m.id === id ? { ...m, ...p } : m)))

  const move = (id: string, delta: number) => {
    const i = media.findIndex((m) => m.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= media.length) return
    const next = [...media]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    write(next)
  }

  const pickFile = (replaceId: string | null) => {
    replaceTargetRef.current = replaceId
    fileInputRef.current?.click()
  }

  const onFileChosen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const replaceId = replaceTargetRef.current
    replaceTargetRef.current = null
    setUploadError(null)
    setUploading(replaceId ?? 'new')

    try {
      const result = await cmsApi.uploadMedia(contentId, file)
      const objectUrl = URL.createObjectURL(file)

      if (replaceId) {
        setLocalPreviews((p) => ({ ...p, [replaceId]: objectUrl }))
        patch(replaceId, {
          storageKey: result.storageKey,
          filename: result.filename,
          mimeType: result.mimeType,
        })
      } else {
        const id = `media-${Date.now().toString(36)}`
        setLocalPreviews((p) => ({ ...p, [id]: objectUrl }))
        write([
          ...media,
          {
            id,
            storageKey: result.storageKey,
            filename: result.filename,
            mimeType: result.mimeType,
            classification: 'EDITORIAL_CONTEXT',
            alt: { he: '' },
            order: media.length + 1,
          },
        ])
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'העלאת התמונה נכשלה')
    } finally {
      setUploading(null)
    }
  }, [contentId, media]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onFileChosen}
        aria-hidden="true"
        tabIndex={-1}
      />

      <Callout tone="info" title="ספריית המדיה המלאה עדיין לא נבנתה">
        כאן מנהלים את התמונות של הפרויקט הזה בלבד. ספרייה כלל-אתרית, עם העלאה
        מרוכזת ומעקב אחרי היכן כל תמונה מופיעה, נבנית בשלב נפרד.
      </Callout>

      <Callout tone="warning" title="סיווג התמונה הוא טענה">
        תמונה מסווגת ״צילום מהפרויקט״ אומרת לציבור שכך נראה המתחם. אם התמונה
        אינה מראה את המתחם, יש לסווג אותה כתצלום הקשר, והאתר יאמר זאת ליד
        התמונה.
      </Callout>

      {uploadError && <Callout tone="blocking" title="שגיאה בהעלאה">{uploadError}</Callout>}

      {canEdit && (
        <button
          type="button"
          onClick={() => pickFile(null)}
          disabled={uploading !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading === 'new'
            ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            : <Upload size={14} aria-hidden="true" />}
          העלאת תמונה
        </button>
      )}

      {media.length === 0 ? (
        <Callout tone="info" title="אין תמונות לפרויקט הזה">
          זה מצב תקין. כשאין תמונת פתיחה, האתר מציג את האיור האדריכלי שנוצר
          בקוד, שאינו מתיימר להראות מבנה קיים.
        </Callout>
      ) : (
        media.map((m, i) => {
          const missingAlt = !m.alt?.he
          return (
            <Section key={m.id} title={m.filename || `תמונה ${i + 1}`}>
              <div className="space-y-4">
                <MediaPreview contentId={contentId} media={m} localUrl={localPreviews[m.id]} />

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[12px] text-gray-700">
                    <ImageIcon size={12} aria-hidden="true" />
                    {CLAIM_LABEL[m.classification].label}
                  </span>
                  {missingAlt && (
                    <span className="rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-[12px] font-semibold text-red-800">
                      חסר טקסט חלופי
                    </span>
                  )}
                  <div className="ms-auto flex items-center gap-1">
                    {canEdit && (
                      <button
                        type="button"
                        disabled={uploading !== null}
                        onClick={() => pickFile(m.id)}
                        aria-label={`החלפת ${m.filename}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
                      >
                        {uploading === m.id
                          ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                          : <Upload size={13} aria-hidden="true" />}
                        החלפה
                      </button>
                    )}
                    <button
                      type="button" disabled={!canEdit || i === 0} onClick={() => move(m.id, -1)}
                      aria-label={`העברת ${m.filename} למעלה`}
                      className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    ><ArrowUp size={13} aria-hidden="true" /></button>
                    <button
                      type="button" disabled={!canEdit || i === media.length - 1} onClick={() => move(m.id, 1)}
                      aria-label={`העברת ${m.filename} למטה`}
                      className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    ><ArrowDown size={13} aria-hidden="true" /></button>
                    <button
                      type="button" disabled={!canEdit}
                      onClick={() => write(media.filter((x) => x.id !== m.id))}
                      aria-label={`הסרת ${m.filename}`}
                      className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    ><Trash2 size={13} aria-hidden="true" /></button>
                  </div>
                </div>

                <fieldset>
                  <legend className="text-[12.5px] font-semibold text-gray-800">
                    מה התמונה הזאת מראה
                  </legend>
                  <div className="mt-2 space-y-2">
                    {(Object.keys(CLAIM_LABEL) as ImageClaim[]).map((claim) => (
                      <label
                        key={claim}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50"
                      >
                        <input
                          type="radio"
                          name={`claim-${m.id}`}
                          value={claim}
                          checked={m.classification === claim}
                          disabled={!canEdit}
                          onChange={() => patch(m.id, { classification: claim })}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-[13px] font-semibold text-gray-900">
                            {CLAIM_LABEL[claim].label}
                          </span>
                          <span className="block text-[12px] leading-relaxed text-gray-600">
                            {CLAIM_LABEL[claim].detail}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <LocalizedField
                  label="טקסט חלופי (חובה)"
                  value={m.alt}
                  fallback="SOURCE"
                  disabled={!canEdit}
                  hint="מה רואים בתמונה, למי שאינו רואה אותה. תמונה בלי טקסט חלופי בעברית אינה מתפרסמת."
                  onChange={(v) => patch(m.id, { alt: v.en ? { he: v.he, en: v.en } : { he: v.he } })}
                />

                <LocalizedField
                  label="כיתוב (לא חובה)"
                  value={m.caption}
                  fallback="SOURCE"
                  disabled={!canEdit}
                  onChange={(v) => patch(m.id, { caption: v.he ? (v.en ? { he: v.he, en: v.en } : { he: v.he }) : undefined })}
                />

                <div>
                  <label htmlFor={`cr-${m.id}`} className="block text-[12.5px] font-semibold text-gray-800">
                    קרדיט (לא חובה)
                  </label>
                  <input
                    id={`cr-${m.id}`}
                    type="text"
                    value={m.credit ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => patch(m.id, { credit: e.target.value || undefined })}
                    className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
                  />
                </div>

                <p className="text-[11.5px] text-gray-600">
                  מפתח אחסון: <span className="font-mono" dir="ltr">{m.storageKey}</span>
                </p>
              </div>
            </Section>
          )
        })
      )}
    </div>
  )
}

/**
 * A thumbnail for one media entry.
 *
 * A freshly uploaded file (this session, not yet saved) has no revision to
 * fetch a signed URL from, so it uses the local URL.createObjectURL preview
 * instead. Anything loaded from the server fetches a short-lived signed URL —
 * scoped to THIS project's media list by projectMediaUrl on the gateway, not
 * to a bare storage key the browser could otherwise guess or reuse.
 */
function MediaPreview({
  contentId, media, localUrl,
}: {
  contentId: string
  media: ProjectMedia
  localUrl: string | undefined
}) {
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (localUrl) return
    let cancelled = false
    cmsApi.mediaUrl(contentId, media.id)
      .then((r) => { if (!cancelled) setRemoteUrl(r.url) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [contentId, media.id, localUrl])

  const src = localUrl ?? remoteUrl
  if (!src) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[12px] text-gray-600">
        {failed ? 'לא ניתן לטעון תצוגה מקדימה' : 'טוען תצוגה מקדימה…'}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={media.alt?.he || media.filename}
      className="h-40 w-full rounded-lg border border-border object-cover"
    />
  )
}
