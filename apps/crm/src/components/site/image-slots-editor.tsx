'use client'

import { useEffect, useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { cmsApi } from '@/lib/cms-api'
import { ContentEditorShell } from './content-editor-shell'
import { MediaPicker } from './media-picker'
import type { MediaLibraryItem } from './media-library'
import { SITE_IMAGE_SLOTS, MAX_SLOT_IMAGES, slotImages, assignSlotImages, type SiteSlotAssignment, type SiteSlotImage } from '../../../../../packages/api-contracts/src/media-slots'

interface ImageSlotsDoc {
  title: { he: string }
  slots: Record<string, SiteSlotAssignment>
}
const SLUG = 'image-slots'
const fromLibrary = (item: MediaLibraryItem): SiteSlotImage => ({
  mediaId: item.id, storageKey: item.storageKey,
  alt: { he: item.altHe, en: item.altEn }, classification: item.classification,
})

/** Existing CMS draft → review → publication flow; no direct public writes. */
export function ImageSlotsEditor() {
  const [contentId, setContentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    cmsApi.list({ kind: 'SETTINGS' }).then(async (items) => {
      const existing = items.find((item) => item.slug === SLUG)
      const id = existing?.id ?? (await cmsApi.create({
        kind: 'SETTINGS', slug: SLUG,
        draft: { title: { he: 'שיבוץ תמונות' }, slots: {} } satisfies ImageSlotsDoc,
      })).id
      if (!cancelled) setContentId(id)
    }).catch(() => { if (!cancelled) setError('לא ניתן לטעון את שיבוץ התמונות. נסו לרענן את העמוד.') })
    return () => { cancelled = true }
  }, [])
  if (error) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>
  if (!contentId) return <p role="status" className="p-8 text-sm text-gray-600">טוען…</p>

  return (
    <ContentEditorShell<ImageSlotsDoc> contentId={contentId} title="תמונות האתר" typeLabel="הגדרה">
      {({ draft, setDraft }) => (
        <div className="space-y-5">
          <p className="max-w-prose text-sm leading-relaxed text-gray-600">
            מעלים תמונות לספריית המדיה בחלק העליון של העמוד, ואז בוחרים היכן להציג אותן.
            בגלריית הפתיחה ניתן לבחור עד {MAX_SLOT_IMAGES} תמונות ולסדר את סדר הופעתן.
            השינויים מופיעים באתר לאחר שמירה ופרסום.
          </p>
          {SITE_IMAGE_SLOTS.map((slot) => {
            const assignment = draft.slots?.[slot.id]
            return <SlotEditor key={slot.id} label={slot.label} multiple={slot.multiple}
              assignment={assignment} onChange={(value) => setDraft((current) => {
                const slots = { ...current.slots }
                if (value === undefined) delete slots[slot.id]
                else slots[slot.id] = value
                return { ...current, slots }
              })} />
          })}
        </div>
      )}
    </ContentEditorShell>
  )
}

function SlotEditor({ label, multiple, assignment, onChange }: {
  label: string; multiple: boolean; assignment?: SiteSlotAssignment
  onChange: (value: SiteSlotAssignment | undefined) => void
}) {
  const images = slotImages({ ...assignment, disabled: false })
  const [error, setError] = useState('')
  const [pickerVersion, setPickerVersion] = useState(0)
  const write = (next: SiteSlotImage[]) => onChange(assignSlotImages(next))
  const select = (position: number, item?: MediaLibraryItem) => {
    setError('')
    if (!item) { write(images.filter((_, i) => i !== position)); return }
    if (!item.altHe?.trim()) { setError('יש להוסיף לתמונה תיאור בעברית בספריית המדיה.'); return }
    if (images.some((image, i) => i !== position && image.storageKey === item.storageKey)) {
      setError('התמונה כבר נמצאת בגלריה הזאת.'); return
    }
    const next = [...images]
    next[position] = fromLibrary(item)
    write(next)
    setPickerVersion((value) => value + 1)
  }
  const move = (position: number, direction: number) => {
    const next = [...images]
    const target = position + direction
    if (target < 0 || target >= next.length) return
    ;[next[position], next[target]] = [next[target], next[position]]
    write(next)
  }
  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">{label}</h2>
      {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
      <div className="mt-3 space-y-3">
        {images.map((image, position) => (
          <div key={image.storageKey} className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-sm text-gray-600">תמונה {position + 1}</p>
              <MediaPicker key={image.storageKey} value={image.mediaId} onChange={(item) => select(position, item)} />
            </div>
            {multiple && <div className="flex gap-1">
              <button type="button" aria-label={`הקדמת תמונה ${position + 1}`} disabled={position === 0}
                className="inline-flex h-11 w-11 items-center justify-center rounded border disabled:opacity-30" onClick={() => move(position, -1)}><ArrowUp size={18} /></button>
              <button type="button" aria-label={`העברת תמונה ${position + 1} לאחר הבאה`} disabled={position === images.length - 1}
                className="inline-flex h-11 w-11 items-center justify-center rounded border disabled:opacity-30" onClick={() => move(position, 1)}><ArrowDown size={18} /></button>
            </div>}
          </div>
        ))}
        {images.length < (multiple ? MAX_SLOT_IMAGES : 1) && (
          <div>
            <p className="mb-1 text-sm text-gray-600">{multiple ? 'הוספת תמונה לגלריה' : 'בחירת תמונה'}</p>
            <MediaPicker key={pickerVersion} value={undefined} onChange={(item) => { if (item) select(images.length, item) }} />
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={assignment?.disabled === true} onChange={(event) => onChange({ ...assignment, disabled: event.target.checked })} />
          הסתרת התמונה או הגלריה באתר
        </label>
        {assignment && <button type="button" className="min-h-11 text-teal-700 underline" onClick={() => onChange(undefined)}>חזרה לתמונות ברירת המחדל</button>}
      </div>
    </section>
  )
}
