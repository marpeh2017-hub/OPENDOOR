'use client'

import { Printer } from 'lucide-react'

/** Prints the copy, which is also how it is saved as a PDF. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-teal-600 bg-white px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50"
    >
      <Printer size={16} aria-hidden="true" />
      הדפסה או שמירה כ-PDF
    </button>
  )
}
