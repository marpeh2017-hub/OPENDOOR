# OpenDoor Group — Phase 1 Implementation Plan

> Planning artifact produced before implementation, per the Master Specification
> §70 and the approval instruction "before writing major page implementation,
> first create: design-system extension plan, shared UI component inventory,
> route map, mock content model, API contract structure."
>
> **Nothing in this document authorises backend, Prisma, PostgreSQL, Redis,
> JWT/session, MinIO, RBAC or CRM business-logic changes.** Phase 1 is frontend,
> contracts and mock data only.

---

## 0. Ground truth — what already exists

Verified by inspection, not assumed:

| Workspace | Port | State |
|---|---|---|
| `apps/web` | 3000 | CRM-SaaS marketing site. **Wrong audience.** Frozen, retired after review. |
| `apps/crm` | 3001 | Mature. 19 routes, ~19 hooks, BFF proxy at `/api/proxy/*`. Untouched. |
| `apps/portal` | 3002 | Resident portal, 9 routes. Frontend-only changes allowed. |
| `services/api-gateway` | 4000 | NestJS. **Untouched in Phase 1.** |
| `packages/design-system` | — | Tokens only, no components. Consumed by all three apps. |
| `packages/db` | — | **Untouched in Phase 1.** |

All three apps already run next-intl with `[locale]` routing and `he`/`en`
message files. RTL is established. This is a real asset — Phase 1 extends it
rather than introducing a second i18n approach.

---

## 1. Design-system extension plan

`packages/design-system` today exports `colors`, `spacing`, `typography`,
`borderRadius`, `shadows`, `animation`, `fonts`, plus `globals.css` and a
Tailwind preset. It is in better shape than the spec assumes.

### 1.1 What is already correct and must NOT be re-derived

`colors.teal[500] = #2F9DA0` and `colors.teal[600] = #22797D` already match the
spec's "brand accent" and "interaction state". `colors.gray` covers the
charcoal/neutral surfaces. Spec §6 says "do not mechanically copy colors from
the raster image" — that work has been done.

Also already present and directly reusable by the website:
`colors.stage.*` (urban-renewal stage colours) and `colors.signature.*`.

### 1.2 Gaps to close

| Gap | Why it matters | Action |
|---|---|---|
| **No `breakpoints` token** | Spec §6 requires centralised breakpoints; §36 requires seven explicit sizes. Tailwind defaults are currently implicit. | Add `breakpoints` and mirror into the Tailwind preset. |
| **No semantic surface aliases** | Website needs "warm off-white" page backgrounds (§6) distinct from CRM's cooler `gray.50`. | Add `colors.surface.{page,raised,sunken,inverse}`. |
| **No `zIndex` scale** | Header, mobile nav, modals, toasts overlap; ad-hoc values cause stacking bugs. | Add `zIndex`. |
| **No focus-ring token** | §37 requires a visible focus indicator on every interactive element. | Add `focusRing` and apply once in `globals.css`. |
| **No reduced-motion handling** | §37 and §45 both require it. | Add a `prefers-reduced-motion` block to `globals.css` neutralising `animation.duration`. |
| **No typographic scale for marketing** | CRM type scale tops out at dashboard sizes; a hero needs display sizes. | Extend `typography.fontSize` with `display-sm/md/lg`. |

### 1.3 Contrast obligation

Every new colour pairing must be checked against WCAG 2.1 AA before use.
Measured against `#FFFFFF` (computed, not estimated):

| Token | Ratio | Body text (4.5:1) | Large text (3:1) |
|---|---|---|---|
| `teal.500` `#2F9DA0` | **3.26:1** | ❌ FAIL | ✅ pass |
| `teal.600` `#22797D` | **5.12:1** | ✅ pass | ✅ pass |
| `teal.700` `#1b5f62` | **7.34:1** | ✅ pass | ✅ pass |

**`teal.500` must not be used for body copy on white.** It is fine for large
headings (≥24px), icons, borders and fills. Text uses `teal.600` or darker.

This is exactly the trap §6 warns about when it says teal should be an accent
rather than dominate — the brand colour is not a text colour. An automated
contrast check over the token pairings is part of Task 14.

### 1.4 Compatibility rule

The CRM and Portal consume this package. Every change is **additive**. No
existing token is renamed, re-valued or removed in Phase 1, so no existing
screen can shift.

---

## 2. Shared UI component inventory (`packages/ui`)

Rule from §60: no duplicate components for minor visual differences. Rule from
this plan: **a component moves into `packages/ui` only when a second app needs
it.** Premature sharing produces an over-parameterised component that fits
nobody, and it couples CRM releases to website releases.

### 2.1 Tier 1 — primitives (shared from day one)

`Button` · `Input` · `Textarea` · `Select` · `Checkbox` · `Radio` · `Label` ·
`FieldError` · `Card` · `Badge` · `Tabs` · `Accordion` · `Dialog` · `Sheet` ·
`Tooltip` · `Skeleton` · `Spinner` · `VisuallyHidden`

Each ships all eight states required by §61 (default, hover, focus, active,
disabled, loading, error, success).

### 2.2 Tier 2 — cross-app composites

`EmptyState` · `ErrorState` · `LoadingState` · `Breadcrumbs` · `Pagination` ·
`SectionHeading` · `Timeline` · `DocumentCard` · `MeetingCard` ·
**`GalleryManagerDnd`**

`Timeline` is deliberately shared: the public Project Transparency timeline
(§13), the resident timeline (§22) and the representation milestones (§66) are
the same component at three disclosure levels, driven by a `visibility` prop.
Building three would guarantee they drift.

### 2.3 Tier 3 — website-only (stay in `apps/website`)

`Hero` · `ProjectCard` · `ProjectGrid` · `ProcessTimeline` · `TrustCard` ·
`KnowledgeCard` · `FAQAccordion` · `FormWizard` · `CTA` · `Header` ·
`MobileNavigation` · `Footer` · `LanguageSwitcher` · `Search`

### 2.4 `GalleryManagerDnd` — Phase 1 scope

Confirmed: no legacy `GalleryManager` exists in this repository, and there is no
external source. Built new, in `packages/ui`.

Phase 1: image/video preview · drag-and-drop reordering · **keyboard reordering**
· remove · captions · alt text · project/category association · responsive ·
**mock data only, no MinIO**.

Keyboard reordering is not optional decoration. §37 requires every interactive
feature to work without a mouse, and a drag-only reorder is the classic failure
of that rule. Contract: `Space` picks up, `↑`/`↓` (`←`/`→` in RTL) move,
`Space` drops, `Escape` cancels and restores original order, with an
`aria-live` region announcing each move.

### 2.5 Explicitly NOT built in Phase 1

Per §56, components for statistics, testimonials, partner logos, awards and
project counts may be *prepared* but must remain **unused and unexported**.
Nothing renders a company metric until verified data is supplied.

---

## 3. Route map

### 3.1 `apps/website` — port 3003, all under `/[locale]`

| Route | Purpose |
|---|---|
| `/` | Homepage |
| `/about` | מי אנחנו |
| `/why-organizer` | למה חברה מארגנת (§10) |
| `/how-we-work` | 11-stage process (§11) |
| `/projects` | Project index |
| `/projects/[slug]` | Detail + Transparency timeline |
| `/trust` | Trust Center (§15) |
| `/knowledge` | Knowledge Center index |
| `/knowledge/[category]` | Category listing |
| `/knowledge/[slug]` | Article |
| `/faq` | שאלות ותשובות |
| `/contact` | צור קשר |
| `/eligibility` | 7-step funnel (§18) |
| `/search` | Site-wide search (§48) |
| `/privacy`, `/terms` | Legal (§42) |
| `/admin/*` | Mock CMS (§51) |

Plus `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, and `not-found` /
`error` boundaries (§49).

### 3.2 `apps/portal` — existing app

Existing: `/login`, `/dashboard`, `/documents`, `/messages`, `/profile`,
`/support`, `/sign/[token]`, `/meetings/invite/[token]`.

Added in Phase 1 (frontend + mock only): `/verify`, `/project`, `/timeline`,
`/updates`, `/meetings`, `/questions`, `/contacts`, `/apartment`, `/settings`,
and `/rep/{overview,tasks,decisions,meetings,documents,milestones,open-items}`.

**`/sign/[token]` and `/meetings/invite/[token]` are load-bearing and stay
exactly as they are.** They are token-authenticated resident entry points that
were broken in every environment until recently and are now verified working.
They are not moved, renamed or restyled in Phase 1.

### 3.3 basePath — prepared, not enabled

Per the approval: architecture made basePath-compatible, configuration
**documented but not switched on**.

Made compatible by: no hardcoded absolute internal paths; all internal links via
next-intl's `Link`; all asset references relative or via `next/image`; any
`fetch` to same-origin routes built from a single `apiBase()` helper rather than
literal `/api/...`.

Cutover configuration, for Phase 2:

```ts
// apps/portal/next.config.ts
const nextConfig = { basePath: '/resident', assetPrefix: '/resident' }
```

```nginx
location /resident/ { proxy_pass http://127.0.0.1:3002; }
location /          { proxy_pass http://127.0.0.1:3003; }
```

Single origin keeps cookies first-party, which is what makes the BFF pattern
work. **Not activated in Phase 1** — flipping it while the Portal is the only
working resident signing path risks breaking it for no Phase 1 benefit.

---

## 4. Mock content model

### 4.1 Placement and separation

All mock data lives in `apps/website/src/mock/` and `apps/portal/src/mock/`,
never mixed with component code, and every module carries the same header:

```ts
/** MOCK DATA — replaced by the API in Phase 2. Contains no real project,
 *  resident or commercial information. */
```

Rationale for the header on every file rather than one README: these files are
the ones most likely to be copied into a component during a rush, and the marker
travels with the copy.

### 4.2 What mock projects may and may not contain

Permitted: name, city, neighbourhood, street, project type, current stage,
descriptions, imagery, public timeline, public updates, SEO metadata.

**Forbidden** (§55, restated in the approval): approvals · developer selections ·
signature percentages · unit counts · planning decisions · financial figures ·
municipal approvals.

Consequence for the UI, and this is a design constraint rather than a data one:
**the project card and detail page must be complete and attractive without any
numeric proof point.** If a layout only works with "87% signed", it is the wrong
layout for Phase 1 and would create pressure to invent a number.

### 4.3 Visibility states the UI must handle

Per §14 and the approval, every project view renders correctly for:
`internal` · `representatives_only` · `residents_only` · `public`, and for
`draft` / `unpublished` / early-stage projects with sparse data.

The index must therefore handle: no projects at all · projects with no image ·
projects with no updates · projects at stage 1 of 11.

---

## 5. API contract structure (`packages/api-contracts`)

### 5.1 Rules

- **Types only.** No fetch, no Zod, no runtime dependency. It is shared
  vocabulary, not a client.
- Mirrors the real gateway at `services/api-gateway` (the spec's `apps/api` does
  not exist here).
- **Defines nothing the backend must change.** Where a contract describes data
  the API does not yet expose, it is marked `@phase2` in a doc comment.

### 5.2 Layout

```
packages/api-contracts/src/
  common.ts          Pagination, ApiError, Visibility, Locale
  public.ts          Projects, updates, knowledge, FAQ, contact, eligibility
  auth.ts            OTP request/verify, session, logout
  resident.ts        Profile, projects, timeline, documents, meetings, updates
  representative.ts  Overview, tasks, decisions, milestones, open items
  cms.ts             Pages, blocks, media, versions
  index.ts
```

### 5.3 The visibility type is shared, and is not authorization

```ts
export type Visibility = 'public' | 'residents_only' | 'representatives_only' | 'internal'
```

Used by frontend models to decide what to *render*. Per §26 and decision 7:
**this is presentation, never authorization.** The backend remains authoritative
in Phase 2. A frontend that hides a field is not a frontend that protects it.

### 5.4 `packages/api-client` — proposed, deferred

Proposed for website + portal only. **Not built in Task 2**, and the existing
CRM client at `apps/crm/src/lib/api-client.ts` is **not refactored in Phase 1**,
per decision 6. Revisited once the website's real fetch needs are known — a
client designed against mock data would be designed against guesses.

---

## 6. Known conflicts carried into implementation

1. **`apps/web` stays running and wrong.** It is frozen, not fixed. Anyone
   visiting :3000 during Phase 1 sees CRM-SaaS positioning. Accepted per
   decision 3; retire after review.
2. **Portal calls the gateway directly from the browser** while CRM uses a BFF.
   Phase 1 does not change this — it is an API-behaviour change. Flagged for
   Phase 2.
3. **Knowledge Center, CMS, Votes/Campaigns/SupportTickets have no backend.**
   Phase 1 builds their UX against mock data; Phase 2 needs real endpoints and,
   for some, schema work that is currently out of scope.
4. **A second tool edits this repository concurrently.** Phase 1 work is on
   `feat/odg-website-phase1`. `scripts/dev-infra/snapshot.mjs` detects
   cross-tool edits.

---

## 7. Task order

| # | Task | Status |
|---|---|---|
| 1 | Remove fake social proof from `apps/web` | **done** — `7b05536` |
| 2 | `packages/api-contracts` | next |
| 3 | Extend `packages/design-system`; create `packages/ui` primitives | |
| 4 | Scaffold `apps/website` (3003, next-intl, RTL, a11y baseline) | |
| 5 | Mock data layer behind the contracts | |
| 6 | Home · Why Organizer · How We Work · About | |
| 7 | Projects · detail · Transparency timeline | |
| 8 | Knowledge Center · FAQ · Search | |
| 9 | Eligibility funnel | |
| 10 | Trust Center · Contact · legal | |
| 11 | Portal UX + Representation Dashboard | |
| 12 | CMS/Admin UX, block model, versioning, `GalleryManagerDnd` | |
| 13 | SEO · analytics events · PWA · error/empty states | |
| 14 | Accessibility · keyboard · responsive · targeted tests | |
| 15 | Phase 1 review report, then **STOP** | |
