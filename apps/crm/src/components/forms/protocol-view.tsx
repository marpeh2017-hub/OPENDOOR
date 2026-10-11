import { Fragment } from 'react'
import Image from 'next/image'
import {
  protocolItemNumber,
  protocolRuns,
  type ProtocolClause,
  type ProtocolText,
  type RepresentationProtocol,
} from '@urban-renewal/api-contracts'
import { formatFormDate, type FormMeeting } from '@/hooks/use-forms'

export interface ProtocolMemberRow {
  fullName: string
  idNumber?: string | null
  apartmentNumber: string
  signatureImage?: string | null
  method?: string | null
}

export interface ProtocolOwnerRow {
  apartmentNumber: string
  fullName: string
  idNumber: string | null
  signedDate: string | null
  phone: string | null
  email: string | null
  signatureImage: string | null
  method: string
}

/**
 * The representation-appointment protocol as a document: the snapshot the
 * form was sent with (never the current code's wording), this meeting's
 * details, the representation table and the owners' table, laid out like
 * the owner's Word file and ready to print as A4.
 *
 * Used three ways: blank (the template, `meeting` omitted), as a preview
 * while staff fill in a draft (meeting and member names), and as the
 * combined document with every signed row. Each table is blank where it has
 * no rows, as on paper. A page with its own h1 above the document passes
 * `titleLevel={2}`.
 */
export function ProtocolView({
  text,
  meeting,
  members,
  rows,
  preparedBy,
  verification,
  titleLevel = 1,
}: {
  text: RepresentationProtocol
  meeting?: FormMeeting
  members?: ProtocolMemberRow[]
  rows?: ProtocolOwnerRow[]
  preparedBy: string
  /** The system's note on how the signatures were made. Not part of the wording. */
  verification?: React.ReactNode
  titleLevel?: 1 | 2
}) {
  const Title = titleLevel === 1 ? 'h1' : 'h2'
  const fieldValue = (key: keyof FormMeeting) => {
    if (!meeting) return null
    return key === 'meetingDate' ? formatFormDate(meeting.meetingDate) : meeting[key]
  }

  return (
    <article
      lang="he"
      dir="rtl"
      aria-labelledby="protocol-title"
      className="mx-auto w-full max-w-[794px] rounded-xl border border-border bg-white px-6 py-8 text-[15px] leading-[1.8] text-gray-900 sm:px-12 sm:py-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:text-[11pt] print:leading-[1.6] print:text-black"
    >
      <div className="mb-8 flex items-start justify-between gap-6 print:mb-5">
        <span className="text-[0.9em]">{text.header}</span>
        <Image src="/brand/opendoor-logo.svg" alt="OpenDoor התחדשות עירונית" width={156} height={58} unoptimized className="h-[58px] w-auto" />
      </div>

      <Title id="protocol-title" className="text-center text-[1.3em] font-bold leading-snug underline underline-offset-4">
        {text.title}
      </Title>

      <dl className="mt-8 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 print:mt-6 print:gap-y-1.5">
        {text.meeting.fields.map((field) => {
          const value = fieldValue(field.key)
          return (
            <Fragment key={field.key}>
              <dt className="font-bold">{field.label}:</dt>
              <dd>
                {value ? <span className="font-medium">{value}</span> : <Blank />}
                <span className="whitespace-nowrap">
                  <Runs text={field.after} />
                </span>
              </dd>
            </Fragment>
          )
        })}
        <dt className="font-bold">{text.meeting.agendaLabel}:</dt>
        <dd>
          <Runs text={text.meeting.agenda} />
        </dd>
      </dl>

      {text.parts.map((part) => (
        <section key={part.letter} aria-labelledby={`protocol-part-${part.letter}`} className="mt-9 print:mt-6">
          <h2 id={`protocol-part-${part.letter}`} className="text-[1em] font-normal print:break-after-avoid">
            <span className="font-bold underline underline-offset-4">{part.letter}.</span> <Runs text={part.title} />
          </h2>
          <div className="mt-4 space-y-5 print:mt-3 print:space-y-3.5">
            {part.clauses.map((clause) => (
              <Clause key={clause.number} clause={clause} text={text} members={members} />
            ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="protocol-owners" className="mt-10 print:mt-7">
        <h2 id="protocol-owners" className="text-center text-[1em] font-normal print:break-after-avoid">
          <Runs text={text.ownersTable.heading} />
        </h2>
        <div className="mt-4 overflow-x-auto print:overflow-visible">
          <table aria-labelledby="protocol-owners" className="w-full min-w-[40rem] border-collapse text-[0.85em] print:min-w-0">
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
                      <Cell ltr>{formatFormDate(row.signedDate)}</Cell>
                      <Cell>
                        <Signature image={row.signatureImage} method={row.method} />
                      </Cell>
                      <Cell ltr>{row.phone}</Cell>
                      <Cell ltr>{row.email}</Cell>
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

      <p className="mt-10 border-t border-gray-300 pt-3 text-center text-[0.8em] leading-normal text-gray-700 print:mt-6 print:text-black">
        {preparedBy}
      </p>
    </article>
  )
}

function Clause({
  clause,
  text,
  members,
}: {
  clause: ProtocolClause
  text: RepresentationProtocol
  members?: ProtocolMemberRow[]
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-1">
      <span>{clause.number}.</span>
      <div className="space-y-3">
        {clause.heading && (
          <h3 className="text-[1em] font-normal print:break-after-avoid">
            <Runs text={clause.heading} />
          </h3>
        )}
        {clause.blocks.map((block, index) => {
          if (block.kind === 'paragraph') {
            return (
              <p key={index} className="text-justify">
                <Runs text={block.text} />
              </p>
            )
          }
          if (block.kind === 'items') {
            return (
              <ol key={index} className="space-y-1.5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="grid grid-cols-[2.5rem_minmax(0,1fr)]">
                    <span>{protocolItemNumber(clause.number, itemIndex)}</span>
                    <span>
                      <Runs text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            )
          }
          return (
            <table key={index} aria-label="חברי הנציגות" className="w-full table-fixed border-collapse text-[0.9em]">
              <thead>
                <tr>
                  {text.representationTable.columns.map((column) => (
                    <th key={column.key} scope="col" className="border border-gray-500 px-2 py-1.5 text-start font-normal">
                      <Runs text={column.label} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members && members.length > 0
                  ? members.map((member, row) => (
                      <tr key={row} className="print:break-inside-avoid">
                        <Cell>{member.fullName}</Cell>
                        <Cell ltr>{member.idNumber}</Cell>
                        <Cell>{member.apartmentNumber}</Cell>
                        <Cell>
                          <Signature image={member.signatureImage} method={member.method} />
                        </Cell>
                      </tr>
                    ))
                  : Array.from({ length: text.representationTable.blankRows }, (_, row) => (
                      <tr key={row} className="h-10 print:h-[9mm]">
                        {text.representationTable.columns.map((column) => (
                          <td key={column.key} className="border border-gray-500" />
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          )
        })}
      </div>
    </div>
  )
}

function Cell({ children, ltr }: { children?: React.ReactNode; ltr?: boolean }) {
  return (
    <td className="h-10 border border-gray-500 px-2 py-1 align-middle" dir={ltr ? 'ltr' : undefined}>
      {children}
    </td>
  )
}

/** The drawn signature, or a note that it was signed on paper. Empty until signed. */
function Signature({ image, method }: { image?: string | null; method?: string | null }) {
  if (method === 'WET') return <span className="text-[0.9em]">נחתם ידנית, מצורף</span>
  if (!image) return null
  // eslint-disable-next-line @next/next/no-img-element -- a data URL, not a file the image optimiser can serve
  return <img src={image} alt="חתימה" className="h-9 w-auto max-w-[9rem] object-contain" />
}

/** A line to fill in by hand, as the Word file's underscores. */
function Blank() {
  return (
    <span className="me-1 inline-block w-28 border-b border-gray-600 align-baseline sm:w-48">
      <span className="sr-only">שדה למילוי</span>
      {'\u00a0'}
    </span>
  )
}

/** The document's emphasis as markup: bold and underline, nothing else. */
function Runs({ text }: { text: ProtocolText }) {
  return (
    <>
      {protocolRuns(text).map((run, index) => {
        let node: React.ReactNode = run.text
        if (run.bold) node = <strong className="font-bold">{node}</strong>
        if (run.underline) node = <u className="underline-offset-4">{node}</u>
        return <Fragment key={index}>{node}</Fragment>
      })}
    </>
  )
}
