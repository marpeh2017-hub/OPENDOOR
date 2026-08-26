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
- PDF/Excel generation.
- Automated appraisal conclusions.
- New GIS provider or scraped planning data.
- Duplicating CRM entities or manually copying existing apartment/owner data.
