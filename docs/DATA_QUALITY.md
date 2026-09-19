# Data Quality Center

**Phase 2 — core platform capability.**
Detects, persists, tracks and reports data-quality problems across the whole
Urban Renewal OS domain. It is the foundation that Project Health Score, Next
Best Action, the management dashboard, automated workflows and readiness
analysis will later read from.

> This document describes only the Data Quality Center. Health Score and Next
> Best Action are **not** part of it — see "Consuming this later".

---

## 1. Architecture

```
HTTP  DataQualityController          ← RBAC, tenant context, filters
        │
      DataQualityService             ← queries, summaries, scoring, transitions, audit
        │
      DataQualityEngine              ← orchestration, upsert, auto-resolution
        │
      DataQualityRule[]              ← 11 independent, deterministic rules
        │
      ScanContext { prisma, tenantId, projectId?, now, index }
```

Source layout (`services/api-gateway/src/data-quality/`):

| File | Role |
| --- | --- |
| `data-quality.types.ts` | `DataQualityRule`, `DetectedIssue`, `ScanContext`, `ProjectIndex` |
| `data-quality.helpers.ts` | validators, exact fraction arithmetic, deep links, `buildProjectIndex` |
| `data-quality.engine.ts` | runs rules, upserts issues, auto-resolves, records scans |
| `data-quality.service.ts` | list/detail/summary/score/status transitions/audit |
| `data-quality.controller.ts` | REST surface |
| `rules/*.rule.ts` | one file per rule |
| `rules/index.ts` | `RULE_PROVIDERS` — the single registration point |

### The shared snapshot (`ProjectIndex`)

`buildProjectIndex()` loads the tenant's `Project → Complex → Building →
Apartment` tree **once per scan** with four batched queries and hands it to
every rule. Rules resolve `apartmentId → projectId`, building addresses and
apartment labels from memory rather than joining per row. This is the single
most important reason the engine has no N+1 access pattern.

### Adding a rule

1. Create `rules/<name>.rule.ts` implementing `DataQualityRule`.
2. Declare every `issueType` it can emit in `issueTypes` — this drives scoped
   auto-resolution, so an omission would leave stale issues open forever.
3. Add the class to `RULE_PROVIDERS` in `rules/index.ts`.

No engine, controller or migration change is required.

---

## 2. Rule engine

A rule is:

* **Deterministic** — the same data always yields the same issues.
* **Tenant-aware** — every query carries `tenantId` or is derived from the
  tenant-scoped index.
* **Independently executable** — rules do not call each other and run in
  parallel via `Promise.allSettled`, so one failing rule cannot abort a scan.
  Failures are recorded on `DataQualityScan.errors` and the rule is excluded
  from that scan's `rulesExecuted`, which in turn excludes its issue types from
  auto-resolution — a rule that crashed never silently closes issues.

### Tenant-wide rules

`DuplicateDataQualityRule` sets `tenantWide = true`. Duplicates are only
meaningful over the whole tenant, so it is **skipped during project-scoped
scans** rather than run against a partial view that would produce false
negatives and flip issues open/closed depending on the scan scope.

### Registered rules

| Rule id | Title | Primary category | Max severity | Issue types |
| --- | --- | --- | --- | --- |
| `project` | Project header consistency | CONSISTENCY | HIGH | 7 |
| `building` | Building structure | CONSISTENCY | HIGH | 6 |
| `apartment` | Apartment inventory | COMPLETENESS | HIGH | 7 |
| `owner` | Owner registry | COMPLETENESS | HIGH | 8 |
| `ownership` | Ownership shares | CONSISTENCY | CRITICAL | 3 |
| `resident` | Resident records | COMPLETENESS | CRITICAL | 7 |
| `signature` | Signature chain integrity | INTEGRITY | CRITICAL | 7 |
| `document` | Document store integrity | INTEGRITY | CRITICAL | 5 |
| `task` | Task hygiene | TIMELINESS | MEDIUM | 6 |
| `communication` | Outbound deliverability | ACCURACY | HIGH | 3 |
| `duplicate` | Duplicate detection (tenant-wide) | DUPLICATION | CRITICAL | 3 |

**11 rules, 62 issue types.** The live catalogue is available at
`GET /api/v1/data-quality/rules`.

<details>
<summary>Full issue-type list</summary>

**project** — `PROJECT_NO_STRUCTURE`, `PROJECT_UNIT_COUNT_MISMATCH`,
`PROJECT_MISSING_MANAGER`, `PROJECT_TARGET_DATE_PASSED`,
`PROJECT_INVALID_DATE_RANGE`, `PROJECT_MISSING_THRESHOLD_RULE`,
`PROJECT_SIGNED_EXCEEDS_TOTAL`

**building** — `BUILDING_NO_APARTMENTS`, `BUILDING_MISSING_ADDRESS`,
`BUILDING_UNIT_COUNT_MISMATCH`, `BUILDING_MISSING_CONSTRUCTION_YEAR`,
`BUILDING_INVALID_CONSTRUCTION_YEAR`, `BUILDING_MISSING_FLOORS`

**apartment** — `APARTMENT_NO_OWNER`, `APARTMENT_NO_RESIDENT`,
`APARTMENT_MISSING_SIZE`, `APARTMENT_MISSING_ROOMS`, `APARTMENT_MISSING_FLOOR`,
`APARTMENT_IMPLAUSIBLE_SIZE`, `APARTMENT_FLOOR_EXCEEDS_BUILDING`

**owner** — `OWNER_MISSING_NAME`, `OWNER_MISSING_PHONE`, `OWNER_MISSING_EMAIL`,
`OWNER_MISSING_NATIONAL_ID`, `OWNER_INVALID_PHONE`, `OWNER_INVALID_EMAIL`,
`OWNER_ESTATE_NO_GUARDIAN`, `OWNER_NO_HOLDINGS`

**ownership** — `OWNERSHIP_SHARE_SUM_INVALID`, `OWNERSHIP_INVALID_FRACTION`,
`OWNERSHIP_ORPHAN_APARTMENT`

**resident** — `RESIDENT_NO_CONTACT`, `RESIDENT_INVALID_PHONE`,
`RESIDENT_INVALID_EMAIL`, `RESIDENT_INVALID_OWNERSHIP_PCT`,
`RESIDENT_ORPHAN_APARTMENT`, `RESIDENT_OBJECTING_NO_REASON`,
`RESIDENT_DNC_NO_REASON`

**signature** — `SIGNATURE_ORPHAN_RECORD_OWNER`,
`SIGNATURE_ORPHAN_RECORD_APARTMENT`, `SIGNATURE_RECORD_NO_SESSION`,
`SIGNATURE_SIGNED_WITHOUT_TIMESTAMP`, `SIGNATURE_PACKAGE_NO_RECORDS`,
`SIGNATURE_PACKAGE_EXPIRED_NOT_CLOSED`, `SIGNATURE_PACKAGE_ORPHAN_PROJECT`

**document** — `DOCUMENT_MISSING_STORAGE_KEY`, `DOCUMENT_ZERO_SIZE`,
`DOCUMENT_EXPIRED_NOT_ARCHIVED`, `DOCUMENT_ORPHAN_PROJECT`,
`DOCUMENT_REVIEW_STALE`

**task** — `TASK_OVERDUE`, `TASK_NO_ASSIGNEE`, `TASK_NO_DUE_DATE`,
`TASK_COMPLETED_WITHOUT_TIMESTAMP`, `TASK_ORPHAN_PROJECT`,
`TASK_STATUS_STALE_OVERDUE`

**communication** — `MESSAGE_MISSING_RECIPIENT`, `MESSAGE_DELIVERY_FAILED`,
`MESSAGE_STUCK_IN_QUEUE`

**duplicate** — `OWNER_DUPLICATE_NATIONAL_ID`, `OWNER_DUPLICATE_PHONE`,
`RESIDENT_DUPLICATE_NATIONAL_ID`

</details>

### Ownership share arithmetic

`sumFractions()` adds shares with exact integer cross-multiplication and reduces
by GCD after every step, so `1/3 + 1/3 + 1/3` is exactly `1` — a float sum would
report a spurious `OWNERSHIP_SHARE_SUM_INVALID` on every three-heir apartment.

---

## 3. Issue model

`DataQualityIssue` (table `data_quality_issues`).

| Field | Notes |
| --- | --- |
| `tenantId`, `projectId?` | scope; `projectId` is null for tenant-wide findings |
| `entityType`, `entityId`, `entityLabel` | the affected record and its Hebrew label |
| `issueType` | stable machine key, e.g. `APARTMENT_NO_OWNER` |
| `category`, `severity`, `status` | Postgres enums |
| `title`, `description` | what is wrong |
| `impact` | **why it matters** — business consequence |
| `recommendation` | what a human should do; never applied automatically |
| `deepLink` | CRM route to the affected record |
| `metadata` | non-sensitive structured context (counts, declared vs actual) |
| `detectedAt`, `lastSeenAt`, `scanId` | detection lifecycle |
| `resolvedAt`, `resolvedById`, `resolutionNote`, `resolutionType` | `AUTO` or `MANUAL` |

### Natural key — the anti-duplication mechanism

```prisma
@@unique([tenantId, issueType, entityType, entityId])
```

One logical problem about one record is exactly one row, forever. Re-scans
UPSERT against this key, so scanning a hundred times produces a hundred
`lastSeenAt` updates and zero new rows. `createMany({ skipDuplicates: true })`
keeps that true even if two scans race.

### Indexes

`(tenantId, status)`, `(tenantId, severity)`, `(tenantId, category)`,
`(tenantId, issueType)`, `(tenantId, projectId, status)`,
`(entityType, entityId)`, `(tenantId, detectedAt)`.

### `DataQualityScan`

Records `scope` (PROJECT/TENANT/GLOBAL), `status`, `startedAt`, `completedAt`,
`durationMs`, `rulesExecuted[]`, `ruleCount`, `entitiesScanned`, `issuesFound`,
`issuesNew`, `issuesResolved`, `errors`, `triggeredById`.

---

## 4. Severity model

| Severity | Meaning | Weight |
| --- | --- | --- |
| `CRITICAL` | Legal or threshold-calculation validity is at risk | 10 |
| `HIGH` | A required business process cannot complete | 5 |
| `MEDIUM` | Degraded process; a workaround exists | 2 |
| `LOW` | Cosmetic or reporting-quality only | 1 |
| `INFO` | Informational; no penalty | 0 |

Categories: `COMPLETENESS`, `ACCURACY`, `CONSISTENCY`, `INTEGRITY`,
`DUPLICATION`, `TIMELINESS`, `COMPLIANCE`.

---

## 5. Status model

```
                 ┌──────────── scan re-detects ────────────┐
                 ▼                                          │
   (new) ──▶ OPEN ──manual──▶ IN_PROGRESS ──manual──▶ RESOLVED
              │  ▲                  │                      ▲
              │  └── manual reopen ─┴──────────────────────┘
              │
              └── manual ──▶ IGNORED   (scans never touch this state)
```

Rules the engine enforces:

* **IGNORED is sacred.** A human decision to ignore is never overwritten,
  reopened or auto-resolved by any scan.
* **Auto-resolution never deletes.** An issue that stops reproducing is set to
  `RESOLVED` with `resolutionType = 'AUTO'`, `resolvedById = null` and a
  system note. The row and its history survive.
* **Auto-resolution is scoped.** Only issue types belonging to rules that
  actually executed in that scan are eligible, and a project-scoped scan only
  considers issues carrying that `projectId`.
* **Re-detection reopens.** A `RESOLVED` issue that reproduces returns to `OPEN`
  with a fresh `detectedAt` and cleared resolution fields.

---

## 6. Scanning

One entry point serves every caller:

```ts
engine.runScan({ tenantId, scope, projectId?, triggeredById })
```

`DataQualityService.scanProject / scanTenant / scanGlobal` wrap it, and the HTTP
controller calls those. **A future scheduled background scan calls exactly the
same method** — no engine rewrite is needed; add a `@Cron` provider that calls
`scanTenant` per active tenant. No scheduler is registered today, by design.

Scan flow:

1. Create the `DataQualityScan` row with status `RUNNING`.
2. Build the `ProjectIndex` (4 queries).
3. Run applicable rules in parallel, isolating failures.
4. Persist: `createMany` for new issues, one bulk `updateMany` to refresh
   `lastSeenAt`, individual updates only for rows whose content actually
   changed.
5. Auto-resolve stale issues in one chunked `updateMany`.
6. Complete the scan row with full metadata.

---

## 7. Remediation

Every issue carries what is wrong (`title`/`description`), why it matters
(`impact`), the affected entity (`entityType`/`entityId`/`entityLabel`), a
recommended action (`recommendation`) and a `deepLink` the CRM uses to navigate
straight to the record.

**No destructive automatic fixes.** The engine never merges, deletes, reassigns
ownership or edits domain data. Every remediation is a human action taken in the
relevant CRM screen; the Data Quality Center only observes and reports.

---

## 8. Scoring

```
penalty     = Σ weight(severity) over OPEN + IN_PROGRESS issues in scope
normaliser  = max(50, 2 × recordCount)
score       = round(100 × (1 − min(1, penalty / normaliser)))
if any open CRITICAL issue → score = min(score, 79)
```

`recordCount` = apartments + residents + tasks + documents + signature records
in scope.

**Why normalise by record count?** A fixed penalty budget would drive every
large project to zero while a six-unit project stayed green with the same defect
rate. Normalising makes the score a *density* measure, comparable across
projects of very different size. The `max(50, …)` floor stops a tiny project from
being destroyed by a single finding.

**Why the CRITICAL cap?** Density alone would let a 2,000-unit project with a
broken ownership fraction present as "green". A single open CRITICAL issue caps
the score at 79 so the project can never read as healthy while its signature
threshold is mathematically invalid.

Per-project headline metrics (owners missing a phone, apartments without owners,
ownership inconsistencies, overdue tasks, total apartments) are returned
alongside the score.

---

## 9. API

Base: `/api/v1/data-quality`. All routes require a valid JWT (global
`JwtAuthGuard`) and are tenant-scoped from the token, never from a parameter.

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/rules` | STAFF |
| GET | `/summary` | STAFF |
| GET | `/projects/:projectId/summary` | STAFF |
| GET | `/issues` | STAFF |
| GET | `/issues/:id` | STAFF |
| PATCH | `/issues/:id/resolve` | MANAGER |
| PATCH | `/issues/:id/ignore` | MANAGER |
| PATCH | `/issues/:id/reopen` | MANAGER |
| PATCH | `/issues/:id/start` | MANAGER |
| POST | `/scan` (`?projectId=`) | MANAGER |
| POST | `/scan/project/:projectId` | MANAGER |
| POST | `/scan/tenant` | MANAGER |
| POST | `/scan/global` | SUPER_ADMIN |
| GET | `/scans` (`?projectId=`) | STAFF |
| GET | `/scans/:id` | STAFF |

`GET /issues` filters: `projectId`, `category`, `severity`, `status`,
`entityType`, `issueType`, `search`, `detectedFrom`, `detectedTo`; sorting via
`sort` (`severity` | `age` | `project` | `entity` | `status`) and `order`;
pagination via `skip` / `take` (max 200).

**RBAC rationale.** Reads are `STAFF_ROLES` because every operational role needs
to see the data problems blocking its own work — a field agent must know which
owners have no phone number. Mutations and scans are `MANAGER_ROLES`: closing an
issue is a governance decision and a scan is a tenant-wide compute cost. The
global scan crosses tenant boundaries and is `SUPER_ADMIN_ONLY`.

---

## 10. Security

* **Tenant isolation.** Every query carries `tenantId`; mutations use the
  codebase's two-step `findFirst({ id, tenantId })` → `update` pattern, so a
  foreign id yields `404`, never a cross-tenant write. Covered by tests.
* **No national ID exposure.** `Owner.nationalId` is AES-256-GCM encrypted with
  a **random IV**, so equal plaintexts produce different ciphertexts and a raw
  string comparison can never find duplicates. The duplicate rule therefore
  decrypts in memory and immediately reduces the value to a SHA-256 fingerprint
  (`fingerprint()` in `data-quality.helpers.ts`). The plaintext never reaches an
  issue title, description, `metadata` field, API response or log line — a test
  asserts the serialized issue payload does not contain the fixture ID.
* **No storage-key leakage.** `DOCUMENT_MISSING_STORAGE_KEY` reports the
  condition without echoing `s3Key` or `s3Bucket`.
* **No IDOR.** Issue detail and every transition are tenant-filtered.
* **No unsafe bulk updates.** Every `updateMany` is constrained by `tenantId`
  and an explicit id list, and status writes exclude `IGNORED`.
* **No destructive auto-fixes.** See §7.

---

## 11. Auditability

Every manual status change writes an `AuditLog` row on the existing shared audit
architecture — no second audit trail was introduced:

```
action:   UPDATE
entity:   'DataQualityIssue'
entityId: <issue id>
changes:  { before: { status }, after: { status } }
metadata: { issueType, severity, entityType, entityId, projectId, note }
userId, ipAddress, userAgent, createdAt
```

`GET /issues/:id` returns this history, and the CRM detail screen renders it as
a timeline. Automatic (scan-driven) resolutions are recorded on the issue row
itself (`resolutionType = 'AUTO'`, `scanId`) rather than in the audit log, which
is reserved for human actions.

---

## 12. Performance

* One shared entity snapshot per scan; rules never query per row.
* Aggregates use `groupBy`; the dashboard never loads issue rows into the API
  process.
* Writes are batched: `createMany` + one bulk `updateMany` + chunked
  auto-resolution (1,000 ids per statement).
* `CommunicationDataQualityRule` is deliberately bounded to the last **90 days**
  of messages — the only intentionally scoped query in the engine. Older
  delivery failures are not actionable and unbounded message history would
  dominate scan cost on high-volume tenants.

Measured on the dev database (2,000 apartments, 4,000 owners, 4,000 ownership
rows, 2,000 residents, 40 buildings):

| Operation | Time |
| --- | --- |
| First full tenant scan | 216 ms |
| Repeat scan (no changes) | 108 ms |
| Scan persisting 3,000 new issues | 542 ms |
| Re-scan with 3,001 issues, no changes | 245 ms |
| Tenant summary | 39 ms |
| Issue list (50 of 3,001) | 8 ms |

---

## 13. CRM UI

`apps/crm/src/app/[locale]/(dashboard)/data-quality/` — Hebrew, RTL.

* **Dashboard** (`page.tsx` → `DqDashboard`): score with a progress bar, open /
  resolved / ignored counts, breakdown by severity, by category and by project,
  last-scan metadata, and a detected-vs-resolved trend across the last 30 scans.
* **Issue list** (`DqIssuesPanel`): filters for project, severity, status,
  category, entity type, issue type and free-text search; sorting by severity,
  age, project, entity or status; pagination; loading, error and empty states;
  the "run scan" button appears only for manager roles.
* **Issue detail** (`[id]/page.tsx` → `DqIssueDetail`): what is wrong, why it
  matters, recommended action, affected record with a working deep link,
  detection dates, status controls (manager only) with an optional note, and the
  resolution history timeline.

RBAC in the UI mirrors the API via `useCanManageDq()`; the API remains the
enforcement point.

---

## 14. Consuming this later (Health Score, Next Best Action)

`DataQualityService` already exposes the two methods the existing
`HealthScoreService` uses, with unchanged signatures:

* `computeProjectScore(tenantId, projectId): Promise<number>` — 0–100, read from
  **persisted** issues (cheap, aggregate-only).
* `scanIssues(tenantId, { projectId, severity, type })` — live, non-persisted
  detection for callers that want the current picture without writing.

For Health Score, prefer `getProjectSummary()`: it returns the score, the
severity histogram and the headline metrics in one call, so a dimension can be
computed without re-running rules. For Next Best Action, `listIssues()` filtered
to `severity=CRITICAL, status=OPEN` and ordered by `severity` gives a
ready-made, deep-linked action queue.

Neither Health Score nor Next Best Action logic lives in this module.

---

## 15. Known limitations

* No scheduled/background scan is registered (deliberate — Step 4 asked only for
  the architecture to permit one).
* Duplicate detection is skipped in project-scoped scans; run a tenant scan to
  refresh duplicate findings.
* Issues with a null `projectId` (owner-level and duplicate findings) are not
  auto-resolved by project-scoped scans, only by tenant scans. They can still
  never duplicate, because of the unique natural key.
* `Owner.nationalId` is currently written as plaintext by the seed script; the
  duplicate rule handles both plaintext and `enc:v1:` values transparently.
* The SQLite mirror in `packages/db/prisma/schema.prisma` diverges from Postgres:
  `Json → String` and `String[] → String` (JSON-encoded). Postgres remains
  canonical; no SQLite migration was generated.
