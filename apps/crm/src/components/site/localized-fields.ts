/**
 * Finding the editable text inside a block tree, and putting it back.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY THE EDITOR WALKS THE TREE INSTEAD OF HAVING A FORM PER BLOCK TYPE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A hand-written form per block type is the obvious V1 and the wrong one. It
 * has to be extended for every new block, and until somebody does that the new
 * block's text is invisible in the editor while being perfectly visible on the
 * website. The failure is silent and one-directional: the CMS quietly stops
 * covering the site it is supposed to manage.
 *
 * Walking the tree inverts that. Every `{ he, en? }` leaf is discovered
 * wherever it sits, so a new block type is editable the day it is added, and a
 * field that is NOT editable here is one that does not exist in the content.
 *
 * ── WHAT IS DELIBERATELY NOT EDITABLE ──────────────────────────────────────
 *
 * Structure. Block order, block types, ids, hrefs and the `hidden` flag are
 * carried through untouched. This is a text editor over an existing
 * composition, which is exactly the V1 the brief asks for: prove that content
 * round-trips through the database, before adding the ability to rearrange it.
 * Adding structural editing later changes this file; it does not change the
 * persistence model underneath.
 */

export interface LocalizedLeaf {
  /** Dotted path with array indices, e.g. `blocks[1].items[0].title`. */
  path: string
  he: string
  en?: string
  /** Human label derived from the path, for the field's own <label>. */
  label: string
  /** Which block this belongs to, for grouping. */
  blockIndex: number
  blockType: string
}

function isLocalized(v: unknown): v is { he: string; en?: string } {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  const keys = Object.keys(v)
  return (
    keys.includes('he') &&
    typeof (v as Record<string, unknown>)['he'] === 'string' &&
    keys.every((k) => k === 'he' || k === 'en')
  )
}

/** `blocks[1].items[0].title` → `items 1 · title`, readable without the noise. */
function labelFor(path: string): string {
  return path
    .replace(/^blocks\[\d+\]\.?/, '')
    .replace(/\[(\d+)\]/g, (_, i) => ` ${Number(i) + 1}`)
    .replace(/\./g, ' · ')
    .trim()
}

export function findLocalizedLeaves(draft: unknown): LocalizedLeaf[] {
  const blocks = (draft as { blocks?: unknown[] })?.blocks
  if (!Array.isArray(blocks)) return []

  const out: LocalizedLeaf[] = []

  const walk = (node: unknown, path: string, blockIndex: number, blockType: string): void => {
    if (node === null || typeof node !== 'object') return
    if (isLocalized(node)) {
      out.push({
        path,
        he: node.he,
        ...(node.en !== undefined ? { en: node.en } : {}),
        label: labelFor(path) || 'טקסט',
        blockIndex,
        blockType,
      })
      return
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`, blockIndex, blockType))
      return
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walk(v, path ? `${path}.${k}` : k, blockIndex, blockType)
    }
  }

  blocks.forEach((block, i) => {
    const type = (block as { type?: string })?.type ?? 'UNKNOWN'
    walk(block, `blocks[${i}]`, i, type)
  })

  return out
}

/**
 * Write one leaf back, returning a NEW draft.
 *
 * Immutable on purpose: the editor keeps the loaded draft as the baseline for
 * "has anything changed", and mutating in place would make the dirty check
 * always say no.
 *
 * An empty English string REMOVES the key rather than storing `''`. The
 * localisation policy distinguishes "no approved English" from "English that
 * happens to be blank", and `resolveContent` treats `''` as absent anyway — so
 * storing it would put a value in the database that means nothing and reads as
 * if somebody had translated the field.
 */
export function setLocalizedLeaf(
  draft: unknown,
  path: string,
  value: { he: string; en?: string },
): unknown {
  const segments = path.match(/[^.[\]]+/g)
  if (!segments) return draft

  const clone = (node: unknown): unknown =>
    Array.isArray(node) ? [...node] : { ...(node as Record<string, unknown>) }

  const root = clone(draft)
  let cursor: Record<string, unknown> | unknown[] = root as Record<string, unknown>

  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!
    const idx: string | number = Array.isArray(cursor) ? Number(key) : key
    const next = clone((cursor as Record<string, unknown>)[idx as string])
    ;(cursor as Record<string, unknown>)[idx as string] = next
    cursor = next as Record<string, unknown> | unknown[]
  }

  const last = segments[segments.length - 1]!
  const target: { he: string; en?: string } = { he: value.he }
  if (value.en !== undefined && value.en !== '') target.en = value.en
  ;(cursor as Record<string, unknown>)[Array.isArray(cursor) ? Number(last) : last] = target

  return root
}
