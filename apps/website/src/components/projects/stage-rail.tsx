import type { ProjectStage } from '@urban-renewal/api-contracts'
import { PROJECT_PHASE_ORDER, phaseStateFor } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { STROKE } from '@/components/brand/architecture'

/**
 * Where the process stands, at phase scale.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  FOUR PHASES, BECAUSE ELEVEN STAGES READ AS A LAW
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The eleven `ProjectStage` values are what the organisation tracks. Rendered
 * publicly in a row they would be read as the statutory path, walked in order,
 * by every project. None of that is true. Four phases read as a description of
 * how the work goes, which is what they are, and the paragraph above the rail
 * says so in words as well.
 *
 * ── NO PROGRESS, ANYWHERE ──────────────────────────────────────────────────
 *
 * There is no bar, no percentage, no "3 of 4", no fill proportional to
 * anything. `phaseStateFor` returns one of three words and that is the entire
 * vocabulary available to this component. A progress bar would be arithmetic
 * presented as measurement, and the number it produced would be wrong in a way
 * nobody could correct.
 *
 * ── THE CURRENT PHASE IS AN OPENING ────────────────────────────────────────
 *
 * Completed phases get a solid teal head rule. The current one gets the head
 * rule AND a sill at its foot, so the panel reads as a threshold rather than
 * as a filled cell — the site's door motif at the scale of a process step.
 * Upcoming phases are drawn but not coloured: they are structure, not claim.
 *
 * ── ABSENT CURRENT STAGE MEANS NO RAIL ─────────────────────────────────────
 *
 * The caller renders nothing when `currentStage` is unverified. There is no
 * default to the first phase: defaulting would state, in a graphic, that the
 * project is at the beginning, which is a factual claim nobody checked.
 */
export async function StageRail({ currentStage }: { currentStage: ProjectStage }) {
  const [tPhases, tPhaseState] = await Promise.all([
    getTranslations('phases'),
    getTranslations('phaseState'),
  ])

  return (
    <ol className="mt-10 grid border-t border-gray-300 sm:grid-cols-2 lg:grid-cols-4">
      {PROJECT_PHASE_ORDER.map((phase, index) => {
        const state = phaseStateFor(phase, currentStage)
        const isCurrent = state === 'current'
        const done = state === 'completed'

        return (
          <li
            key={phase}
            className={[
              'relative -mt-px px-5 pb-7 pt-6',
              index > 0 ? 'lg:border-s lg:border-gray-200' : '',
              isCurrent ? 'bg-surface-page' : '',
            ].join(' ')}
            style={{
              borderTop: `3px solid ${done || isCurrent ? (isCurrent ? STROKE.teal : STROKE.tealDeep) : STROKE.hair}`,
            }}
          >
            <div
              className={`text-xs font-bold tracking-wide ${
                isCurrent ? 'text-teal-700' : done ? 'text-teal-600' : 'text-gray-600'
              }`}
            >
              {tPhaseState(state)}
            </div>

            <h3
              className={`mt-2.5 text-base font-bold sm:text-[17px] ${
                state === 'upcoming' ? 'text-gray-600' : 'text-gray-900'
              }`}
            >
              {tPhases(`${phase}.name`)}
            </h3>

            <p
              className={`mt-2.5 text-[13px] leading-relaxed ${
                state === 'upcoming' ? 'text-gray-600' : 'text-gray-600'
              }`}
            >
              {tPhases(`${phase}.description`)}
            </p>

            {/* The sill. Only the current phase gets one, and it is what makes
                the panel a threshold rather than a highlighted cell. */}
            {isCurrent && (
              <span
                aria-hidden="true"
                className="absolute inset-x-5 bottom-0 h-0.5"
                style={{ background: STROKE.teal }}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
