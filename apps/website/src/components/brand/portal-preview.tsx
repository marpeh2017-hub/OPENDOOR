'use client'

import { useId, useState } from 'react'
import { MilestoneMarker, STROKE } from './architecture'

/**
 * Already-localised demo content.
 *
 * ── WHY NOT THE `PortalDemo` CONTRACT AND A LOCALIZER ──────────────────────
 *
 * This is a client component, and a function cannot cross the server/client
 * boundary — passing the localizer down fails at render with "Functions cannot
 * be passed directly to Client Components". So the server resolves every
 * string first and hands over plain data.
 *
 * That is the better boundary anyway: it keeps `LocalizedText` maps and the
 * locale-resolution rules out of the client bundle entirely, and it means this
 * component cannot accidentally render the wrong language.
 */
export interface PortalDemoStrings {
  label: string
  projectLabel: string
  stages: { id: string; title: string; state: 'completed' | 'current' | 'upcoming' }[]
  panels: { id: string; label: string; value: string }[]
  tabs: string[]
  representation?: { label: string; items: { id: string; label: string; value: string }[] }
}

/**
 * Resident portal — interface DEMONSTRATION.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS IS THE MOST DANGEROUS COMPONENT ON THE PAGE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A convincing product screenshot is exactly the kind of thing a visitor reads
 * as evidence that the product exists and that the data in it is real. Three
 * things hold that in check, and none of them is optional:
 *
 *   1. A PERMANENT badge, `demo.label`, inside the frame. Not a footnote, not
 *      a caption underneath — inside, always, in both views.
 *   2. No real project name, address, resident, date or number anywhere in the
 *      content. Enforced at the fixture, not here.
 *   3. The section's own `buildNotice` says the environment is still being
 *      built, and it renders next to the heading rather than below the fold.
 *
 * ── NOT A FLOATING BROWSER SCREENSHOT ──────────────────────────────────────
 *
 * No fake browser chrome, no URL bar, no traffic-light dots, no drop shadow
 * hovering over a gradient. Those signal "marketing mockup". Instead the frame
 * uses the same interrupted-border portal motif as the rest of the site and is
 * anchored into the page composition — the visitor is looking through the same
 * doorway the hero drew, and what is behind it is their project.
 *
 * ── THE TOGGLE ─────────────────────────────────────────────────────────────
 *
 * Real tab semantics: `role="tablist"`, `aria-selected`, arrow-key roving
 * focus. Both panels stay mounted so in-page search and screen-reader browse
 * mode can reach either one; the inactive panel is `hidden`, which removes it
 * from the accessibility tree without unmounting the DOM.
 *
 * This is the only interactive element in the section, and the section is fully
 * readable if its JavaScript never arrives: the resident view is the default
 * server-rendered state.
 */
export function PortalPreview({ demo }: { demo: PortalDemoStrings }) {
  const [view, setView] = useState<'resident' | 'representation'>('resident')
  const baseId = useId()
  const hasRep = Boolean(demo.representation)

  const tabs: { key: 'resident' | 'representation'; label: string }[] = [
    { key: 'resident', label: demo.projectLabel },
    ...(demo.representation
      ? [{ key: 'representation' as const, label: demo.representation.label }]
      : []),
  ]

  /** Arrow-key navigation, as the tab pattern requires. */
  function onKeyDown(event: React.KeyboardEvent) {
    if (!hasRep) return
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = view === 'resident' ? 'representation' : 'resident'
    setView(next)
    document.getElementById(`${baseId}-tab-${next}`)?.focus()
  }

  return (
    <div className="relative">
      {/* The frame. Four rules with a gap in the top edge — the portal motif at
          its largest scale on the page. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="absolute start-0 top-0 h-px w-[14%]" style={{ background: STROKE.teal }} />
        <span className="absolute end-0 top-0 h-px w-[46%]" style={{ background: STROKE.teal }} />
        <span className="absolute bottom-0 start-0 h-px w-full" style={{ background: STROKE.faint }} />
        <span className="absolute bottom-0 start-0 top-0 w-px" style={{ background: STROKE.faint }} />
        <span className="absolute bottom-0 end-0 top-0 w-px" style={{ background: STROKE.faint }} />
      </span>

      <div className="bg-white/80 p-5 backdrop-blur-[1px] sm:p-7">
        {/* ── frame header: the demo badge is not removable ─────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label={demo.projectLabel}
            onKeyDown={onKeyDown}
            className="flex gap-1"
          >
            {tabs.map((tab) => {
              const active = view === tab.key
              return (
                <button
                  key={tab.key}
                  id={`${baseId}-tab-${tab.key}`}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls={`${baseId}-panel-${tab.key}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setView(tab.key)}
                  className={`inline-flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:min-h-0 ${
                    active
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <span className="inline-flex items-center gap-1.5 border border-gray-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-gray-400" />
            {demo.label}
          </span>
        </div>

        {/* ── resident view ─────────────────────────────────────────────── */}
        <div
          id={`${baseId}-panel-resident`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-resident`}
          hidden={view !== 'resident'}
          className="mt-6"
        >
          {/* The demo timeline: the same markers as the public process, so a
              visitor recognises the stages they just read about. */}
          <ol className="flex flex-wrap items-start gap-x-1 gap-y-4">
            {demo.stages.map((stage, index) => (
              <li key={stage.id} className="flex flex-1 basis-24 flex-col items-center text-center">
                <span className="relative flex w-full items-center justify-center">
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute end-1/2 top-1/2 h-px w-1/2"
                      style={{
                        background:
                          demo.stages[index - 1].state === 'completed'
                            ? STROKE.teal
                            : STROKE.faint,
                      }}
                    />
                  )}
                  <MilestoneMarker state={stage.state} size="sm" />
                </span>
                <span
                  className={`mt-2 text-[11px] leading-tight sm:text-xs ${
                    stage.state === 'current'
                      ? 'font-semibold text-teal-800'
                      : stage.state === 'completed'
                        ? 'text-gray-700'
                        : 'text-gray-500'
                  }`}
                >
                  {stage.title}
                </span>
              </li>
            ))}
          </ol>

          <dl className="mt-7 divide-y divide-gray-200 border-y border-gray-200">
            {demo.panels.map((panel) => (
              <div key={panel.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
                <dt className="w-44 shrink-0 text-xs font-medium text-gray-500">
                  {panel.label}
                </dt>
                <dd className="text-sm font-medium text-gray-900">{panel.value}</dd>
              </div>
            ))}
          </dl>

          {/* Labels only. These are not links and are not styled as links —
              a control that looks clickable and does nothing is a lie about
              what the product currently does. */}
          <ul className="mt-5 flex flex-wrap gap-2">
            {demo.tabs.map((tab, index) => (
              <li
                key={index}
                className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600"
              >
                {tab}
              </li>
            ))}
          </ul>
        </div>

        {/* ── representation view ───────────────────────────────────────── */}
        {demo.representation && (
          <div
            id={`${baseId}-panel-representation`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-representation`}
            hidden={view !== 'representation'}
            className="mt-6"
          >
            <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {demo.representation.items.map((item) => (
                <li key={item.id}>
                  <span aria-hidden="true" className="block h-0.5 w-8 bg-teal-600" />
                  <h4 className="mt-3 text-sm font-semibold text-gray-900">{item.label}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{item.value}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
