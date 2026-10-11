import { Fragment } from 'react'
import { BrandMark } from '@/components/brand/brand-mark'
import { ORGANIZING_AGREEMENT, type OrganizingAgreement } from '@urban-renewal/api-contracts'
import { DOCUMENT_FRAME, INHERIT, Runs, Segments } from './document-text'

/** Gaps that take a short line: a block or parcel number. */
const SHORT_FIELDS = ['gush', 'helka'] as const

/**
 * The organizing and accompaniment agreement as a blank form: the owner's own
 * wording (packages/api-contracts, organizing-agreement.ts), to read on screen
 * and to print or save as a PDF.
 *
 * Laid out like the Word file: the title and the parties, the table of the
 * representatives who sign for the owners, the organiser, the recitals,
 * clauses 1 to 11, the three signature lines, and the owners' signature table
 * (three empty rows on screen, all seventeen on paper). The gaps a complex
 * fills in (the street, the block and parcel, the city, the determining date)
 * print as blank lines. Hebrew only, so right-to-left on the English site too.
 */
export function OrganizingAgreementDocument({ agreement = ORGANIZING_AGREEMENT }: { agreement?: OrganizingAgreement } = {}) {
  return (
    <article lang="he" dir="rtl" aria-labelledby="agreement-title" className={DOCUMENT_FRAME}>
      <div className="mb-8 flex items-start justify-between gap-6 print:mb-5">
        <span className="text-[0.9em]">{agreement.header}</span>
        <BrandMark name="OpenDoor התחדשות עירונית" variant="document" />
      </div>

      <h1 id="agreement-title" className={`${INHERIT} text-center text-[1.3em] font-bold leading-snug`}>
        <Runs text={agreement.title} />
      </h1>
      <p className={`${INHERIT} mt-4 text-center`}>
        <Segments text={agreement.parties} />
      </p>

      <table aria-label="הנציגים" className="mx-auto mt-5 w-full max-w-[34rem] table-fixed border-collapse text-[0.9em]">
        <thead>
          <tr>
            {agreement.representativesTable.columns.map((column) => (
              <th key={column.key} scope="col" className="border border-gray-500 px-2 py-1.5 text-start font-normal">
                <Runs text={column.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: agreement.representativesTable.blankRows }, (_, row) => (
            <tr key={row} className="h-10 print:h-[9mm]">
              {agreement.representativesTable.columns.map((column) => (
                <td key={column.key} className="border border-gray-500" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className={`${INHERIT} mt-5 text-center`}>
        <Runs text={agreement.jointly} />
      </p>
      <p className={`${INHERIT} mt-3 text-center`}>
        <Runs text={agreement.between} />
      </p>
      <p className={`${INHERIT} mt-3`}>
        <Runs text={agreement.organizer} />
      </p>

      <dl className="mt-6 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-2">
        {agreement.recitals.map((recital) => (
          <Fragment key={recital.label}>
            <dt>{recital.label}</dt>
            <dd>
              <Segments text={recital.text} />
            </dd>
          </Fragment>
        ))}
      </dl>

      <p className={`${INHERIT} mt-6 text-center`}>{agreement.agreed}</p>

      <ol className="mt-4 space-y-3 print:space-y-2">
        {agreement.clauses.map((clause) => (
          <li key={clause.number} className="grid grid-cols-[2rem_minmax(0,1fr)]">
            <span>{clause.number}.</span>
            <span>
              <Segments text={clause.text} short={SHORT_FIELDS} />
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-12 grid grid-cols-3 gap-4 text-center sm:gap-8 print:mt-10 print:break-inside-avoid">
        {agreement.signatureRow.map((label) => (
          <div key={label}>
            <div className="h-10 border-b border-gray-600" />
            <p className={`${INHERIT} mt-1.5`}>{label}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="agreement-owners" className="mt-10 print:mt-8">
        <h2 id="agreement-owners" className={`${INHERIT} text-center font-normal print:break-after-avoid`}>
          <Runs text={agreement.ownersTable.heading} />
        </h2>
        {/* Five columns are tight on a phone, so the table scrolls sideways
            there. A scrolling region must be reachable by keyboard, hence the
            tab stop and the name. */}
        <div
          role="region"
          aria-labelledby="agreement-owners"
          tabIndex={0}
          className="mt-4 overflow-x-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 print:overflow-visible"
        >
          <table aria-labelledby="agreement-owners" className="w-full min-w-[30rem] border-collapse text-[0.85em] print:min-w-0">
            <thead>
              <tr>
                {agreement.ownersTable.columns.map((column) => (
                  <th key={column.key} scope="col" className="border border-gray-500 px-2 py-1.5 text-start font-normal">
                    <Runs text={column.label} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: agreement.ownersTable.blankRows }, (_, row) => (
                <tr key={row} className={`h-9 print:h-[7.5mm] print:break-inside-avoid ${row >= 3 ? 'hidden print:table-row' : ''}`}>
                  {agreement.ownersTable.columns.map((column) => (
                    <td key={column.key} className="border border-gray-500" />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  )
}
