# Urban Renewal OS — System Specification Document

**Version:** 2.0 · **Date:** August 2026 · **Status:** Authoritative — single source of truth
**Owner:** OpenDoor התחדשות עירונית · **Supersedes:** PRD.md v1, SPEC_V2.md (review draft)

> Conventions used in this document:
> **[RA]** = Recommended Addition (not in original requirements, added for production-grade completeness).
> **[OQ-n]** = Open Question, resolved in §28.
> "Owner" = legal owner of an apartment; "Resident" = CRM contact profile (may or may not be an owner).

---

## 1. Executive Summary

| | |
|---|---|
| **Product name** | Urban Renewal OS |
| **Vision** | The operating system for resident-consent real-estate projects: turn the multi-year process of convincing, signing, and informing hundreds of apartment owners into a managed, measurable pipeline. |
| **Purpose** | Replace Excel sheets, personal WhatsApp, and paper folders with one platform that manages the full urban-renewal lifecycle — lead → resident organizing → signatures → permits → construction → delivery. |
| **Business objectives** | 1) Centralize operations. 2) Increase signature rate (+15% vs captured baseline). 3) Radical resident transparency. 4) Automate repetitive communication/tasks. 5) Multi-tenant SaaS scale. 6) Reduce time-to-close per stage. |
| **Target users** | Internal: urban-renewal company staff (13 roles). External: apartment owners/residents, municipality reviewers, external consultants. |
| **Problems solved** | Scattered data, lost communication history, manual document handling, no live signature % visibility, low resident trust, no KPIs. |
| **Key value proposition** | The signature threshold (67% מפתח) is computed live from **ownership shares** and drives every dashboard, automation, and decision. One source of truth for the company; self-service transparency for the resident. |

## 2. Product Overview

**What the system does:** Manages urban-renewal projects (פינוי-בינוי, תמ"א 38) end-to-end: project hierarchy (Project → Complex → Building → Apartment), an ownership registry with fractional shares, resident CRM with a unified interaction timeline, legal signature packages with digital + wet-signature flows, a live threshold engine, multi-channel communications (WhatsApp/SMS/email), tasks/meetings, documents, dashboards, and a resident portal with OTP login.

**Core capabilities:** project lifecycle (12 stages, gated); ownership & consent tracking; signature collection & validation; document vault + mail-merge generation; communications with consent management; task/SLA management; Excel import; reporting; audit; multi-tenancy.

**Main use cases:** UC1 signature campaign management · UC2 resident onboarding to portal · UC3 field visit + wet signature capture · UC4 lawyer package approval · UC5 stage advancement with checklist · UC6 tenant onboarding with data import · UC7 executive KPI review.

**System boundaries — included:** everything above, V1 scope per §24.
**Excluded:** accounting/bookkeeping (integration only), construction-site management (Gantt/BOQ), payroll, tenant-company marketing automation, brokerage/listing features, legal case management beyond objection tracking.

## 3. User Roles & Permissions

Thirteen roles (unchanged from RBAC_MATRIX.md) with the following **added semantics**:

| Role | Responsibility | Access level |
|---|---|---|
| SUPER_ADMIN | Platform operator | All tenants; impersonation with consent banner + audit **[RA]** |
| COMPANY_ADMIN | Tenant owner | Full tenant CRUD; user mgmt; settings; billing |
| CEO | Executive oversight | Read-all + reports; no destructive ops |
| PROJECT_MANAGER | Runs assigned projects | CRUD on assigned projects (via ProjectMember) |
| RESIDENT_RELATIONS_MANAGER | Consent pipeline | Residents, communications, signatures CRUD |
| FIELD_AGENT | Field visits | Mobile/PWA scope: visits, wet-signature capture, resident read/update |
| LAWYER | Legal validity | Signature package approve/lock; wet-signature validation; legal docs CRUD |
| ARCHITECT / ENGINEER | Technical docs | Docs CRUD in own category; project read |
| DEVELOPER_REP / EXTERNAL_CONSULTANT / MUNICIPALITY_USER | External viewers | Read-only, explicit project allowlist |
| RESIDENT | Portal self-service | Own apartment(s) only via OwnerApartment join |

**RBAC mechanics:**
- Assignment = `ProjectMember(userId, projectId)`. Removal blocked while open tasks exist (or bulk-reassign wizard).
- Policy predicates evaluated server-side: `tenant` (always) ∧ (`own` | `assigned` | role grant).
- **Field-level security [RA]:** `nationalId`, bank details visible only to LAWYER / PM / COMPANY_ADMIN; masked elsewhere.
- **Two-person rule [RA]:** project delete & bulk resident delete require COMPANY_ADMIN + typed confirmation; soft-delete, 30-day recovery.
- Full CRUD matrix: see RBAC_MATRIX.md (kept as annex; conditions above override where conflicting).

## 4. System Modules

Hierarchy (15 modules). Format per module: Purpose / Users / Features / Screens / Actions / Data / Permissions / Dependencies / Automations.

### 4.1 Identity & Access
Purpose: authn/authz, tenants. Users: all. Features: email+password login (scrypt), TOTP MFA (mandatory COMPANY_ADMIN+), SMS OTP for residents, JWT 15m access + rotating 30d refresh (DB-stored, revocable), session list & revoke. Screens: Login, MFA setup, OTP flow, Sessions. Data: User, Session, Tenant. Dependencies: SMS provider. Automations: lockout after 5 failures (15 min), session-revoke on password change.

### 4.2 Projects
Purpose: lifecycle backbone. Users: PM, admin, viewers. Features: 12-stage stepper with **gated advancement** (required-artifact checklist per stage), Complex/Building/Apartment hierarchy, team assignment, stage history. Screens: Projects list, Project detail (tabs: Overview/Buildings/Residents/Signatures/Documents/Timeline/Team/Settings), New Project wizard. Actions: create, advance/revert stage (with reason), assign team. Data: Project, Complex, Building, Apartment, ProjectMember, ProjectStageHistory. Automations: stage-change → notifications + broadcast draft.

### 4.3 Ownership Registry **[RA — core]**
Purpose: legal source of truth for who must sign. Users: PM, lawyer, admin. Features: owners with fractional shares per apartment (numerator/denominator), multi-apartment owners, estates (עיזבון), POA holders, owners abroad; share-sum validation (must equal 1 per apartment; warning badge otherwise). Screens: Apartment drawer (owners table), Owner profile. Data: Owner, OwnerApartment. Dependencies: Import module. Automations: share-sum ≠ 1 → data-quality task.

### 4.4 Residents & Consent
Purpose: CRM for humans in the project. Features: profile, unified interaction timeline (calls/visits/messages/meetings), signature status, objection management (reason taxonomy: financial/emotional/legal/absentee/dispute; escalation levels), consent registry per channel (timestamped, source-attributed), communication preferences (language, channel priority, quiet hours). Screens: Residents list, Resident profile. Data: Resident, ResidentActivity, Objection, Consent, CommunicationPreference. Automations: OBJECTOR status → follow-up task 48h; inactive 30d → re-invite.

### 4.5 Signatures
Purpose: the core loop. Features: SignaturePackage (versioned doc bundle; DRAFT→APPROVED→LOCKED by lawyer), per-owner SignatureRecord (DIGITAL via Comsign / WET via field capture with witness+geo, lawyer validation), refusal/revocation flow, **Threshold Engine**: live % per project & building, basis SHARES or UNITS, configurable required % (default 67). Screens: Signatures board (building × apartment × owner matrix), Package manager, Threshold gauge (embedded in dashboards). Data: SignaturePackage, SignatureRecord, ThresholdRule. Dependencies: Ownership, Documents, Comsign. Automations: signed → recompute + milestone events (25/50/67%); refused → objection record.

### 4.6 Documents
Purpose: vault + generation. Features: upload (drag-drop, 25MB, allowlist: pdf/docx/xlsx/jpg/png), categories, versioning (immutable versions, latest pointer), per-role permissions, expiry dates with reminders **[RA]**, mail-merge generation from templates (resident+apartment placeholders) **[RA]**. Screens: Documents tab, Template manager (V1: upload DOCX with placeholders). Data: Document, DocumentVersion, ResidentDocument. Automations: upload to package → lawyer notification; expiry-30d → task.

### 4.7 Communications
Purpose: all resident/staff messaging. Features: WhatsApp Business Cloud (approved templates), SMS (InfoRU, Twilio fallback), email (SES); template manager per language incl. approval status; bulk send with audience builder + preview-as-resident; **outbox pattern** (queue → provider → delivery receipt → status); consent + quiet-hours enforcement (21:00–08:00 queue-delay); fallback WhatsApp→SMS once; undelivered report. Data: Message, MessageTemplate, Campaign (V2). Automations: §10.

### 4.8 Tasks & Meetings
Features: tasks with assignee/due/priority/SLA, meeting scheduling with attendees + outcomes, overdue escalation. Data: Task, Meeting, MeetingAttendee. Automations: overdue 24h → manager escalation.

### 4.9 Leads & Intake
Features: website form capture, pipeline Kanban, round-robin assignment, first-touch SLA (4 business hours), conversion → project. Data: Lead, LeadActivity.

### 4.10 Resident Portal
Features: SMS-link invite → OTP login → onboarding (confirm details, language, consents) → stage timeline in plain language, personal document vault, sign-request cards, message thread. Mobile-first, he/ru (V1), ar/en (V2). Data: reuses core entities via portal-scoped API.

### 4.11 Field Operations (PWA) **[RA]**
Features: visit checklist form, photo + wet-signature capture (canvas), geotag, offline queue with sync-on-reconnect (IndexedDB), conflict rule: server wins, agent notified. Users: FIELD_AGENT. Dependencies: Signatures, Residents.

### 4.12 Dashboards & Reports — §7, §14.

### 4.13 Automations — rules engine, §10.

### 4.14 Admin & Platform
Features: tenant settings (branding, locales), user management, **Excel import wizard** (upload → column map → validation report → dry-run → commit; ImportBatch with rollback) **[RA]**, feature flags per tenant **[RA]**, audit log viewer, data export (JSON+files ZIP) **[RA]**, manual billing record (V1).

### 4.15 AI Layer (V2+) — §16.

## 5. User Journeys & Workflows

### W1 — Tenant onboarding (SaaS)
Start: signed contract. User: SUPER_ADMIN + COMPANY_ADMIN. Steps: create tenant → admin invite email → branding setup → template pack cloned (he) → Excel import (apartments+owners+residents) → validation report → fix/commit → go-live checklist → 30-day success review. Exceptions: import validation failures (downloadable error file, nothing committed); duplicate tenant slug (blocked).

### W2 — Project intake → active campaign
Trigger: qualified lead or direct creation. Steps: create project (DISCOVERY) → hierarchy setup (import or manual) → threshold rules configured (default 67% SHARES) → team assigned → stage RESIDENT_ORGANIZING → kickoff broadcast (PM-approved) + portal invites. System: baseline signed % captured at import **[RA — enables ROI metric]**. End: campaign live. Edge: missing ownership data → apartments flagged, count as unsigned.

### W3 — Signature collection (core loop)
Trigger: lawyer approves package (DRAFT→APPROVED; LOCKED on first send). Per owner-apartment share, records created PENDING. Digital: send link → Comsign → webhook → SIGNED + certificate stored. Field: agent visit → wet capture (photo/witness/geo) → status PENDING_VALIDATION → lawyer validates → SIGNED. Every SIGNED → threshold recompute → milestone automations. Refusal: REFUSED + Objection(reason) → follow-up cadence → escalation to lawyer after 3 attempts. Exceptions: expired link (re-issue), owner deceased (estate flow: mark isEstate, block signature until heirs registered — **[OQ-3]**), revocation window (**[OQ-4]**).

### W4 — Resident portal lifecycle
Invite SMS → OTP (6-digit, 5min TTL, 5 attempts, 3/hour per phone) → onboarding → ongoing use. Exceptions: phone mismatch → support ticket path; OTP provider down → fallback provider; no smartphone → field agent proxy flow (agent shows info, resident signs paper).

### W5 — Stage advancement
PM clicks advance → checklist evaluated (e.g., PERMITS requires threshold reached + protocol doc) → if unmet, blocking dialog lists missing artifacts → if met, stage saved + history row + team notification + optional resident broadcast draft. Revert requires reason (audited).

### W6 — Field visit
Agent opens PWA day-list → navigates to visit → completes form (met/not-met, outcome, next step) → optional signature capture → offline-safe save → sync. Exception: sync conflict → server wins, agent sees diff notice.

## 6. Screen-by-Screen Specification

Global standards applying to **every** screen: RTL-first; skeleton loading; error boundary with retry + support code; toasts on success; server-side pagination (25/page default); typed-confirm modal for destructive actions; breadcrumbs on nested pages; WCAG AA; responsive (≥1280 full layout, 768–1279 collapsed sidebar, <768 mobile stack).

| # | Screen | Path | Users | Key components & behavior |
|---|---|---|---|---|
| S1 | Login | /login | staff | Email+password, MFA step, error: generic "wrong credentials" (no enumeration) |
| S2 | Dashboard | /dashboard | staff | §7 |
| S3 | Projects list | /projects | staff | Table: name, city, stage chip, threshold mini-bar, units, PM; filters: stage/city/PM; search; New Project. Empty: "צור פרויקט ראשון" CTA |
| S4 | Project detail | /projects/:id | assigned | Header: stage stepper + threshold gauge; 8 tabs (§4.2). Advance-stage button gated per W5 |
| S5 | New Project wizard | /projects/new | PM+ | 4 steps: details → hierarchy (manual/import) → threshold rules → team. Validation per step; draft saved between steps |
| S6 | Apartment drawer | (overlay) | assigned | Owners+shares table (sum badge), signature status per owner, docs, notes. Inline add-owner with share fraction inputs (validate denominator>0, sum≤1) |
| S7 | Residents list | /residents | staff | Table + filters (project, status, objection, consent); bulk bar: send message, assign task, export |
| S8 | Resident profile | /residents/:id | staff | Identity card (masked ID), holdings, consent panel, unified timeline (infinite scroll), objection panel, quick actions (call/WhatsApp/task/visit) |
| S9 | Signatures board | /signatures | PM, RR, lawyer | Matrix building×apartment×owner; status chips; filters; bulk send; refusal heatmap toggle; package selector |
| S10 | Package manager | /signatures/packages | lawyer, PM | Package list w/ version+status; detail: doc list, approve (lawyer only), lock indicator; append-only after LOCKED |
| S11 | Leads Kanban | /leads | sales roles | Existing board + convert-to-project action |
| S12 | Tasks | /tasks | staff | My/team views, due chips, overdue filter default-pinned |
| S13 | Communications | /communications | RR, PM | Template manager (language tabs, WhatsApp approval badge), bulk composer (audience builder → preview-as-resident → schedule/send), delivery report |
| S14 | Import wizard | /admin/import | admin, PM | Upload → column mapping (auto-detect Hebrew headers) → validation report table (row, field, error) + downloadable errors → dry-run summary ("יווצרו: 120 דירות, 214 בעלים") → commit. All-or-nothing per batch |
| S15 | Reports | /reports | CEO, admin, PM | §14 |
| S16 | Admin settings | /admin/* | admin | Users, branding, flags, audit viewer, export |
| P1 | Portal home | portal:/ | resident | Stage timeline (plain language), threshold NOT shown (**[OQ-5]** — recommended: show project-level % only after PM opt-in) |
| P2 | Portal documents | portal:/documents | resident | Personal vault + shared project docs |
| P3 | Portal sign | portal:/sign/:id | resident | Package summary, doc preview, big CTA → Comsign redirect; status after |
| P4 | Portal messages | portal:/messages | resident | Thread with company; attachments |
| F1 | PWA day list | pwa:/ | agent | Today's visits, map links, offline badge |
| F2 | PWA visit form | pwa:/visit/:id | agent | Checklist, outcome, photo capture, signature canvas, save-offline indicator |

## 7. Dashboard Specification

**Main dashboard (role-aware):**
- KPI tiles: total signed % (portfolio), active projects, overdue tasks, undelivered messages, open objections.
- Per-project threshold progress bars (target line at required %), click → project.
- "Needs attention" queue: share-sum errors, expired docs, stalled residents (no touch 21d), failed sends.
- Activity feed (last 50, filterable by project).
- Upcoming tasks/meetings (7 days).
- Charts (dataviz standards): signature velocity line (weekly, per project), leads funnel, task SLA compliance bar.
- Filters: project, date range, team member. Drill-down: every number links to its filtered list view.
- Role variants: CEO sees portfolio + trends only (no task minutiae); FIELD_AGENT sees day list; LAWYER sees pending validations + packages.
- Alerts strip: threshold milestone reached, integration failures (admin only).

## 8. Database Specification

Authoritative schema = `packages/db/prisma/schema.postgres.prisma`. Entity inventory & rules (audit fields `createdAt`/`updatedAt` on all; `tenantId` on all tenant-scoped tables; cuid PKs; soft-delete via status where noted):

| Entity | Purpose | Key fields (type, required, validation) | Relations / constraints |
|---|---|---|---|
| Tenant | SaaS customer | name (str, req), slug (unique), settings (json) | 1—N all |
| User | Staff account | email (unique/tenant, email format), passwordHash (scrypt), role (enum 13), isActive, mfaSecret? | N—1 Tenant; sessions |
| Session | Refresh tokens | userId, tokenHash, expiresAt, revokedAt? | index (userId) |
| Project | Lifecycle root | code (unique/tenant), name req, city req, stage (enum 12), status, signatureGoal (int, default 67), totalUnits/signedUnits (derived cache) | 1—N Complex, ProjectMember, StageHistory |
| Complex/Building/Apartment | Hierarchy | apartmentNumber unique per building; floor/sizeSqm/rooms optional; gush/helka **[RA]** on Building (str, validated format) | cascade delete down |
| **Owner** | Legal person | fullName req; nationalId? (encrypted, ת"ז checksum validated); isEstate; residentId? unique | N—M Apartment via OwnerApartment |
| **OwnerApartment** | Share row | shareNumerator/Denominator (int >0); unique (ownerId, apartmentId) | per-apartment sum ≤ 1 (app-enforced, warning if ≠1) |
| Resident | CRM profile | names req; phone (IL format E.164); language; signatureStatus enum; doNotContact | N—1 Apartment; timeline children |
| **Consent** [RA] | Channel consent | residentId, channel enum, granted bool, source, timestamp | append-only |
| **Objection** [RA] | Refusal tracking | reason enum(5), escalationLevel int, resolvedAt? | N—1 Resident |
| **SignaturePackage** | Doc bundle | version int, status DRAFT/APPROVED/LOCKED, documentIds json, approvedById | 1—N SignatureRecord; immutable after LOCKED |
| **SignatureRecord** | Per-owner-apartment | method DIGITAL/WET, status PENDING/SIGNED/REFUSED/REVOKED, evidenceDocId, witnessName?, geo?, validatedById? | unique (packageId, ownerId, apartmentId) |
| **ThresholdRule** | Majority config | scope PROJECT/BUILDING, requiredPct float (0–100], basis SHARES/UNITS | unique (projectId, scope, buildingId) |
| Document / DocumentVersion | Vault | category enum, fileName, fileSize ≤ 25MB, mime allowlist, expiresAt? | versions immutable |
| Message / MessageTemplate | Comms | channel, status (QUEUED/SENT/DELIVERED/FAILED), templateId, language | outbox indexes (status, scheduledAt) |
| Task / Meeting | Ops | dueAt, priority, assigneeId | escalation fields |
| Lead | Intake | source, stage, assignedTo | convertedProjectId? |
| ImportBatch [RA] | Import audit | type, fileRef, status, errorReport json, committedAt? | rollback = delete children by batchId |
| FeatureFlag [RA] | Config | key, tenantId?, enabled, config json | unique (tenantId, key) |
| AuditLog | Audit | actorId, action, entity, entityId, before/after json, ip | append-only, 7y retention |

**ERD (core):** Tenant ⟶ Project ⟶ Complex ⟶ Building ⟶ Apartment ⟵ OwnerApartment ⟶ Owner; Apartment ⟵ Resident; SignaturePackage ⟶ SignatureRecord ⟵ Owner; Project ⟵ ThresholdRule; Resident ⟵ {Consent, Objection, Activity, Message}.

## 9. Business Rules

1. **Threshold computation:** signedPct = Σ(signed share fractions per apartment, capped 1.0) / apartment count × 100 (basis SHARES); basis UNITS counts apartment only when all shares signed. No ownership rows → apartment counts fully unsigned. Recompute on every SignatureRecord transition; cached on Project (signedUnits), never trusted for legal display (always recomputed for the gauge).
2. **Stage gates:** PERMITS requires project-scope threshold reached + protocol document present. Reverts require typed reason. Full gate table maintained in code as config **[OQ-6]**.
3. **Status transitions:** SignatureRecord PENDING→SIGNED|REFUSED; SIGNED→REVOKED (lawyer only, reason req); REFUSED→PENDING (re-engage). Package DRAFT→APPROVED (lawyer)→LOCKED (first send); LOCKED is terminal except new version (copies docs, increments version).
4. **Validation:** Israeli ID checksum (biometric algorithm); phone normalized to E.164 (+972); share denominators > 0; share sum warning ≠ 1, hard error > 1; gush/helka numeric formats.
5. **Consent rule:** no resident-facing send without granted consent for that channel; quiet hours 21:00–08:00 delay queue; חוק הספאם compliance — every marketing-class message carries opt-out.
6. **Approval rules:** package approval = LAWYER only; wet signature validation = LAWYER only; broadcast to residents = PM approval required (no fully automatic resident messaging in V1).
7. **Calculation:** money in agorot (int); dates UTC stored, Asia/Jerusalem rendered.
8. **Exception handling:** integration failure → outbox retry ×3 exponential → mark FAILED → surface in undelivered report + admin alert.

## 10. Automations (V1 rule set — config-as-JSON, BullMQ worker)

| # | Trigger | Condition | Action | Recipient | Timing | On failure | Log |
|---|---|---|---|---|---|---|---|
| A1 | signature.signed | — | recompute threshold; notify PM | PM | immediate | retry ×3 | AuditLog + job log |
| A2 | threshold.milestone (25/50/67) | first crossing | create broadcast draft + celebration task | PM | immediate | retry | yes |
| A3 | resident.status=OBJECTOR | — | follow-up task | RR manager | +48h | retry | yes |
| A4 | task.overdue | 24h past due | escalation notification | assignee's manager | daily 08:00 | skip+log | yes |
| A5 | lead.created | — | round-robin assign + first-touch task (SLA 4bh) | assignee | immediate | fallback: unassigned queue | yes |
| A6 | document.uploaded to package | package DRAFT | notify lawyer | lawyer | immediate | retry | yes |
| A7 | resident.invited & no login | 30 days | re-invite via alternate channel | resident | once | respect consent | yes |
| A8 | project.stage.changed | — | team notification + resident broadcast **draft** | team, PM | immediate | retry | yes |
| A9 | document.expiresAt | −30d | renewal task | doc owner | daily 08:00 | skip+log | yes |

All automations idempotent (dedupe key = trigger+entity+rule), failures visible in admin log viewer.

## 11. Notifications & Communication

Channels: in-app (bell + feed, mark-read), email (SES — internal digests, portal fallback), SMS (OTP + critical), WhatsApp (resident default, approved templates only), PWA push (agents, V1-optional).
**Preference matrix:** per user & per resident: event-category × channel toggle; defaults: staff = in-app+daily email digest; residents = WhatsApp→SMS fallback. Quiet hours enforced for resident sends.
**Templates:** per language (he/ru V1), versioned, variables validated against schema before save; WhatsApp templates track Meta approval status; test-send to self.
**Trigger conditions:** every automation in §10 + manual sends. Delivery statuses tracked per message; digest batches internal notifications (default on).

## 12. Document Management

Types (category enum): contract, POA, tabu extract, protocol, permit, plan, correspondence, id-copy, other.
Upload: drag-drop, ≤25MB, mime allowlist, virus scan **[RA — V1: extension+magic-byte check; V2: ClamAV]**. Download: signed URLs (15-min expiry).
Versioning: immutable versions, latest pointer, "restore as new version."
Permissions: per-category role map (legal docs → lawyer/PM/admin; resident sees only own + published project docs).
Digital signatures: Comsign qualified signature; certificate + signed PDF stored as evidence version; wet signatures stored as photo evidence + validation record.
Status: DRAFT/FINAL/ARCHIVED; history = version list + audit entries; expiration dates with A9 reminders.

## 13. Search, Filters & Data Management

Global search (topbar, Ctrl+K): residents, owners, projects, apartments by name/phone/ID-last-4/address — Postgres FTS + pg_trgm (Hebrew-adequate at this scale; Elasticsearch deferred).
Module filters: enumerated per screen (§6); **saved filters** per user; sort on all table columns (server-side).
Bulk actions: residents (message, task, export, tag), signatures (send), tasks (reassign). Bulk bar shows count + undo where possible.
Export: filtered views → XLSX/CSV; full tenant export → ZIP (admin).
Import: §4.14 wizard; batches auditable + rollback-able.
Pagination: cursor-based, 25 default, 100 max.

## 14. Reports & Analytics

Standard V1 reports (server-rendered + XLSX): signature progress & weekly velocity per project; ownership coverage gaps (apartments with share-sum≠1, unreachable owners); field-agent activity; communication delivery; task SLA; portal adoption; **baseline vs current signed %** (ROI proof).
Filters: project, date range, team. Role-based: CEO portfolio pack; PM per-project pack; municipality user: none (screens only).
Custom reports: V2 (Metabase embed). KPI definitions documented in code and referenced by dashboards (single definition source).

## 15. Integrations

| Service | Purpose | Data exchanged | Auth | Webhooks | Errors/fallback | Rate limits |
|---|---|---|---|---|---|---|
| Comsign | Qualified digital signature | package docs out; signed PDF + cert in | API key (vault) | signing status | retry ×3 → manual task | vendor limit, queue |
| WhatsApp Business Cloud | Resident messaging | template messages; delivery receipts | Meta token | delivery/read | fallback SMS once | 80 msg/s cap, queue-paced |
| InfoRU (SMS) | OTP + notifications | message; DLR | API key | DLR | fallback Twilio | provider limit |
| SES/Resend | Email | transactional | IAM/key | bounce/complaint | suppress-list on bounce | 14/s default |
| Google Maps | Geocoding, map pins | address→latlng | API key | — | cache results; degrade to text | budget alert |
| Comsign/Textract OCR, Tabu vendor, iCount | V2 | — | — | — | — | — |

All outbound calls via outbox worker; secrets in platform secret store; every integration has a feature-flag kill switch **[RA]**.

## 16. AI Features (V2+; none in V1)

| Feature | User | Input | Processing | Output | Human approval | Privacy |
|---|---|---|---|---|---|---|
| Meeting summary | PM/RR | meeting audio/notes | Claude summarization | summary + action items → tasks draft | PM approves tasks | no resident PII to model beyond names; DPA with provider |
| Resident chatbot (portal) | Resident | question + project context | RAG over published project docs only | answer with sources | escalate-to-human button | answers only from published docs |
| Signature-likelihood scoring | RR | interaction history | classification | priority ranking | advisory only — never auto-messages | explainable factors shown |
| Message draft assist | RR | context + intent | generation | draft in resident's language | always human-sent | template-constrained |

Failure handling: AI unavailable → feature hidden, no degradation of core flows.

## 17. Security

- **AuthN:** scrypt (N=2^15) password hashing with transparent upgrade-on-login from legacy; password policy ≥10 chars + breach-list check **[RA]**; TOTP MFA mandatory COMPANY_ADMIN+, optional others; OTP per §5-W4 limits.
- **AuthZ:** RBAC per §3; server-side policy checks on every route; portal scoped by OwnerApartment.
- **Sessions:** access JWT 15m; refresh 30d rotating, hashed in DB, revocable; logout-all.
- **Encryption:** TLS 1.3; at-rest by provider; field-level AES-256-GCM for nationalId + bank fields, key in secret store, rotation runbook.
- **API security:** rate limiting (existing throttler), helmet headers, CSP, input validation (class-validator, whitelist+forbidNonWhitelisted), no user enumeration.
- **Files:** signed URLs, mime+magic-byte validation, per-role access.
- **Audit:** §22. **Backup/recovery:** Postgres PITR, daily snapshots 30d, quarterly restore drill, RPO ≤1h, RTO ≤4h.
- **Privacy compliance:** Israeli Privacy Protection Law incl. Amendment 13 — DPO appointed, records of processing, 72h breach-notification runbook, data-minimization review, resident data-subject requests (export/correct) via support flow; GDPR-aligned.
- **Monitoring:** Sentry alerts, failed-login spike alert, admin notification on integration failures; annual external pentest before tenant #4.

## 18. Technical Architecture

**Decision: modular monolith** (NestJS modules = future service seams), not the 12-microservice design of V1 — one deploy, transactions across modules, matches team capacity. Extraction trigger: sustained load or team ≥3 backend devs per domain.

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 App Router ×3 (crm/portal/web) on Vercel; React Query; next-intl RTL |
| Backend | NestJS single API service + BullMQ worker process, on Railway/Render (Docker) |
| DB | Managed PostgreSQL, PITR; Prisma **pinned v6**; SQLite for local dev |
| Cache/queues | Redis (BullMQ, OTP, rate-limit) |
| Files | Cloudflare R2 (S3 API) + signed URLs |
| Search | Postgres FTS + pg_trgm |
| Background | outbox pattern for all external sends; scheduled jobs (cron via BullMQ repeatables) |
| Monitoring | Sentry (FE+BE), UptimeRobot, provider metrics, slow-query log review monthly |
| Logging | structured JSON (pino), request-id correlation, no PII in logs |
| CI/CD | GitHub Actions: lint → typecheck → unit → integration (Docker PG) → migrate-deploy gate → deploy; preview deploys per PR (Vercel) |
| Environments | local (SQLite) → staging (full stack, seeded) → production |

## 19. UX/UI Design System

Principles: Hebrew-first RTL; calm-professional (OpenDoor brand tokens in packages/design-system); density medium; one primary action per screen.
Navigation: CRM = right-side collapsible sidebar (RTL) + topbar (search, bell, avatar); Portal = bottom nav mobile / top nav desktop.
Typography: brand font stack, 14px base, scale 12/14/16/20/24/32.
Components (ShadCN-based): buttons (primary/secondary/ghost/destructive; loading state built-in), forms (label-above, inline validation on blur, error text below field, RTL-correct number inputs), tables (sticky header, sortable, row hover, selection column), modals (max 560px, typed-confirm for destructive), drawers for detail-in-context, toasts (sonner, bottom-left in RTL), status chips (stage/signature/consent color-coded with icons — never color-only), progress/threshold gauge (target line marker), timeline component, empty states (icon + one CTA), skeletons per layout.
Accessibility: WCAG AA — contrast ≥4.5:1, visible focus rings, full keyboard nav, aria labels, form errors announced; icons mirrored correctly in RTL (chevrons, steppers).
Responsive: breakpoints per §6 global standards; tables collapse to cards <768px.

## 20. Performance & Scalability

Targets: API P95 <200ms (reads) / <500ms (writes); page LCP <2.5s; search <1s; threshold recompute <2s for 1,000-apartment project.
Scale assumptions: Y1 = 10 tenants, 200 projects, 50k residents, 200 concurrent staff; data growth ~5GB/y + files.
Strategy: proper indexes (defined in schema), cursor pagination, React Query caching, Redis caching for dashboard aggregates (60s TTL), N+1 audits, file offload to R2+CDN. Vertical scaling first; worker horizontal-scales independently; DB read replica when read P95 breaches target.

## 21. Error Handling & Edge Cases

| Scenario | System response |
|---|---|
| Comsign down | outbox retry ×3 → record stays PENDING, task to PM, admin alert |
| WhatsApp template rejected by Meta | template flagged, sends blocked to that template, fallback SMS |
| SMS OTP not delivered | resend (max 3/hour), fallback provider, support path |
| Import file malformed / partial errors | nothing committed; downloadable error report |
| Share sum >1 | hard block on save with explanation |
| Owner deceased mid-campaign | isEstate flag; signature blocked until heirs registered [OQ-3] |
| Two agents edit same resident offline | server wins; agent shown diff notice |
| JWT expired mid-form | silent refresh; on failure, modal preserving form state |
| Payment/billing lapse of tenant | read-only mode, banner, no data deletion [RA] |
| DB connection loss | health check degrades, platform restarts, alert |
| Bulk send to >500 recipients | queue-paced, progress indicator, cancel button |

## 22. Audit & Activity Tracking

AuditLog on every mutation: actorId (user/system), action verb, entity type+id, before/after JSON diff (PII-masked in diff), timestamp UTC, IP + user-agent (staff actions), tenantId. Append-only; 7-year retention; admin viewer with filters (actor/entity/date); export CSV. Additionally: login events (success/fail), permission-denied events, impersonation sessions, data exports.

## 23. Admin & System Management

User CRUD + role assignment + deactivate (never hard-delete); role matrix viewer; tenant settings (branding, default language, timezone, quiet hours); template management; integration credentials (masked, test-connection button); logs viewer (audit + automation runs + failed messages); feature flags per tenant; import/export; billing records (manual V1).

## 24. MVP / V1 Scope

**Must-have:** Identity & Access (incl. scrypt, MFA for admins), Projects (12 stages, gates), Ownership Registry + Threshold Engine, Residents & Consent (timeline, objections), Signatures (packages, digital via Comsign, wet capture + validation), Documents (vault, versions, basic mail-merge), Communications (WhatsApp/SMS/email, templates, bulk send, outbox, consent/quiet-hours), Tasks, Leads, Portal (he/ru), Import wizard, Dashboard + 6 standard reports + baseline capture, Audit, Feature flags, Backups/PITR, Sentry.
**Should-have:** Field PWA with offline queue; document expiry reminders; saved filters.
**Nice-to-have:** PWA push; refusal heatmap; daily digest customization.
**Out of scope V1 (explicit):** visual automation builder (JSON rules only), all AI, GIS beyond map pin, voting, ticketing module (portal messages suffice), campaigns manager, Elasticsearch, native mobile apps, municipality portal, ar/en locales, billing automation, webhooks/public API, microservices.

## 25. Future Roadmap

**V2 (months 5–9):** visual automation builder (rule engine already underneath); campaigns; ticketing; OCR (Textract); AI meeting summaries + message assist; Arabic+English; public API + webhooks; Metabase BI; Tabu integration; billing automation; ClamAV. *Postponed because each depends on V1 data volume/feedback and none blocks the core consent pipeline.*
**V3 (10–16):** native apps (offline depth beyond PWA), AI chatbot + scoring, voting with quorum rules (needs legal spec), municipality portal, multi-country, SOC2.

## 26. Development Requirements

Coding: TypeScript strict everywhere; ESLint+Prettier enforced in CI; conventional commits; feature branches + PR review.
Architecture: module boundaries = NestJS modules; no cross-module DB writes (call the module's service); DTO validation at every boundary; outbox for all external side effects.
Testing: unit (services, threshold engine golden cases incl. fractions/estates), integration (API + real PG in CI), permission tests asserting cross-tenant denial per endpoint, E2E happy paths (Playwright: login, create project, import, sign flow); coverage gate 70% V1 → 80%.
Security: no secrets in repo; dependency scanning (Renovate); §17 items are release-blocking.
Documentation: OpenAPI (Swagger already wired) kept accurate; ADRs for architecture decisions; runbooks (deploy, restore, breach).
Deployment: migrations via `prisma migrate deploy` gate before app start; blue-green or health-checked rollout; rollback = previous image + migration policy (expand-contract only — no destructive migrations in same release as code).
Maintenance: monthly dependency + slow-query review; quarterly restore drill + security review.

## 27. Acceptance Criteria (per module, measurable)

- **Auth:** login <1s; 5 failed logins locks 15min; legacy hash upgraded on first login (DB shows $scrypt$); MFA enforced for admin roles; OTP limits per spec verified by test.
- **Projects:** cannot enter PERMITS without threshold+protocol (blocking dialog lists items); stage history complete for every transition.
- **Ownership:** import of 3 owners × fractional shares sums correctly; share-sum >1 blocked; apartment with no owners shows flagged and counts unsigned.
- **Threshold:** golden test set passes — e.g., 10 apartments, one with 2 owners ½+½ where one signed → project 5.0% (SHARES) / 0 units (UNITS at that apartment); milestone automation fires exactly once per crossing.
- **Signatures:** digital flow round-trips Comsign sandbox → record SIGNED with evidence doc; wet flow requires lawyer validation before counting; LOCKED package rejects doc changes.
- **Communications:** consent-off resident receives nothing (test); quiet-hours message delivered next morning; failed WhatsApp falls back to SMS exactly once; delivery report matches provider receipts.
- **Import:** file with 10% bad rows commits nothing and yields row-level error report; valid file of 500 apartments commits <60s.
- **Portal:** OTP login on mid-range Android <3s LCP; resident sees only own apartment data (cross-access test).
- **Audit:** every mutating endpoint produces an audit row (automated test sweep).
- **Reports:** baseline % captured at import and immutable; velocity report matches manual computation on seed data.

## 28. Open Questions & Decisions

| # | Question | Recommendation | Status |
|---|---|---|---|
| OQ-1 | Signature legal flow details: witness requirements per document type, countersigning order | Workshop with company lawyer; encode as package-type config | **Business decision needed** |
| OQ-2 | Which majority rules per project type (67% פינוי-בינוי vs תמ"א variants), per-building AND/OR project | Default 67% SHARES project-scope; configurable per project; confirm with counsel | Needs confirmation |
| OQ-3 | Estate (עיזבון) handling: who may sign before probate | Block signature; allow POA-holder flow only with lawyer override (audited) | **Legal decision needed** |
| OQ-4 | Signature revocation window and legal effect | Model as REVOKED status with reason; legal effect out of system scope | Needs confirmation |
| OQ-5 | Show live threshold % to residents in portal? | Show only after PM opt-in per project (social-proof vs pressure trade-off) | Product decision |
| OQ-6 | Exact artifact checklist per stage gate | Draft from OpenDoor's current practice; config table, not code | Business input needed |
| OQ-7 | SMS provider contract (InfoRU vs Twilio primary) | InfoRU primary (IL rates), Twilio fallback | Procurement |
| OQ-8 | Data residency requirement (IL region hosting) | Prefer EU/IL regions; confirm municipal procurement requirements | Needs confirmation |
| **Assumptions** | Tenant companies operate Israeli projects only in V1; residents have mobile phones (fallback: agent proxy flow); Comsign sandbox available for dev | | |
| **Risks** | WhatsApp template approval lead-time (mitigate: submit early); ownership data quality from Excel (mitigate: validation + flagged states); single-developer bus factor (mitigate: docs + CI discipline); legal misconfiguration of thresholds (mitigate: lawyer sign-off screen per project) | | |

---
*End of specification. Changes to this document require a PR reviewed by product owner; version history via git.*
