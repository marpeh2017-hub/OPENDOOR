# Pilot 2 source record — מתחם טשרניחובסקי - שמעוני

**Status: DRAFT. Nothing in this document is published, and nothing in it may
be published without the review each item names.**

## Why this document exists and not a code fixture

The values below are real, precise and unverified — the most dangerous
combination there is. They are recorded **here**, in `docs/`, and deliberately
**not** anywhere under `apps/website/`.

The reason is mechanical rather than stylistic. A number that is not in the
website's module graph cannot reach a browser, whatever a future flag, a
mistaken import or a careless `publishState` change does. A number in a fixture
file is one bad line away from a page. `apps/website` imports nothing from
`docs/`, and that is the whole protection.

The type-level shape these values *would* take, if and when they are persisted
behind authentication, is defined in
`packages/api-contracts/src/project-internal.ts` — types only, no data.

---

## 1. Source

| | |
|---|---|
| **Type** | `FEASIBILITY_WORKBOOK` |
| **Filename** | `תחשיב טשרניכובסקי - שמעוני - 9 קומות בממוצע עפ רשום.xlsx` |
| **Author** | not confirmed |
| **Date** | not confirmed |
| **Reliability** | `REQUIRES_REVIEW` |
| **In repository** | no — the file is not committed and must not be |

### What this source does and does not establish

**It establishes:** that a feasibility calculation was performed for a complex
referred to by these street names, under stated assumptions.

**It does not establish:** an approved planning scheme, a submitted plan, a
settled project boundary, a confirmed unit count, an entitlement of any kind,
or OpenDoor's role. The filename itself says `עפ רשום` — computed on the
registered position, which is an input to a model, not an outcome of a process.

---

## 2. Data-quality flags

Every one of these blocks automatic verification. Together they are why the
whole record is `REQUIRES_REVIEW` rather than a mix of grades.

| # | Flag | Blocking |
|---|---|---|
| 1 | Street name spelled inconsistently (`טשרניחובסקי` / `טשרניכובסקי`) | yes |
| 2 | 95 vs 98 owner/residential unit interpretation unresolved | yes |
| 3 | `שמעוני 14` appears in apartment data; parcel list has `שמעוני 13` | yes |
| 4 | גוש 30185 חלקה 126 has no confirmed address | yes |
| 5 | External workbook reference present and unresolved | yes |
| 6 | At least seven `#REF!` formulas | yes |
| 7 | Cached values may differ after recalculation | yes |
| 8 | Author and date of workbook not confirmed | yes |

Flag 2 matters more than it looks: the difference between 95 and 98 is the
difference between a registry count and a scenario output, and they are not the
same kind of number. Publishing either as "apartments" would be wrong in a
different way.

---

## 3. Candidate boundary — `REQUIRES_REVIEW`, not published

Ten addresses appear in the workbook's parcel list:

```
טשרניחובסקי 38      שמעוני 15
טשרניחובסקי 40      שמעוני 13
טשרניחובסקי 44      שמעוני 11
טשרניחובסקי 46      שמעוני 9
טשרניחובסקי 46א     שמעוני 7
```

**טשרניחובסקי 42 does not appear in the workbook.** It was a search lead in the
audit brief and it is recorded here as absent so nobody later assumes it was
overlooked. It must not be silently added to close the numbering gap; a gap in
street numbers is not evidence of a missing parcel.

**גוש 30185 חלקה 126** appears without a confirmed address and requires
investigation.

The project record carries **no street and no neighbourhood**. Displaying one of
ten unconfirmed addresses would settle by presentation a question the sources
leave open.

---

## 4. Existing-condition values — internal, `REQUIRES_REVIEW`

Registered and measured detail. Public-record in nature, internal in status:
precision published under a company's name reads as a surveyed statement that
company stands behind.

| Value | Figure | Note |
|---|---|---|
| Registered parcel area | 10,575 sqm | registry |
| GIS measured area | 10,545.14 sqm | differs from registered by ~30 sqm; unexplained |
| Residential sub-parcels | 95 | **sub-parcels, not apartments** |
| Commercial/land sub-parcels | 3 | |
| Calculated existing built area | 9,296.8 sqm | calculated, not measured |
| Average apartment area incl. equivalents | 94.87 sqm | includes equivalents; not a floor area |
| Estimated demolition gross area | 12,550.68 sqm | estimate |

The registered-versus-measured discrepancy is itself a finding: two areas that
disagree cannot both be published, and choosing one silently would hide the
disagreement.

---

## 5. Feasibility scenario — internal, and never a public fact

Assumptions: ~9 above-ground floors average · 8 buildings · 47% above-ground
coverage · no expropriation · owner consideration the greater of 22 sqm or 22%.

Outputs: ~43,930.7 sqm total envelope · ~35,031.5 sqm residential sale area ·
~1,491.1 sqm commercial · ~1,226.1 sqm public use · 16 penthouse units ·
**98 owner units, 239.18 developer units, 337.18 total**.

### The rule

**337.18 must never be rounded to "337 planned apartments."**

That number is arithmetic performed on assumptions somebody chose. It is not a
count of apartments anyone may build. The fractional part is the tell, and
rounding it away is exactly what converts a calculation into a planning claim.
The same applies to every area above.

If a unit count is ever published for this complex it comes from an **approved
plan**, cited to that plan, verified by a person — never from this scenario,
however carefully it was modelled.

---

## 6. Economic figures — strictly internal

Sales ~₪825.6M · calculated profit ~₪135.9M · return on cost ~16% · developer
profit/sales ~14%.

These belong to the CRM and the feasibility engine, behind authentication.
`FeasibilityScenario` in the contracts package deliberately does **not** model
them, so no code importing the website's contracts can hold them even by
accident. They appear in this document once, for the record, and nowhere in the
application.

---

## 7. Candidate facts, classified

| Candidate | Class | Publishable |
|---|---|---|
| Working project name | `EDITORIAL_CONTEXT` | as a working name only |
| City (ירושלים) | `SOURCE_FOUND_BUT_REQUIRES_REVIEW` | no — established only via comparison transactions |
| Ten candidate addresses | `SOURCE_FOUND_BUT_REQUIRES_REVIEW` | no |
| גוש 30185 חלקה 126 | `SOURCE_FOUND_BUT_REQUIRES_REVIEW` | no |
| All existing-condition areas | `SOURCE_FOUND_BUT_REQUIRES_REVIEW` | no |
| Sub-parcel counts (95 / 3) | `SOURCE_FOUND_BUT_REQUIRES_REVIEW` | no |
| All scenario assumptions and outputs | `NOT_SUPPORTED` as public fact | never |
| All economic figures | `NOT_SUPPORTED` as public fact | never |
| Project stage | `NOT_SUPPORTED` | no |
| OpenDoor's role | `NOT_SUPPORTED` | no — no evidence at all |
| Milestones | `NOT_SUPPORTED` | no — the workbook records no event |
| Media | `NOT_SUPPORTED` | no — none exists |

**Nothing is class A (`VERIFIED_SOURCE`).**

---

## 8. Internal working classification

Not published. `INITIAL_REVIEW` is the strongest defensible reading: a
feasibility calculation exists and nothing else does.

The project must not be described as submitted, deposited, approved or at
permit stage. A scenario computed `עפ רשום` is the opposite of a submission.

---

## 9. What is required before anything here can be published

1. **Confirm the boundary** — which of the ten addresses are in, whether
   טשרניחובסקי 42 belongs, and what גוש 30185 חלקה 126 is.
2. **Confirm the city** on project evidence rather than comparison
   transactions.
3. **Confirm OpenDoor's role**, or the project should not be published at all.
4. **Resolve the 95/98 ambiguity** and state which is a registry count.
5. **Recalculate the workbook**, resolve the `#REF!` formulas and the external
   reference, and confirm author and date.
6. **Decide registered vs measured area**, with the discrepancy explained.
7. **Approve an official project name.**
8. Only then: verify individual facts one at a time, each with a checker and a
   date.

Steps 1–3 are the ones that decide whether a public page can exist at all.
Steps 4–6 decide whether any number on it can.
