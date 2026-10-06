import type { ModelsBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { LineIcon } from '@/components/brand/line-icon'
import { Section, SectionHeading } from './section'

/**
 * "שני מודלים של עבודה" — the ways the company works, side by side.
 *
 * One card per model, equal weight: neither is the "real" business. Each says
 * what is done, then sets apart on the wash what is different about it, which
 * is the line a reader comparing the two is looking for. The note under the
 * cards carries the rule that makes two models honest: the model is stated in
 * advance and written into the agreement.
 */
export function ModelsBlockView({ block, t }: { block: ModelsBlock; t: Localizer }) {
  return (
    <Section size="md">
      <SectionHeading heading={block.heading} t={t} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {block.items.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-4 rounded-2xl border border-gray-200 border-t-4 border-t-teal-500 bg-white p-6 sm:p-8"
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600 sm:h-[3.25rem] sm:w-[3.25rem]">
                <LineIcon name={item.icon} size={26} />
              </span>
              <h3 className="type-h3 font-bold text-gray-900">{t(item.title)}</h3>
            </div>
            <p className="type-body text-gray-600">{t(item.body)}</p>
            {t(item.highlight) && (
              <p className="rounded-xl bg-teal-50 px-4 py-4 type-body font-semibold text-teal-700 sm:px-5">
                {t(item.highlight)}
              </p>
            )}
          </article>
        ))}
      </div>

      {t(block.note) && (
        <p className="mt-6 flex items-start gap-2.5 type-body text-gray-600">
          <LineIcon name="document-check" size={22} className="mt-0.5 shrink-0 text-teal-600" />
          {t(block.note)}
        </p>
      )}
    </Section>
  )
}
