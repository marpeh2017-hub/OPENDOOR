import type { ProjectMilestone } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import type { Localizer } from '@/lib/localize'
import { STROKE } from '@/components/brand/architecture'

/**
 * What has happened, and what comes next.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  AN UPCOMING MILESTONE NEVER CARRIES A DATE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This is enforced here, in the renderer, rather than trusted to whoever fills
 * the data. `occurredAt` and `periodLabel` are read ONLY for completed and
 * current entries; for an upcoming one they are ignored even when present.
 *
 * The reason is that the failure is asymmetric. A missing date on a future
 * milestone costs a reader nothing. A date shown on one is read as a
 * commitment, gets repeated at a residents' meeting, and becomes the thing
 * OpenDoor is held to when the planning committee sits three months later than
 * anyone expected. No caveat text survives that journey; deleting the date
 * does.
 *
 * ── APPROXIMATE PERIODS ARE FIRST-CLASS ────────────────────────────────────
 *
 * Most real project history is remembered as "some time in 2025", not as a
 * day. Without `periodLabel` an author who knows only the year is pushed to
 * invent a day so the field will accept a value, turning a vague truth into a
 * precise falsehood. `occurredAt` wins when present; otherwise the period
 * label prints as written.
 *
 * ── NO COMPLETION ARITHMETIC ───────────────────────────────────────────────
 *
 * Nothing here counts completed entries against the total. Four of seven
 * milestones done is not 57% of a project, and printing that number would be
 * inventing a measurement out of an editorial list whose length is arbitrary.
 *
 * ── UNVERIFIED HISTORY IS NOT HISTORY ──────────────────────────────────────
 *
 * A completed milestone without `verification` is dropped. Saying a thing
 * happened, on a date, is a factual claim about a real building's process, and
 * it obeys the same rule as every other one on the page.
 */
export async function MilestoneList({
  milestones,
  verifiedProjection = false,
  t: loc,
}: {
  milestones: readonly ProjectMilestone[]
  verifiedProjection?: boolean
  t: Localizer
}) {
  const tMs = await getTranslations('milestones')

  const shown = milestones.filter(
    (milestone) =>
      verifiedProjection || milestone.state !== 'completed' || milestone.verification !== undefined,
  )
  if (shown.length === 0) return null

  return (
    <ol className="relative mt-11">
      {/* One continuous hairline, teal while the history is real and grey once
          it passes into what has not happened. The gradient stop is computed
          from how many entries are behind us, so the line's change of colour
          lands at the current entry rather than at a guessed fraction. */}
      <span
        aria-hidden="true"
        className="absolute bottom-2 top-2 w-px"
        style={{
          insetInlineStart: '7px',
          background: `linear-gradient(to bottom, ${STROKE.teal} 0%, ${STROKE.teal} ${stopAt(shown)}%, ${STROKE.faint} ${stopAt(shown)}%, ${STROKE.faint} 100%)`,
        }}
      />

      {shown.map((milestone, index) => {
        const upcoming = milestone.state === 'upcoming'
        const current = milestone.state === 'current'

        // Read for completed and current only. See the block comment.
        const when = upcoming
          ? null
          : (milestone.occurredAt ?? (milestone.periodLabel ? loc(milestone.periodLabel) : null))

        return (
          <li
            key={milestone.id}
            className={`relative ps-10 ${index < shown.length - 1 ? 'pb-9' : ''}`}
          >
            <Marker state={milestone.state} />

            <div
              className={`text-[12.5px] font-semibold tracking-wide ${
                current ? 'text-teal-700' : upcoming ? 'text-gray-600' : 'text-teal-600'
              }`}
            >
              {tMs(milestone.state)}
              {when && <span> · {when}</span>}
              {upcoming && <span> · {tMs('noDate')}</span>}
            </div>

            <h3
              className={`mt-2 text-lg font-bold sm:text-xl ${
                upcoming ? 'text-gray-600' : 'text-gray-900'
              }`}
            >
              {loc(milestone.title)}
            </h3>

            {milestone.note && (
              <p
                className={`mt-2 max-w-2xl text-sm leading-relaxed sm:text-[15px] ${
                  upcoming ? 'text-gray-600' : 'text-gray-600'
                }`}
              >
                {loc(milestone.note)}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Where the line stops being teal: at the current entry, or at the end of
 *  the completed run when nothing is marked current. */
function stopAt(milestones: readonly ProjectMilestone[]): number {
  const currentIndex = milestones.findIndex((m) => m.state === 'current')
  const completed = milestones.filter((m) => m.state === 'completed').length
  const index = currentIndex >= 0 ? currentIndex : completed - 1
  if (index < 0) return 0
  return Math.round(((index + 0.5) / milestones.length) * 100)
}

/**
 * Completed is a filled dot, current is an OPENING — a ring, not a disc,
 * because the thing it marks has not closed. Upcoming is a small hollow
 * outline: drawn, but not asserted.
 */
function Marker({ state }: { state: ProjectMilestone['state'] }) {
  if (state === 'current') {
    return (
      <span
        aria-hidden="true"
        className="absolute top-0.5 h-[15px] w-[15px] rounded-full border-2 bg-white"
        style={{ insetInlineStart: 0, borderColor: STROKE.teal }}
      />
    )
  }
  if (state === 'completed') {
    return (
      <span
        aria-hidden="true"
        className="absolute top-1 h-[11px] w-[11px] rounded-full"
        style={{ insetInlineStart: '2px', background: STROKE.tealDeep }}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="absolute top-[5px] h-[9px] w-[9px] rounded-full border bg-surface-page"
      style={{ insetInlineStart: '3px', borderColor: STROKE.line }}
    />
  )
}
