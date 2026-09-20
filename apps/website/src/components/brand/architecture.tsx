/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE OPENDOOR VISUAL LANGUAGE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Three ideas, drawn the same way everywhere on the site:
 *
 *   DOOR         a rectangular opening — a frame whose edge is INTERRUPTED.
 *                Never a door icon. The gap is the motif.
 *   ARCHITECTURE stroked elevation geometry on a faint planning grid.
 *                Diagrams, never renderings, never photographs.
 *   PROCESS      one continuous hairline carrying markers through states.
 *
 * ── WHY THESE ARE PRIMITIVES AND NOT PER-SECTION DECORATION ────────────────
 *
 * A brand is recognisable because the same few devices recur with discipline.
 * If each section drew its own ornament, the page would be busier and LESS
 * distinctive — which is exactly the failure mode the brief calls "a
 * collection of cards". Everything visual on the homepage is assembled from
 * this file, so the grammar cannot drift, and a second page inherits it by
 * importing rather than by imitation.
 *
 * ── WHY STROKES, NOT FILLS OR IMAGES ───────────────────────────────────────
 *
 * There is no verified OpenDoor project photography. A stock building beside a
 * named project asserts, in pictures, that the building IS that project. Line
 * geometry asserts nothing: it is visibly a graphic. This is a provenance
 * decision before it is an aesthetic one.
 *
 * ── COST ───────────────────────────────────────────────────────────────────
 *
 * Inline SVG and CSS gradients only. No images, no canvas, no animation
 * library. Every element here is decorative and therefore `aria-hidden`.
 */

/** Brand strokes. Literal hex: an SVG stroke is not a Tailwind text colour. */
export const STROKE = {
  teal: '#2F9DA0',
  tealDeep: '#22797D',
  structure: '#6D7378',
  line: '#b8bdc2',
  faint: '#d5d8db',
  hair: '#eaecee',
} as const

/* ══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURAL GRID — the planning layer
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A faint modular grid, the way a site plan sits under a drawing. It is what
 * makes a section read as surveyed rather than as an empty band, and it
 * replaces V1's alternating background colours as the way sections gain
 * texture — colour bands made eleven slides; a shared grid makes one document.
 *
 * A CSS gradient rather than an SVG pattern, so it costs no DOM and scales to
 * any container without a viewBox.
 */
export function ArchitecturalGrid({
  size = 40,
  opacity = 0.5,
  className = '',
}: {
  size?: number
  opacity?: number
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        opacity,
        backgroundImage: `linear-gradient(to right, ${STROKE.hair} 1px, transparent 1px),
                          linear-gradient(to bottom, ${STROKE.hair} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        // Fades the grid before it reaches an edge, so it reads as a drawing on
        // the page rather than as a tiled background that got cut off.
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, #000 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, #000 40%, transparent 100%)',
      }}
    />
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * PORTAL FRAME — the door, abstracted
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A rectangle whose top edge is broken by a gap: the threshold. Content sits
 * INSIDE the frame, so a visitor reads it through the opening. That is the
 * whole motif — an interrupted border, not a drawn door.
 *
 * It recurs at three scales (portal preview, transparency demo, closing CTA):
 * enough to register as deliberate, few enough not to become wallpaper.
 */
export function PortalFrame({
  children,
  className = '',
  tone = 'teal',
}: {
  children: React.ReactNode
  className?: string
  tone?: 'teal' | 'neutral'
}) {
  const color = tone === 'teal' ? STROKE.teal : STROKE.line
  return (
    <div className={`relative ${className}`}>
      {/* Drawn as separate rules rather than a border, because the top edge has
          to carry a gap and a border cannot be interrupted. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="absolute start-0 top-0 h-px w-[18%]" style={{ background: color }} />
        {/* ↑ segment · GAP · segment ↓ — the opening */}
        <span className="absolute end-0 top-0 h-px w-[52%]" style={{ background: color }} />
        <span className="absolute bottom-0 start-0 h-px w-full" style={{ background: color }} />
        <span className="absolute bottom-0 start-0 top-0 w-px" style={{ background: color }} />
        <span className="absolute bottom-0 end-0 top-0 w-px" style={{ background: color }} />
      </span>
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * SECTION CONNECTOR — continuity across a boundary
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A short vertical hairline with a marker, straddling the seam between two
 * sections. This is the device that replaces V1's hard band edges: the eye
 * follows a line THROUGH the boundary instead of stopping at a colour change,
 * which is what makes eleven sections read as one journey.
 */
export function SectionConnector({ marker = true }: { marker?: boolean }) {
  return (
    <div aria-hidden="true" className="relative h-14 sm:h-16">
      <span
        className="absolute start-1/2 top-0 h-full w-px -translate-x-1/2"
        style={{
          background: `linear-gradient(to bottom, transparent, ${STROKE.faint} 30%, ${STROKE.faint} 70%, transparent)`,
        }}
      />
      {marker && (
        <span
          className="absolute start-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45"
          style={{ background: STROKE.teal }}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * HERO COMPOSITION — architecture + door + process, layered
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Four depths, back to front:
 *
 *   1. planning grid          the survey
 *   2. distant volumes        context — the urban block
 *   3. foreground elevation   the subject
 *   4. the opening, and the process line leaving the frame
 *
 * The process line exits the drawing at the bottom edge on purpose: the
 * section connector below the hero picks it up, so the journey the page
 * describes starts inside the hero graphic and continues down the page.
 *
 * Depth comes from stroke weight and value, not from shadow or blur — the way
 * an elevation drawing does it, and it stays crisp at any zoom.
 */
export function HeroComposition() {
  return (
    <svg
      viewBox="0 0 520 440"
      className="h-auto w-full"
      fill="none"
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        {/* Fades the far context so the eye lands on the foreground volume. */}
        <linearGradient id="odg-hero-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ── 1. planning grid ────────────────────────────────────────────── */}
      <g stroke={STROKE.hair} strokeWidth="1">
        {Array.from({ length: 13 }, (_, i) => (
          <path key={`gv-${i}`} d={`M${40 + i * 36} 24V400`} />
        ))}
        {Array.from({ length: 11 }, (_, i) => (
          <path key={`gh-${i}`} d={`M40 ${24 + i * 36}H472`} />
        ))}
      </g>
      <rect x="40" y="24" width="432" height="376" fill="url(#odg-hero-fade)" />

      {/* ── 2. distant volumes ──────────────────────────────────────────── */}
      <g stroke={STROKE.faint} strokeWidth="1.25" className="odg-layer-far">
        <path d="M56 372V214h74v158" />
        <path d="M392 372V246h72v126" />
        {[246, 282, 318, 354].map((y) => (
          <path key={`d1-${y}`} d={`M56 ${y}h74`} />
        ))}
        {[282, 318, 354].map((y) => (
          <path key={`d2-${y}`} d={`M392 ${y}h72`} />
        ))}
      </g>

      {/* ── 3. foreground elevation ─────────────────────────────────────── */}
      <g className="odg-layer-near">
        <g stroke={STROKE.line} strokeWidth="1.25">
          <path d="M148 372V150h108v222" />
          {[186, 222, 258, 294, 330].map((y) => (
            <path key={`f-${y}`} d={`M148 ${y}h108`} />
          ))}
          {[184, 220].map((x) => (
            <path key={`fv-${x}`} d={`M${x} 150v222`} />
          ))}
        </g>

        {/* Second mass, offset — asymmetry, so it reads as a block, not a tower */}
        <path d="M272 372V186h96v186" stroke={STROKE.structure} strokeWidth="1.75" />
        <g stroke={STROKE.line} strokeWidth="1">
          {[222, 258, 294, 330].map((y) => (
            <path key={`s-${y}`} d={`M272 ${y}h96`} />
          ))}
          {[304, 336].map((x) => (
            <path key={`sv-${x}`} d={`M${x} 186v186`} />
          ))}
        </g>

        {/* Roof accents — the only teal in the upper composition */}
        <path d="M272 186h96" stroke={STROKE.teal} strokeWidth="2.25" />
        <path d="M148 150h108" stroke={STROKE.tealDeep} strokeWidth="1.5" />
      </g>

      <path d="M24 372h472" stroke={STROKE.line} strokeWidth="1.5" />

      {/* ── 4. THE OPENING ──────────────────────────────────────────────── */}
      {/* A threshold cut into the foreground mass: three sides drawn, the
          fourth left open, the swing implied by one offset edge. */}
      <g className="odg-portal">
        <path
          d="M296 372v-74h44v74"
          stroke={STROKE.teal}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M340 298l22-16v74"
          stroke={STROKE.teal}
          strokeWidth="1.75"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </g>

      {/* ── the process line leaves the drawing ─────────────────────────── */}
      <path
        d="M318 372v46"
        stroke={STROKE.teal}
        strokeWidth="1.5"
        strokeDasharray="4 5"
        opacity="0.7"
      />
      <circle cx="318" cy="426" r="3.5" fill={STROKE.teal} />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * HERO MARK, COMPACT — the same idea at phone size
 * ══════════════════════════════════════════════════════════════════════════
 *
 * V1 hid the hero graphic below `lg`, so a phone visitor met no brand identity
 * at all on the first screen. The brief calls that out directly. Rather than
 * shrink the full composition into illegibility, this is a separate, wider,
 * shallower crop with the layers that survive at 375px: ground, two masses, the
 * grid, and the opening. The identity is preserved; the detail is not faked.
 */
export function HeroMarkCompact() {
  return (
    <svg
      viewBox="0 0 360 132"
      className="h-auto w-full"
      fill="none"
      role="presentation"
      aria-hidden="true"
    >
      <g stroke={STROKE.hair} strokeWidth="1">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={`mv-${i}`} d={`M${i * 40} 0V112`} />
        ))}
        {[28, 56, 84].map((y) => (
          <path key={`mh-${y}`} d={`M0 ${y}H360`} />
        ))}
      </g>
      <g stroke={STROKE.faint} strokeWidth="1.25">
        <path d="M20 112V56h52v56" />
        <path d="M292 112V64h48v48" />
      </g>
      <g stroke={STROKE.line} strokeWidth="1.25">
        <path d="M92 112V38h72v74" />
        {[62, 86].map((y) => (
          <path key={`c-${y}`} d={`M92 ${y}h72`} />
        ))}
      </g>
      <path d="M180 112V26h84v86" stroke={STROKE.structure} strokeWidth="1.75" />
      <g stroke={STROKE.line} strokeWidth="1">
        {[54, 82].map((y) => (
          <path key={`c2-${y}`} d={`M180 ${y}h84`} />
        ))}
      </g>
      <path d="M180 26h84" stroke={STROKE.teal} strokeWidth="2.25" />
      <path d="M0 112h360" stroke={STROKE.line} strokeWidth="1.5" />
      <path
        d="M208 112V80h28v32"
        stroke={STROKE.teal}
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <path d="M236 80l14-10v42" stroke={STROKE.teal} strokeWidth="1.5" opacity="0.55" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * PROJECT PATTERN — a unique mark per project, from the slug alone
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Solves the missing-photography problem WITHOUT inventing anything. The
 * composition varies with a hash of the slug: how many volumes, their heights,
 * which one carries the opening, floor-line density, and the crop. Same slug →
 * same mark forever; different slugs → visibly different marks.
 *
 * ── THE VARIATION MEANS NOTHING, DELIBERATELY ──────────────────────────────
 *
 * Height is not storey count. Volume count is not building count. The opening
 * is not an entrance location. It must stay that way: the moment a viewer
 * could decode a fact from the drawing, the drawing would be asserting one —
 * and none of these facts are verified for any real project. It reads as a
 * graphic mark precisely so that it cannot be read as a plan.
 */
function hash(slug: string): number {
  // FNV-1a. Small, stable across runtimes, and — unlike Math.random — gives the
  // server and the client the same mark, so this cannot hydration-mismatch.
  let h = 0x811c9dc5
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function ProjectPattern({ slug, className = '' }: { slug: string; className?: string }) {
  const h = hash(slug)
  const pick = (shift: number, mod: number) => (h >>> shift) % mod

  const count = 3 + pick(0, 2) // 3 or 4 volumes
  const doorIn = pick(3, count) // which volume is opened
  const density = 26 + pick(6, 3) * 6 // floor-line spacing
  const skew = pick(9, 3) // horizontal crop offset
  const baseline = 168
  const width = 300 / count

  const volumes = Array.from({ length: count }, (_, i) => {
    const tall = ((h >>> (12 + i * 3)) % 5) * 14
    return { x: 10 + i * width + skew * 3, w: width - 10, top: 108 - tall }
  })

  return (
    <svg
      viewBox="0 0 320 200"
      className={`h-full w-full ${className}`}
      fill="none"
      role="presentation"
      aria-hidden="true"
    >
      {/* planning grid, cropped differently per project */}
      <g stroke={STROKE.hair} strokeWidth="1">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={`pg-${i}`} d={`M${-10 + skew * 8 + i * 40} 0V200`} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <path key={`ph-${i}`} d={`M0 ${i * 40}H320`} />
        ))}
      </g>

      {volumes.map((v, i) => {
        const opened = i === doorIn
        const floors = Math.max(1, Math.floor((baseline - v.top) / density))
        return (
          <g key={i}>
            <path
              d={`M${v.x} ${baseline}V${v.top}h${v.w}v${baseline - v.top}`}
              stroke={opened ? STROKE.structure : STROKE.line}
              strokeWidth={opened ? 1.75 : 1.25}
            />
            {Array.from({ length: floors }, (_, k) => (
              <path
                key={k}
                d={`M${v.x} ${baseline - (k + 1) * density}h${v.w}`}
                stroke={STROKE.hair}
                strokeWidth="1"
              />
            ))}
            {opened && (
              <>
                {/* One teal note per mark: the roof, and the threshold. */}
                <path d={`M${v.x} ${v.top}h${v.w}`} stroke={STROKE.teal} strokeWidth="2" />
                <path
                  d={`M${v.x + v.w / 2 - 11} ${baseline}v-30h22v30`}
                  stroke={STROKE.teal}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </>
            )}
          </g>
        )
      })}

      <path d={`M0 ${baseline}h320`} stroke={STROKE.line} strokeWidth="1.25" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * MILESTONE MARKER — one node, three states
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Shared by the public process, the transparency demonstration and the portal
 * preview — which is what makes those three read as one system rather than as
 * three unrelated timelines.
 *
 * State is carried by SHAPE and FILL as well as colour, so it survives
 * greyscale and colour vision deficiency. Colour alone is not an accessible
 * carrier of meaning, and these three states are meaning.
 */
export function MilestoneMarker({
  state,
  label,
  size = 'md',
}: {
  state: 'completed' | 'current' | 'upcoming'
  /** Rendered inside the marker when present — a stage number. */
  label?: string
  size?: 'sm' | 'md'
}) {
  const box = size === 'sm' ? 'h-6 w-6 text-[11px]' : 'h-9 w-9 text-xs'
  const skin =
    state === 'completed'
      ? 'border-teal-600 bg-teal-600 text-white'
      : state === 'current'
        ? 'border-teal-600 bg-white text-teal-800 ring-4 ring-teal-100'
        : 'border-gray-300 bg-white text-gray-400'

  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center rounded-full border-2 font-semibold ${box} ${skin}`}
    >
      {state === 'completed' && !label ? (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none">
          <path
            d="M5 10.5l3.5 3.5L15 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : label ? (
        label
      ) : state === 'current' ? (
        <span className="h-2 w-2 rounded-full bg-teal-600" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
      )}
    </span>
  )
}
