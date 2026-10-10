'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Prints the page, which is also how it becomes a PDF: every browser's print
 * dialog offers "Save as PDF". When the address carries `?print=1` (a link
 * that promised the PDF) the dialog opens by itself once the page is ready
 * and the fonts are in, and the address drops the parameter first, so a
 * reload does not print again.
 */
export function PrintButton({ ready = true }: { ready?: boolean }) {
  useEffect(() => {
    if (!ready || new URLSearchParams(window.location.search).get('print') !== '1') return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (cancelled) return
      window.history.replaceState(null, '', window.location.pathname)
      window.print()
    })
    return () => {
      cancelled = true
    }
  }, [ready])

  return (
    <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()} disabled={!ready}>
      <Printer size={16} aria-hidden="true" />
      הדפסה או שמירה כ-PDF
    </Button>
  )
}
