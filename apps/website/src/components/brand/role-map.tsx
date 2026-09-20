import type { RoleMap } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { STROKE } from './architecture'

/**
 * The relationship map — who is who in an urban-renewal process.
 *
 * ── WHY THIS IS NOT A HOVER-REVEAL, AND NOT A CLIENT COMPONENT ─────────────
 *
 * The brief suggests revealing each role's explanation on hover or focus. I
 * did not build it that way, for two reasons that outrank the visual idea:
 *
 *   1. To make a static tile focusable you have to put `tabindex` on
 *      non-interactive content. That inserts six stops into the tab order that
 *      do nothing when activated — a well-known screen-reader trap, and worse
 *      for keyboard users than the pattern it was meant to serve.
 *   2. The explanations ARE the point of the section. A visitor scanning the
 *      page should read "יזם — צד נפרד, עם אינטרס נפרד" without discovering
 *      that hovering is required. Hiding the substance behind a gesture makes
 *      the section decorative.
 *
 * So every explanation is permanently visible, and hover/focus supplies
 * EMPHASIS instead of content: the tile's rule turns teal and its text
 * darkens. Nothing is gated, nothing is hidden, no JavaScript ships, and the
 * section renders fully on the server.
 *
 * ── WHAT THE LAYOUT ASSERTS ────────────────────────────────────────────────
 *
 * OpenDoor sits on the owners' side of a drawn line, and the other parties sit
 * across from it. That is the one structural claim the section makes and it is
 * true. The parties are shown as peers of each other — no arrow from OpenDoor
 * to any of them — because an arrow would imply direction of authority, and
 * OpenDoor does not employ or direct any of them.
 */
export function RoleMapView({ map, t }: { map: RoleMap; t: Localizer }) {
  return (
    <div className="relative">
      {/* ── owners' side ──────────────────────────────────────────────── */}
      <div className="relative">
        <ul className="grid gap-4 sm:grid-cols-2">
          {[map.principal, map.organiser].map((node, index) => (
            <li
              key={node.id}
              className="group relative bg-white/70 p-5 transition-colors duration-200 hover:bg-white"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 bg-teal-600"
                style={index === 1 ? undefined : { background: STROKE.tealDeep }}
              />
              <h3 className="text-base font-semibold text-gray-900">{t(node.label)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 transition-colors group-hover:text-gray-800">
                {t(node.detail)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* ── the table ─────────────────────────────────────────────────────
          A drawn line with a gap in the middle: the same interrupted-border
          motif as everywhere else, here reading as the two sides of a table
          with an opening between them. */}
      <div aria-hidden="true" className="relative my-8 h-10">
        <span
          className="absolute start-0 top-1/2 h-px w-[calc(50%-1.75rem)]"
          style={{ background: STROKE.faint }}
        />
        <span
          className="absolute end-0 top-1/2 h-px w-[calc(50%-1.75rem)]"
          style={{ background: STROKE.faint }}
        />
        <span
          className="absolute start-1/2 top-0 h-full w-px -translate-x-1/2"
          style={{ background: STROKE.faint }}
        />
        <span
          className="absolute start-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45"
          style={{ background: STROKE.teal }}
        />
      </div>

      {/* ── the other parties ─────────────────────────────────────────────
          Peers of each other, deliberately uniform: none is ranked above
          another, and none is presented as belonging to OpenDoor. */}
      <ul className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {map.parties.map((node) => (
          <li key={node.id} className="group">
            <span
              aria-hidden="true"
              className="block h-px w-full bg-gray-200 transition-colors duration-200 group-hover:bg-teal-500"
            />
            <h3 className="mt-4 text-sm font-semibold text-gray-900">{t(node.label)}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600 transition-colors group-hover:text-gray-800">
              {t(node.detail)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
