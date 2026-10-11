import { protocolRuns, type ProtocolText } from './representation-protocol'

/**
 * Fill-in fields inside a document's marked-up text.
 *
 * The owner's documents leave gaps to fill per complex: a street, a block and
 * parcel, a date. In the text they are `{key}`, so a sentence keeps its place
 * and its emphasis around the gap: "ברחוב {street} ב{city}". The website
 * prints a gap as a blank line; a filled copy prints the value with the
 * emphasis of the words around it.
 */

export interface DocumentSegment {
  text: string
  bold: boolean
  underline: boolean
  /** Set on a gap: the field it stands for. `text` is then its value, or empty. */
  field?: string
}

const FIELD = /\{([a-zA-Z]+)\}/g

/** Runs with their gaps split out, each gap filled from `values` when it has one. */
export function documentSegments(text: ProtocolText, values: Record<string, string | null | undefined> = {}): DocumentSegment[] {
  const out: DocumentSegment[] = []
  for (const run of protocolRuns(text)) {
    let last = 0
    for (const match of run.text.matchAll(FIELD)) {
      const at = match.index ?? 0
      if (at > last) out.push({ text: run.text.slice(last, at), bold: run.bold, underline: run.underline })
      const key = match[1]!
      out.push({ text: values[key]?.trim() ?? '', bold: run.bold, underline: run.underline, field: key })
      last = at + match[0].length
    }
    if (last < run.text.length) out.push({ text: run.text.slice(last), bold: run.bold, underline: run.underline })
  }
  return out
}

/** The fields a text asks for, in order. */
export function documentFields(text: ProtocolText): string[] {
  return [...text.matchAll(FIELD)].map((m) => m[1]!)
}
