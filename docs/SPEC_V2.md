# Urban Renewal OS – Specification V2 (Critical Review & Refined Spec)

**Status:** Review of Spec V1 (PRD.md, ARCHITECTURE.md, RBAC_MATRIX.md, ROADMAP.md) + refined implementation-ready specification.
**Date:** August 2026
**Reviewers' lens:** Product architecture · UX/UI · Engineering · SaaS operations

---

# PART A — REVIEW OF THE EXISTING SPECIFICATION

## A.1 What the current spec gets right

- Clear problem statement grounded in real pain (Excel + WhatsApp + fragmented tools).
- Correct core split: Marketing site / CRM / Resident portal / Mobile.
- Multi-tenant from day one, Hebrew-first RTL, OTP for residents (right call — residents will not manage passwords).
- 12-stage project lifecycle as the backbone entity model.
- Signature rate as the north-star metric — correct: the 67% threshold (רוב דרוש לפי חוק פינוי-בינוי) is *the* business event in this industry.

## A.2 Problems in the existing specification

| # | Problem | Why it matters | Severity |
|---|---|---|---|
| 1 | **Architecture is massively over-engineered for V1.** 12 microservices, RabbitMQ, Elasticsearch, ECS Fargate, OpenSearch, Amazon MQ — for a product with 1 paying tenant and a 4-month MVP window. | Each moving part is ops burden. The team already struggled to deploy *one* NestJS service. Microservices multiply that ×12. | **Critical** |
| 2 | **The spec conflates "spec" with "aspiration."** AI risk scoring, sentiment analysis, France/Spain expansion appear alongside MVP items with no acceptance criteria for any of them. | A dev team cannot tell what "done" means. Nothing in the spec has acceptance criteria, error cases, or data contracts. | **Critical** |
| 3 | **No definition of the signature legal workflow** — the single most important flow. What document types constitute a valid signature package? Who countersigns? What happens on refusal? What is the דייר סרבן (refusing resident) flow? | This is the product's core value and it's unspecified. Comsign vs DocuSign is named, but the *workflow* (who initiates, witness requirements, lawyer approval, revocation) is not. | **Critical** |
| 4 | **RBAC matrix has 13 roles but no permission *conditions*.** "CRUD (assigned)" is stated but "assigned" is never modeled — there's a `ProjectMember` table implied but the assignment/removal flow, and what happens to a PM's tasks when reassigned, is unspecified. | Permissions bugs = data leaks between projects, the #1 trust killer in multi-tenant SaaS. | High |
| 5 | **No offline story for field agents in V1** despite field signature collection being the core acquisition motion. Mobile app is Phase 3. | Field agents will keep using paper + WhatsApp for 9+ months, undermining adoption. | High |
| 6 | **Resident identity model is naive.** One resident = one apartment is implied. Reality: joint ownership (spouses), inheritance disputes (multiple heirs, עיזבון), renters vs owners, protected tenants (דייר מוגן), owners abroad, power of attorney. | Signature validity depends on getting ownership right. This is a legal-domain modeling problem, not a CRUD problem. | **Critical** |
| 7 | **No data validation spec.** Israeli ID (ת"ז) checksum, Israeli phone formats, גוש/חלקה (block/parcel) validation, address normalization — none specified. | Garbage data in = wrong legal documents out. | High |
| 8 | **Notifications listed as a feature, not designed.** No preference model, no quiet hours, no per-channel opt-out, no Hebrew/Arabic template management, no delivery-failure handling. | WhatsApp template rejection / SMS DND will silently break the core communication loop. | High |
| 9 | **No error/edge-case section anywhere.** | Every screen needs empty/loading/error states; every integration needs failure behavior. | Medium |
| 10 | **Success metrics unmeasurable as written.** "+15% signature rate vs baseline" — no baseline capture mechanism specified. | Can't prove ROI to tenant #2 and #3. | Medium |
| 11 | **Compliance hand-waved.** "GDPR ready" — but the operative law is the Israeli Privacy Protection Law (תיקון 13, in force Aug 2025) which mandates DPO appointment, breach notification, and data minimization for exactly this kind of PII database. | Legal exposure; also a sales blocker with municipalities. | High |
| 12 | **Search strategy wrong for V1.** Elasticsearch for multilingual search when Postgres FTS + `pg_trgm` handles Hebrew adequately at this scale. | Another cluster to operate for negligible gain under 1M rows. | Medium |
| 13 | **No backup/restore, RPO/RTO targets, or data-export commitments** (tenant offboarding). | "Can I get my data out?" is a procurement question you must answer. | High |
| 14 | **Voting system listed with zero spec** despite being legally sensitive (אסיפת דיירים decisions have formal quorum/majority rules). | Either spec it properly or cut it. | Medium |

## A.3 Missing requirements (not in V1 at all)

Each item: what / why / who / essential-for-V1?

1. **Owner–Apartment many-to-many with share fractions (חלקים)** — ownership registry mirroring Tabu (טאבו) extract: multiple owners per apartment, fractional shares, lien/mortgage flags. *Why:* signature validity is computed over ownership shares, not resident count. *Who:* lawyers, PMs. **V1: essential.**
2. **Signature-threshold engine** — per-project configurable majority rules (67% פינוי-בינוי, 66% תמ"א 38/2, per-building AND per-complex thresholds), computed live from signed shares. *Why:* this number drives every decision. **V1: essential.**
3. **Objector/refuser management (דיירים סרבנים)** — status, objection reasons taxonomy, escalation trail, legal-action tracking. *Why:* the last 10% of signatures is where projects live or die. **V1: essential (basic), V2 (legal escalation).**
4. **Document generation** — merge templates (Word/PDF) with resident+apartment data to produce personalized legal docs at scale. *Why:* manual doc prep is a top time sink; signature flow needs it upstream. **V1: essential (basic mail-merge), V2 (visual template editor).**
5. **Interaction log / CRM timeline per resident** — every call, visit, WhatsApp, meeting in one feed with outcomes. Partially modeled (`ResidentActivity`) but not specified as the primary PM workspace. **V1: essential.**
6. **Consent & communication-preference registry** — per-resident channel consent, timestamped, exportable. *Why:* חוק הספאם (Amendment 40) + Privacy Law. **V1: essential (minimal).**
7. **Field-agent PWA** (not native app) with offline queue — visit forms, photo capture, signature capture on tablet, sync-on-reconnect. *Why:* moves the core motion online in V1 without app-store investment. **V1: strongly recommended; native apps stay Phase 3.**
8. **Tenant onboarding & billing** — plan limits, seat counting, usage metering, invoicing (even manual). *Why:* you plan 3 tenants in 4 months but have no way to onboard or bill them. **V1: minimal (manual billing, self-serve onboarding checklist).**
9. **Data import** — Excel import wizard with validation preview + rollback for residents/apartments. *Why:* every new tenant arrives with Excel; without import, onboarding takes weeks. **V1: essential.**
10. **Rate-limited public API + webhooks** — outbound webhooks on core events (signature.signed, stage.changed). *Why:* tenants have accountants/lawyers with their own systems. **V2.**
11. **Impersonation with consent banner + audit** for support. **V2.**
12. **Feature flags + kill switches** per tenant. **V1: trivial to add now, painful later.**
13. **Backup/restore runbook** — PITR enabled, quarterly restore drill, RPO ≤ 1h, RTO ≤ 4h. **V1: essential.**
14. **Observability** — structured logs, error tracking (Sentry), uptime monitoring, slow-query log review. **V1: essential (Sentry + basic).**

---

# PART B — REFINED SPECIFICATION

## B.1 Product vision (refined)

> **The operating system for resident-consent real-estate projects.** Urban Renewal OS turns the messy, multi-year process of convincing, signing, and keeping hundreds of apartment owners informed into a managed pipeline — with the signature threshold as the living heartbeat of every project. One source of truth for the company; radical transparency for the resident.

Key sharpening vs V1: the product is not "a CRM + portal." It is a **consent pipeline**. Every module exists to move ownership-share percentage toward threshold and keep it there.

## B.2 Module hierarchy

```
Urban Renewal OS
├── 1. Identity & Access        (auth, MFA, OTP, RBAC, tenant mgmt)
├── 2. Projects                 (lifecycle 12 stages, complexes, buildings, apartments)
├── 3. Ownership Registry       (owners, shares, tabu sync, encumbrances)   ← NEW
├── 4. Residents & Consent      (profiles, timeline, statuses, objections, consents)
├── 5. Signatures               (packages, threshold engine, digital signing, witness flow)
├── 6. Documents                (storage, versioning, categories, generation/mail-merge)
├── 7. Communications           (WhatsApp/SMS/Email, templates, campaigns, preferences)
├── 8. Tasks & Meetings         (assignment, SLAs, meeting notes, follow-ups)
├── 9. Leads & Intake           (marketing site forms, pipeline, conversion to project)
├── 10. Resident Portal         (status, docs, messages, tickets; OTP login)
├── 11. Field Operations        (PWA: visits, offline forms, photo/signature capture)  ← NEW
├── 12. Dashboards & Reports    (KPIs, exports, per-project drilldowns)
├── 13. Automations             (trigger→condition→action rules; visual builder in V2)
├── 14. Admin & Platform        (tenant settings, imports, feature flags, audit, billing)
└── 15. AI Layer (V2+)          (summaries, chatbot, risk scoring)
```

## B.3 Roles & permissions (refined)

Keep the 13 roles but add the missing semantics:

- **Assignment model:** `ProjectMember(userId, projectId, roleOverride?)`. "Assigned" = row exists. Removing a member triggers a task-reassignment wizard (block removal while open tasks exist, or bulk-reassign).
- **Permission conditions,** expressed as policy predicates evaluated server-side (CASL or equivalent):
  - `own`: `resource.createdById == user.id`
  - `assigned`: `ProjectMember` exists for resource's project
  - `tenant`: same `tenantId` (always ANDed)
- **Two-person rule** for destructive ops: deleting a project or bulk-deleting residents requires COMPANY_ADMIN + typed confirmation; soft-delete with 30-day recovery window.
- **Field-level permissions:** resident ID number (ת"ז) and bank details visible only to LAWYER, PM, COMPANY_ADMIN; masked elsewhere (`***-**-123`).
- **Resident portal scope:** resident sees own apartment(s) via `OwnerApartment` join — supports multi-apartment owners.

## B.4 Core workflows (end-to-end)

### W1 — Project intake → active signature campaign
1. Lead (from website/referral) → qualification → feasibility check (גוש/חלקה lookup, unit count) → project created in DISCOVERY.
2. Import wizard: Excel of apartments+owners → validation report (ID checksums, duplicate detection, share fractions must sum to 1.0 per apartment) → commit or fix.
3. PM assigns team (ProjectMember). Stage → RESIDENT_ORGANIZING. Threshold rules configured (default 67%).
4. Kickoff: bulk intro message (WhatsApp template, pre-approved) + portal invitations (OTP links).

### W2 — Signature collection (the core loop)
1. Lawyer uploads/approves the signature package (contract + POA + disclosures) → versioned, locked.
2. Per apartment: system computes required signers from ownership shares.
3. Channels: (a) digital — resident receives signed link → Comsign flow → certificate stored; (b) field — agent schedules visit, captures wet signature photo + geotag + witness details in PWA; lawyer later validates.
4. Every signature event recomputes project/building threshold; dashboard + automations fire (e.g., at 50%: "halfway" campaign; at 67%: legal-milestone tasks auto-created).
5. Refusal path: status → OBJECTOR with reason taxonomy (financial / emotional / legal / absentee / dispute); auto-creates follow-up cadence; escalation to lawyer after N attempts.

### W3 — Resident lifecycle on the portal
Invite (SMS link) → OTP login → onboarding (confirm details, choose language+channel preferences, consent capture) → ongoing: timeline of project stage, personal document vault, sign requests, messages, support tickets.

### W4 — Stage advancement
PM advances stage → required-artifact checklist enforced (e.g., can't enter PERMITS without signed threshold reached + protocol docs) → stage history recorded (who/when/notes) → notifications to team + optional resident broadcast.

### W5 — Tenant onboarding (SaaS)
Create tenant → admin invite → branding (logo/colors) → import projects/residents → template pack cloned (message + document templates in Hebrew) → go-live checklist → success criteria review at 30 days.

## B.5 Database entities (delta from current Prisma schema)

Existing schema is solid on Project/Complex/Building/Apartment/Resident/Lead/Task/AuditLog. Required changes:

```
Owner            (id, tenantId, fullName, israeliId [encrypted], phone, email,
                  addressAbroad?, isEstate bool, guardianContact?)
OwnerApartment   (ownerId, apartmentId, shareNumerator, shareDenominator,
                  acquiredAt?, viaInheritance bool, poaHolderId?)   ← replaces naive 1:1
SignaturePackage (id, projectId, version, status: DRAFT|APPROVED|LOCKED, approvedById, docIds[])
SignatureRecord  (id, packageId, ownerId, apartmentId, method: DIGITAL|WET,
                  status: PENDING|SIGNED|REFUSED|REVOKED, signedAt, evidenceDocId,
                  witnessName?, geo?, validatedById?)
ThresholdRule    (projectId, scope: PROJECT|BUILDING, requiredPct, basis: SHARES|UNITS)
Consent          (residentId, channel, granted bool, timestamp, source)
Objection        (residentId, reason enum, notes, escalationLevel, resolvedAt?)
CommunicationPreference (residentId, language, channelPriority[], quietHours)
ImportBatch      (tenantId, type, fileRef, status, errorReport JSON, committedAt?)
FeatureFlag      (tenantId?, key, enabled, config JSON)
WebhookEndpoint  (tenantId, url, secret, events[])            ← V2
```

Notes: `israeliId` encrypted at rest (app-level AES-GCM, key in Secrets Manager); all money as integer agorot; all timestamps UTC with tenant-timezone rendering.

## B.6 Screens (main) & key components

**CRM** (sidebar: Dashboard / Projects / Residents / Signatures / Leads / Tasks / Communications / Reports / Automations / Settings)

| Screen | Key components |
|---|---|
| Dashboard | KPI tiles (signed %, active projects, overdue tasks, unanswered messages), per-project threshold progress bars, activity feed, "needs attention" queue |
| Project detail | Header w/ stage stepper (12 stages), threshold gauge (shares-based), tabs: Overview / Buildings & Apartments / Residents / Signatures / Documents / Timeline / Team / Settings |
| Apartment drawer | Owners + shares table, signature status per owner, docs, notes |
| Resident profile | Identity card, ownership list, consent panel, interaction timeline (calls/visits/messages unified), objection panel, quick actions (call, WhatsApp, task, schedule visit) |
| Signatures board | Filterable matrix: building × apartment × owner × status; bulk send; refusal heatmap |
| Leads Kanban | Existing — add conversion-to-project action |
| Communications | Template manager (per language, WhatsApp approval status), campaign composer with audience builder + preview-as-resident, delivery report |
| Import wizard | Upload → column mapping → validation report (errors downloadable) → dry-run summary → commit |
| Reports | Signature velocity (weekly), funnel per project, agent activity, exportable XLSX/PDF |

**Portal** (bottom-nav mobile: Home / Documents / Messages / Profile): stage timeline with plain-language explanations per language, sign-request cards with big CTA, document vault, ticket thread.

**Shared UX standards:** every table = server-side pagination + column sort + saved filters + bulk-select bar; every destructive action = typed-confirm modal; empty states with single primary CTA; skeleton loading; error boundary with retry + support code; toasts for success; breadcrumbs on all nested pages; RTL-first layouts mirrored properly (icons, chevrons, steppers); WCAG AA (focus rings, 4.5:1 contrast, full keyboard nav); Hebrew numerals/dates via `Intl` with he-IL.

## B.7 Automations (V1 rule engine — no visual builder yet)

Trigger → optional condition → action, stored as JSON rules, executed by a worker (BullMQ):

Essential V1 rules (shipped as templates):
1. Signature signed → notify PM + recompute threshold + if crossed milestone (25/50/67%) → create celebration broadcast draft.
2. Resident status → OBJECTOR → create follow-up task (48h) for RR manager.
3. Task overdue 24h → escalate to assignee's manager.
4. New lead → assign round-robin + first-touch task (SLA 4 business hours).
5. Document uploaded to signature package → notify lawyer for approval.
6. Resident inactive 30d post-invite → re-invite via alternate channel.
7. Stage changed → resident broadcast draft (PM approves before send — no fully-automatic resident messaging in V1).

## B.8 Notifications

- **Channels:** in-app (bell + feed), email, SMS, WhatsApp, push (PWA).
- **Preference matrix** per user & per resident: event-category × channel, with sane defaults; quiet hours 21:00–08:00 for resident-facing sends (enforced, queue-delayed).
- **Delivery pipeline:** outbox table → worker → provider → delivery receipt webhook → status on message record; failure → fallback channel (WhatsApp→SMS) once, then surface in "undelivered" report.
- **Digest:** daily email digest for internal users instead of per-event spam (default on).

## B.9 Integrations

| Integration | Purpose | Phase |
|---|---|---|
| Comsign | Qualified digital signature (Israeli legal standard) | V1 |
| WhatsApp Business Cloud API | Resident messaging (template-approved) | V1 |
| SMS (InfoRU / Twilio fallback) | OTP + notifications | V1 |
| Email (SES/Resend) | Internal notifications, digests | V1 |
| Google Maps | Address geocoding, project map | V1 (light) |
| AWS Textract / OCR | Document data extraction | V2 |
| Tabu/נסח טאבו providers (e.g., API of justice ministry via vendors) | Ownership verification | V2 |
| Accounting (iCount/Greeninvoice) | Tenant billing | V2 |
| Municipality APIs | Permit status | V3 |

## B.10 Security requirements (concrete)

- AuthN: Argon2id password hashing (replace SHA-256 **before production**), JWT access 15m + rotating refresh 30d (DB-stored, revocable), MFA (TOTP) mandatory for COMPANY_ADMIN+.
- OTP: 6 digits, 5-min TTL, max 5 attempts, per-phone rate limit 3/hour, no user enumeration.
- Tenant isolation: Prisma client extension injecting `tenantId` on every query (defense in depth over per-service discipline) + integration tests asserting cross-tenant denial.
- PII: field-level encryption for ת"ז + bank details; masked in logs; access logged.
- Transport/headers: TLS 1.3, HSTS, CSP, helmet defaults.
- Audit: append-only audit log for all mutations incl. actor, before/after diff, IP; 7-year retention (legal docs domain).
- Compliance track: Israeli Privacy Protection Law Amendment 13 — appoint DPO, maintain records of processing, breach-notification runbook (72h), data-minimization review; GDPR alignment as by-product.
- Backups: Postgres PITR, daily snapshot 30-day retention, quarterly restore drill; tenant data export (JSON+files ZIP) on demand.
- AppSec: dependency scanning (Renovate + audit), secrets in env manager only, annual external pentest before tenant #4.

## B.11 Reporting & analytics

V1 reports (server-rendered + XLSX export): signature progress & velocity per project; ownership coverage gaps (unreachable owners); agent field activity; communication delivery rates; task SLA compliance; portal adoption. Baseline capture: on project import, record starting signed % — enables the "+15%" claim. V2: BI embed (Metabase self-hosted) + cohort dashboards.

## B.12 Recommended V1 scope (MVP cut — 4 months, honest)

**In:** Modules 1,2,3,4,5(core),6(storage+mail-merge basic),7(WhatsApp+SMS+email, templates, no campaigns UI—bulk send only),8,10,12(basic),14(import, flags, audit). Field PWA with online-first + basic offline queue.
**Out of V1 (explicitly):** visual automation builder (rules-as-config only), AI features, GIS beyond a map pin, voting, ticketing (portal messages suffice), campaigns manager, Elasticsearch, mobile native apps, municipality access, multi-language beyond he+ru (add ar+en in V2), microservices (see B.13).

**V2 (months 5–9):** visual automation builder, campaigns, ticketing, OCR, AI meeting summaries, Arabic+English, webhooks/API, Metabase BI, tabu integration, billing automation.
**V3 (10–16):** native apps, AI chatbot + risk scoring, voting (properly specced with quorum rules), municipality portal, international.

## B.13 Technical architecture (right-sized)

**Recommendation: modular monolith now, service extraction later.** Compare:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| 12 microservices (V1 spec) | Team-scale independence | 12× deploy/ops surface, distributed debugging, the team currently struggles to ship 1 service | ❌ Reject for now |
| Modular monolith (NestJS modules, single deploy) + 1 worker | One pipeline, transactions across modules, trivial local dev; NestJS modules already map to future services | Requires discipline on module boundaries | ✅ **Adopt** |

**Stack:** Next.js 15 apps (crm/portal/web) on Vercel · NestJS API (single service) + BullMQ worker on Railway/Render · PostgreSQL (managed, PITR) · Redis (queues, OTP, cache) · S3-compatible storage (Cloudflare R2) · Prisma **pinned v6** · Postgres FTS for search · Sentry + provider metrics + UptimeRobot · GitHub Actions CI (lint, typecheck, test, migrate-deploy gate). Background jobs: outbox pattern for all external sends. Events: in-process event emitter now; the exchange/routing-key design from V1 becomes the BullMQ topic naming — preserved conceptually, deferred physically. AWS/ECS/Terraform: defer until tenant #5 or compliance forces it.

---

# PART C — IMPLEMENTATION GUIDANCE (post-spec)

Order of work from the current codebase state:
1. **Security debt:** Argon2id, refresh-token rotation, Prisma tenant-guard extension, PII field encryption.
2. **Ownership model migration** (Owner/OwnerApartment/shares) + threshold engine + recompute job — this reshapes Residents/Signatures UIs.
3. **Import wizard** (unblocks real data).
4. **Signature package flow** (lawyer approve → send → track → evidence).
5. **Communication outbox + templates + preferences/consent.**
6. **Field PWA** (visit form, signature/photo capture, offline queue).
7. **Reports + baseline capture.**
8. Then V2 backlog.

Definition of done per feature: acceptance criteria written first; empty/loading/error states; RTL + he/ru strings; audit log entries; permission tests including cross-tenant denial; seed data updated.
