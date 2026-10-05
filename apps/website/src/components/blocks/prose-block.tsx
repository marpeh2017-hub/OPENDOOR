import type { ProseBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'

/**
 * Long-form body copy.
 *
 * ── SPLIT ON BLANK LINES, NEVER PARSED AS MARKUP ───────────────────────────
 *
 * The body is editor-supplied text. Rendering it through `dangerouslySetInnerHTML`
 * or a markdown parser would hand whoever edits the CMS an injection surface on
 * a public page, and buy formatting nobody has asked for. Paragraph breaks are
 * the only structure this needs.
 *
 * ── THE LEAD IS SET LARGER FOR A REASON ────────────────────────────────────
 *
 * The first paragraph of an explanation carries more weight than the ones after
 * it: it is what a scanning reader takes away. Setting it at reading scale
 * rather than body scale makes the hierarchy match how the page is actually
 * read.
 *
 * ── MEASURE ────────────────────────────────────────────────────────────────
 *
 * `max-w-prose` is 68ch. Hebrew becomes hard to track past roughly 75
 * characters a line, and a full-width paragraph on a 1440px screen is exactly
 * that mistake.
 */
export function ProseBlockView({
  block,
  t,
  justify = false,
}: {
  block: ProseBlock
  t: Localizer
  /** Justified from the small breakpoint up, as the STATEMENT pairing on
   *  /about sets it. Never on a phone, where a narrow justified column opens
   *  wide gaps between words. */
  justify?: boolean
}) {
  const paragraphs = t(block.body)
    .split('\n')
    .filter((paragraph) => paragraph.trim().length > 0)
  const align = justify ? 'sm:text-justify' : ''

  return (
    <div className="max-w-prose">
      {block.heading && (
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
          {t(block.heading)}
        </h2>
      )}

      {block.lead && (
        <p
          className={`text-lg leading-[1.7] text-gray-800 sm:text-xl sm:leading-[1.7] ${align} ${
            block.heading ? 'mt-5' : ''
          }`}
        >
          {t(block.lead)}
        </p>
      )}

      {paragraphs.length > 0 && (
        <div className={`space-y-5 ${block.lead || block.heading ? 'mt-5' : ''}`}>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className={`text-base leading-[1.75] text-gray-600 ${align}`}>
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
