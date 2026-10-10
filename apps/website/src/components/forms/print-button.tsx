'use client'

import { useEffect } from 'react'
import { LineIcon } from '@/components/brand/line-icon'

/**
 * Prints the page, which is also how a visitor saves it as a PDF: every
 * current browser offers "Save as PDF" in its print dialog. That keeps the
 * file always in step with the text on the page, where a PDF kept in the
 * repository would go stale the first time a word changed.
 *
 * `autoPrint` is for a link that promises printing (the forms page's
 * "הדפסה או שמירה כ-PDF"): the dialog opens once the fonts have loaded, and
 * the address loses its `?print=1` first, so a reload does not print again.
 */
export function PrintButton({ label, autoPrint = false }: { label: string; autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (cancelled) return
      window.history.replaceState(null, '', window.location.pathname)
      window.print()
    })
    return () => {
      cancelled = true
    }
  }, [autoPrint])

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-md border border-teal-600 bg-white px-5 py-2.5 type-body font-bold text-teal-700 transition-colors hover:bg-teal-50"
    >
      <LineIcon name="printer" size={20} />
      {label}
    </button>
  )
}
