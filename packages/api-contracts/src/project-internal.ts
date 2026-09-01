import type { IsoDate, LocalizedText } from './common'
import type {
  ProjectApproval, ProjectParty, ProjectStage, PlanningStatus,
} from './public'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE FOUR LAYERS OF A PROJECT, AND WHY THEY MUST NOT BE ONE OBJECT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A project carries four kinds of information with four different audiences,
 * and the failure this file exists to prevent is letting them share a type:
 *
 *   1. PUBLIC PROJECT CONTENT  what a visitor may read. `PublicProject`.
 *   2. INTERNAL PROJECT DATA   measured, registered and organisational detail
 *                              that is real but not for publication.
 *   3. VERIFICATION/PROVENANCE where a claim came from and who checked it.
 *   4. FEASIBILITY SCENARIOS   modelled outcomes under stated assumptions.
 *
 * If they are one object, publishing a project publishes all four. That is not
 * a hypothetical: the Tchernichovsky-Shimoni pilot arrived with a parcel area,
 * a demolition area, a unit-mix scenario and a profit figure, all in one
 * workbook, all attached to one complex. Any model that accepted them onto
 * `PublicProject` would have put a developer's margin one `publishState` flag
 * away from the public internet.
 *
 * ── THIS FILE IS TYPES ONLY, ON PURPOSE ────────────────────────────────────
 *
 * There is no data here, no constant, no function, and nothing that survives
 * compilation. It exists so the separation is written down in the language the
 * codebase is actually checked in, rather than only in a document somebody may
 * not read. A future CMS and a future API can implement these; nothing
 * implements them today.
 *
 * ── THE ONE-WAY RULE ───────────────────────────────────────────────────────
 *
 * Nothing in this file may ever be a field on `PublicProject`, and no function
 * may map one of these into it wholesale. A value moves from here into public
 * content ONE FIELD AT A TIME, by a person, through verification, and arrives
 * as a `VerifiedFact`. There is deliberately no `toPublic(internal)` helper:
 * such a function is precisely the accident this separation prevents.
 */

/* ── 3. SOURCE AND PROVENANCE ───────────────────────────────────────────── */

/**
 * What kind of thing a claim came from.
 *
 * The distinctions matter because they carry different authority. A feasibility
 * workbook proves that somebody performed a calculation; a committee decision
 * proves that a body decided something. Collapsing them into "document" loses
 * exactly the difference that governs whether a value may be published.
 */
export type ProjectSourceType =
  | 'FEASIBILITY_WORKBOOK'
  | 'APPRAISAL'
  | 'PLANNING_DOCUMENT'
  | 'COMMITTEE_DECISION'
  | 'PERMIT'
  | 'LAND_REGISTRY'
  | 'GIS_MEASUREMENT'
  | 'MEETING_RECORD'
  | 'CORRESPONDENCE'
  | 'OTHER'

/**
 * How far a source can be trusted, as a judgement someone made about the
 * document itself rather than about any single value in it.
 *
 * `REQUIRES_REVIEW` is the correct default for anything that arrives without
 * a confirmed author, date and internal consistency. It is not an insult to
 * the document; it is a statement that nobody has yet checked it.
 */
export type SourceReliability =
  | 'AUTHORITATIVE'
  | 'REQUIRES_REVIEW'
  | 'SUPERSEDED'
  | 'UNRELIABLE'

/** A defect in a source that must block automatic verification of anything
 *  drawn from it. */
export interface SourceQualityFlag {
  id: string
  note: LocalizedText
  /** Whether this alone is enough to stop a value being published. */
  blocking: boolean
}

/**
 * A document a project's claims can be traced back to.
 *
 * Deliberately carries NO file content and no storage key. A source is a
 * reference plus a judgement; the bytes live wherever the organisation keeps
 * them, under whatever access control applies there.
 */
export interface ProjectSource {
  id: string
  projectId: string
  type: ProjectSourceType
  /** As supplied. Never parsed for meaning: a filename is not evidence. */
  filename?: string
  /** Who produced it, when it is known. Absent is common and is not a gap
   *  to be filled by inference. */
  authorName?: string
  producedOn?: IsoDate
  reliability: SourceReliability
  /** Defects found on reading it. A source with a blocking flag can support
   *  no automatic verification, whatever its `reliability` says. */
  qualityFlags?: SourceQualityFlag[]
  /** Free-text record of what the source does and does not establish. */
  note?: LocalizedText
}

/* ── A CLAIM ON ITS WAY TO BEING A FACT ─────────────────────────────────── */

/**
 * How confident anyone is in a single value, as distinct from the source it
 * came from. One workbook can hold a registered parcel area worth trusting and
 * a scenario output worth nothing.
 */
export type FactConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * The audit classification a candidate value is given when it is found.
 *
 * Only `VERIFIED_SOURCE` may become a public `VerifiedFact`, and even then only
 * after a person verifies it. The other three are terminal until new evidence
 * arrives.
 */
export type FactCandidateClass =
  | 'VERIFIED_SOURCE'
  | 'SOURCE_FOUND_BUT_REQUIRES_REVIEW'
  | 'EDITORIAL_CONTEXT'
  | 'NOT_SUPPORTED'

/**
 * A value somebody found, with everything needed to decide what to do with it.
 *
 * ── WHY THE VALUE IS A STRING ──────────────────────────────────────────────
 *
 * Sources give things like "approximately N sqm", a bare count, or a rule such
 * as "greater of X sqm or Y%". Parsing those into numbers at capture time
 * throws away the qualification that is often the most important part, and
 * invites the rounding that turns a fractional model output into a published
 * apartment count. The value is recorded as it was read; conversion happens
 * when a person verifies it, deliberately.
 */
export interface ProjectFactCandidate {
  id: string
  projectId: string
  sourceId: string
  /** Which field on `PublicProject` this would eventually populate, when it
   *  corresponds to one. Absent for values with no public counterpart. */
  targetField?: string
  /** Human-readable label for what was found. */
  label: LocalizedText
  /** As read from the source, including its qualifications. Never rounded. */
  rawValue: string
  /** Sheet, cell, page, clause. Enough for the next person to find it. */
  sourceLocation?: string
  sourceDate?: IsoDate
  confidence: FactConfidence
  classification: FactCandidateClass
  /** Why it is classified as it is, and what would change it. */
  note?: LocalizedText
}

/* ── 2. INTERNAL PROJECT DATA ───────────────────────────────────────────── */

/** One address a project may cover, before anyone has confirmed the boundary. */
export interface CandidateAddress {
  id: string
  /** Street and number exactly as the source writes them. */
  address: string
  sourceId: string
  /** Registry identifiers, when the source gives them. */
  block?: string
  parcel?: string
  /** True when the source lists it but its inclusion is unconfirmed. */
  requiresReview: boolean
  note?: LocalizedText
}

/**
 * Measured and registered detail about a complex as it stands today.
 *
 * ── NOT PUBLIC, AND NOT BECAUSE IT IS SECRET ───────────────────────────────
 *
 * Much of this is a matter of public record. It is internal because it is
 * PRECISE AND UNVERIFIED: a parcel area to two decimal places, published under
 * a company's name, is read as a surveyed statement that company stands
 * behind. Until someone does stand behind it, it belongs here.
 *
 * A value graduates by being verified individually, not by this object being
 * marked public.
 */
export interface ProjectInternalData {
  projectId: string
  /** The boundary as sources describe it, before confirmation. */
  candidateAddresses?: CandidateAddress[]
  /** Areas in square metres, as measured or registered. */
  registeredParcelArea?: number
  measuredParcelArea?: number
  calculatedBuiltArea?: number
  estimatedDemolitionArea?: number
  /** Sub-parcel counts from the registry, which are not the same thing as
   *  apartments and must never be published as one. */
  residentialSubParcels?: number
  commercialSubParcels?: number
  averageApartmentArea?: number
  /** The working stage, which may be more cautious than anything published. */
  workingStage?: ProjectStage
  workingPlanningStatus?: PlanningStatus
  /** Parties known internally, before any is confirmed for publication. */
  knownParties?: ProjectParty[]
  knownApprovals?: ProjectApproval[]
  note?: LocalizedText
}

/* ── 4. FEASIBILITY SCENARIOS ───────────────────────────────────────────── */

/**
 * A modelled outcome under stated assumptions.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  A SCENARIO IS NOT A PLAN, AND ITS OUTPUTS ARE NOT ENTITLEMENTS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This is the single most dangerous category in the model, because its outputs
 * look exactly like facts. A "total units" output is arithmetic performed on
 * assumptions somebody chose; it is not a number of apartments anybody may
 * build, and rounding a fractional one to a whole "planned apartments" figure
 * converts a calculation into a planning claim in one step.
 *
 * So a scenario's outputs are structurally separated from its assumptions and
 * both are kept away from `PublicProject`. A scenario NEVER becomes a public
 * fact. If a unit count is eventually published it comes from an approved
 * plan, cited to that plan, verified by a person — not from here, however
 * confident the model was.
 *
 * ── ECONOMICS ARE NOT MODELLED HERE AT ALL ─────────────────────────────────
 *
 * Sales totals, profit, return on cost and developer margin are deliberately
 * ABSENT from this type. They belong to the CRM and the feasibility engine,
 * behind authentication, and the website's contract package has no business
 * describing their shape. Omitting them means no code that imports these
 * contracts can accidentally hold them.
 */
export interface FeasibilityScenario {
  id: string
  projectId: string
  sourceId: string
  label: LocalizedText
  /** The assumptions the scenario runs on, as the source states them. */
  assumptions?: {
    averageFloorsAboveGround?: number
    buildingCount?: number
    aboveGroundCoveragePercent?: number
    expropriationAssumed?: boolean
    /** As written, e.g. "greater of 22 sqm or 22%". Not parsed. */
    ownerConsiderationRule?: string
  }
  /** Modelled areas in square metres. */
  outputs?: {
    totalBuildingEnvelope?: number
    residentialSaleArea?: number
    commercialArea?: number
    publicUseArea?: number
    penthouseUnits?: number
    /** Fractional on purpose: the model produces fractions, and rounding one
     *  here is how it starts reading as a real apartment count. */
    ownerUnits?: number
    developerUnits?: number
    totalUnits?: number
  }
  /** Always true in practice, and stated as a field so no consumer has to
   *  infer it from the type name. */
  isModelledNotApproved: true
  note?: LocalizedText
}
