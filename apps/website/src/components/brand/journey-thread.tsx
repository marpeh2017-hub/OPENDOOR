'use client'

import { useEffect, useRef, useState } from 'react'
import { STROKE } from './architecture'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE SIGNATURE OPENDOOR INTERACTION
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ONE line, drawn once, running the length of the page's journey:
 *
 *   the city  →  the threshold  →  the process  →  a project
 *             →  transparency   →  the resident's own view
 *
 * It is the brief's central idea made literal but quiet: OpenDoor does not
 * hand residents to a developer, it manages a route — so the page draws the
 * route, and the visitor's own scrolling is what advances along it.
 *
 * ── WHY THIS AND NOT TWENTY MICRO-INTERACTIONS ─────────────────────────────
 *
 * Every section could have had its own reveal. That is the agency pattern the
 * brief rules out, and it produces motion that means nothing individually. One
 * continuous element that responds to the reader's actual position through the
 * argument is a single idea, executed once, and it is the thing that would
 * still identify the site with the logo removed.
 *
 * ── IT IS A DESIGN BEFORE IT IS AN INTERACTION ─────────────────────────────
 *
 * With JavaScript off, reduced motion on, or the observer unsupported, the
 * rail still renders: the full line, every waypoint node, in neutral. The
 * progress fill is the only thing that is lost, and the composition does not
 * depend on it. That ordering is deliberate — the rail is authored as complete
 * and progress is added, never the reverse.
 *
 * ── WHY IT IS NOT ON MOBILE ────────────────────────────────────────────────
 *
 * A phone has no gutter to put it in. Forcing it there would either overlap the
 * content or squeeze the text column. Mobile keeps the section connectors,
 * which carry the same grammar at the seams where it reads. Identity survives;
 * the desktop-only ornament does not get faked at a width that cannot hold it.
 *
 * ── COST ───────────────────────────────────────────────────────────────────
 *
 * One passive scroll listener, `requestAnimationFrame`-coalesced, writing a
 * single CSS custom property. No layout reads in the frame, no library, and it
 * unsubscribes itself when the journey has left the viewport.
 */
export function JourneyThread({
  /** Waypoint labels, in order. Content, so the caller supplies them. */
  waypoints,
}: {
  waypoints: string[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    setLive(true)
    let frame = 0

    const measure = () => {
      frame = 0
      const rect = node.getBoundingClientRect()
      // How far the viewport's midpoint has travelled through the rail.
      const travelled = window.innerHeight / 2 - rect.top
      const ratio = travelled / rect.height
      setProgress(Math.min(1, Math.max(0, ratio)))
    }

    const onScroll = () => {
      // Coalesce to one measurement per frame: a scroll handler that reads
      // layout on every event is the classic cause of scroll jank.
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 top-0 hidden lg:block"
      style={{ insetInlineStart: 'max(1.25rem, calc((100vw - 80rem) / 2 + 1.25rem))' }}
    >
      <div className="sticky top-0 h-screen">
        <div className="relative h-full w-px">
          {/* The rail, always fully drawn. */}
          <span
            className="absolute inset-0 w-px"
            style={{ background: STROKE.faint }}
          />

          {/* The travelled portion. Zero-height without JS, which simply means
              the rail reads as neutral — not as broken. */}
          <span
            className="absolute start-0 top-0 w-px origin-top transition-[height] duration-150 ease-out"
            style={{
              height: live ? `${progress * 100}%` : '0%',
              background: STROKE.teal,
            }}
          />

          {/* Waypoints, evenly spaced along the rail. A node is filled once the
              travelled portion has reached it. */}
          {waypoints.map((label, index) => {
            const at = waypoints.length === 1 ? 0 : index / (waypoints.length - 1)
            const reached = live && progress >= at - 0.001
            return (
              <span
                key={label}
                className="absolute start-0 flex -translate-x-1/2 items-center rtl:translate-x-1/2"
                style={{ top: `${at * 100}%` }}
              >
                <span
                  className="block h-1.5 w-1.5 rotate-45 transition-colors duration-300"
                  style={{ background: reached ? STROKE.teal : STROKE.line }}
                />
                <span
                  className="ms-3 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.16em] transition-colors duration-300"
                  style={{ color: reached ? STROKE.tealDeep : '#959ba2' }}
                >
                  {label}
                </span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
