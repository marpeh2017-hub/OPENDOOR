import type { ChecklistBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { Section } from './section'

/**
 * Named things with icons, laid out as tiles: what we check in an offer.
 *
 * ── THE ICONS ARE A CLOSED SET ─────────────────────────────────────────────
 *
 * Drawn here and named in the content, never uploaded. An unknown name renders
 * the tile without an icon rather than a broken image, for the same reason an
 * unknown block renders nothing.
 *
 * ── THE NUMBERS ARE ORDER, NOT RANK ────────────────────────────────────────
 *
 * They help a reader keep their place in six tiles. They are hidden from
 * screen readers, which announce the list's length and position already.
 */
const ICONS: Record<string, React.ReactNode> = {
  chart: (
    <>
      <path d="M3 20h18" />
      <path d="M6 20v-7" />
      <path d="M11 20V8" />
      <path d="M16 20v-4" />
      <path d="M21 20V5" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  'document-check': (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 14l2 2 4-4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17v.5" />
    </>
  ),
}

export function ChecklistBlockView({ block, t }: { block: ChecklistBlock; t: Localizer }) {
  return (
    <Section size="lg">
      <h2 className="max-w-3xl text-balance text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-[2.375rem] sm:leading-[1.2]">
        {t(block.heading)}
      </h2>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
        {block.items.map((item, index) => {
          const icon = item.icon ? ICONS[item.icon] : undefined
          return (
            <li
              key={item.id}
              className="flex items-center gap-5 border border-t-2 border-gray-100 border-t-teal-600 bg-white px-6 py-6 sm:px-7 sm:py-7"
            >
              {icon && (
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600"
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {icon}
                  </svg>
                </span>
              )}
              <div>
                <span aria-hidden="true" className="block text-[13px] tabular-nums text-gray-500">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="mt-0.5 block text-xl font-semibold text-gray-900">
                  {t(item.label)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {block.note && (
        <p className="mt-11 max-w-prose text-lg leading-[1.7] text-gray-700 sm:text-justify">
          {t(block.note)}
        </p>
      )}
    </Section>
  )
}
