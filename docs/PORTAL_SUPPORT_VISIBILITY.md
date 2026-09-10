# What residents can now see — two things the CRM has to account for

Written 2026-09-10, alongside portal stage 3d.

Until this stage, `SupportTicket` had no reader anywhere in the product. Nothing
displayed a ticket, so nothing about a ticket was visible to anybody outside the
company. That is no longer true, and two consequences need handling outside the
portal codebase.

---

## 1. A ticket's `subject` and `description` are now resident-visible

`TicketReply.isInternal` separates staff's private notes from the reply the
resident is meant to read, and the portal filters on it everywhere — the
conversation, and the reply count on the list. That part is enforced in code and
covered by tests.

**The ticket's own `subject` and `description` carry no such flag.**

So a ticket a staff member opens *about* a resident — "resident is refusing to
engage, escalate to legal" — is visible to that resident in full, the moment
`residentId` is set on it. There is no field in the schema to mark a ticket
internal, and adding one would be a schema change with a migration.

### What needs to happen in the CRM

When staff open or edit a ticket that has a `residentId`, the interface should
say plainly that the subject and description will be visible to that resident in
their portal. A quiet note beside the field is enough; the failure mode is a
staff member who does not know, not one who forgets.

Internal commentary belongs in a reply with `isInternal: true`, which is exactly
what that flag is for.

### The alternative, if that is not enough

Add `SupportTicket.isInternal` (or a `visibility` enum) and filter on it in
`PortalSupportService`. That is a small change to make; it is recorded here
rather than done because the current design is the standard helpdesk model and
the flag that matters — the one on replies — already exists and is honoured.

---

## 2. There is no CMS for portal content, and the FAQ needed one

The support page shipped with five hard-coded questions and answers. Four of
them made claims the company would be held to:

| Claim on the page | Why it was removed |
|---|---|
| "אם 80% מהדיירים חתמו ניתן לפנות לבית המשפט" | `Project.signatureGoal` defaults to **67** and is per-project. The page contradicted the system's own data, in the direction least favourable to the resident. |
| "מסירה בסוף 2027" | `Project.targetEndDate` exists and is per-project. |
| "הדירה החדשה תהיה… בתוספת של לפחות 25% שטח" | A contract term. Varies per project and per agreement. |
| "היזם נושא בכל עלויות הפינוי, הדיור החלופי, האחסון" | A contract term, likewise. |

A resident can rely on these. In a pinuy-binuy dispute, "the promoter's own
portal told me 80%" is a real problem — the more so because the number was wrong
against the company's own record.

### What was done

`PortalSupportService.faq()` now answers only what **this project's row** can
answer: how many units have signed, the signature goal recorded for the project,
and the target delivery date. An entry whose data is missing is **omitted**
rather than answered with a guess — a silent question is recoverable, a wrong
number in front of a resident is not.

The signature-goal answer also says explicitly that the statutory threshold is
decided case by case and points legal questions at the project team, rather than
implying that the project's own target is the law.

### The gap

The contractual questions are gone, and residents genuinely do ask them. There
is no model for portal-facing editorial content — `CmsContent` covers the
marketing website, not the resident portal — so there is nowhere for a project
team to write a correct per-project answer without a deploy.

**This is a product gap, not a bug.** Filling it means either extending the CMS
to cover portal content, or adding a per-project FAQ that the project team
maintains. Either way the answers become the project's own words, reviewable and
correctable, which is what these particular questions need.

---

## Related decisions recorded elsewhere

- A support ticket belongs to **one resident**, never to an apartment, even when
  several residents share one. The reasoning — inherited apartments, contested
  estates, separating couples — is in the header of
  `services/api-gateway/src/portal/portal-support.service.ts`, and the property
  is held by a fixture with two residents in one apartment in
  `test/portal-support.e2e-spec.ts`.
- OTP-verified self-service phone change remains deferred; see the stage 3c
  commit message.
