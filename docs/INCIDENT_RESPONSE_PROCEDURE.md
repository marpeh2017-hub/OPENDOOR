# Incident Response Procedure

**Status:** DRAFT — not approved, not exercised, not ready to rely on
**Owner:** Michael Rosenbach
**Companion to:** `INFORMATION_SECURITY_POLICY.md`, `RISK_REGISTER.md`
**Last verified against the system:** 2026-09-22

---

## Read this first

The marks from the security policy apply here too: **[VERIFIED]** means checked
against the running system, **[PLANNED]** means it does not exist yet,
**[DECISION]** means a human has to answer before the step is real.

A response plan describing detection that is not switched on is worse than no
plan, because the gap only becomes visible during the incident it was written
for.

---

## 1. Who we are

The identity below goes on every regulator filing and every resident letter, so
it is recorded once, here, rather than retyped.

| Field | Value |
|---|---|
| Registered name | קבוצת אופן דור יזמות והתחדשות בע"מ |
| Company number | ח.פ. 515856334 |
| Domain | odg.co.il |
| Contact for privacy matters | **[DECISION]** — no `privacy@` mailbox exists yet |

Earlier drafts named "Urban Renewal OS Ltd." at `rosenbach.co.il`. Neither is a
real entity or a real domain. A regulator filing naming a company that does not
exist, or a breach letter linking residents to a domain that does not resolve,
converts an incident into a second incident.

`Urban Renewal OS` is the product. It is not the legal person, and it cannot
sign a notification.

---

## 2. Which law applies — unresolved

**[DECISION] — this governs the entire timetable below.**

The Israeli regime is **חוק הגנת הפרטיות** and **תקנות הגנת הפרטיות (אבטחת
מידע), התשע"ז-2017**, supervised by **הרשות להגנת הפרטיות**.

The 72-hour figure that appears in most drafts of this document is **GDPR's**
(Art. 33). The Israeli regulations use a different trigger and a different
obligation — they turn on a severe security incident, the duty runs to the
Authority, and the Authority may then direct how and whether data subjects are
told. The two regimes are not interchangeable, and copying GDPR's clock into an
Israeli procedure produces a deadline nobody is actually bound by, while
possibly missing one they are.

**Do not fill in a timetable from this document until counsel has confirmed:**

1. The trigger — what counts as a reportable event under the 2017 regulations.
2. The deadline — measured from what, in what form, to whom.
3. Whether we notify data subjects directly, or only on the Authority's direction.
4. Whether GDPR *also* applies, which would make both timetables run at once.
5. The record retention period for incident documentation. The commonly quoted
   "7 years" is not verified here and should not be asserted until it is.

Everything below that depends on a clock is marked accordingly.

---

## 3. Detection — almost none of this exists

**[PLANNED] — this is the largest gap in this document.**

There is no monitoring. No uptime checks, no error alerting, no security
alerting, no anomaly detection, no log aggregation, no intrusion detection, no
automated backup verification. This is **R11** in the risk register, open and
rated HIGH.

Drafts of this plan describe a detection table citing Fly.io monitoring,
Postgres anomaly detection, SSL Labs scanning, DDoS detection and daily snapshot
verification. **None of it is configured.** Some of it cannot be, because
nothing is deployed yet.

What genuinely exists today:

| Capability | Status | Note |
|---|---|---|
| Audit trail of human data mutations | **[VERIFIED]** | Actor, entity, before/after, timestamp; PII redacted. Webhook and integration activity is NOT captured (R12). |
| Rate limiting | **[VERIFIED]** | 20/s global; OTP issuance 3/hour per phone; 5-attempt OTP lockout that destroys the code. |
| Cross-tenant refusal | **[VERIFIED]** | `TenantScopeService`; another tenant's row 404s rather than 403s. |
| Health endpoint | **[VERIFIED]** | `/api/v1/health` reports Postgres and Redis, and `redisMode` so a fallback cannot pass as real Redis. |
| Alerting on any of the above | **[PLANNED]** | Nothing watches them. Nobody is paged. |

**So the realistic detection path today is a person noticing.** A resident
reporting activity they did not perform, a staff member seeing something wrong,
or a third party telling us. That is the honest answer and it is what the
procedure below assumes.

**Before launch, the minimum worth having** (and enough to make this section
real): alerting on repeated failed authentication, on any `TenantScopeService`
refusal, on 5xx rate, and on the health endpoint going unhealthy.

---

## 4. Severity

| Level | Meaning | Examples |
|---|---|---|
| **1 — Low** | No personal data exposed | Phishing mail reported, single failed login burst, config drift |
| **2 — Medium** | Suspected exposure, bounded | One cross-tenant refusal that should not have been attempted, a credential exposed but unused, a document URL shared wider than intended |
| **3 — High** | Confirmed exposure of personal data | Any confirmed unauthorised access to resident data, national IDs, signature packages or documents; `FIELD_ENCRYPTION_KEY` exposure; database copied |

National identity numbers and signature packages put an incident at **Level 3**
by default. They are the most sensitive data we hold and the hardest for a
resident to remediate — a phone number can be changed, a תעודת זהות cannot.

---

## 5. Response

### Contain — first, and without waiting for a decision

These actions are safe, reversible, and should not queue behind a phone call:

1. **Revoke sessions.** `JWT_SECRET` rotation invalidates every session and every
   outstanding OTP at once. Blunt, immediate, and it logs everybody out —
   including staff responding to the incident, so rotate deliberately.
2. **Disable the affected account(s).**
3. **Preserve evidence before changing anything else.** Snapshot the database and
   copy logs to somewhere the incident cannot reach. Containment destroys
   evidence as a side effect; do this first.
4. **Do not delete anything**, including the attacker's artefacts.

### Assess

- What data, which residents, what time window.
- Was it encrypted? National IDs are AES-256-GCM at rest, so ciphertext without
  `FIELD_ENCRYPTION_KEY` is a materially different incident from plaintext.
- Is it still happening.
- Did it reach a processor (Vonage, the email provider, Anthropic, storage).

### Escalate

**[DECISION]** — the policy names a CTO, a DevOps engineer, a QA lead and a
communications lead. Confirm which of these people exist before this procedure
depends on them. A call tree with a fictional name in it fails on first use.

Today the realistic list is: Michael Rosenbach, and counsel.

### Notify

**[DECISION]** — timing and recipients per §2. Nothing here is a deadline until
counsel confirms it.

What can be prepared in advance, and should be: the regulator submission
carrying the correct registered name and company number from §1, and a resident
letter in Hebrew that says plainly what happened, what data was involved, what
was done, and what the resident should do. Written before it is needed, because
nobody writes well at 2am during the event.

---

## 6. After

- Root cause, written down.
- Fix, with an owner and a date.
- Add the detection that would have caught it sooner — most incidents here will
  reveal a missing alert, since §3 says there are none.
- Update this document with what actually happened versus what it said would.

---

## 7. Before this document is worth anything

- [ ] §2 answered by counsel — the timetable is empty until then
- [ ] §3 detection actually configured (R11)
- [ ] §5 escalation names confirmed to be real people
- [ ] A `privacy@odg.co.il` mailbox that somebody reads
- [ ] One tabletop exercise, because an unexercised plan is a document, not a capability

**This is not ready for implementation.** It is ready to be the agenda for the
conversation that makes it ready.
