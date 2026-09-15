# Golden Case — דוח אפס הרואה, רמת גן

## Confidentiality boundary

The source workbook is a confidential Golden Case. It is read from the
user-provided location only and is not copied into this repository, seeded into
PostgreSQL, or surfaced by the CRM. This document deliberately records no
financial amounts, rates, transaction values, profit values, or personal data.

Source identity (SHA-256):

```text
CEBC0342D7B4D83A6BE2BA5226A6A4E05DF41871563F3F7E3D543123A8D71841
```

## Confirmed workbook structure

| Workbook section | Digital engine mapping |
| --- | --- |
| Existing situation | Existing project inventory, building/apartment facts, area schedule, source register |
| Proposed planning complexes | Planning rights, scenario program, unit mix and area reconciliation |
| Zero Report | Revenue, cost, owner consideration, financing, cash-flow, profitability and validation sections |
| Executive summary | Snapshot-driven dashboard and final report summary |

## Formula evidence

The supplied workbook contains live formulas across its existing-situation,
planning, report and summary sections. Later engine phases must therefore
compare formula categories and resulting values against this source, rather
than treating it as a static PDF-style report.

## Golden Case protocol

1. Do not persist confidential source figures in seed data or automated test
   fixtures.
2. When a calculation domain is implemented, create a private local comparison
   run from the source workbook.
3. Store only the comparison status, tolerance type, difference and a
   redacted source reference in committed tests/documentation.
4. Record exact values only in local, untracked Golden Case inputs until the
   owner explicitly approves storing them in the application tenant.
5. A domain is not marked production-ready until its variance is explained or
   within an explicit deterministic, currency, percentage or area tolerance.

## Initial implementation implications

- The model needs separate existing and proposed area schedules.
- Planning may include multiple complexes/blocks and must roll up to one
  project profile.
- The output needs both a detailed report and an executive summary generated
  from the same calculation snapshot.
- Calculated rows must preserve their trace to source, assumption and formula
  category.
