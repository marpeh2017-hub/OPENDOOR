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

/** Does this value carry a real verification record? */
function isVerified(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const fact = value as { verifiedAt?: unknown; verifiedByName?: unknown }
  return typeof fact.verifiedAt === 'string' && fact.verifiedAt.length > 0
    && typeof fact.verifiedByName === 'string' && fact.verifiedByName.length > 0
}

/**
 * Development-time guard.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  A REAL PROJECT MAY ASSERT A FACT. IT MAY NOT ASSERT AN UNVERIFIED ONE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This guard originally forbade a `REALISTIC_PLACEHOLDER` from carrying ANY
 * claim field. That was right while no real project had verified anything: a
 * real name plus a factual field could only mean somebody had typed a number
 * they liked the look of.
 *
 * It stopped being right the moment a real project acquired a genuinely
 * verified fact. The rule as written would have forced the choice between
 * deleting a true, checked, attributable statement and relabelling a real
 * complex as fiction — and the second is how a fixture with a real address
 * ends up marked safe to invent things about.
 *
 * So the test is no longer "is there a claim field" but "is there a claim
 * field NOBODY STOOD BEHIND". A field wrapped in a complete `VerifiedFact` —
 * a date and a name — is by definition not invented; that is the entire
 * meaning of the wrapper. A bare value, or a half-filled verification, is.
 *
 * This is strictly stronger than what it replaces. The old rule could not
 * distinguish a checked fact from a fabricated one and simply banned both; it
 * would have been satisfied by a project that published nothing while saying
 * nothing about whether anyone had checked. The new one catches the actual
 * failure mode: an unverified claim about a real building.
 *
 * Fields outside the verification model — `timeline`, `unitCount`,
 * `signaturePercentage` and the rest — stay banned outright. They have no
 * wrapper to carry a name and a date, so there is no way for one of them to
 * be verified, and their presence on a real project is always a mistake.
 *
 * Throwing in development makes it impossible to miss; production returns the
 * value untouched so a fixture mistake can never take the site down.
 */
export function assertNoInventedClaims<T extends WithProvenance>(fixture: T, label: string): T {
  if (process.env.NODE_ENV === 'production') return fixture
  if (fixture.provenance !== 'REALISTIC_PLACEHOLDER') return fixture

  const record = fixture as unknown as Record<string, unknown>

  const offending = CLAIM_FIELDS.filter((field) => {
    const value = record[field]
    if (value === undefined || value === null) return false

    // Inside the verification model: allowed once somebody has signed for it.
    if ((MATERIAL_CLAIM_FIELDS as readonly string[]).includes(field)) {
      return !isVerified(value)
    }

    // Outside it: no wrapper exists, so nothing here can ever be verified.
    if (Array.isArray(value)) return value.length > 0
    return true
  })

  // Milestones are verified per entry rather than as a list, so the list is
  // checked entry by entry. One unverified milestone is one invented event.
  const milestones = record['milestones']
  const unverifiedMilestones = Array.isArray(milestones)
    ? milestones.filter((entry) => {
        const m = entry as { state?: unknown; verification?: unknown }
        return m.state !== 'upcoming' && !isVerified(m.verification)
      }).length
    : 0

  if (offending.length > 0 || unverifiedMilestones > 0) {
    const parts = [
      ...(offending.length > 0 ? [offending.join(', ')] : []),
      ...(unverifiedMilestones > 0
        ? [`${unverifiedMilestones} milestone(s) without a verification record`]
        : []),
    ]
    throw new Error(
      `Fixture "${label}" is REALISTIC_PLACEHOLDER but asserts unverified facts: ` +
      `${parts.join('; ')}. Either remove them, give each a complete ` +
      `VerifiedFact (verifiedAt AND verifiedByName), or change its provenance ` +
      `to UI_FIXTURE and give it a fictional name.`,
    )
  }
  return fixture
}

/** Strips authoring metadata before content reaches the UI. */
export function stripProvenance<T extends WithProvenance>(fixture: T): Omit<T, 'provenance'> {
  const { provenance: _provenance, ...rest } = fixture
  return rest
}
