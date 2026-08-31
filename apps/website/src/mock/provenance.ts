import { MATERIAL_CLAIM_FIELDS } from '@urban-renewal/api-contracts'

/**
 * MOCK DATA — replaced by the API in Phase 2. Contains no verified project,
 * resident or commercial information.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE HONESTY RULE, ENCODED IN TYPES
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Two kinds of fixture live in this folder, and confusing them is the specific
 * risk this file exists to prevent:
 *
 *   REALISTIC_PLACEHOLDER — uses a real OpenDoor project name and location so
 *   the UI can be judged against believable content. Every factual field is
 *   ABSENT: no stage, no unit count, no developer, no dates, no approvals.
 *   Nothing about it may read as a public statement of fact.
 *
 *   UI_FIXTURE — entirely invented, with an obviously fictional name. Factual
 *   fields MAY be populated, because there is no real-world claim to misstate.
 *   These exist to exercise states a placeholder cannot: a completed timeline,
 *   a project mid-stage, a project with a full gallery.
 *
 * The distinction is a required discriminant on every project fixture rather
 * than a comment, so a new fixture cannot be added without the author deciding
 * which it is. A comment would be ignored; a type error will not be.
 */

export type FixtureProvenance =
  /**
   * Real name and place, zero invented facts. Anything factual must be absent
   * rather than guessed — see `assertPlaceholderHasNoClaims`.
   */
  | 'REALISTIC_PLACEHOLDER'
  /** Fully fictional. Safe to populate for UI testing. */
  | 'UI_FIXTURE'

export interface WithProvenance {
  /**
   * Required. Determines what this fixture is permitted to assert.
   *
   * Removed before the data reaches a component — it is authoring metadata,
   * not content, and must never render.
   */
  provenance: FixtureProvenance
}

/**
 * Fields that constitute a factual claim about a real project.
 *
 * ── WHY THIS DERIVES FROM THE CONTRACT ─────────────────────────────────────
 *
 * `MATERIAL_CLAIM_FIELDS` in `@urban-renewal/api-contracts` is the
 * authoritative definition of what counts as a material claim — it is what the
 * `VerifiedFact` wrapper is applied to, and what a future CMS drives its
 * verification UI from. Restating that list here by hand would create two
 * definitions that drift, and the one that drifts is always the one nobody
 * looks at.
 *
 * The extra entries below are fields this guard has always checked that are
 * not part of the project contract (`timeline` is derived; the rest are names
 * a fixture author might reach for). Keeping them costs nothing and closes the
 * gap between "what the type forbids" and "what a person might type".
 */
export const CLAIM_FIELDS = [
  ...MATERIAL_CLAIM_FIELDS,
  'timeline',
  'unitCount',
  'signaturePercentage',
  'municipalDecision',
  'financials',
  'residentCount',
  'professionalTeam',
  'completedAt',
] as const

/**
 * Development-time guard.
 *
 * A `REALISTIC_PLACEHOLDER` that carries any claim field is a bug in the
 * fixture, not a display problem — it is the exact failure mode of a mock
 * quietly becoming a published statement about a real building. Throwing in
 * development makes it impossible to miss; production returns the value
 * untouched so a fixture mistake can never take the site down.
 */
export function assertNoInventedClaims<T extends WithProvenance>(fixture: T, label: string): T {
  if (process.env.NODE_ENV === 'production') return fixture
  if (fixture.provenance !== 'REALISTIC_PLACEHOLDER') return fixture

  const record = fixture as unknown as Record<string, unknown>
  const offending = CLAIM_FIELDS.filter((field) => {
    const value = record[field]
    if (value === undefined || value === null) return false
    if (Array.isArray(value)) return value.length > 0
    return true
  })

  if (offending.length > 0) {
    throw new Error(
      `Fixture "${label}" is REALISTIC_PLACEHOLDER but asserts unverified facts: ` +
      `${offending.join(', ')}. Either remove those fields, or change its ` +
      `provenance to UI_FIXTURE and give it a fictional name.`,
    )
  }
  return fixture
}

/** Strips authoring metadata before content reaches the UI. */
export function stripProvenance<T extends WithProvenance>(fixture: T): Omit<T, 'provenance'> {
  const { provenance: _provenance, ...rest } = fixture
  return rest
}
