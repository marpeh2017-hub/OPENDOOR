# Digital Zero Report / Feasibility Engine — Phase 0

## Status

Phase 0 establishes the bounded-context design before a schema migration. No
existing CRM, ownership, document, signature, audit, or tenant entity is
duplicated by this module.

## Confirmed platform constraints

- Canonical persistence is PostgreSQL through Prisma.
- The API is the NestJS API Gateway; calculations are server-authoritative.
- CRM and Portal are Next.js applications. The CRM calls the API through its
  same-origin BFF proxy.
- Tenant isolation is enforced by tenant-scoped service queries; feasibility
  rows therefore carry `tenantId` directly as well as `projectId` where
  applicable.
- Existing `AuditService`, `TenantScopeService`, Data Quality engine, document
  versioning, in-house signatures, and exact ownership-fraction utilities are
  mandatory reuse points.
- The report is a professional decision-support tool. It is not an automated
  statutory appraisal and must not represent itself as one.

## Existing data to consume, not copy

| Existing source | Intended use |
| --- | --- |
| Project / Complex / Building / Apartment | Existing situation, address, hierarchy, physical inventory |
| Owner / OwnerApartment | Apartment-level ownership and compensation attribution |
| Document / ResidentDocument | Sources, appendices and versioned supporting material |
| DataQualityIssue | Existing-data completeness and integrity warnings |
| AuditLog / AuditService | Financial-model and approval audit trail |
| SignaturePackage / SignatureEvidence | Formal sign-off for a generated report version |
| GIS coordinates and addresses | Future map and planning-source linkage |

## Precision and accounting policy

- All monetary values are Israeli shekels unless a value explicitly states a
  different currency.
- The default model basis is **VAT excluded**. Every applicable line still
  stores an explicit VAT treatment and rate; the engine must reject ambiguous
  VAT aggregation.
- Default cash-flow granularity is monthly; quarterly and yearly are derived
  presentation/export views, not separate sources of truth.
- Financial amounts, rates, discount factors, IRR inputs and outputs use a
  fixed-precision decimal calculation library. Existing `Fraction`/BigInt
  utilities remain the only ownership-share arithmetic.

## Feasibility permissions

Global `UserRole` values remain unchanged. The module introduces scoped
capabilities rather than new global roles:

- `feasibility.view`
- `feasibility.edit`
- `feasibility.run_calculations`
- `feasibility.manage_assumptions`
- `feasibility.approve`
- `feasibility.lock`
- `feasibility.export`
- `feasibility.sign`
- `feasibility.distribute`

Phase 1 will map these capabilities to the existing RBAC role groups without
altering their meaning across the rest of the CRM.

## Phase 1 data foundation

The first migration is deliberately limited to source and assumption layers:

1. Feasibility profile per project (deal/report type, dates, purpose and
   professional metadata).
2. A child collection of Gush/Chelka records per Project.
3. Source register and source-document references.
4. Assumption register with provenance, confidence, validity period and
   classification.
5. Area schedule line items with explicit area classification.
6. Planning-rights line items with certainty/status.

Scenarios, revenues, costs, compensation, financing, calculation snapshots and
exports follow only after this foundation is validated.

## Golden Case

The Hida 26, Jerusalem source documents are not currently in the repository.
The engine will include a Golden Case comparison facility, but no Golden Case
data or expected results may be invented. Its status remains `PENDING_SOURCE`.

## Explicit non-goals for Phase 1

- Project Health Score and Next Best Action.
- Automated appraisal conclusions.
- New GIS provider or scraped planning data.
- Duplicating CRM entities or manually copying existing apartment/owner data.

## Delivered beyond this plan

This document describes the intended STARTING POINT, and the engine has gone
well past it. Recorded here so the document is not read as a description of
what exists:

- **PDF/Excel generation** was listed above as a Phase 1 non-goal and has been
  removed from that list, because it is built and wired:
  `feasibility-pdf-export.service.ts` and `feasibility-excel-export.service.ts`,
  exposed as `POST .../reports/:reportId/export/{pdf,excel}`, reachable from the
  CRM's report-versions panel for LOCKED reports. The PDF renderer shells out to
  a local Chrome/Edge, so it needs `PDF_BROWSER_PATH` on any host where neither
  sits at a default Windows path — which includes every Linux deployment.
- **Scenarios, revenues, costs, compensation, financing, calculation snapshots
  and exports** were staged to follow "only after this foundation is validated".
  All of them exist.
- **Owner-replacement allocations** (`FeasibilityReplacementAllocation`): which
  replacement flat goes to which holding, in exact integer fractions. The engine
  reconciled these from 0cbdefb against a relation that did not exist, so the
  checks passed vacuously until the model landed.
- **A dated regulatory rules registry** (`FeasibilityRule`), which this document
  does not mention: rules resolved against the study's determining date, with
  overlap treated as an error rather than settled by recency. Its deviations
  view is surfaced read-only in the CRM's דוח אפס tab. The engine is
  deliberately NOT wired to it — reporting a deviation moves no number.

## Capability mapping — current state

The nine capabilities are mapped in `FEASIBILITY_CAPABILITIES` in
`auth/roles.constants.ts`, which is an object rather than a paragraph so the
mapping can be asserted. They are still expressed through the global role model
rather than as project-scoped grants.

| Capability | Roles |
| --- | --- |
| `view` | Admins, PROJECT_MANAGER, RESIDENT_RELATIONS_MANAGER, FIELD_AGENT, LAWYER, ARCHITECT, ENGINEER, EXTERNAL_CONSULTANT |
| `edit`, `manage_assumptions`, `run_calculations` | Admins, PROJECT_MANAGER, LAWYER, ARCHITECT, ENGINEER |
| `submit` (DRAFT → REVIEW) | same as `edit` |
| `approve` (REVIEW → APPROVED) | Admins, PROJECT_MANAGER |
| `lock` (APPROVED → LOCKED) | Admins, PROJECT_MANAGER |
| `export` | same as `edit` |
| `sign`, `distribute` | **No endpoint exists.** Mapped to `null` rather than to a plausible list |

Three things are deliberate and are argued in full at the definitions:

- **DEVELOPER_REP and MUNICIPALITY_USER hold nothing.** The report is the
  promoter's position in a negotiation the first is on the other side of, and
  the second has standing over planning rather than over a private company's
  profitability. Until this mapping they could read AND export everything,
  because `view` was `STAFF_ROLES` and export sat on `view`.
- **`export` is narrower than `view`.** A screen leaves no copy; a PDF does.
  EXTERNAL_CONSULTANT may perform the study and may not be the one to take the
  file out of the company.
- **`submit` is separated from `approve`.** All three transitions share one
  route, so its decorator holds their union and
  `FeasibilityReportVersionService.assertMayTransition` re-checks the specific
  capability against the target state. Previously the whole route required a
  manager, so the engineer who built a model could not hand it in.

`FIELD_AGENT` retaining `view` is the one open question rather than a settled
answer, and is recorded as such in the constants file.

Resource cost on `run_calculations` is not controlled by the role list: Monte
Carlo is bounded by its own measured budget guard (it refuses a run it projects
will exceed fifteen seconds) and by a per-route throttle. Narrowing roles would
not stop one authorised user issuing a hundred requests, so it is not pretended
to.
