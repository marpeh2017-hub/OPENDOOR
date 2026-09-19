'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Scroll reveal — progressive enhancement, and nothing more.
 *
 * ── THE RULE THIS COMPONENT OBEYS ──────────────────────────────────────────
 *
 * The page must be complete with motion switched off. So the revealed state is
 * the DEFAULT in CSS, and the hidden state is applied only after JavaScript has
 * confirmed it can also remove it. That ordering matters: the naive version
 * (hidden by default, shown by observer) leaves every section permanently
 * invisible if the script fails, the observer is unsupported, or the element
 * starts off-screen in a browser that never fires the callback.
 *
 * Here, failure of any kind means the content is simply visible — which is the
 * correct outcome, and also what a crawler and a reader-mode parser get.
 *
 * ── REDUCED MOTION ─────────────────────────────────────────────────────────
 *
 * Checked in JS as well as in CSS. The media query alone would still let the
 * element be marked hidden for a frame before the CSS neutralised the
 * transition; bailing out here means the node is never touched at all.
 *
 * ── WHY NOT A LIBRARY ──────────────────────────────────────────────────────
 *
 * This is eighteen lines of logic and one CSS transition. Framer Motion for
 * this is roughly 40 kB of JavaScript to move something 12 pixels.
 */
export function Reveal({
  children,
  /** Stagger, in ms. Kept small — a long stagger reads as a page still loading. */
  delay = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  as?: 'div' | 'li' | 'section'
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const [armed, setArmed] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') return

    // Already in view on first paint (the hero, above-the-fold content): do not
    // hide it just to animate it back in. That produces a flash on load and
    // delays the largest contentful paint for no benefit.
    const rect = node.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.9) return

    setArmed(true)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            observer.disconnect()
          }
        }
      },
      // Fires slightly before the element reaches the viewport edge, so the
      // motion has finished by the time it is properly in view.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const state = !armed || shown ? 'odg-reveal-in' : 'odg-reveal-out'

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`odg-reveal ${state} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
