/**
 * ══════════════════════════════════════════════════════════════════════════
 *  TWO KINDS OF CORRECTNESS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Content on this website can be wrong in two very different ways, and
 * conflating them produces either a bureaucratic CMS or a dishonest website.
 *
 *   AN EDITORIAL MISTAKE is a typo, a clumsy sentence, a badly cropped image.
 *   It is caught by someone reading the page before it goes live, and the cost
 *   of getting it wrong is embarrassment.
 *
 *   A FACTUAL CLAIM is "this project is at the developer-selection stage",
 *   "there are 84 existing units", "the plan was approved". It cannot be
 *   caught by reading — the reader has no way to know — and the cost of
 *   getting it wrong is a resident making a decision about their home on the
 *   strength of something nobody checked.
 *
 * So they get different machinery:
 *
 *   Editorial fields  →  DRAFT → REVIEW → PUBLISHED  (see PublishState)
 *   Material claims   →  VerifiedFact<T>, which cannot exist unverified
 *
 * ── WHY NOT WRAP EVERYTHING ────────────────────────────────────────────────
 *
 * An earlier draft of this model wrapped every project field. That would mean
 * an editor fixing a comma in a description has to record who verified the
 * comma — which teaches people to type their own name into a verification box
 * without thinking, and a verification everyone rubber-stamps verifies
 * nothing. Scoping the mechanism to claims that could materially affect a
 * resident's trust is what keeps it meaningful where it is used.
 *
 * `MATERIAL_CLAIM_FIELDS` below is the authoritative list of what qualifies.
 */

import type { IsoDate } from './common'

/**
 * A factual claim somebody has checked.
 *
 * The object CANNOT BE CONSTRUCTED without `verifiedAt` and `verifiedByName`.
 * That is the whole design: "only if verified" stops being a policy an editor
 * might forget and becomes something the type system will not let them skip.
 * An unverified developer name has nowhere in the model to live.
 *
 * A field of this type is ALWAYS optional on its parent. Absent means "nobody
 * has checked this", which is a normal and expected state, and the UI must
 * render completely without it. Absent never means zero, unknown or pending.
 */
export interface VerifiedFact<T> {
  value: T
  /** When the check happened. Not when the fact became true. */
  verifiedAt: IsoDate
  /** Who checked. A person, so there is someone to ask. */
  verifiedByName: string
  /**
   * What they checked it against: a document reference, a decision number, a
   * meeting date. Optional because some facts are verified by direct
   * knowledge, but strongly encouraged for anything a resident might dispute.
   */
  source?: string
}

/**
 * A verified fact as an UNAUTHENTICATED VISITOR receives it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THE VERIFIER'S NAME IS NOT SHIPPED TO THE BROWSER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `verifiedByName` is required on `VerifiedFact` because the value of the
 * model is that there is always a person to ask. That guarantee is about the
 * RECORD, not about the web page.
 *
 * Omitting it from the render is not enough. A server-rendered page serialises
 * the objects it was given, so a field that is fetched but never displayed
 * still travels to every visitor in the page source. That is publication by
 * any meaningful definition: it is greppable, archived by crawlers, and
 * visible in view-source to anyone who looks.
 *
 * So the name is removed at the repository boundary, and this type is what
 * makes that removal enforceable rather than a convention somebody remembers.
 * A component cannot read a name that its type does not have.
 *
 * `verifiedAt` stays: the date is the part a reader can act on, and it is the
 * whole point of the section-level verification note.
 */
export type PublicVerifiedFact<T> = Omit<VerifiedFact<T>, 'verifiedByName'>

/**
 * The fields on a project that require structured verification.
 *
 * Exported as data, not just as documentation, so the CMS can drive its own
 * form from it and the two cannot drift. Adding a field here is a deliberate
 * decision that it is a material claim.
 */
export const MATERIAL_CLAIM_FIELDS = [
  'currentStage',
  'existingUnits',
  'proposedUnits',
  'buildingCount',
  'planningStatus',
  'developer',
  'approvals',
  'permits',
  'materialDates',
] as const

export type MaterialClaimField = (typeof MATERIAL_CLAIM_FIELDS)[number]

/**
 * The fields that need editorial approval only.
 *
 * These carry no factual assertion a reader could be misled by. A wrong city
 * name is a mistake anyone can see; a wrong unit count is not.
 *
 * `organizingStatus` sits here deliberately, and it is the judgement call in
 * this list: it describes OpenDoor's own working relationship with a complex,
 * which OpenDoor is the authority on, rather than a fact about the building or
 * the planning system. Move it to MATERIAL if that ever stops being true.
 */
export const EDITORIAL_FIELDS = [
  'name',
  'slug',
  'city',
  'neighborhood',
  'address',
  'type',
  'summary',
  'description',
  'organizingStatus',
  'heroImage',
  'gallery',
  'beforeImages',
  'seo',
  'featured',
] as const

export type EditorialField = (typeof EDITORIAL_FIELDS)[number]

/** True when a field must carry a `VerifiedFact` rather than a bare value. */
export function requiresVerification(field: string): field is MaterialClaimField {
  return (MATERIAL_CLAIM_FIELDS as readonly string[]).includes(field)
}

/**
 * Reads a verified fact's value, or undefined.
 *
 * The point of routing every read through here is that a caller cannot
 * accidentally render `fact` (the wrapper object) where it meant `fact.value`,
 * and cannot forget the absent case — the return type forces the check.
 */
export function verifiedValue<T>(fact: VerifiedFact<T> | undefined): T | undefined {
  return fact?.value
}
