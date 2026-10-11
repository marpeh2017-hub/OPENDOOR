import { Fragment } from 'react'
import type { OrganizingAgreement } from '@urban-renewal/api-contracts'
import { Cell, DOCUMENT_FRAME, DocumentHeader, Runs, Segments, Signature, documentDate } from './document-parts'

/** Gaps that take a short line: a block or parcel number. */
const SHORT_FIELDS = ['gush', 'helka'] as const

export interface AgreementRepresentative {
  fullName: string
  idNumber?: string | null
  signatureImage?: string | null
  signed?: boolean
}

export interface AgreementOwnerRow {
  apartmentNumber: string
  fullName: string
  idNumber: string | null
  signedDate: string | null
  signatureImage: string | null
  method: string
}

/** "ישראל ישראלי" → first name "ישראל", family name "ישראלי": the table's two columns. */
function splitName(fullName: string): { first: string; last: string } {
  const [first = '', ...rest] = fullName.trim().split(/\s+/)
  return { first, last: rest.join(' ') }
}

/**
 * The organizing agreement as a document: the snapshot the form was sent with,
 * this complex's gaps filled in, the representatives' table, the signature
 * lines and the owners' table, laid out like the owner's Word file and ready
 * to print as A4.
 *
 * Used blank (the template), as a preview while staff fill in a draft, and
 * as the combined document: the representatives sign on the "נציגות
 * הדיירים" line with the signatures from their own rows, the company on
 * "המארגן" with the date beside it, and the determining date is the day the
 * first owner signed.
 */
export function AgreementView({
  text,
  fields,
  representatives,
  rows,
  determiningDate,
  organizer,
  verification,
  titleLevel = 1,
}: {
  text: OrganizingAgreement
  fields?: Record<string, string> | null
  representatives?: AgreementRepresentative[]
  rows?: AgreementOwnerRow[]
  determiningDate?: string | null
  organizer?: { signatureImage: string; signedDate: string } | null
  verification?: React.ReactNode
  titleLevel?: 1 | 2
}) {
  const Title = titleLevel === 1 ? 'h1' : 'h2'
  const values = { ...(fields ?? {}), determiningDate: documentDate(determiningDate) }
  const signedRepresentatives = (representatives ?? []).filter((r) => r.signatureImage)

  return (
    <article
      lang="he"
      dir="rtl"
      aria-labelledby="agreement-title"
      className={DOCUMENT_FRAME}
    >
      <DocumentHeader header={text.header} />

      <Title id="agreement-title" className="text-center text-[1.3em] font-bold leading-snug">
        <Runs text={text.title} />
      </Title>
      <p className="mt-4 text-center">
        <Segments text={text.parties} values={values} />
      </p>

      <table aria-label="הנציגים" className="mx-auto mt-5 w-full max-w-[34rem] table-fixed border-collapse text-[0.9em]">
        <thead>
          <tr>
            {text.representativesTable.columns.map((column) => (
              <th key={column.key} scope="col" className="border border-gray-500 px-2 py-1.5 text-start font-normal">
                <Runs text={column.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {representatives && representatives.length > 0
            ? representatives.map((member, index) => {
                const { first, last } = splitName(member.fullName)
                return (
                  <tr key={index} className="print:break-inside-avoid">
                    {text.representativesTable.columns.map((column) => (
                      <Cell key={column.key} ltr={column.key === 'idNumber'}>
                        {column.key === 'lastName' ? last : column.key === 'firstName' ? first : member.idNumber}
                      </Cell>
                    ))}
                  </tr>
                )
              })
            : Array.from({ length: text.representativesTable.blankRows }, (_, row) => (
                <tr key={row} className="h-10 print:h-[9mm]">
                  {text.representativesTable.columns.map((column) => (
                    <td key={column.key} className="border border-gray-500" />
                  ))}
                </tr>
              ))}
        </tbody>
      </table>

      <p className="mt-5 text-center">
        <Runs text={text.jointly} />
      </p>
      <p className="mt-3 text-center">
        <Runs text={text.between} />
      </p>
      <p className="mt-3">
        <Runs text={text.organizer} />
      </p>

      <dl className="mt-6 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-2">
        {text.recitals.map((recital) => (
          <Fragment key={recital.label}>
            <dt>{recital.label}</dt>
            <dd>
              <Segments text={recital.text} values={values} />
            </dd>
          </Fragment>
        ))}
      </dl>

      <p className="mt-6 text-center">{text.agreed}</p>

      <ol className="mt-4 space-y-3 print:space-y-2">
        {text.clauses.map((clause) => (
          <li key={clause.number} className="grid grid-cols-[2rem_minmax(0,1fr)]">
            <span>{clause.number}.</span>
            <span>
              <Segments text={clause.text} values={values} short={SHORT_FIELDS} />
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-12 grid grid-cols-3 gap-6 text-center print:mt-10 print:break-inside-avoid">
        {text.signatureRow.map((label, index) => (
          <div key={label}>
            <div className="flex min-h-10 flex-wrap items-end justify-center gap-2 border-b border-gray-600 pb-1">
              {index === 0 &&
                signedRepresentatives.map((member, i) => <Signature key={i} image={member.signatureImage} />)}
              {index === 1 && organizer && <span>{documentDate(organizer.signedDate)}</span>}
              {index === 2 && organizer && <Signature image={organizer.signatureImage} />}
            </div>
            <p className="mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="agreement-owners" className="mt-10 print:mt-7">
        <h2 id="agreement-owners" className="text-center text-[1em] font-normal print:break-after-avoid">
          <Runs text={text.ownersTable.heading} />
        </h2>
        <div className="mt-4 overflow-x-auto print:overflow-visible">
          <table aria-labelledby="agreement-owners" className="w-full min-w-[34rem] border-collapse text-[0.85em] print:min-w-0">
            <thead>
              <tr>
                {text.ownersTable.columns.map((column) => (
                  <th key={column.key} scope="col" className="border border-gray-500 px-2 py-1.5 text-start font-normal">
                    <Runs text={column.label} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows && rows.length > 0
                ? rows.map((row, index) => (
                    <tr key={index} className="print:break-inside-avoid">
                      <Cell>{row.apartmentNumber}</Cell>
                      <Cell>{row.fullName}</Cell>
                      <Cell ltr>{row.idNumber}</Cell>
                      <Cell ltr>{documentDate(row.signedDate)}</Cell>
                      <Cell>
                        <Signature image={row.signatureImage} method={row.method} />
                      </Cell>
                    </tr>
                  ))
                : Array.from({ length: text.ownersTable.blankRows }, (_, row) => (
                    <tr key={row} className={`h-9 print:h-[7.5mm] ${row >= 3 ? 'hidden print:table-row' : ''}`}>
                      {text.ownersTable.columns.map((column) => (
                        <td key={column.key} className="border border-gray-500" />
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      {verification && (
        <div className="mt-8 rounded-lg border border-gray-300 bg-gray-50 p-4 text-[0.82em] leading-relaxed text-gray-700 print:break-inside-avoid print:bg-white print:text-black">
          {verification}
        </div>
      )}
    </article>
  )
}
