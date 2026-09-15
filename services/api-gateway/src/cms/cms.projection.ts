/**
 * The public boundary, as one pure function.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY THIS IS A DENY-LIST *AND* A SHAPE REBUILD, NOT A FIELD DELETION
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The obvious implementation is `delete draft.internal` on the way out. It is
 * also the one that fails silently: the day somebody adds `sourceNotes` to a
 * block, the deletion list does not know about it and the field ships. A leak
 * introduced that way is invisible in review, because the diff that causes it
 * touches a different file from the one that is supposed to prevent it.
 *
 * So this walks the content and REBUILDS it, carrying forward only what is
 * recognised as publishable. An unrecognised key is dropped, not passed
 * through. The failure mode of a mistake is therefore "the new field does not
 * appear on the website" — noticed immediately by whoever added it — instead
 * of "the new field appears on the website" — noticed by nobody.
 *
 * ── WHAT IS STRIPPED, AND WHY EACH ONE ─────────────────────────────────────
 *
 *   verifiedByName / verifiedByUserId / verifiedById
 *       The public learns that a figure was verified, never by whom. Naming
 *       the person turns an internal quality record into a personal warranty
 *       and invites approaching them directly.
 *
 *   source / sourceReference
 *       The source VOCABULARY (`FEASIBILITY_WORKBOOK`, `USER_VERIFIED`) leaks
 *       how the company works internally and, worse, reads as corroboration to
 *       someone who does not know what the terms mean.
 *
 *   exposure INTERNAL and FEASIBILITY
 *       Dropped whole. FEASIBILITY is dropped even when it is marked verified:
 *       a scenario output is a projection, not a fact about the world, and no
 *       amount of internal sign-off converts one into the other.
 *
 *   unverified material claims
 *       A claim nobody has stood behind does not travel. This is the same rule
 *       the website's own `assertNoInventedClaims` enforces on fixtures; it is
 *       repeated here because the CMS is now a second way for content to
 *       arrive, and a rule enforced on only one of two paths is not enforced.
 *
 * The projection is stored on the publication row rather than recomputed at
 * read time, so what the public was given remains provable after this file
 * changes.
 */

/** Fields whose presence constitutes a factual claim about the world. */
export const MATERIAL_CLAIM_FIELDS = [
  'unitCount',
  'existingUnits',
  'plannedUnits',
  'builtArea',
  'lotArea',
  'planningStatus',
  'approvalDate',
  'permitDate',
  'developerName',
  'startDate',
  'completionDate',
  'signatureRate',
] as const

/** Keys that must never appear in a public payload, at any depth. */
export const NEVER_PUBLIC_KEYS = [
  'verifiedByName',
  'verifiedByUserId',
  'verifiedById',
  'verifiedBy',
  'source',
  'sourceReference',
  'sourceNotes',
  'editedByUserId',
  'editedById',
  'editedBy',
  'internal',
  'internalNotes',
  'feasibility',
  'feasibilityScenario',
  'economics',
  'tenantId',
  'createdById',
  'updatedById',
  'publishedById',
  'authorId',
  'actorId',
  'uploadedById',
] as const

const NEVER = new Set<string>(NEVER_PUBLIC_KEYS)
const MATERIAL = new Set<string>(MATERIAL_CLAIM_FIELDS)

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

export interface ProjectionOptions {
  /**
   * Verification status per dotted field path, as stored in `cms_verifications`.
   * A material claim with no entry here has never been verified and is dropped.
   */
  verification?: Record<string, string>
}

/** Only these two statuses may reach the public. Mirrors `isPublishable`. */
const PUBLISHABLE_STATUSES = new Set(['VERIFIED', 'SELF_VERIFIED'])

/**
 * A verified fact as authored: `{ value, status, verifiedAt, verifiedByName, source }`.
 * Recognised structurally rather than by a type tag, because the tag would be
 * one more thing that can be forgotten on a new block type.
 */
function isFactEnvelope(v: unknown): v is Record<string, Json> {
  return (
    typeof v === 'object' && v !== null && !Array.isArray(v) &&
    'value' in (v as Record<string, unknown>) &&
    'status' in (v as Record<string, unknown>)
  )
}

function exposureOf(v: unknown): string | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const e = (v as Record<string, unknown>)['exposure']
  return typeof e === 'string' ? e : undefined
}

/**
 * Rebuild `node` keeping only what may be published.
 *
 * `path` is the dotted location used to look up verification state, so the
 * caller's `cms_verifications` rows line up with the content tree.
 */
function project(node: Json, path: string, opts: ProjectionOptions): Json | undefined {
  if (node === null || typeof node !== 'object') return node

  if (Array.isArray(node)) {
    const out: Json[] = []
    node.forEach((item, i) => {
      const v = project(item, path ? `${path}.${i}` : String(i), opts)
      if (v !== undefined) out.push(v)
    })
    return out
  }

  // A whole subtree can declare itself unpublishable.
  const exposure = exposureOf(node)
  if (exposure === 'INTERNAL' || exposure === 'FEASIBILITY') return undefined

  // A fact envelope collapses to its value, and only if somebody signed for it.
  if (isFactEnvelope(node)) {
    const status = typeof node['status'] === 'string' ? (node['status'] as string) : 'UNVERIFIED'
    if (!PUBLISHABLE_STATUSES.has(status)) return undefined
    const value = project(node['value'] as Json, path, opts)
    if (value === undefined) return undefined
    // Carry the BADGE, never the identity: the site may say "verified", and
    // may say when, but not by whom or from what.
    const verifiedAt = node['verifiedAt']
    return verifiedAt === undefined || verifiedAt === null
      ? { value, verified: true }
      : { value, verified: true, verifiedAt: verifiedAt as Json }
  }

  const out: Record<string, Json> = {}
  for (const [key, raw] of Object.entries(node as Record<string, Json>)) {
    if (NEVER.has(key)) continue

    const childPath = path ? `${path}.${key}` : key

    // A bare material claim — a number sitting directly on the object rather
    // than wrapped in a fact envelope — needs a verification row to travel.
    if (MATERIAL.has(key) && !isFactEnvelope(raw)) {
      const status = opts.verification?.[childPath]
      if (!status || !PUBLISHABLE_STATUSES.has(status)) continue
    }

    const value = project(raw, childPath, opts)
    if (value !== undefined) out[key] = value
  }
  return out
}

/**
 * Project one content draft into the payload the public may receive.
 *
 * Returns a NEW structure; the input is never mutated, because the draft it is
 * given is the row the editor is still working on.
 */
export function toPublicProjection(draft: unknown, opts: ProjectionOptions = {}): Json {
  const result = project(draft as Json, '', opts)
  // A draft that projects to nothing is an empty document, not `undefined` —
  // callers store this, and a null column would be indistinguishable from
  // "never published".
  return result === undefined ? {} : result
}

/**
 * Assert that a payload carries nothing private, by SHAPE rather than by
 * scanning for known strings.
 *
 * Used by the publish path as a last gate and by the test suite as its
 * oracle. It exists because `toPublicProjection` and this check can fail
 * independently: the projection can be wrong, and a string search for
 * "USER_VERIFIED" would pass happily on a payload that leaked a user id.
 *
 * Returns the offending dotted paths; empty means clean.
 */
export function findPrivateLeaks(payload: unknown, path = ''): string[] {
  if (payload === null || typeof payload !== 'object') return []
  if (Array.isArray(payload)) {
    return payload.flatMap((v, i) => findPrivateLeaks(v, path ? `${path}.${i}` : String(i)))
  }
  const leaks: string[] = []
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key
    if (NEVER.has(key)) leaks.push(childPath)
    leaks.push(...findPrivateLeaks(value, childPath))
  }
  return leaks
}
