import { Fragment } from 'react'
import { BrandMark } from '@/components/brand/brand-mark'
import {
  REPRESENTATION_PROTOCOL as PROTOCOL,
  protocolItemNumber,
  protocolPreparedBy,
  protocolRuns,
  type ProtocolClause,
  type ProtocolText,
  type RepresentationProtocol,
} from '@urban-renewal/api-contracts'

/**
 * The shared stylesheet gives every h1-h3 and p its own size, colour and
 * leading (packages/design-system, globals.css). A legal document reads in one
 * size and one colour, so its headings and paragraphs inherit them from the
 * document instead, and say only what differs.
 */
const INHERIT = 'text-[1em] leading-[inherit] tracking-normal text-inherit'

/**
 * The representation-appointment protocol as a blank form: the owner's own
 * wording (packages/api-contracts, representation-protocol.ts), to read on
 * screen and to print or save as a PDF.
 *
 * ── LAID OUT LIKE THE WORD FILE ────────────────────────────────────────────
 *
 * On paper it follows the owner's document: the logo top left and "בס"ד" top
 * right of the first page, the meeting details, the two lettered parts with
 * clauses 1 to 11, sub-items numbered under their clause, the representation
 * table with three empty rows and the owners' signature table with twenty.
 * Page numbers start on page two, as in the file. On screen the owners' table
 * shows three empty rows; the other seventeen are for the printed form.
 *
 * ── HEBREW ON BOTH SITES ───────────────────────────────────────────────────
 *
 * The protocol exists only in Hebrew, so the document is `lang="he"` and
 * right-to-left on the English site too, where the page around it explains.
 *
 * The public text never carries the preparer's ID number; only the signed
 * copy does (protocolPreparedBy).
 *
 * ── FILLED IN, ON THE NEIGHBOURS' LINK ─────────────────────────────────────
 *
 * A protocol started on the website shows the same document with what its
 * initiator filled in: `protocol` is the snapshot the gateway stored (always
 * an approved wording), `meeting` the meeting's details and `members` the
 * proposed members' names. While somebody signs, `ownersTable` is off: they
 * add their own row in the form below the document.
 */
export interface DocumentMeeting {
  compoundName: string
  address: string
  meetingDate: string
  meetingPlace: string
}

/** 2026-10-20 → 20.10.2026, the way the protocol's date line is written. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

export function ProtocolDocument({
  protocol = PROTOCOL,
  meeting,
  members,
  ownersTable = true,
  titleLevel = 1,
}: {
  protocol?: RepresentationProtocol
  meeting?: DocumentMeeting
  members?: { fullName: string; apartmentNumber: string }[]
  ownersTable?: boolean
  /** 2 when the page has its own h1 above the document. */
  titleLevel?: 1 | 2
} = {}) {
  const Title = titleLevel === 1 ? 'h1' : 'h2'
  const value = (key: keyof DocumentMeeting) =>
    meeting ? (key === 'meetingDate' ? formatDate(meeting.meetingDate) : meeting[key]) : null
  return (
    <article
      lang="he"
      dir="rtl"
      aria-labelledby="protocol-title"
      className="mx-auto w-full max-w-[794px] rounded-2xl border border-gray-200 bg-white px-5 py-8 text-[15px] leading-[1.8] text-gray-900 sm:px-12 sm:py-12 sm:text-base print:max-w-none print:rounded-none print:border-0 print:p-0 print:text-[11pt] print:leading-[1.6] print:text-black"
    >
      {/* The first page's header in the Word file: "בס"ד" at the right,
          the logo anchored at the left margin. */}
      <div className="mb-8 flex items-start justify-between gap-6 print:mb-5">
        <span className="text-[0.9em]">{protocol.header}</span>
        <BrandMark name="OpenDoor התחדשות עירונית" variant="document" />
      </div>

      <Title
        id="protocol-title"
        className="text-center text-[1.3em] font-bold leading-snug tracking-normal text-inherit underline underline-offset-4"
      >
        {protocol.title}
      </Title>

      <dl className="mt-8 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 print:mt-6 print:gap-y-1.5">
        {protocol.meeting.fields.map((field) => (
          <Fragment key={field.key}>
            <dt className="font-bold">{field.label}:</dt>
            <dd>
              {value(field.key) ? <span className="font-medium">{value(field.key)}</span> : <Blank />}
              {/* Wraps whole, so "(להלן: "המתחם")" never breaks in two. */}
              <span className="whitespace-nowrap">
                <Runs text={field.after} />
              </span>
            </dd>
          </Fragment>
        ))}
        <dt className="font-bold">{protocol.meeting.agendaLabel}:</dt>
        <dd>
          <Runs text={protocol.meeting.agenda} />
        </dd>
      </dl>

      {protocol.parts.map((part) => (
        <section key={part.letter} aria-labelledby={`protocol-part-${part.letter}`} className="mt-9 print:mt-6">
          <h2 id={`protocol-part-${part.letter}`} className={`${INHERIT} font-normal print:break-after-avoid`}>
            <span className="font-bold underline underline-offset-4">{part.letter}.</span>{' '}
            <Runs text={part.title} />
          </h2>
          <div className="mt-4 space-y-5 print:mt-3 print:space-y-3.5">
            {part.clauses.map((clause) => (
              <Clause key={clause.number} clause={clause} protocol={protocol} members={members} />
            ))}
          </div>
        </section>
      ))}

      {ownersTable && (
        <section aria-labelledby="protocol-owners" className="mt-10 print:mt-7">
          <h2 id="protocol-owners" className={`${INHERIT} text-center font-normal print:break-after-avoid`}>
            <Runs text={protocol.ownersTable.heading} />
          </h2>
          {/* Seven columns do not fit a phone, so the table scrolls sideways
              there. A scrolling region must be reachable by keyboard, hence the
              tab stop and the name. */}
          <div
            role="region"
            aria-labelledby="protocol-owners"
            tabIndex={0}
            className="mt-4 overflow-x-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 print:overflow-visible"
          >
            <table aria-labelledby="protocol-owners" className="w-full min-w-[36rem] border-collapse text-[0.85em] print:min-w-0">
              <thead>
                <tr>
                  {protocol.ownersTable.columns.map((column) => (
                    <th key={column.key} scope="col" className="border border-gray-500 px-2 py-1.5 text-start font-normal">
                      <Runs text={column.label} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: protocol.ownersTable.blankRows }, (_, row) => (
                  <tr key={row} className={`h-9 print:h-[7.5mm] print:break-inside-avoid ${row >= 3 ? 'hidden print:table-row' : ''}`}>
                    {protocol.ownersTable.columns.map((column) => (
                      <td key={column.key} className="border border-gray-500" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-10 border-t border-gray-300 pt-3 text-center text-[0.8em] leading-normal text-gray-700 print:mt-6 print:text-black">
        {protocolPreparedBy(protocol)}
      </p>
    </article>
  )
}

/** A clause, its number hanging at the start. Clauses 1 and 2 have no
 *  heading, so the number stands beside their paragraph. */
function Clause({
  clause,
  protocol,
  members,
}: {
  clause: ProtocolClause
  protocol: RepresentationProtocol
  members?: { fullName: string; apartmentNumber: string }[]
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-1">
      <span>{clause.number}.</span>
      <div className="space-y-3">
        {clause.heading && (
          <h3 className={`${INHERIT} font-normal print:break-after-avoid`}>
            <Runs text={clause.heading} />
          </h3>
        )}
        {clause.blocks.map((block, index) => {
          if (block.kind === 'paragraph') {
            return (
              <p key={index} className={`${INHERIT} text-justify`}>
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
          return <RepresentationTable key={index} protocol={protocol} members={members} />
        })}
      </div>
    </div>
  )
}

function RepresentationTable({
  protocol,
  members,
}: {
  protocol: RepresentationProtocol
  members?: { fullName: string; apartmentNumber: string }[]
}) {
  return (
    <div>
      <table aria-label="חברי הנציגות" className="w-full table-fixed border-collapse text-[0.9em]">
        <thead>
          <tr>
            {protocol.representationTable.columns.map((column) => (
              <th key={column.key} scope="col" className="border border-gray-500 px-2 py-1.5 text-start font-normal">
                <Runs text={column.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members && members.length > 0
            ? members.map((member, row) => (
                <tr key={row} className="h-10 print:h-[9mm] print:break-inside-avoid">
                  {protocol.representationTable.columns.map((column) => (
                    <td key={column.key} className="border border-gray-500 px-2">
                      {column.key === 'fullName' ? member.fullName : column.key === 'apartment' ? member.apartmentNumber : null}
                    </td>
                  ))}
                </tr>
              ))
            : Array.from({ length: protocol.representationTable.blankRows }, (_, row) => (
                <tr key={row} className="h-10 print:h-[9mm] print:break-inside-avoid">
                  {protocol.representationTable.columns.map((column) => (
                    <td key={column.key} className="border border-gray-500" />
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
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
