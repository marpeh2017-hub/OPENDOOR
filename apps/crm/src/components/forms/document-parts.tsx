import { Fragment } from 'react'
import Image from 'next/image'
import { documentSegments, protocolRuns, type ProtocolText } from '@urban-renewal/api-contracts'

/**
 * What the agreement's and the notice's views share with the protocol's: the
 * A4 frame, the header, the document's emphasis, gaps as blank lines or
 * values, and table cells and signatures.
 */

export const DOCUMENT_FRAME =
  'mx-auto w-full max-w-[794px] rounded-xl border border-border bg-white px-6 py-8 text-[15px] leading-[1.8] text-gray-900 sm:px-12 sm:py-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:text-[11pt] print:leading-[1.6] print:text-black'

/** The first page's header in the Word files: "בס"ד" at the right, the logo at the left. */
export function DocumentHeader({ header }: { header: string }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-6 print:mb-5">
      <span className="text-[0.9em]">{header}</span>
      <Image src="/brand/opendoor-logo.svg" alt="OpenDoor התחדשות עירונית" width={156} height={58} unoptimized className="h-[58px] w-auto" />
    </div>
  )
}

/** The document's emphasis as markup: bold and underline, nothing else. */
export function Runs({ text }: { text: ProtocolText }) {
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

/** A line to fill in by hand, as the Word file's underscores. */
export function Blank({ short = false }: { short?: boolean }) {
  return (
    <span className={`inline-block ${short ? 'w-16 sm:w-20' : 'w-28 sm:w-44'} border-b border-gray-600 align-baseline`}>
      <span className="sr-only">שדה למילוי</span>
      {'\u00a0'}
    </span>
  )
}

/** Text with gaps: the value where the form has one, a blank line where it does not. */
export function Segments({
  text,
  values,
  short = [],
}: {
  text: ProtocolText
  values?: Record<string, string | null | undefined> | null
  short?: readonly string[]
}) {
  return (
    <>
      {documentSegments(text, values ?? {}).map((segment, index) => {
        if (segment.field !== undefined && !segment.text) return <Blank key={index} short={short.includes(segment.field)} />
        let node: React.ReactNode = segment.field !== undefined ? <span className="font-medium">{segment.text}</span> : segment.text
        if (segment.bold) node = <strong className="font-bold">{node}</strong>
        if (segment.underline) node = <u className="underline-offset-4">{node}</u>
        return <Fragment key={index}>{node}</Fragment>
      })}
    </>
  )
}

export function Cell({ children, ltr }: { children?: React.ReactNode; ltr?: boolean }) {
  return (
    <td className="h-10 border border-gray-500 px-2 py-1 align-middle" dir={ltr ? 'ltr' : undefined}>
      {children}
    </td>
  )
}

/** The drawn signature, or a note that it was signed on paper. Empty until signed. */
export function Signature({ image, method }: { image?: string | null; method?: string | null }) {
  if (method === 'WET') return <span className="text-[0.9em]">נחתם ידנית, מצורף</span>
  if (!image) return null
  // eslint-disable-next-line @next/next/no-img-element -- a data URL, not a file the image optimiser can serve
  return <img src={image} alt="חתימה" className="h-9 w-auto max-w-[9rem] object-contain" />
}

/** 2026-10-20 → 20.10.2026. */
export function documentDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}.${m}.${y}` : ''
}
