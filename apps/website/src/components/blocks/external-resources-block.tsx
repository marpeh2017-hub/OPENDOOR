import type { CollectionBlock, ExternalResource } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { STROKE } from '@/components/brand/architecture'

/**
 * Pointers to authoritative outside sources.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THESE ARE NOT PARTNERS, AND THE MARKUP HAS TO SAY SO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A row of public-body names on a company website reads as affiliation unless
 * the page prevents it. Four things prevent it here:
 *
 *   1. NO LOGOS. Text only. A logo is the single strongest affiliation signal
 *      there is, and the type has no field for one.
 *   2. The block's own intro states there is no business relationship,
 *      cooperation or mutual endorsement.
 *   3. Nothing is styled as a badge, a seal or a certification mark.
 *   4. They are presented as things to CHECK US AGAINST, which is the
 *      opposite of an endorsement.
 *
 * ── EXTERNAL LINK MECHANICS ────────────────────────────────────────────────
 *
 * `target="_blank"` with `rel="noopener noreferrer"`: `noopener` stops the
 * opened page reaching back through `window.opener`, and `noreferrer` keeps
 * the referrer off the request. Both matter on links the site does not
 * control.
 *
 * A link that opens a new tab must announce that it will. The arrow glyph is
 * `aria-hidden` and a visually-hidden phrase carries the meaning, so a screen
 * reader hears "planning administration, opens in a new tab" rather than being
 * moved to a new context with no warning.
 */
export async function ExternalResourcesBlockView({
  block,
  resources,
  t,
}: {
  block: CollectionBlock
  resources: readonly ExternalResource[]
  t: Localizer
}) {
  if (resources.length === 0) return null

  const tUi = await getTranslations('ui')

  return (
    <Section tone="sunken" size="lg">
      <SectionHeading heading={block.heading} intro={block.intro} t={t} size="md" />

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => (
          <li key={resource.id} className="relative bg-white p-6">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-0.5 w-[34%]"
              style={{ background: STROKE.teal }}
            />

            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex min-h-[44px] items-start gap-2 text-[15px] font-semibold text-teal-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <span>{t(resource.label)}</span>
              {/* Decorative: the meaning is carried by the sr-only phrase. */}
              <svg
                viewBox="0 0 20 20"
                className="mt-1 h-3.5 w-3.5 shrink-0"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7 4h9v9M16 4L5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sr-only">{tUi('opensInNewTab')}</span>
            </a>

            {resource.description && (
              <p className="mt-2.5 text-sm leading-relaxed text-gray-600">
                {t(resource.description)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}
