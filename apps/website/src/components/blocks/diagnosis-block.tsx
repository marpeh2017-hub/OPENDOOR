import type { DiagnosisBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { LineIcon } from '@/components/brand/line-icon'
import { Section } from './section'

/**
 * "איפה פרויקטים נתקעים, ואיך מחזירים אותם לתנועה."
 *
 * The argument on one side, and on the other the one idea it rests on drawn
 * as a branch: a diagnosis first, then one of a few ways forward. The drawing
 * is HTML boxes and hairlines, not a picture, so every word in it is text;
 * the caption under it says the same in a sentence, so no reader depends on
 * the drawing to get the point.
 *
 * The outcomes stay side by side on a phone: three short labels fit, and the
 * branch only reads as a branch across.
 */
export function DiagnosisBlockView({ block, t }: { block: DiagnosisBlock; t: Localizer }) {
  return (
    <Section size="md">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 className="type-h2 font-bold text-gray-900">{t(block.heading)}</h2>
          {t(block.lead) && <p className="mt-4 type-lead text-gray-900">{t(block.lead)}</p>}
          {t(block.body) && <p className="mt-4 type-body text-gray-600">{t(block.body)}</p>}
          {block.linkHref && t(block.linkLabel) && (
            <Link
              href={block.linkHref}
              className="group mt-5 inline-flex min-h-11 items-center gap-2 type-body font-semibold text-teal-600 hover:text-teal-700"
            >
              {t(block.linkLabel)}
              <span
                aria-hidden="true"
                className="inline-block rtl:rotate-180 motion-safe:transition-transform motion-safe:ltr:group-hover:translate-x-1 motion-safe:rtl:group-hover:-translate-x-1"
              >
                →
              </span>
            </Link>
          )}
        </div>

        <div className="flex flex-col items-center">
          <p className="flex items-center gap-3 rounded-xl bg-surface-inverse px-6 py-4 type-h3 font-bold text-white">
            <LineIcon name="search" size={22} className="text-teal-300" />
            {t(block.start)}
          </p>
          <span aria-hidden="true" className="h-7 w-0.5 bg-teal-200" />
          <span aria-hidden="true" className="h-0.5 w-2/3 bg-teal-200" />
          <ul className="grid w-full grid-cols-3 gap-2.5 sm:gap-3.5">
            {block.outcomes.map((outcome) => (
              <li key={outcome.id} className="flex flex-col items-center">
                <span aria-hidden="true" className="h-6 w-0.5 bg-teal-200" />
                <span className="flex w-full flex-1 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-2 py-4 text-center type-small font-bold text-teal-700 sm:px-3">
                  {t(outcome.label)}
                </span>
              </li>
            ))}
          </ul>
          {t(block.caption) && (
            <p className="mt-5 max-w-md text-center type-small text-gray-600">{t(block.caption)}</p>
          )}
        </div>
      </div>
    </Section>
  )
}
