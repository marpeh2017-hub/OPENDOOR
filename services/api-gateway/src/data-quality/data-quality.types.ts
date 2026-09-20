import type {
  DataQualityCategory,
  DataQualityEntityType,
  DataQualitySeverity,
} from '@prisma/client'
import type { PrismaService } from '../prisma.service'

export type { DataQualityCategory, DataQualityEntityType, DataQualitySeverity }

/** Backwards-compatible aliases used by the pre-existing HealthScoreService. */
export type IssueSeverity = DataQualitySeverity
export type IssueType = string

// ─── Scan context ───────────────────────────────────────────────────────────

export interface ProjectRef {
  id: string
  name: string
  code: string
  status: string
  stage: string
  totalUnits: number
  signedUnits: number
  signatureGoal: number
  projectManagerId: string | null
  startDate: Date | null
  targetEndDate: Date | null
}

export interface BuildingRef {
  id: string
  address: string
  complexId: string
  projectId: string
  floors: number | null
  totalApartments: number | null
  constructionYear: number | null
}

export interface ApartmentRef {
  id: string
  apartmentNumber: string
  buildingId: string
  projectId: string
  floor: number | null
  sizeSqm: number | null
  rooms: number | null
  /** Human-readable Hebrew label, e.g. `דירה 4, הרצל 45` */
  label: string
}

/**
 * A snapshot of the tenant's project → complex → building → apartment tree,
 * loaded ONCE per scan with four batched queries and shared by every rule.
 * This is what keeps the engine free of N+1 access patterns.
 */
export interface ProjectIndex {
  projects: Map<string, ProjectRef>
  buildings: Map<string, BuildingRef>
  apartments: Map<string, ApartmentRef>
  complexToProject: Map<string, string>
  projectIds: string[]
  buildingIds: string[]
  apartmentIds: string[]
  /** apartmentId -> resident count */
  entityCount: number
}

export interface ScanContext {
  prisma: PrismaService
  tenantId: string
  /** When set, the scan is limited to a single project. */
  projectId?: string
  now: Date
  index: ProjectIndex
}

// ─── Rules ──────────────────────────────────────────────────────────────────

/**
 * A single detected problem, as produced by a rule. Purely in-memory —
 * the engine is responsible for persisting it as a `DataQualityIssue`.
 *
 * SECURITY: `description`, `title` and `metadata` must never contain a national
 * ID, OTP, token, storage key or any other secret. Rules that reason over such
 * values must reduce them to a non-reversible fingerprint first.
 */
export interface DetectedIssue {
  issueType: string
  category: DataQualityCategory
  severity: DataQualitySeverity
  entityType: DataQualityEntityType
  entityId: string
  entityLabel: string
  projectId: string | null
  title: string
  description: string
  /** Why it matters — business impact. */
  impact: string
  /** Recommended remediation. Never applied automatically. */
  recommendation: string
  /** CRM deep link to the affected record. */
  deepLink: string
  metadata?: Record<string, unknown>
}

export interface DataQualityRule {
  /** Stable identifier, e.g. `owner`. Recorded in `DataQualityScan.rulesExecuted`. */
  readonly id: string
  readonly title: string
  readonly category: DataQualityCategory
  /** The highest severity this rule can emit — used for the rule catalogue. */
  readonly severity: DataQualitySeverity
  /** Every issueType this rule can emit. Drives scoped auto-resolution. */
  readonly issueTypes: readonly string[]
  /**
   * When true the rule reasons across the whole tenant (e.g. duplicate
   * detection) and is therefore SKIPPED during single-project scans, because a
   * project-limited view would produce false negatives and unstable results.
   */
  readonly tenantWide?: boolean
  run(ctx: ScanContext): Promise<DetectedIssue[]>
}

// ─── Legacy-compatible issue shape (consumed by HealthScoreService) ─────────

export interface DataQualityIssueView {
  type: string
  severity: DataQualitySeverity
  category: DataQualityCategory
  entityType: DataQualityEntityType
  entityId: string
  entityLabel: string
  projectId: string | null
  title: string
  description: string
  impact: string
  recommendation: string
  /** Legacy alias for `deepLink`. */
  fixUrl: string
  deepLink: string
}
