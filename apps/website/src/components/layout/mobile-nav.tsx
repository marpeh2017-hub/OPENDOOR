'use client'

import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { RESIDENT_PORTAL_HREF } from '@/lib/navigation'

/**
 * Mobile navigation.
 *
 * Hand-built rather than pulled from a dialog library, because the four
 * behaviours below are the whole substance of the component and each is a
 * common omission. §37 requires all of them.
 *
 *   1. ESCAPE closes. Without it the only way out on a keyboard is tabbing to
 *      the close button, which may be behind the whole menu.
 *   2. FOCUS MOVES IN on open and RETURNS to the trigger on close. A menu that
 *      opens without moving focus leaves a screen-reader user reading the page
 *      behind it, unaware anything happened.
 *   3. FOCUS IS TRAPPED while open, so Tab cannot wander into the inert page.
 *   4. BODY SCROLL IS LOCKED, so the page behind does not scroll under the
 *      overlay on touch.
 *
 * `aria-expanded` and `aria-controls` on the trigger state the relationship,
 * and `role="dialog"` + `aria-modal` tell assistive tech the rest is inert.
 */
export function MobileNav({
  items,
  openLabel,
  closeLabel,
  navLabel,
  residentPortalLabel,
}: {
  items: readonly { key: string; href: string; label: string }[]
  openLabel: string
  closeLabel: string
  navLabel: string
  residentPortalLabel: string
}) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    // Move focus into the panel so the next Tab is inside it.
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      )
      if (!focusables || focusables.length === 0) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!

      // Wrap at both ends — this is the trap.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      // Return focus where the user left it, not to the top of the page.
      ;(previouslyFocused ?? triggerRef.current)?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={openLabel}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-drawer lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label={navLabel}
            // `end-0` not `right-0`: the panel opens from the inline end, so it
            // slides from the correct side in both RTL and LTR without a
            // direction check.
            className="absolute inset-y-0 end-0 flex w-80 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
              <span className="text-sm font-semibold text-gray-500">{navLabel}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-4 py-3 text-base font-medium text-gray-800 hover:bg-gray-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-gray-200 p-4">
              <Link
                href={RESIDENT_PORTAL_HREF}
                onClick={() => setOpen(false)}
                className="block rounded-md border border-teal-600 px-4 py-3 text-center text-sm font-semibold text-teal-700 hover:bg-teal-50"
              >
                {residentPortalLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
