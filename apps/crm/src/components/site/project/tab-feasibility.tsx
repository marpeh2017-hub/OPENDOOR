'use client'

import { PrivateBanner, Section, Callout, ExactValue } from './fields'
import type { FeasibilityEntry, ProjectDocument } from './types'

/**
 * בדיקת היתכנות — four areas, deliberately not one form.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY THE SPLIT IS THE WHOLE POINT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Flattened into a single table, every number here looks equally solid. They
 * are not remotely equal:
 *
 *   SOURCE DATA   what somebody measured or was told. May be wrong, and for
 *                 this project several entries are known to be.
 *   ASSUMPTIONS   what the scenario ASSUMED. Not approvals, not a plan, not
 *                 an agreement. Someone chose these.
 *   OUTPUTS       what the arithmetic produced FROM the two above. As reliable
 *                 as its inputs and no more.
 *   ECONOMICS     money. The most private area in the product.
 *
 * A reader who cannot see which is which will quote an output as a fact, and
 * "337.18 planned units" becomes "337 apartments" in a resident meeting. The
 * separation is what stops the arithmetic from laundering its inputs.
 *
 * ── NOTHING HERE IS PUBLISHABLE, AT ANY VERIFICATION LEVEL ─────────────────
 *
 * That is the distinction from INTERNAL. An internal figure may one day be
 * verified and published; a scenario output may not, ever, because it is a
 * projection rather than a claim about the world. Verifying it would only
 * establish that the arithmetic was copied correctly.
 */
export function TabFeasibility({ doc }: { doc: ProjectDocument }) {
  const f = doc.feasibility ?? {}
  const has = (o?: Record<string, FeasibilityEntry>) => o && Object.keys(o).length > 0

  if (!has(f.sourceData) && !has(f.assumptions) && !has(f.outputs) && !has(f.economics)) {
    return (
      <div className="space-y-5">
        <PrivateBanner level="FEASIBILITY" />
        <Callout tone="info" title="אין בדיקת היתכנות לפרויקט הזה">
          זה מצב תקין. פרויקט אינו חייב תרחיש היתכנות כדי להתקיים במערכת.
        </Callout>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PrivateBanner level="FEASIBILITY" />

      <Callout tone="warning" title="איך לקרוא את המספרים בלשונית הזאת">
        נתוני מקור הם מה שנמדד או נמסר. הנחות הן מה שהתרחיש הניח, ואינן אישור
        תכנוני. פלטים הם תוצאת החישוב, והם אמינים בדיוק כמו הנתונים שמתחתיהם.
        מספר מכאן אינו הופך לעובדה על העולם, גם לא אחרי אימות.
      </Callout>

      {has(f.sourceData) && (
        <Section
          title="נתוני מקור"
          description="מה שנמדד או נמסר. אלה מועמדים לבדיקה ולא נתונים מאומתים, ומצב הבדיקה מופיע ליד כל אחד."
        >
          <EntryTable entries={f.sourceData!} labels={SOURCE_LABEL} showReview />
        </Section>
      )}

      {has(f.assumptions) && (
        <Section
          title="הנחות התרחיש"
          description="מה שהתרחיש הניח. אלה אינן אישורים תכנוניים, אינן תב״ע ואינן התחייבות כלפי איש."
        >
          <div className="mb-3">
            <span className="inline-flex items-center rounded-full border border-[#d8cdb8] bg-[#f4f1ec] px-2.5 py-0.5 text-[11.5px] font-bold text-[#7d6234]">
              הנחות תרחיש
            </span>
          </div>
          <EntryTable entries={f.assumptions!} labels={ASSUMPTION_LABEL} />
        </Section>
      )}

      {has(f.outputs) && (
        <Section
          title="פלטי החישוב"
          description="תוצאות התרחיש. מוצגות בדיוק שבו הן חושבו ואינן מעוגלות: עיגול הופך פלט חישוב למספר שנשמע כמו תוכנית."
        >
          <EntryTable entries={f.outputs!} labels={OUTPUT_LABEL} />
          <Callout tone="warning">
            337.18 אינו ״337 דירות מתוכננות״. זהו פלט חישוב עם שתי ספרות אחרי
            הנקודה, והפער בין השניים הוא ההבדל בין תרחיש לבין הבטחה.
          </Callout>
        </Section>
      )}

      {has(f.economics) && (
        <Section
          title="תוצאות כלכליות"
          description="המידע הפרטי ביותר במערכת. אינו יוצא בשום נתיב ציבורי: לא ב-DTO, לא בתצוגה מקדימה, לא ב-SEO ולא במפת האתר."
          className="border-[#d8cdb8] bg-[#f4f1ec]"
        >
          <EntryTable entries={f.economics!} labels={ECONOMICS_LABEL} />
        </Section>
      )}
    </div>
  )
}

function EntryTable({
  entries, labels, showReview,
}: {
  entries: Record<string, FeasibilityEntry>
  labels: Record<string, string>
  showReview?: boolean
}) {
  const REVIEW: Record<string, string> = {
    UNREVIEWED: 'טרם נבדק', IN_REVIEW: 'בבדיקה', ACCEPTED: 'התקבל', REJECTED: 'נדחה',
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-start">
        <caption className="sr-only">ערכי התרחיש</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="pb-2 text-start text-[12px] font-semibold text-gray-700">שדה</th>
            <th scope="col" className="pb-2 text-start text-[12px] font-semibold text-gray-700">ערך</th>
            {showReview && (
              <th scope="col" className="pb-2 text-start text-[12px] font-semibold text-gray-700">מצב בדיקה</th>
            )}
          </tr>
        </thead>
        <tbody>
          {Object.entries(entries).map(([key, entry]) => (
            <tr key={key} className="border-b border-border last:border-0">
              <th scope="row" className="py-2.5 pe-4 text-start align-top text-[12.5px] font-medium text-gray-700">
                {labels[key] ?? key}
              </th>
              <td className="py-2.5 pe-4 align-top">
                <ExactValue value={entry.value} unit={entry.unit} note={entry.note} />
              </td>
              {showReview && (
                <td className="py-2.5 align-top text-[12px] text-gray-600">
                  {REVIEW[entry.reviewState ?? ''] ?? '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SOURCE_LABEL: Record<string, string> = {
  registeredLotArea: 'שטח מגרש רשום',
  gisMeasuredArea: 'שטח במדידת GIS',
  existingBuiltArea: 'שטח בנוי קיים מחושב',
  permittedArea: 'שטח מותר',
  averageApartmentArea: 'שטח דירה ממוצע',
  existingUnits: 'מספר יחידות קיימות',
  residentialSubParcels: 'תתי חלקות למגורים',
  commercialSubParcels: 'תתי חלקות מסחר וקרקע',
  demolitionGrossArea: 'שטח הריסה ברוטו משוער',
}

const ASSUMPTION_LABEL: Record<string, string> = {
  note: 'הערה',
  averageFloors: 'מספר קומות ממוצע מעל הקרקע',
  buildingCount: 'מספר מבנים',
  coverage: 'תכסית',
  expropriation: 'הנחת הפקעה',
  ownerConsideration: 'כלל תמורה לבעלים',
}

const OUTPUT_LABEL: Record<string, string> = {
  buildingEnvelope: 'מעטפת בנייה',
  residentialSaleArea: 'שטח מכירה למגורים',
  commercialArea: 'שטח מסחרי',
  publicUseArea: 'שטח לצורכי ציבור',
  penthouseCount: 'מספר פנטהאוזים',
  ownerUnits: 'יחידות לבעלים',
  developerUnits: 'יחידות ליזם',
  totalScenarioUnits: 'סך יחידות בתרחיש',
}

const ECONOMICS_LABEL: Record<string, string> = {
  sales: 'מכירות',
  profit: 'רווח',
  returnOnCost: 'תשואה על העלות',
  developerProfitOverSales: 'רווח יזמי מתוך מכירות',
}
