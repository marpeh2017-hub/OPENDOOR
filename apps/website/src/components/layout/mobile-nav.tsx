'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
 *
 * ── WHY THE DRAWER IS PORTALLED TO document.body ───────────────────────────
 *
 * The header carries `backdrop-blur`, and an element with a backdrop-filter
 * becomes the containing block for its `position: fixed` descendants. Rendered
 * in place, the drawer's `inset-0` resolved against the header's 64px bar
 * instead of the viewport: the overlay collapsed to that height, and the nav
 * items overflowed it and painted behind the page, where a tap reached the
 * article underneath rather than the link. The portal moves the drawer out of
 * that containing block, so `inset-0` means the viewport again.
 *
 * Do not move this back inline without first removing the blur.
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
  // `createPortal` needs a DOM node, which does not exist during the server
  // render. Mounting first keeps the server and first client render identical.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    // The portal is a sibling of the page; make background content truly inert.
    const background = Array.from(document.body.children)
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node.id !== 'mobile-nav-overlay')
      .map((node) => ({ node, inert: node.inert }))
    background.forEach(({ node }) => { node.inert = true })
    const desktop = window.matchMedia('(min-width: 1024px)')
    const onResize = () => { if (desktop.matches) setOpen(false) }
    desktop.addEventListener('change', onResize)
    onResize()

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
      desktop.removeEventListener('change', onResize)
      background.forEach(({ node, inert }) => { node.inert = inert })
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

      {mounted && open && createPortal(
        <div id="mobile-nav-overlay" className="fixed inset-0 z-drawer lg:hidden">
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
        </div>,
        document.body,
      )}
    </>
  )
}
