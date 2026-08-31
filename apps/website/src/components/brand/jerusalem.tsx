/**
 * ══════════════════════════════════════════════════════════════════════════
 *  JERUSALEM — DRAWN, BECAUSE IT CANNOT YET BE PHOTOGRAPHED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The brief asks for Jerusalem photography. The repository contains no image
 * assets at all, and sourcing licensed photography is not something this pass
 * can do. Two responses were available:
 *
 *   1. Ship empty slots and wait.
 *   2. Draw Jerusalem in the OpenDoor line language, and design the slots so a
 *      photograph REPLACES the drawing the day one is licensed.
 *
 * This is (2), and it is the better outcome even after the photographs arrive:
 * the page cannot be broken by a missing asset, and the identity does not
 * depend on a stock library that any competitor can buy from.
 *
 * ── WHY THESE FOUR SUBJECTS ────────────────────────────────────────────────
 *
 * Each carries the meaning the brief assigned it, and each is specific enough
 * that it could not be any other city:
 *
 *   HILLSIDE   Jerusalem is built on hills, in stone, in dense stepped
 *              terraces. Drawn as stacked masses following a contour — not a
 *              flat skyline, which is what makes generic skyline art generic.
 *   COURSING   Ashlar stone coursing. Place, continuity, materiality.
 *   CABLES     The Chords Bridge, as structure: one leaning mast and a fan of
 *              cables. Used ONCE on the page.
 *   RAIL       The light rail as part of a street — track, catenary, and the
 *              buildings either side. Transformation, not transport.
 *
 * ── AND WHY THE CABLE FAN MATTERS BEYOND ITS ONE APPEARANCE ────────────────
 *
 * A cable fan is a set of straight lines converging on a point — which is
 * exactly what a process connector is. The bridge is not repeated, but its
 * GEOMETRY is where the process line's fan connectors come from. That is the
 * brief's "subtle geometric inspiration" rather than a repeated logo.
 *
 * Everything here is decorative: `aria-hidden`, and the meaning it carries is
 * always also stated in adjacent text.
 */

import { STROKE } from './architecture'

/* ══════════════════════════════════════════════════════════════════════════
 * HILLSIDE — dense stepped residential fabric on a contour
 * ══════════════════════════════════════════════════════════════════════════ */
export function JerusalemHillside({ className = '' }: { className?: string }) {
  // Stepped terraces: each band of buildings sits on a higher contour than the
  // one in front. This is the shape of the city; a flat baseline is not.
  const terraces = [
    { y: 300, from: 20, to: 470, h: [52, 74, 60, 88, 66, 80], stroke: STROKE.line, w: 1.5 },
    { y: 258, from: 60, to: 500, h: [46, 68, 54, 76, 62], stroke: STROKE.faint, w: 1.25 },
    { y: 216, from: 110, to: 520, h: [40, 56, 48, 64], stroke: STROKE.hair, w: 1 },
  ]

  return (
    <svg
      viewBox="0 0 540 340"
      className={`h-full w-full ${className}`}
      fill="none"
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax slice"
    >
      {terraces.map((row, r) => {
        const span = (row.to - row.from) / row.h.length
        return (
          <g key={r} stroke={row.stroke} strokeWidth={row.w}>
            {/* the contour the terrace stands on */}
            <path d={`M${row.from} ${row.y}h${row.to - row.from}`} />
            {row.h.map((h, i) => {
              const x = row.from + i * span
              const w = span - 8
              return (
                <g key={i}>
                  <path d={`M${x} ${row.y}V${row.y - h}h${w}v${h}`} />
                  {/* floor lines — only on the front terrace, so depth reads */}
                  {r === 0 &&
                    [0.33, 0.66].map((f) => (
                      <path
                        key={f}
                        d={`M${x} ${row.y - h * f}h${w}`}
                        stroke={STROKE.hair}
                        strokeWidth="1"
                      />
                    ))}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * STONE COURSING — Jerusalem stone, as a pattern
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ashlar: staggered courses of dressed block. Rendered as a tiling SVG pattern
 * so it fills any area without a fixed viewBox, and kept extremely faint — it
 * is material, not decoration, and it should be felt before it is noticed.
 */
export function StoneCoursing({
  id,
  opacity = 0.5,
  className = '',
}: {
  /** Pattern ids are document-global; two instances with one id collide. */
  id: string
  opacity?: number
  className?: string
}) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} width="72" height="34" patternUnits="userSpaceOnUse">
          <path d="M0 0h72M0 17h72M0 34h72" stroke={STROKE.hair} strokeWidth="1" fill="none" />
          {/* staggered joints — the thing that makes it ashlar and not a grid */}
          <path d="M0 0v17M36 17v17M72 0v17" stroke={STROKE.hair} strokeWidth="1" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * CABLE FAN — the Chords Bridge, as structure
 * ══════════════════════════════════════════════════════════════════════════
 *
 * One leaning mast, a fan of cables to the deck, the deck, and the city behind
 * it. Not a postcard: no sky, no sunset, no framing that makes it a monument.
 * It is drawn as an engineering elevation, which is what it is.
 *
 * Used ONCE on the homepage, at the closing. Its geometry recurs; its image
 * does not.
 */
export function ChordsBridgeGeometry({ className = '' }: { className?: string }) {
  const mastX = 168
  const mastTop = 26
  const deckY = 232
  // Cable anchor points along the deck. Uneven spacing, because the real fan is
  // uneven — evenly spaced cables read as a decorative sunburst.
  const anchors = [246, 296, 342, 384, 422, 456, 486, 512]
  const back = [124, 96, 72, 52]

  return (
    <svg
      viewBox="0 0 560 300"
      className={`h-full w-full ${className}`}
      fill="none"
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* the city the bridge crosses — kept faint, it is context not subject */}
      <g stroke={STROKE.hair} strokeWidth="1">
        {[
          [24, 268, 44, 46],
          [78, 268, 38, 32],
          [520, 268, 36, 40],
        ].map(([x, y, w, h], i) => (
          <path key={i} d={`M${x} ${y}V${y - h}h${w}v${h}`} />
        ))}
      </g>

      {/* the fan — forward cables */}
      <g stroke={STROKE.faint} strokeWidth="1">
        {anchors.map((x) => (
          <path key={x} d={`M${mastX} ${mastTop}L${x} ${deckY}`} />
        ))}
      </g>
      {/* backstays */}
      <g stroke={STROKE.hair} strokeWidth="1">
        {back.map((x) => (
          <path key={x} d={`M${mastX} ${mastTop}L${x} ${deckY}`} />
        ))}
      </g>

      {/* the mast — leaning, which is the bridge's signature */}
      <path d={`M${mastX} ${mastTop}L188 ${deckY}`} stroke={STROKE.structure} strokeWidth="2.25" />

      {/* the deck */}
      <path d={`M20 ${deckY}h520`} stroke={STROKE.teal} strokeWidth="2.25" />
      <path d={`M20 ${deckY + 9}h520`} stroke={STROKE.faint} strokeWidth="1" />

      <path d="M0 268h560" stroke={STROKE.faint} strokeWidth="1.25" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * LIGHT RAIL — the street, not the train
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The brief is specific: a promotional close-up of a tram would say the site is
 * about public transport. What communicates "the city is changing" is the tram
 * INSIDE its street — track, catenary, poles, and residential frontage either
 * side. So the train is the smallest element here, and the buildings are the
 * largest.
 */
export function LightRailStreet({ className = '' }: { className?: string }) {
  const ground = 176

  return (
    <svg
      viewBox="0 0 640 220"
      className={`h-full w-full ${className}`}
      fill="none"
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax slice"
    >
      {/* residential frontage, both sides, in perspective-free elevation */}
      <g stroke={STROKE.faint} strokeWidth="1.25">
        {[
          [10, 88],
          [76, 112],
          [150, 96],
          [472, 104],
          [548, 84],
        ].map(([x, h], i) => (
          <g key={i}>
            <path d={`M${x} ${ground}V${ground - h}h58v${h}`} />
            {[0.28, 0.52, 0.76].map((f) => (
              <path
                key={f}
                d={`M${x} ${ground - h * f}h58`}
                stroke={STROKE.hair}
                strokeWidth="1"
              />
            ))}
          </g>
        ))}
      </g>

      {/* catenary: poles and the contact wire the tram runs under */}
      <g stroke={STROKE.hair} strokeWidth="1">
        {[240, 330, 420].map((x) => (
          <path key={x} d={`M${x} ${ground}V64`} />
        ))}
      </g>
      <path d={`M228 64h204`} stroke={STROKE.faint} strokeWidth="1" />

      {/* the tram — one long low volume, deliberately understated */}
      <path
        d={`M252 ${ground - 4}v-38h136v38`}
        stroke={STROKE.structure}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d={`M252 ${ground - 30}h136`} stroke={STROKE.hair} strokeWidth="1" />
      {/* the articulation joint, which is what makes it read as a tram */}
      <path d={`M320 ${ground - 42}v38`} stroke={STROKE.hair} strokeWidth="1" />
      <path d={`M252 ${ground - 42}h136`} stroke={STROKE.teal} strokeWidth="2" />

      {/* the track — the only other teal, so the eye follows the line */}
      <path d={`M0 ${ground}h640`} stroke={STROKE.line} strokeWidth="1.5" />
      <path d={`M0 ${ground + 7}h640`} stroke={STROKE.teal} strokeWidth="1.5" opacity="0.7" />
    </svg>
  )
}
