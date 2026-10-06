import { MilestoneMarker } from './architecture'

/** Already-localised demo content, resolved on the server. */
export interface PortalDemoStrings {
  label: string
  projectLabel: string
  stages: { id: string; state: 'completed' | 'current' | 'upcoming'; title: string }[]
  panels: { id: string; label: string; value: string }[]
  tabs: string[]
}

/**
 * The personal area, drawn as a phone screen: a picture of the interface, not
 * an interface.
 *
 * ── WHY IT HAS NO CONTROLS ─────────────────────────────────────────────────
 *
 * The homepage used to embed an interactive demo whose first tab, a teal
 * "הפרויקט שלי", was the most prominent button between the hero and the end of
 * the page, and it led nowhere. The design review counted it as the page's
 * accidental call to action. This frame has no buttons, links or tabs: the
 * chips along the bottom are labels, and the one action is the real link
 * beside it.
 *
 * ── WHAT IT MUST NOT CLAIM ─────────────────────────────────────────────────
 *
 * Every string is generic ("הפרויקט שלי", no address, no date, no number),
 * and the demonstration badge is part of the frame, not an option. It is a
 * <figure> whose text a screen reader reads as text, labelled as the
 * demonstration it is.
 */
export function PortalTeaser({
  demo,
  currentStageLabel,
}: {
  demo: PortalDemoStrings
  currentStageLabel: string
}) {
  const current = demo.stages.find((stage) => stage.state === 'current')

  return (
    <figure aria-label={demo.label} className="m-0 mx-auto w-full max-w-[20rem]">
      <div className="rounded-[2.25rem] bg-surface-inverse p-3 shadow-[0_24px_48px_-24px_rgba(20,49,47,0.55)]">
        <div className="rounded-[1.6rem] bg-white px-5 pb-6 pt-5">
          <div className="flex items-center justify-between gap-3">
            <span className="type-small font-bold text-gray-900">{demo.projectLabel}</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {demo.label}
            </span>
          </div>

          {/* The stages as markers on a line. Their names are listed for
              screen readers; on screen the current one is named below. */}
          <ol className="relative mt-5 flex items-center justify-between">
            <span aria-hidden="true" className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-teal-100" />
            {demo.stages.map((stage) => (
              <li key={stage.id} className="relative">
                <MilestoneMarker state={stage.state} size="sm" />
                <span className="sr-only">{stage.title}</span>
              </li>
            ))}
          </ol>

          <dl className="mt-5 divide-y divide-gray-200 border-y border-gray-200">
            {current && (
              <div className="py-3">
                <dt className="text-xs text-gray-600">{currentStageLabel}</dt>
                <dd className="mt-0.5 type-small font-semibold text-gray-900">{current.title}</dd>
              </div>
            )}
            {demo.panels.map((panel) => (
              <div key={panel.id} className="py-3">
                <dt className="text-xs text-gray-600">{panel.label}</dt>
                <dd className="mt-0.5 type-small font-semibold text-gray-900">{panel.value}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-4 flex flex-wrap gap-2">
            {demo.tabs.map((tab) => (
              <li key={tab} className="rounded-md border border-teal-100 px-2.5 py-1 text-xs text-gray-700">
                {tab}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  )
}
