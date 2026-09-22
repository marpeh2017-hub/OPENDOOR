# Risk Register — Urban Renewal OS

**Status:** DRAFT
**Last verified against the codebase:** 2026-09-22
**Companion to:** `docs/INFORMATION_SECURITY_POLICY.md`

Severity is the residual risk *after* the stated control, not the inherent risk
of the threat. A register that scores everything at its inherent severity tells
you nothing about where to spend the next hour.

OWASP references use the 2021 Top 10. The draft this replaces mapped several
rows to the wrong category; corrections are noted, because a register is also
how people learn the taxonomy.

---

## Mitigated — control verified in the source

| # | Risk | OWASP | Residual | Control | Evidence |
|---|---|---|---|---|---|
| R1 | SQL injection | A03 | Low | Prisma parameterised queries throughout; no raw SQL, no GraphQL | source sweep, 2026-09-22 |
| R2 | Cross-tenant data access | A01 | Low | `TenantScopeService`; tenantId from JWT only; 404 not 403 on cross-tenant | e2e tenant-isolation tests |
| R3 | Unauthenticated API access | A01 | Low | JWT with mandatory `sessionId`; Redis revocation on logout | `JwtStrategy`, auth e2e |
| R4 | OTP brute force | A07 | Low | 5-attempt lockout destroys the code; `crypto.randomInt`; HMAC-at-rest; 3/hour per phone | OTP service |
| R5 | Webhook forgery | **A08** | Low | HMAC verification, fail-closed; ±5 min replay window | signature webhook handler |
| R6 | National ID exposure | **A02** | Low | AES-256-GCM, random IV, fingerprint over ciphertext; prod start fails without key | encryption service |
| R7 | SSRF via webhook targets | A10 | Low | Private/loopback blocked before allowlist; startup refuses internal addresses | `validateAllowlistConfiguration()` |
| R8 | Shipped dependency vulnerabilities | A06 | Low | 0 critical as of 2026-09-22; Next RCEs and multer DoS closed | `pnpm audit` |

> **Corrections from the previous draft.** R5 was mapped to A06 (Vulnerable
> Components); webhook forgery is A08, Software and Data Integrity Failures.
> R6 was mapped to A04 (Insecure Design); exposure of an encrypted identifier
> is A02, Cryptographic Failures. The draft's "R10 — Secrets in pnpm overrides"
> has been dropped: a `pnpm` override pins a version number and cannot contain
> a secret.

---

## Open — no adequate control today

| # | Risk | OWASP | Residual | Position | Owner | Target |
|---|---|---|---|---|---|---|
| R9 | **No transport encryption.** Every app serves plain HTTP. Credentials, OTP codes, session tokens and national IDs would cross the wire in clear the moment this is public. | A02 | **CRITICAL** | HSTS headers are shipped but inert without TLS. Blocked on the hosting decision. | — | **before any public traffic** |
| R10 | **No backups.** No automated backup, no tested restore, no RPO. | A04 | **HIGH** | A database loss today is unrecoverable. Independent of hosting choice in principle; blocked on it in practice. | — | before launch |
| R11 | **No monitoring or alerting.** No uptime checks, no error alerting, no security alerting. | A09 | **HIGH** | Nobody would learn of an outage or an attack except from a customer. | — | before launch |
| R12 | Webhook and integration activity bypasses the audit log | A09 | Medium | `AuditActor` cannot represent a non-human actor; needs a discriminated union. Signature state changes are therefore unattributable. | — | Phase 2 |
| R13 | No CI gate on dependency audit | A06 | Medium | `pnpm audit` is manual. A new critical would reach production silently. | — | Phase 2 |
| R14 | Weak webhook idempotency | A08 | Medium | Substring match on metadata rather than a unique constraint on `(tenantId, provider, eventId)`. A duplicate delivery can double-apply. | — | Phase 2 |
| R15 | Secrets read ad hoc from `process.env` | A05 | Medium | No central resolver, no rotation path, no per-tenant credentials. | — | Phase 2 |
| R16 | No Content-Security-Policy on the Next apps | A05 | Medium | Needs nonce-based middleware; a naive CSP blanks a Next app. | — | Phase 2 |
| R17 | **Israeli privacy regime not assessed** | — | **HIGH** | Policy was drafted against GDPR. חוק הגנת הפרטיות and תקנות אבטחת מידע 2017 apply and impose duties with no GDPR equivalent — database registration, security level classification, annual access review. Non-compliance is a regulatory exposure, not a technical one. | — | **before launch** |
| R18 | No signed DPA with any processor | — | Medium | Vonage carries OTP codes and phone numbers with no data processing agreement. Hosting vendor not yet chosen. | — | before launch |
| R19 | Audit log is append-only by convention | A09 | Low | No database constraint prevents an `UPDATE` or `DELETE` on audit rows. | — | Phase 2 |
| R20 | Split pnpm toolchain | A06 | Low | Global pnpm 11 vs `packageManager` 9.15.2 read overrides from different files; an override silently applied in neither until declared in both. Fixed, but the underlying split remains. | — | Phase 2 |

---

## What this register says

Eight risks are genuinely closed, and the application-layer security is in
good shape — tenant isolation, OTP hardening, encryption at rest, SSRF control
and input validation are all real and all tested.

**Every remaining critical and high risk is operational, not application-level,
and all but one are blocked on the same undecided question: where this runs.**

R9, R10 and R11 — no TLS, no backups, no monitoring — cannot be closed by
writing code. R17 cannot be closed by writing code either; it needs a lawyer.

A launch that ships the current application onto TLS with backups and
monitoring would be defensible. A launch without them would not be, regardless
of how good the application-layer controls are.
