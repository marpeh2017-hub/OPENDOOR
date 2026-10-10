import { Fragment } from 'react'
import Image from 'next/image'
import {
  protocolItemNumber,
  protocolRuns,
  type ProtocolClause,
  type ProtocolText,
  type RepresentationProtocol,
} from '@urban-renewal/api-contracts'
import { formatFormDate, type FormMeeting } from '@/lib/forms'

export interface MemberRow {
  fullName: string
  idNumber?: string | null
  apartmentNumber: string
  signatureImage?: string | null
  method?: string | null
}

export interface OwnerRow {
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
 * The shared stylesheet gives every h1-h3 and p its own size, colour and
 * leading. A legal document reads in one size and one colour, so its
 * headings and paragraphs inherit them and say only what differs.
 */
const INHERIT = 'text-[1em] leading-[inherit] tracking-normal text-inherit'

/**
 * The representation-appointment protocol as the resident reads it: the
 * snapshot the form was sent with, this meeting's details, the
 * representation table and, on a copy, the signed rows. Laid out like the
 * owner's Word file and printable as A4; on a phone it is one readable
 * column, with the wide owners' table scrolling sideways.
 */
export function ProtocolView({
  text,
  meeting,
  members,
  rows,
  preparedBy,
  ownersTable = true,
  footer,
  titleLevel = 1,
}: {
  text: RepresentationProtocol
  meeting: FormMeeting
  members?: MemberRow[]
  rows?: OwnerRow[]
  preparedBy?: string
  /** Off while signing: the signer fills their own row on the next step. */
  ownersTable?: boolean
  footer?: React.ReactNode
  /** 2 when the page has its own h1 above the document. */
  titleLevel?: 1 | 2
}) {
  const Title = titleLevel === 1 ? 'h1' : 'h2'

  return (
    <article
      lang="he"
      dir="rtl"
      aria-labelledby="protocol-title"
      className="w-full rounded-xl border border-border bg-white px-4 py-6 text-[15px] leading-[1.8] text-gray-900 sm:px-6 print:rounded-none print:border-0 print:p-0 print:text-[11pt] print:leading-[1.6] print:text-black"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <span className="text-[0.9em]">{text.header}</span>
        <Image src="/brand/opendoor-logo.svg" alt="OpenDoor התחדשות עירונית" width={118} height={44} unoptimized className="h-11 w-auto" />
      </div>

      <Title
        id="protocol-title"
        className="text-center text-[1.2em] font-bold leading-snug tracking-normal text-inherit underline underline-offset-4"
      >
        {text.title}
      </Title>

      <dl className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
        {text.meeting.fields.map((field) => {
          const value = field.key === 'meetingDate' ? formatFormDate(meeting.meetingDate) : meeting[field.key]
          return (
            <Fragment key={field.key}>
              <dt className="font-bold">{field.label}:</dt>
              <dd>
                <span className="font-medium">{value}</span>
                <Runs text={field.after} />
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
        <section key={part.letter} aria-labelledby={`protocol-part-${part.letter}`} className="mt-7">
          <h2 id={`protocol-part-${part.letter}`} className={`${INHERIT} font-normal`}>
            <span className="font-bold underline underline-offset-4">{part.letter}.</span> <Runs text={part.title} />
          </h2>
          <div className="mt-3 space-y-4">
            {part.clauses.map((clause) => (
              <Clause key={clause.number} clause={clause} text={text} members={members} />
            ))}
          </div>
        </section>
      ))}

      {ownersTable && (
        <section aria-labelledby="protocol-owners" className="mt-8">
          <h2 id="protocol-owners" className={`${INHERIT} text-center font-normal`}>
            <Runs text={text.ownersTable.heading} />
          </h2>
          <div
            role="region"
            aria-labelledby="protocol-owners"
            tabIndex={0}
            className="mt-3 overflow-x-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 print:overflow-visible"
          >
            <table className="w-full min-w-[36rem] border-collapse text-[0.85em] print:min-w-0">
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
                {(rows ?? []).map((row, index) => (
                  <tr key={index}>
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
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {footer}

      {preparedBy && (
        <p className="mt-8 border-t border-gray-300 pt-3 text-center text-[0.8em] leading-normal tracking-normal text-gray-700">
          {preparedBy}
        </p>
      )}
    </article>
  )
}

function Clause({ clause, text, members }: { clause: ProtocolClause; text: RepresentationProtocol; members?: MemberRow[] }) {
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-1">
      <span>{clause.number}.</span>
      <div className="space-y-2.5">
        {clause.heading && (
          <h3 className={`${INHERIT} font-normal`}>
            <Runs text={clause.heading} />
          </h3>
        )}
        {clause.blocks.map((block, index) => {
          if (block.kind === 'paragraph') {
            return (
              <p key={index} className={INHERIT}>
                <Runs text={block.text} />
              </p>
            )
          }
          if (block.kind === 'items') {
            return (
              <ol key={index} className="space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="grid grid-cols-[2.25rem_minmax(0,1fr)]">
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
                {(members ?? []).map((member, row) => (
                  <tr key={row}>
                    <Cell>{member.fullName}</Cell>
                    <Cell ltr>{member.idNumber}</Cell>
                    <Cell>{member.apartmentNumber}</Cell>
                    <Cell>
                      <Signature image={member.signatureImage} method={member.method} />
                    </Cell>
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

function Signature({ image, method }: { image?: string | null; method?: string | null }) {
  if (method === 'WET') return <span className="text-[0.9em]">נחתם ידנית, מצורף</span>
  if (!image) return null
  // eslint-disable-next-line @next/next/no-img-element -- a data URL, not a file the image optimiser can serve
  return <img src={image} alt="חתימה" className="h-9 w-auto max-w-[8rem] object-contain" />
}

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
