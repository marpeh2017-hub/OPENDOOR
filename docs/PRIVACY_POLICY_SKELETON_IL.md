# Privacy Policy Skeleton — Israeli Law

**For legal review. Not publishable as-is.**

**Controller:** קבוצת אופן דור יזמות והתחדשות בע"מ, ח.פ. 515856334
**Domain:** odg.co.il
**Prepared:** 2026-09-22
**Regime:** חוק הגנת הפרטיות, התשמ"א-1981 · תקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017
**Supervisor:** הרשות להגנת הפרטיות

---

## How to read this

This is not a draft policy. It is a **structured statement of what the system
actually does with personal data**, written so a lawyer can turn it into a
policy without first having to interview an engineer.

Every factual claim below was checked against the code on the date above.
Questions that only counsel can answer are marked **🔴 Q1–Q7** and collected in
§8.

**Why Israeli law and not GDPR.** Earlier drafts were GDPR-shaped. Our residents
are in Israel, the projects are Israeli, the clients are Israeli municipalities
and developers. GDPR binds us only if we process data of people in the EU
(**🔴 Q7**). The 2017 regulations are not a lighter GDPR — they impose duties
GDPR has no equivalent for, including database registration, a security-level
classification per database, and annual access review. A GDPR-shaped policy does
not discharge them.

---

## 1. Two different things are being regulated

This matters more than anything else in this document, and it is the thing the
existing policy does not cover.

**(a) The marketing site — already has a published policy.** It covers enquiry
forms only. It already commits us, publicly, to:

- retaining an enquiry that did not become an engagement for **24 months** from
  last contact, then deleting it
- answering a rights request within **30 days**
- the §11 notice (חוק הגנת הפרטיות) at the point of collection
- the right to complain to הרשות להגנת הפרטיות

Those four are **already binding**. Nothing in the final policy may quietly
contradict them, and if any of them is wrong, it is wrong *now* and on a live
site.

**(b) The platform — has no policy at all.** The CRM and the resident portal
process categories of data an order of magnitude more sensitive than an enquiry
form: national identity numbers, signed agreements, ownership shares, private
correspondence. **There is currently no privacy notice covering any of it.**

This skeleton is about (b).

---

## 2. What is actually collected

From the schema, not from memory.

| Category | Where | Notes |
|---|---|---|
| Identity — name, phone, email | `Resident`, `Owner`, `User`, `Lead` | Phone is the portal's login identifier |
| **National ID (תעודת זהות)** | `Resident`, `Owner`, `User` | **Encrypted at rest**, AES-256-GCM, random IV per record. Lookup by SHA-256 fingerprint over ciphertext, so plaintext is never indexed. |
| Property and ownership | `Apartment`, `Owner` | Ownership **shares** — legally consequential, since they determine the pinuy-binuy signature threshold |
| Signatures and agreements | `SignaturePackage`, `Document` | Signed instruments plus their evidence trail |
| Correspondence | `Message`, `Meeting` | SMS and in-app messages, attendance |
| Behavioural | `AuditLog` | Who did what, when. PII redacted before write. |

**Special categories.** National ID and signed agreements are the sharp end. A
phone number can be changed after a breach; a תעודת זהות cannot. Whatever the
final policy says about safeguards, these are what it is really about.

**🔴 Q1 — Lawful basis.** For each category: consent, contract, or legitimate
interest? Note that a resident in a pinuy-binuy project did not choose us — they
live in a building whose owners engaged us — which makes consent an awkward fit
and makes the answer matter.

---

## 3. Who we share it with

Verified against the code. Earlier drafts listed 16 vendors; the real list is
six, and two of the named ones process nothing at all.

| Processor | Purpose | Data | Location |
|---|---|---|---|
| **Vonage** | SMS, including OTP | Phone, message body | Outside Israel |
| **Resend or SendGrid** | Email | Email address, content | Outside Israel |
| **Anthropic** | Assistant features | Conversation content | Outside Israel |
| **Nominatim** | Address geocoding | Property addresses | Outside Israel |
| **Object storage (S3-compatible)** | Documents | Everything uploaded | **🔴 Q5** — provider undecided |
| **Hosting** | Application and database | Everything | **🔴 Q5** — provider undecided |

**Not processors, despite appearing in earlier lists:**

- **ComSign and DocuSign** — both unimplemented. E-signature is **in-house**;
  the provider factory returns a native implementation and throws at start-up if
  either vendor's credentials are present. Neither receives any data.
- **Twilio, Inforu** — code exists, not configured. SMS resolves to Vonage.
- **ClamAV** — self-hosted (`127.0.0.1`).
- **Stripe** — never integrated. No payment data is processed at all.

**No DPA is signed with any processor.** Not one.

**🔴 Q2 — Cross-border transfer.** Every processor above is outside Israel. What
does תקנות הגנת הפרטיות (העברת מידע אל מאגרי מידע שמחוץ לגבולות המדינה) require
here, and does the answer differ for Anthropic, where the content is free text a
resident typed?

---

## 4. How long we keep it

**Published and binding:** enquiries, 24 months from last contact.

**Everything else: undecided.** No retention period is configured for resident
records, documents, messages, signature packages or audit logs. Nothing is
deleted automatically today.

**🔴 Q3 — Retention.** Per category, and note the tension: a signed pinuy-binuy
agreement may need to survive for decades for the residents' own protection,
while their phone number probably should not. "Delete everything after N years"
is the wrong shape of answer.

**🔴 Q6 — Audit log retention.** Separate question, because the audit log is
itself a record *of* processing, and deleting it destroys the evidence that we
handled the rest correctly.

---

## 5. Rights

Published and binding: access, withdrawal of consent, asking how data is used,
**30-day** response, and the right to complain to הרשות להגנת הפרטיות.

**Implementation status: none of it is built for the platform.** There is no
export endpoint, no self-service correction beyond the profile fields, no
deletion workflow. A request today is handled by a person with database access.

**🔴 Q4 — Rights mechanics.** What must exist before launch versus what may be
manual? Specifically: does עיון (access) require a machine-readable export, or
is a written response sufficient?

---

## 6. Security — what is actually true

Stated honestly, because the policy will be read against reality if there is
ever an incident.

**In place, verified:** national IDs encrypted at rest (AES-256-GCM); OTP
authentication with HMAC-at-rest, 5-minute expiry and 5-attempt lockout;
tenant isolation enforced centrally, with another tenant's record returning
"not found" rather than "forbidden"; role-based access across 203 endpoints and
13 roles; audit trail with PII redaction; rate limiting; zero critical
dependency vulnerabilities; no credentials in 189 commits of history.

**Not in place:**

- **No TLS.** Nothing is deployed and no certificate exists. **Personal data is
  not currently protected in transit**, because nothing is currently in transit.
  This must be true before a single resident uses the system.
- **No backups**, and therefore no tested restore.
- **No monitoring or alerting.** Nobody would learn of a breach except from a
  person noticing.
- **No signed DPA** with any processor.

**🔴 Q5 — Security level.** Which רמת אבטחה (בסיסית / בינונית / גבוהה) do our
databases fall under? This drives most of the concrete obligations in the 2017
regulations, and it is the single question that most changes what we have to
build. Note the national IDs and the volume of data subjects when answering.

**🔴 Q6 — Database registration.** Do our databases require registration with
the Authority (רישום מאגר מידע)? If so, which, by when, and who signs.

---

## 7. Breach notification

See `INCIDENT_RESPONSE_PROCEDURE.md`, whose timetable is deliberately blank.

**🔴 Q7 — Notification duty.** The trigger, the deadline, the recipient, and
whether residents are told directly or only on the Authority's direction. The
72-hour figure in circulation is GDPR Article 33 and should not be assumed to
apply. Also: does GDPR apply in parallel, and if so, do both clocks run?

---

## 8. The seven questions

| # | Question | Blocks | Needed by |
|---|---|---|---|
| **Q1** | Lawful basis per data category — and how it works for a resident who did not choose us | Consent flow, the notice text itself | **Launch** |
| **Q2** | Cross-border transfer requirements; all six processors are outside Israel | DPA content, possibly vendor choice | **Launch** |
| **Q3** | Retention per category; signed agreements vs. contact details | Deletion schedule | **Launch** |
| **Q4** | Rights mechanics — what must be automated vs. manual | Portal build work | **Launch** |
| **Q5** | Security level classification; storage and hosting provider constraints | Most 2017-regulation obligations; hosting decision | Before go-live |
| **Q6** | Database registration; audit log retention | Regulatory filing | Before go-live |
| **Q7** | Breach trigger and timetable; does GDPR also apply | Incident procedure | Before go-live |

---

## 9. What we are asking for

Not a drafted policy. A one-hour conversation answering Q1–Q4, after which the
policy can be written quickly and correctly, and Q5–Q7 before the system carries
real data.

The honest framing for that conversation: **the application-layer security is in
good shape and the operational and legal layers are not.** We would rather be
told that clearly now than discover it from the Authority later.

---

### Cover note

> Subject: בקשה לייעוץ — מדיניות פרטיות ותקנות אבטחת מידע
>
> שלום,
>
> אנחנו קבוצת אופן דור יזמות והתחדשות בע"מ (ח.פ. 515856334), ומפעילים פלטפורמה
> לניהול פרויקטי פינוי-בינוי ותמ"א 38. המערכת מעבדת מידע אישי של דיירים ובעלי
> דירות, כולל תעודות זהות והסכמים חתומים.
>
> מצורף מסמך שמתאר בדיוק מה המערכת אוספת, למי היא מעבירה, ומה קיים היום מבחינת
> אבטחה — כולל מה שעדיין לא קיים. הוא נכתב על בסיס חוק הגנת הפרטיות ותקנות
> אבטחת מידע 2017, ולא על בסיס GDPR.
>
> יש בו שבע שאלות שרק עורך דין יכול לענות עליהן. ארבע מהן חוסמות השקה.
>
> נשמח לשיחה של שעה. האם יש זמן פנוי בשבוע הקרוב?
>
> תודה,
> מיכאל רוזנבך
