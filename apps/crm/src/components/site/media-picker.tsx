'use client'

import { useEffect, useState } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import { cmsApi } from '@/lib/cms-api'
import { getOrCreateMediaLibrary, type MediaLibraryItem } from './media-library'
import { CLAIM_LABEL } from './project/types'

/**
 * "Choose from the Media Library" — the one control every editorial image
 * slot uses, so there is exactly one way to attach an image anywhere on the
 * managed website (Pass 4G §7). A slot never gets its own upload button: it
 * gets this picker, and the picker's only source is the library.
 */
export function MediaPicker({
  value,
  onChange,
  required = false,
}: {
  /** The chosen library item's id, or undefined. */
  value: string | undefined
  onChange: (item: MediaLibraryItem | undefined) => void
  required?: boolean
}) {
  const [libraryId, setLibraryId] = useState<string | null>(null)
  const [items, setItems] = useState<MediaLibraryItem[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [previews, setPreviews] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    getOrCreateMediaLibrary()
      .then(({ id, doc }) => {
        if (cancelled) return
        setLibraryId(id)
        setItems(doc.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const selected = items.find((i) => i.id === value)

  useEffect(() => {
    if (!libraryId || !selected || preview) return
    cmsApi
      .mediaUrl(libraryId, selected.id)
      .then((r) => setPreview(r.url))
      .catch(() => {})
  }, [libraryId, selected, preview])

  useEffect(() => {
    if (!open || !libraryId) return
    for (const item of items) {
      if (previews[item.id]) continue
      cmsApi
        .mediaUrl(libraryId, item.id)
        .then((r) => setPreviews((p) => ({ ...p, [item.id]: r.url })))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, libraryId, items])

  return (
    <div>
      {selected ? (
        <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={selected.altHe}
              className="h-14 w-20 flex-shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <div className="h-14 w-20 flex-shrink-0 rounded-md border border-dashed border-gray-300 bg-gray-50" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-gray-900">{selected.title}</p>
            <p className="text-[11.5px] text-gray-600">
              {CLAIM_LABEL[selected.classification].label}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(undefined)
              setPreview(null)
            }}
            aria-label="הסרת התמונה"
            className="rounded-lg border border-border p-1.5 text-gray-700 transition-colors hover:bg-gray-50"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-4 text-[13px] font-medium text-gray-600 transition-colors hover:border-teal-600 hover:text-teal-800"
        >
          <ImageIcon size={16} aria-hidden="true" />
          בחירה מספריית המדיה{required ? ' (חובה)' : ''}
        </button>
      )}

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-gray-800">ספריית מדיה</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגירה"
              className="text-gray-500 hover:text-gray-800"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          {items.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-gray-600">
              אין עדיין תמונות בספרייה. ניתן להעלות תמונות במסך ספריית המדיה.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item)
                    setPreview(previews[item.id] ?? null)
                    setOpen(false)
                  }}
                  className="rounded-lg border border-border p-1 text-start transition-colors hover:border-teal-600"
                >
                  {previews[item.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[item.id]}
                      alt={item.altHe}
                      className="h-16 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="h-16 w-full rounded bg-gray-100" />
                  )}
                  <p className="mt-1 truncate text-[10.5px] text-gray-700">{item.title}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
