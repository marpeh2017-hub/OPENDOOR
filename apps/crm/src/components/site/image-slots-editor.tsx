'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cmsApi } from '@/lib/cms-api'
import { ContentEditorShell } from './content-editor-shell'
import { MediaPicker } from './media-picker'
import type { MediaLibraryItem } from './media-library'
import { CLAIM_LABEL } from './project/types'

/**
 * Assigning a Media Library image to one of the site's controlled image
 * slots — Pass 4G §7/§8.
 *
 * ── THE SEVEN SLOTS ARE A FIXED, CLOSED SET ────────────────────────────────
 *
 * They are declared in `apps/website/src/mock/fixtures/images.ts` as
 * `IMAGE_SLOTS`: hero, a city-band, and five editorial moments across the
 * core pages, each with its own aspect ratio, minimum resolution and — the
 * part that matters here — a DECLARED CLAIM the eventual image may make
 * (`VERIFIED_PROJECT_PHOTO`, `EDITORIAL_CONTEXT` or `ARCHITECTURAL_PATTERN`).
 * This screen cannot add an eighth slot or change what one may claim; it can
 * only fill one that already exists, from the library, or leave it empty so
 * the site keeps drawing its own architectural pattern.
 *
 * The list is duplicated here (id, label, required claim) rather than
 * imported, because the CRM and the website are two Next apps with no shared
 * runtime module boundary — same discipline as `KNOWN_FIELDS` in the
 * feasibility model being mirrored rather than imported across the gateway
 * boundary. Drift is caught by a mismatched slot id simply doing nothing on
 * the website, which is a visible, not silent, failure.
 */
interface SlotSpec {
  id: string
  label: string
  claim: 'VERIFIED_PROJECT_PHOTO' | 'EDITORIAL_CONTEXT' | 'ARCHITECTURAL_PATTERN'
}

const SLOTS: SlotSpec[] = [
  { id: 'RESIDENT_MEETING', label: 'כנס דיירים — עמוד כך אנחנו עובדים', claim: 'EDITORIAL_CONTEXT' },
  { id: 'HERO_JERUSALEM_ARCHITECTURE', label: 'הירו — פתיחת דף הבית', claim: 'EDITORIAL_CONTEXT' },
  { id: 'JERUSALEM_LIGHT_RAIL', label: 'רצועת עיר — בין התהליך לפרויקטים', claim: 'EDITORIAL_CONTEXT' },
  { id: 'JERUSALEM_CHORDS_BRIDGE', label: 'קריאה לפעולה בעמוד הבית', claim: 'EDITORIAL_CONTEXT' },
  { id: 'ABOUT_ISRAELI_RESIDENTIAL', label: 'עמוד מי אנחנו', claim: 'EDITORIAL_CONTEXT' },
  { id: 'RENEWED_ALONGSIDE_EXISTING', label: 'לפני ואחרי, עמוד כך אנחנו עובדים', claim: 'EDITORIAL_CONTEXT' },
  { id: 'JERUSALEM_URBAN_FABRIC', label: 'מרקם עירוני', claim: 'EDITORIAL_CONTEXT' },
  { id: 'ARCHITECTURAL_DETAIL', label: 'פרט אדריכלי', claim: 'ARCHITECTURAL_PATTERN' },
]

interface SlotAssignment {
  mediaId: string
  storageKey: string
  alt: { he: string; en?: string }
  classification: string
}
interface ImageSlotsDoc {
  title: { he: string }
  slots: Record<string, SlotAssignment>
}

const SLUG = 'image-slots'

export function ImageSlotsEditor() {
  const [contentId, setContentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    cmsApi.list({ kind: 'SETTINGS' })
      .then(async (items) => {
        const existing = items.find((i) => i.slug === SLUG)
        if (existing) { if (!cancelled) setContentId(existing.id); return }
        const created = await cmsApi.create({
          kind: 'SETTINGS', slug: SLUG,
          draft: { title: { he: 'שיבוץ תמונות' }, slots: {} } satisfies ImageSlotsDoc,
        })
        if (!cancelled) setContentId(created.id)
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'טעינה נכשלה') })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-[13px] text-red-800">
        {error}
      </div>
    )
  }
  if (!contentId) return <div className="p-8 text-sm text-gray-600">טוען…</div>

  return (
    <ContentEditorShell<ImageSlotsDoc> contentId={contentId} title="שיבוץ תמונות" typeLabel="הגדרה">
      {({ draft, setDraft }) => (
        <div className="space-y-3">
          <p className="max-w-prose text-[13.5px] leading-relaxed text-gray-600">
            שבעה מקומות קבועים באתר שבהם ניתן להציג תמונה. כל עוד מקום אינו
            משובץ, האתר מציג את האיור האדריכלי שלו במקום תמונה חסרה.
          </p>
          {SLOTS.map((slot) => {
            const assigned = draft.slots?.[slot.id]
            const mismatch = assigned && assigned.classification !== slot.claim
              && !(slot.claim === 'EDITORIAL_CONTEXT' && assigned.classification === 'ARCHITECTURAL_PATTERN')
            return (
              <div key={slot.id} className="rounded-lg border border-border bg-white p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-gray-900">{slot.label}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-gray-600">
                    דורש: {CLAIM_LABEL[slot.claim].label}
                  </span>
                </div>
                {mismatch && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-red-800">
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    התמונה הנבחרת מסווגת כ{CLAIM_LABEL[assigned!.classification as keyof typeof CLAIM_LABEL]?.label ?? assigned!.classification},
                    לא כ{CLAIM_LABEL[slot.claim].label}. יש לבחור תמונה אחרת או לעדכן את הסיווג בספרייה.
                  </p>
                )}
                <div className="mt-2">
                  <MediaPicker
                    value={assigned?.mediaId}
                    onChange={(item?: MediaLibraryItem) =>
                      setDraft((d) => {
                        const slots = { ...d.slots }
                        if (item) {
                          slots[slot.id] = {
                            mediaId: item.id, storageKey: item.storageKey,
                            alt: { he: item.altHe, en: item.altEn }, classification: item.classification,
                          }
                        } else {
                          delete slots[slot.id]
                        }
                        return { ...d, slots }
                      })
                    }
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </ContentEditorShell>
  )
}
