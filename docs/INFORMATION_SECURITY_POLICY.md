# Information Security Policy — Urban Renewal OS

**Status:** DRAFT — not approved, not audit-ready
**Effective date:** not yet in force
**Owner:** Michael Rosenbach
**Review cycle:** quarterly
**Last verified against the codebase:** 2026-09-22

---

## How to read this document

Every control below is marked with its evidence status. This is the whole point
of the document: an audit-readiness claim that turns out to be aspirational is
worse than no claim, because an auditor who finds one stops believing the rest.

| Mark | Meaning |
|---|---|
| **[VERIFIED]** | Read in the source, or observed on a running system, on the date above. The evidence is named. |
| **[PARTIAL]** | Real, but narrower than it sounds. The limit is stated. |
| **[PLANNED]** | Does not exist yet. Written here so the gap is visible, not to imply coverage. |
| **[DECISION]** | Needs a human answer before it can be either. |

Nothing in this document should be presented to a board or an auditor while it
still carries **[PLANNED]** or **[DECISION]** marks in the section being relied on.

---

## 1. Purpose and scope

Urban Renewal OS is a multi-tenant platform for pinuy-binuy and TAMA 38
projects in Israel. It processes personal data of residents and apartment
owners, including national identity numbers, phone numbers, signatures and
project correspondence.

**Scope:** the API gateway, the CRM, the resident portal, the marketing site,
the PostgreSQL database, object storage, and every third party that processes
customer data on our behalf.

---

## 2. Which law actually applies

**[DECISION] — this is the most important open question in this document.**

The draft this replaces was written around GDPR. GDPR binds us only where we
process data of people in the EU. Our residents are in Israel, our projects are
Israeli, and our clients are Israeli municipalities and developers.

The regime that applies by default is:

- **חוק הגנת הפרטיות, התשמ"א-1981** (Privacy Protection Law)
- **תקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017** (Data Security Regulations)
- Supervision by **הרשות להגנת הפרטיות** (Privacy Protection Authority)

The 2017 regulations are not a lighter GDPR. They impose their own duties —
a database registration obligation, a defined security level per database, a
mandatory security document, annual access reviews, and breach notification to
the Authority — and several have no GDPR equivalent. A GDPR-shaped policy does
not discharge them.

**Required before this section can be finalised:**

1. Do we process data of anyone in the EU? If yes, both regimes apply.
2. Which security level do our databases fall under (בסיסית / בינונית / גבוהה)?
   This determines most of the concrete obligations and is not optional.
3. Are our databases registered with the Authority where registration is required?

Until these are answered, this policy covers Israeli law in outline only, and
the GDPR material has been removed rather than left in as decoration.

---

## 3. Controls, with evidence

### 3.1 Tenant isolation

**[VERIFIED]** Every query is scoped by `tenantId`, which is taken from the
validated JWT and never accepted from the client. Enforcement is centralised in
`TenantScopeService`. Cross-tenant reads return 404 rather than 403, so the
response cannot confirm that a record exists in another tenant.

*Evidence:* `services/api-gateway/src/common/tenant/tenant-scope.service.ts`;
`DomainError.notFound` used for the cross-tenant case; e2e coverage for tenant
isolation on the feasibility rules registry.

### 3.2 Authentication and sessions

**[VERIFIED]** Residents authenticate with a six-digit OTP. The code is
generated with `crypto.randomInt`, stored as an HMAC-SHA256 peppered from
`JWT_SECRET` rather than in clear, has a five-minute TTL, and is destroyed
after five failed attempts. Issuance is rate-limited per phone number. Sessions
are JWTs carrying a `sessionId`; a token without one is rejected, and logout
revokes the session in Redis so it is immediately dead.

**[PARTIAL]** OTP delivery is SMS via Vonage. The policy draft said "SMS/
WhatsApp" — WhatsApp is Meta Cloud API and permits only pre-approved template
messages for business-initiated conversations, so it is not a working second
channel today.

### 3.3 Encryption

**[VERIFIED — at rest]** National identity numbers are encrypted with
AES-256-GCM using a random IV per record. Production start-up fails if the key
is absent. Lookup uses a SHA-256 fingerprint computed over ciphertext, so the
plaintext is never indexed.

**[PLANNED — in transit]** There is no TLS. No certificate has been issued, no
hosting target has been chosen, and every app currently serves plain HTTP on
localhost. The HSTS headers shipped on 2026-09-22 are correct and inert: a
browser ignores HSTS delivered over HTTP.

**Any claim that data is encrypted in transit is false as of this date.**

### 3.4 Security headers

**[VERIFIED]** The API sends Helmet's defaults plus `X-Frame-Options: DENY` and
a `Permissions-Policy`. All four Next apps send HSTS, `nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`, on pages
and on API route handlers alike. Verified by inspecting live responses.

**[PLANNED]** No Content-Security-Policy on the Next apps. A naive
`default-src 'self'` blanks a Next app; a correct one needs a per-request nonce
threaded through middleware.

### 3.5 Webhook integrity

**[VERIFIED]** Inbound signature webhooks are HMAC-verified and fail closed.
Replay is rejected outside a freshness window.

**[PARTIAL]** The window is **±5 minutes**. The earlier draft said "6-second
replay window (±3 min freshness)", which is both wrong and internally
inconsistent — an auditor reading two different numbers in one row will
reasonably ask what else was not checked.

**[PLANNED]** Webhook-initiated changes do not reach the audit log, because
`AuditActor` can only represent a human user. Tracked as R7.

### 3.6 Input handling

**[VERIFIED]** All database access goes through Prisma with parameterised
queries; there is no string-concatenated SQL and no GraphQL surface. A global
`ValidationPipe` runs with `whitelist` and `forbidNonWhitelisted`, so
unexpected fields are rejected rather than ignored.

### 3.7 Egress control

**[VERIFIED]** Outbound webhook targets are checked against an allowlist, with
private and loopback ranges blocked *before* the allowlist is consulted.
`validateAllowlistConfiguration()` refuses to start if an internal address is
configured.

### 3.8 Audit trail

**[PARTIAL]** Data mutations by human users are recorded with actor, entity,
before/after diff and timestamp, and PII is redacted by substring match before
the row is written. Two limits: webhook and integration activity is not
captured (3.5), and the log is append-only by convention rather than enforced
by a database constraint.

**[DECISION]** Retention period. The draft asserted 90 days for audit logs and
90 days after account closure for customer data. Neither has been decided, and
both interact with the Israeli retention duties in §2 and with the 24-month
retention already published in the website privacy policy. The published figure
is the one currently binding on us.

### 3.9 Dependency management

**[VERIFIED]** As of 2026-09-22: **0 critical**, 35 high. The highs are all in
the development and build toolchain and are not shipped to production. Two
unauthenticated RCEs in Next.js and five DoS advisories in multer were closed
the same day.

**[PLANNED]** No CI gate. `pnpm audit` is run by hand; nothing fails a build on
a new critical. Tracked as R13.

### 3.10 Availability

**[PLANNED]** All of it. There is no uptime SLA, no synthetic monitoring, no
automated backup, no tested restore, and no disaster recovery runbook. RTO and
RPO have not been set.

The previous draft stated a 99.5% SLA "monitored via synthetic checks" and
"automated daily backups, 7-day retention". Neither exists. These were the two
most dangerous sentences in the document: an availability claim is exactly what
a customer relies on when they decide not to keep their own copy.

---

## 4. Vendors

**[DECISION]** The previous draft listed DPAs as "signed Q3 2026" and
"signed Q4 2026" for Railway/Supabase, Vercel and Fly.io. Today is 2026-09-22.
Those quarters are the present and the future, the hosting decision has not
been made, and no account exists. **No DPA has been signed with any hosting
vendor.** A signed-agreement claim that an auditor can disprove by asking for
the PDF is the single fastest way to lose an audit.

Actual processors today:

| Vendor | Role | DPA |
|---|---|---|
| Vonage | SMS / OTP delivery | **not signed** |
| Meta (WhatsApp Cloud API) | messaging, not in active use | **not signed** |
| Hosting (undecided) | application + database | no vendor chosen |

The draft named Twilio. We do not use Twilio.

---

## 5. Roles and responsibilities

**[DECISION]** The previous draft assigned CTO, DevOps and QA roles and
committed all staff to annual security training and quarterly phishing drills.
Confirm these people exist before the policy commits them to duties; a control
with a fictional owner fails on the first test.

---

## 6. Incident response

See `docs/INCIDENT_RESPONSE_PROCEDURE.md`.

**[DECISION]** Breach notification under Israeli law goes to the Privacy
Protection Authority, on that regime's timetable and thresholds — not GDPR's
72 hours, unless GDPR is also found to apply under §2. The notification clock
and recipient must be settled with counsel before this is relied on.

---

## 7. Approval

- [ ] Open items in §2 answered
- [ ] Every **[PLANNED]** and **[DECISION]** mark resolved or explicitly accepted as a known gap
- [ ] Legal review, specifically the Israeli privacy regime
- [ ] Board approval

**This document is not ready for a board presentation.** It is ready to be the
agenda for one.
