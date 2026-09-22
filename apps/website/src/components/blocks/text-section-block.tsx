import type { TextSectionBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { Section } from './section'
import type { Localizer } from '@/lib/localize'
import { RoleMapView } from '@/components/brand/role-map'

/**
 * Editorial prose, optionally with a relationship map.
 *
 * ── WHAT V2 CHANGED ────────────────────────────────────────────────────────
 *
 * V1 rendered this as one column of grey paragraphs, and it was the flattest
 * thing on the page — a wall of text explaining the single concept a visitor
 * most needs to understand.
 *
 * Now the prose sits in a narrow editorial column with the first paragraph set
 * larger as a standfirst, and the ecosystem is DRAWN beside it. The section
 * explains "what is an organising company" twice, in two registers: in
 * sentences for someone reading, and as a structure for someone scanning.
 *
 * Paragraphs are still split on blank lines rather than rendered as HTML: the
 * body is editor-supplied text, and interpreting markup in it would be an
 * injection surface for whoever edits the CMS later.
 */
export function TextSectionBlockView({
  block,
  t,
  cta,
}: {
  block: TextSectionBlock
  t: Localizer
  cta?: { label: string; href: string }
}) {
  const paragraphs = t(block.body)
    .split('\n')
    .filter((p) => p.trim().length > 0)

  const [standfirst, ...body] = paragraphs

  return (
    <Section size="lg">
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div>
          {block.heading && (
            <h2 className="max-w-[14ch] text-3xl font-bold leading-[1.15] tracking-tight text-gray-900 text-balance sm:text-4xl">
              {t(block.heading)}
            </h2>
          )}

          {/* The standfirst carries the definition, so it is set at reading
              scale rather than at footnote scale. */}
          {standfirst && (
            <p className="mt-6 text-lg leading-relaxed text-gray-800 sm:text-xl sm:leading-relaxed">
              {standfirst}
            </p>
          )}

          <div className="mt-5 max-w-prose space-y-4">
            {body.map((paragraph, index) => (
              <p key={index} className="text-base leading-relaxed text-gray-600">
                {paragraph}
              </p>
            ))}
          </div>

          {cta && (
            <Link
              href={cta.href}
              className="group mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700"
            >
              <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-teal-700">
                {cta.label}
              </span>
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
              >
                →
              </span>
            </Link>
          )}
        </div>

        {/* Absent for a plain text section — the layout collapses to one
            column and nothing looks unfinished. */}
        {block.roleMap && (
          <details className="self-start rounded-sm border border-gray-200 p-5">
            <summary className="min-h-11 cursor-pointer text-lg font-semibold text-teal-700">
              {t({ he: 'מי עושה מה בתהליך?', en: 'Who does what in the process?' })}
            </summary>
            <div className="mt-6"><RoleMapView map={block.roleMap} t={t} /></div>
          </details>
        )}
      </div>
    </Section>
  )
}
