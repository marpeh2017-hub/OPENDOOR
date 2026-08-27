import type { TextSectionBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { Section } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * Editorial prose.
 *
 * Constrained to `max-w-prose` (68ch) — Hebrew prose becomes hard to track past
 * roughly 75 characters per line, and a full-width paragraph on a 1440px screen
 * is exactly that mistake.
 *
 * Paragraphs are split on blank lines rather than rendered as HTML: the body is
 * editor-supplied text, and interpreting markup in it would be an injection
 * surface for whoever edits the CMS later.
 */
export function TextSectionBlockView({
  block, t, tone, cta,
}: {
  block: TextSectionBlock
  t: Localizer
  tone?: 'page' | 'raised' | 'sunken'
  cta?: { label: string; href: string }
}) {
  const paragraphs = t(block.body).split('\n').filter((p) => p.trim().length > 0)

  return (
    <Section tone={tone}>
      <div className="max-w-prose">
        {block.heading && (
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {t(block.heading)}
          </h2>
        )}
        <div className="mt-6 space-y-5">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="text-base leading-relaxed text-gray-600">
              {paragraph}
            </p>
          ))}
        </div>
        {cta && (
          <Link
            href={cta.href}
            className="mt-8 inline-flex text-sm font-semibold text-teal-700 underline-offset-4 hover:underline"
          >
            {cta.label} →
          </Link>
        )}
      </div>
    </Section>
  )
}
