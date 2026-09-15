'use client'

import { useEffect, useState } from 'react'

/**
 * Compact-on-scroll shell for the site header.
 *
 * ── WHY A SHELL AND NOT A CLIENT HEADER ────────────────────────────────────
 *
 * The header's content — navigation labels, the brand, the CTAs — is all
 * server-rendered and translated on the server. Only the scrolled/​not-scrolled
 * class needs the client. Wrapping the server output in this shell keeps the
 * entire header out of the client bundle except for this one boolean.
 *
 * ── WHY THE HEIGHT DOES NOT CHANGE ─────────────────────────────────────────
 *
 * "Compact on scroll" usually means the bar shrinks, which reflows the whole
 * document under a sticky element the moment the user starts scrolling — the
 * page jumps under the pointer. Here the bar keeps its height and changes only
 * its SURFACE: transparent-ish over the hero, opaque with a hairline once
 * content is passing beneath it. The effect is the intended one (the header
 * separating itself from the page) with none of the reflow.
 *
 * `passive: true` on the listener: this handler never calls `preventDefault`,
 * and without the flag the browser must wait for it before scrolling, which is
 * the classic scroll-jank source.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll() // a reload part-way down the page must not start untouched
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-header transition-[background-color,border-color,box-shadow] duration-200 ${
        scrolled
          ? 'border-b border-gray-200 bg-white/95 shadow-[0_1px_3px_rgb(20_49_47/0.05)] backdrop-blur'
          : 'border-b border-transparent bg-white/70 backdrop-blur'
      }`}
    >
      {children}
    </header>
  )
}
