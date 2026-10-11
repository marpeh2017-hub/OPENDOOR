import { Fragment } from 'react'
import { documentSegments, protocolRuns, type ProtocolText } from '@urban-renewal/api-contracts'

/**
 * What the owner's documents share on the page: one frame, one size and
 * colour for the text, the document's emphasis, and blank lines for the gaps
 * a complex fills in.
 */

/**
 * The shared stylesheet gives every h1-h3 and p its own size, colour and
 * leading (packages/design-system, globals.css). A legal document reads in one
 * size and one colour, so its headings and paragraphs inherit them from the
 * document instead, and say only what differs.
 */
export const INHERIT = 'text-[1em] leading-[inherit] tracking-normal text-inherit'

/** The page each document sits on: A4-wide on screen, the paper itself in print. */
export const DOCUMENT_FRAME =
  'mx-auto w-full max-w-[794px] rounded-2xl border border-gray-200 bg-white px-5 py-8 text-[15px] leading-[1.8] text-gray-900 sm:px-12 sm:py-12 sm:text-base print:max-w-none print:rounded-none print:border-0 print:p-0 print:text-[11pt] print:leading-[1.6] print:text-black'

/** A line to fill in by hand, as the Word file's underscores. No margin: the
 *  text around a gap carries its own spaces, and "ב{city}" keeps its letter
 *  against the line. */
export function Blank({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const width = size === 'sm' ? 'w-16 sm:w-20' : size === 'lg' ? 'w-40 sm:w-64' : 'w-28 sm:w-48'
  return (
    <span className={`inline-block ${width} border-b border-gray-600 align-baseline`}>
      <span className="sr-only">שדה למילוי</span>
      {'\u00a0'}
    </span>
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

/**
 * Text with gaps (`{street}`): a blank line where a gap has no value, the
 * value with the emphasis of the words around it where it has one.
 */
export function Segments({
  text,
  values,
  short = [],
}: {
  text: ProtocolText
  values?: Record<string, string | null | undefined>
  /** Gaps that take a short line (a block or parcel number). */
  short?: readonly string[]
}) {
  return (
    <>
      {documentSegments(text, values).map((segment, index) => {
        if (segment.field !== undefined && !segment.text) {
          return <Blank key={index} size={short.includes(segment.field) ? 'sm' : 'md'} />
        }
        let node: React.ReactNode = segment.field !== undefined ? <span className="font-medium">{segment.text}</span> : segment.text
        if (segment.bold) node = <strong className="font-bold">{node}</strong>
        if (segment.underline) node = <u className="underline-offset-4">{node}</u>
        return <Fragment key={index}>{node}</Fragment>
      })}
    </>
  )
}
