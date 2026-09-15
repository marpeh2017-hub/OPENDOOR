import type { ExposureLevel } from '@urban-renewal/api-contracts'
import { ExposureBanner } from './exposure'

/**
 * What a Site Manager section looks like before its editor is built.
 *
 * ── WHY A SCAFFOLD AND NOT AN EMPTY PAGE ───────────────────────────────────
 *
 * Pass 4A establishes routing, navigation, the permission boundary and the
 * content architecture. The editors themselves are later phases, so every
 * section here has a real address and no editing UI yet.
 *
 * A blank page would be indistinguishable from a broken one, and worse, it
 * would tell the next person nothing about what is supposed to arrive. So each
 * section states what it will manage, what it will NOT touch, and which phase
 * builds it. That is the same honesty the public site applies to a project with
 * no verified figures: say what is true now rather than leave a hole.
 */
export function SectionScaffold({
  title,
  description,
  exposure = 'PUBLIC',
  willManage,
  willNotTouch,
  phase,
}: {
  title: string
  description: string
  /** Governs the banner. Most sections are `PUBLIC`; the project editor's
   *  internal and feasibility areas are not, and say so. */
  exposure?: ExposureLevel
  willManage: string[]
  willNotTouch?: string[]
  phase: string
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-gray-600">
          {description}
        </p>
      </div>

      <ExposureBanner level={exposure} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5">
          <h2 className="text-[15px] font-bold text-gray-900">מה יהיה אפשר לנהל כאן</h2>
          <ul className="mt-3 list-disc space-y-1.5 ps-5 text-[13.5px] leading-relaxed text-gray-600">
            {willManage.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {willNotTouch && willNotTouch.length > 0 && (
          <div className="rounded-xl border border-border bg-gray-50 p-5">
            <h2 className="text-[15px] font-bold text-gray-900">מה לא ישתנה מכאן</h2>
            <ul className="mt-3 list-disc space-y-1.5 ps-5 text-[13.5px] leading-relaxed text-gray-600">
              {willNotTouch.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5">
        <p className="text-[13.5px] leading-relaxed text-gray-600">
          <span className="font-semibold text-gray-800">המסך עדיין לא נבנה.</span>{' '}
          הכתובת, הניווט, גבול ההרשאות ומודל התוכן מוכנים. העורך עצמו נבנה ב{phase}.
          עד אז התוכן נערך בקוד, ומה שמופיע באתר לא השתנה.
        </p>
      </div>
    </div>
  )
}
