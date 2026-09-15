import type { MediaAsset, PublicProject } from '@urban-renewal/api-contracts'

/**
 * Presentation decisions for the project system.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY THESE LIVE IN ONE NAMED FILE RATHER THAN INSIDE THE COMPONENTS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Each value below is a JUDGEMENT, not a layout constant. A `> 5` buried in a
 * JSX condition is indistinguishable from an accident six months later, and
 * the person who finds it cannot tell whether changing it is safe. Written
 * here, with the reasoning attached, each one can be argued with.
 */

/* ── RESIDENT ACCESS ────────────────────────────────────────────────────── */

/**
 * Whether the private environment for apartment owners can actually be
 * reached.
 *
 * `COMING_SOON` is the honest value TODAY: the environment is being built, no
 * authentication exists on this site, and the brief is explicit that the
 * bridge must not imply private access is live when it is not.
 *
 * Three states rather than a boolean because "not available" and "not
 * mentioned" are genuinely different products:
 *
 *   AVAILABLE   the bridge links out to a working sign-in.
 *   COMING_SOON the bridge explains what exists today (meetings, written
 *               summaries, the representation) and offers contact instead.
 *               It never shows a sign-in control that would fail.
 *   HIDDEN      the block does not render at all. For the case where a
 *               representation has asked that the project not advertise a
 *               resident channel publicly.
 *
 * Changing this to `AVAILABLE` is a deliberate act that requires the portal
 * to exist. It is not a feature flag to flip optimistically.
 */
export type ResidentAccessState = 'AVAILABLE' | 'COMING_SOON' | 'HIDDEN'

export const RESIDENT_ACCESS: ResidentAccessState = 'COMING_SOON'

/* ── FILTER VISIBILITY ──────────────────────────────────────────────────── */

/**
 * How many published projects must exist before the filter rail appears.
 *
 * ── THE DECISION, AND WHY THIS NUMBER ──────────────────────────────────────
 *
 * Filters exist to make finding something easier. Below a certain count they
 * make it HARDER: a rail offering "by city / by stage / by track" above four
 * cards adds a decision the visitor did not need, implies a catalogue larger
 * than what is there, and gives them a way to filter the list down to nothing.
 *
 * Seven is the threshold because it is roughly where a single screen stops
 * holding the whole grid at desktop widths (three columns, so seven is the
 * first count that guarantees a third row and some scrolling). Below that,
 * reading every card is faster than operating a control.
 *
 * The rail is also suppressed when every published project shares one city, or
 * one track, regardless of count: a filter with a single option is a control
 * that cannot do anything.
 *
 * This is DATA-AWARE rather than configured off, so the rail appears on its
 * own the day the catalogue justifies it. Nobody has to remember to turn it on.
 */
export const PROJECT_FILTER_MIN_COUNT = 7

/**
 * Whether the filter rail earns its place, given what is actually published.
 *
 * Takes the distinct-value counts rather than the projects themselves so the
 * caller can compute them from whatever projection it has.
 */
export function shouldShowFilters(input: {
  total: number
  cityCount: number
  typeCount: number
}): boolean {
  if (input.total < PROJECT_FILTER_MIN_COUNT) return false
  // A rail whose every control has one option is decoration.
  return input.cityCount > 1 || input.typeCount > 1
}

/* ── SECTION SUPPRESSION ────────────────────────────────────────────────── */

/**
 * Does this project have enough verified fact to justify a facts section?
 *
 * ── WHY A HELPER AND NOT `project.existingUnits && ...` AT THE CALL SITE ───
 *
 * The rule the brief sets is "render only sections supported by meaningful
 * content", and meaningful is per-section rather than per-field. A facts table
 * containing exactly one row is worse than no facts table: it gives a heading,
 * a rule and a verification note to a single number, which draws attention to
 * how little is known rather than to what is.
 *
 * `type` alone does not count. Every project has a track, so counting it would
 * make this function always true and the section would render empty-handed.
 */
export function hasProjectFacts(project: PublicProject): boolean {
  const rows = [
    project.existingUnits,
    project.proposedUnits,
    project.buildingCount,
    project.planningStatus,
    project.developer,
    project.approvals,
    project.permits,
    project.materialDates,
  ].filter((field) => field !== undefined)
  return rows.length > 0
}

/**
 * The verification date shown for a section: the OLDEST across its facts.
 *
 * Oldest rather than newest, because the note is a guarantee about the whole
 * block. Showing the most recent date would let one freshly checked figure
 * vouch for four stale ones, which is the precise misreading the note exists
 * to prevent.
 *
 * Returns null when nothing is verified, and the note does not render.
 */
export function oldestVerification(project: PublicProject): string | null {
  const dates = [
    project.existingUnits, project.proposedUnits, project.buildingCount,
    project.planningStatus, project.developer, project.approvals,
    project.permits, project.materialDates, project.currentStage,
  ]
    .map((field) => field?.verifiedAt)
    .filter((date): date is string => typeof date === 'string')

  if (dates.length === 0) return null
  return dates.sort()[0]!
}

/* ── GALLERY ────────────────────────────────────────────────────────────── */

/**
 * Gallery items, in the order an editor chose, minus anything unsafe to show.
 *
 * Two filters, both load-bearing:
 *
 *   NO `imageType` → DROPPED. An unclassified image on a project page is
 *   exactly the claim the classification system exists to prevent, and there
 *   is no safe default: guessing `EDITORIAL_CONTEXT` would caption a real
 *   project photo as not-the-project, and guessing the other way is worse.
 *
 *   `ARCHITECTURAL_PATTERN` → DROPPED. It is generated, it is the fallback for
 *   an absent image, and listing a drawing among photographs presents it as
 *   documentation of something.
 *
 * Sorting is stable: `order` when present, array position otherwise, so a
 * partially ordered gallery does not scramble.
 */
export function galleryItems(project: PublicProject): MediaAsset[] {
  const items = (project.gallery ?? []).filter(
    (asset) =>
      asset.kind === 'image' &&
      asset.imageType !== undefined &&
      asset.imageType !== 'ARCHITECTURAL_PATTERN',
  )

  return items
    .map((asset, index) => ({ asset, index }))
    .sort((a, b) => {
      const ao = a.asset.order ?? Number.MAX_SAFE_INTEGER
      const bo = b.asset.order ?? Number.MAX_SAFE_INTEGER
      return ao - bo || a.index - b.index
    })
    .map((entry) => entry.asset)
}

/**
 * The hero image, or null when the pattern should stand in.
 *
 * ONLY `VERIFIED_PROJECT_PHOTO` may open a project page. An
 * `EDITORIAL_CONTEXT` photograph at hero scale, under the project's name, IS
 * the assertion that it depicts the project, whatever its caption says. The
 * caption is read second and by fewer people than the picture.
 */
export function heroPhoto(project: PublicProject): MediaAsset | null {
  const hero = project.heroImage
  if (!hero || hero.kind !== 'image') return null
  return hero.imageType === 'VERIFIED_PROJECT_PHOTO' ? hero : null
}
