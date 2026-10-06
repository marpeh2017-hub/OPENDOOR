import type { ProseBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { PendingNote } from '@/components/brand/pending-note'

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
export function ProseBlockView({ block, t }: { block: ProseBlock; t: Localizer }) {
  const paragraphs = t(block.body)
    .split('\n')
    .filter((paragraph) => paragraph.trim().length > 0)

  return (
    <div className="max-w-prose">
      {block.heading && (
        <h2 className="type-h2 font-bold text-gray-900">
          {t(block.heading)}
        </h2>
      )}

      {block.lead && (
        <p
          className={`type-lead text-gray-800 ${block.heading ? 'mt-5' : ''}`}
        >
          {t(block.lead)}
        </p>
      )}

      {paragraphs.length > 0 && (
        <div className={`space-y-5 ${block.lead || block.heading ? 'mt-5' : ''}`}>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="type-body text-gray-600">
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {block.pending && <PendingNote text={t(block.pending)} className="mt-6" />}
    </div>
  )
}
