# OpenDoor Group — CMS Architecture

**Status: PROPOSAL. Nothing in this document has been implemented.**

The goal this serves: OpenDoor staff update the website without a developer.
This document designs the content model and the future admin that makes that
true. It does not build a CMS.

---

## 1. The principle that is already in place

The homepage was built content-first from day one. Every sentence a visitor
reads on `/` comes from `getHomePage()`; the components in
`components/blocks/` render blocks and own no company messaging. That is not a
detail — it is the reason a CMS is a **swap** rather than a rewrite:

```
@urban-renewal/api-contracts  →  mock repositories  →  page components
         (types)                  (data source)          (presentation)
```

Phase 2 changes the BODY of each repository function to a `fetch`. Signatures,
return types and every call site stay the same. The work below extends that
model to projects and internal pages; it does not introduce a new one.

**What must not regress**: no page component may acquire a hardcoded sentence.
Every string a visitor reads belongs to the content layer, in both languages.

---

## 2. Content types

### 2.1 Pages (exists, extend)

`CmsPage` already carries `slug`, `title`, `publishState`, `blocks[]`,
per-locale `seo`, `updatedAt`, `updatedByName`. Internal pages become rows in
the same table the homepage already uses. No new page type is needed — an
editor building `/about` is arranging the same blocks the homepage arranges.

### 2.2 Blocks (exists, extend)

Current catalogue, all in `packages/api-contracts/src/cms.ts`:

| Block | Purpose | Used by |
|---|---|---|
| `HERO` | Page opening with CTAs | Home |
| `TEXT_SECTION` | Editorial prose, optional `roleMap` | Home |
| `FEATURE_GRID` | Titled paragraphs | Home |
| `PROCESS` | The stepped five-stage journey | Home |
| `PROJECT_TRANSPARENCY` | Demonstration timeline | Home |
| `TRUST` | Institutional index | Home |
| `PORTAL` | Two audiences + interface demo | Home |
| `PROJECTS` / `KNOWLEDGE` / `FAQ` | Collection references | Home |
| `MEDIA` | Full-bleed city band, slot-referenced | Home |
| `CTA` | Closing call to action | Home |

**Proposed additions**, driven by what the internal pages actually need and
nothing more:

| Block | Purpose | Needed by |
|---|---|---|
| `PAGE_HEADER` | The compact opening every internal page needs. Eyebrow, h1, standfirst, optional image slot. Explicitly NOT `HERO` — no CTA pair, no full aperture | every internal page |
| `STATEMENT` | One large editorial sentence with attribution-free supporting lines. The "אתם בעלי הדירות" moment, reusable | about, why-organizer, trust |
| `STEP_DETAIL` | One process stage at full page scale: number, title, what happens, what is asked of owners, what it produces | how-we-work |
| `FORM` | Renders a named form (`contact`, `eligibility`) with its consent copy and success message as content | contact, eligibility |
| `RESOURCE_LIST` | External authoritative links, rendered without logos or endorsement wording | trust |
| `PROSE` | Long legal/editorial body with headings and lists | privacy, terms, knowledge article |

Six additions covering eleven pages. Each exists because a page needs it, not
to round out a catalogue.

### 2.3 Projects (exists, extend substantially)

This is the largest change. The current `PublicProject` cannot hold the fields
§2 of the brief lists, and the fields it is missing are precisely the sensitive
ones.

**The core proposal: verification is a type, not a policy.**

```ts
/**
 * A fact about a real project that somebody has confirmed.
 *
 * The object CANNOT BE CONSTRUCTED without recording who verified it and
 * when. That is the enforcement: "developer, only if verified" stops being a
 * rule an editor might forget and becomes something the type system will not
 * let them skip. An unverified developer name has nowhere to live.
 */
export interface VerifiedFact<T> {
  value: T
  verifiedAt: IsoDate
  verifiedByName: string
  /** Optional pointer to the document or decision that verifies it. */
  source?: string
}

export interface ProjectParty {
  role: 'DEVELOPER' | 'LAWYER' | 'APPRAISER' | 'ARCHITECT' | 'SUPERVISOR' | 'OTHER'
  name: string
}
```

Extended project shape (every new field optional):

```ts
export interface PublicProject {
  // ── identity: always present ─────────────────────────────────────────
  id: string
  slug: string
  name: string
  type: ProjectType
  location: GeoContext            // city, neighborhood, street
  summary: string

  // ── narrative: safe, unverified-by-nature ────────────────────────────
  description?: string

  // ── SENSITIVE FACTS: all optional, all verification-wrapped ──────────
  currentStage?: VerifiedFact<ProjectStage>
  existingUnits?: VerifiedFact<number>
  proposedUnits?: VerifiedFact<number>
  buildingCount?: VerifiedFact<number>
  organizingStatus?: VerifiedFact<OrganizingStatus>
  planningStatus?: VerifiedFact<PlanningStatus>
  developer?: VerifiedFact<ProjectParty>
  professionals?: VerifiedFact<ProjectParty[]>
  milestones?: ProjectMilestone[]

  // ── media ────────────────────────────────────────────────────────────
  heroImage?: MediaAsset          // must carry imageType
  gallery?: MediaAsset[]
  beforeImages?: MediaAsset[]
  documents?: ProjectDocument[]

  // ── control ──────────────────────────────────────────────────────────
  residentUpdatesVisible?: boolean
  featured: boolean
  visibility: Visibility
  publishState: PublishState
  seo?: SeoMetadata
  updatedAt: IsoDateTime
}
```

Supporting types:

```ts
export type OrganizingStatus =
  | 'NOT_STARTED' | 'EARLY_CONVERSATION' | 'REPRESENTATION_FORMED' | 'PROCESS_ACTIVE'

export type PlanningStatus =
  | 'PRE_PLANNING' | 'PLAN_SUBMITTED' | 'PLAN_DEPOSITED'
  | 'PLAN_APPROVED' | 'PERMIT_STAGE' | 'UNDER_CONSTRUCTION'

export interface ProjectMilestone {
  id: string
  title: LocalizedText
  state: 'completed' | 'current' | 'upcoming'
  occurredAt?: IsoDate
  note?: LocalizedText
}

export interface ProjectDocument {
  id: string
  title: LocalizedText
  kind: 'PLAN' | 'PERMIT' | 'SUMMARY' | 'OTHER'
  /** A signed, expiring URL issued per request. NEVER a storage key. */
  url: string
  visibility: Visibility
  mimeType?: string
  sizeBytes?: number
}
```

**Note the breaking change**: `currentStage` moves from `ProjectStage` to
`VerifiedFact<ProjectStage>`. That is deliberate — the current type allows a
stage to be set with no record of who confirmed it, which is the exact failure
the provenance rules exist to prevent. It touches `projects-block.tsx`,
`transparency-block.tsx` and the repository projection, all of which are ours.

**The completeness rule stays**: a project page must read as finished with only
name, location, description and one image. Every block above renders only when
its data exists, and the page composition (see the design plan) is built so
that absence leaves no visible hole.

### 2.4 Knowledge, FAQ (exist, one change)

`KnowledgeArticle` currently carries `locale: 'he'` — one record per language.
Every other content type is one record serving both languages via
`LocalizedText`. **Proposal: align knowledge and FAQ to the `LocalizedText`
model.** Two reasons: an editor should translate by filling a second field, not
by cloning a record; and per-locale records drift out of structural sync, which
is how a site ends up with five Hebrew articles and three English ones that do
not correspond.

### 2.5 Navigation, Settings (new)

```ts
export interface NavigationConfig {
  primary: NavEntry[]          // desktop header, currently 5 hardcoded keys
  footerGroups: NavGroup[]
  residentPortalHref: string   // today a constant; becomes settings
}

export interface SiteSettings {
  brandName: LocalizedText
  descriptor: LocalizedText
  ctaLabels: Record<'eligibility' | 'eligibilityShort' | 'residentPortal', LocalizedText>
  contactPhone?: string
  contactEmail?: string
  legalEntityName?: string
  registrationNumber?: string
  socialShareImage?: MediaAsset
}
```

Everything here is currently a constant in `lib/navigation.ts` or the message
catalogue. Moving it to settings is what lets staff change a CTA label without
a deploy.

### 2.6 Media (new)

```ts
export interface MediaRecord extends MediaAsset {
  /** REQUIRED in the CMS, unlike the optional field on MediaAsset today. */
  imageType: ImageClaim
  uploadedAt: IsoDateTime
  uploadedByName: string
  /** Set only when imageType is VERIFIED_PROJECT_PHOTO. */
  depictsProjectId?: string
}
```

**This is where image truth is enforced.** The upload form asks what the image
may claim before it asks anything else, and `VERIFIED_PROJECT_PHOTO` requires
naming the project it depicts. An `EDITORIAL_CONTEXT` image is then not
selectable in a project's hero slot at all — the CMS refuses it, rather than
trusting an editor to remember the rule.

---

## 3. Localisation model

One record, two languages, per field:

```ts
type LocalizedText = { he: string; en: string }
```

The admin renders both fields side by side with the Hebrew first (it is the
primary authoring language and the default locale). A missing English value
falls back to Hebrew at render time via `resolveLocalized`, which already
exists — so a half-translated page degrades to readable rather than blank.

**The admin must show translation completeness**, per page and per project, or
English quietly rots. A simple "3 of 11 fields translated" line is enough.

---

## 4. Publish workflow

Two states, already modelled: `draft` and `published`, plus `visibility`
(`public` / `internal`). Both are required, and they are independent:

- `draft` + `internal` → the normal state of a new record
- `published` + `public` → live
- `published` + `internal` → finished content held back deliberately

The website repository filters on both (`isPubliclyVisible`). Nothing renders
publicly by accident.

**Proposed addition: a preview URL.** An editor must be able to see a draft
page as it will look before publishing it. Without that they will publish to
check, which is how a half-finished page reaches the public.

---

## 5. The future admin

Designed for a company manager, not a developer. Nine sections:

### Dashboard
What changed recently, what is sitting in draft, and what is incomplete —
specifically: pages with untranslated fields, projects missing a hero image,
image slots with no asset. The dashboard's job is to answer "what needs my
attention" without the manager going looking.

### Pages
List of pages with status and last-edited. Opening one shows its blocks in
order, each collapsible, with drag to reorder, a visibility toggle per block,
and "add block" offering the catalogue by plain name ("prose section",
"process steps", "call to action") rather than by type constant.

**No styling controls anywhere.** The editor changes words, images, order and
visibility. Spacing, colour and typography come from the design tokens. This
is the single rule that keeps the site coherent after a year of edits by
people who did not design it.

### Projects
List with status, city and completeness. The project form is grouped:

1. **Basics** — name, city, neighborhood, type, description. Always editable.
2. **Verified facts** — a visually distinct panel. Each field pairs a value
   with "who confirmed this and when", and the value cannot be saved without
   it. Copy at the top of the panel states plainly why.
3. **Media** — hero, gallery, before images. The picker only offers images
   whose claim permits the slot.
4. **Milestones** — add, reorder, mark completed/current/upcoming.
5. **Publishing** — draft/published, public/internal, featured, SEO.

### Knowledge / FAQ
Straightforward list + edit. Knowledge gains a category picker and a related-
articles selector. Both show Hebrew and English side by side.

### Media
Grid of uploads. Upload asks for the claim first, then alt text (required, and
the form explains what good alt text does), then optional caption and credit.
Focal point is set by clicking the image.

### Navigation
Reorder the header and footer. A route that has no published page cannot be
added — that is what prevents the dead links this site has already had.

### SEO
Per-page title and description with length guidance, the social share image,
and a read-only view of what the sitemap currently contains.

### Settings
Brand name, descriptor, CTA labels, contact details, legal identifiers.

### Roles
Two are enough: **Editor** (everything except publishing and settings) and
**Manager** (everything). A third role is not justified at this size.

---

## 6. What this phase delivers, and what it does not

**Delivers (design and types only):**
- The extended contracts above, in `packages/api-contracts`
- Empty project templates as draft records, so the shape exists to fill
- Content/presentation separation extended to all eleven internal pages
- This document

**Does not deliver:**
- Any admin interface
- Any database table, migration or backend route
- Any change to the CRM, Portal, Prisma, Redis, MinIO or authentication

**The natural build order afterwards**, when you decide to start:

1. Persist the content model behind the existing API gateway (it already has
   auth, RBAC and file handling — the CMS should not get its own)
2. Media library first: image truth is the rule most expensive to retrofit
3. Projects, because that is the content that changes most often
4. Pages and blocks
5. Navigation, SEO, settings

Steps 1 and 2 are the ones worth doing properly. The rest is CRUD.

---

# Appendix A. Editing a verified fact

*Added during Real Project Pilot 1. This is a requirement on the future CMS,
not something built yet.*

## The rule

**A changed value must never inherit the verification of the value it
replaced.**

When an editor changes a material fact, the new value is unverified from the
moment it is saved, whatever the old one was. Verification attaches to a
*specific value checked on a specific date*, not to the field it happens to
live in.

```
verified fact  ──edit──▶  new value, UNVERIFIED
                              │
                              ▼
                          verification  ──▶  publishable
```

## Why this is the whole point of the model

The failure it prevents is quiet and total. Somebody corrects a unit count from
84 to 96. The record still carries `verifiedAt: 2026-08-12` and a colleague's
name. The page now publishes a number nobody checked, stamped with a date and a
person that vouch for a *different* number — and the audit trail actively
asserts that it was verified, so the mistake survives every subsequent review.

That is worse than having no verification model at all, because the model's own
metadata is what makes the wrong figure look trustworthy.

## What this means in practice

- **The unit of verification is the value, not the field.** Store the verified
  value alongside the verification, so a comparison at save time can tell
  whether the thing that was checked is still the thing being shown.
- **Editing clears the verification.** `verifiedAt`, `verifiedByName` and
  `source` are dropped, not preserved and not greyed out. A partially-filled
  verification record invites somebody to complete it from memory.
- **The public consequence is automatic and needs no extra rule.** An
  unverified material fact does not render — that is already how every project
  surface works. So a mid-edit figure disappears from the site until it is
  re-verified, rather than sitting there wrong. The page is built to be
  complete without any given field, which is what makes this safe.
- **A no-op edit is still an edit.** If the value is saved unchanged, the
  verification may stand; if the value differs by so much as a digit, it does
  not. Do not offer "keep the existing verification" as a checkbox.
- **Editorial fields are unaffected.** Name, summary, description, captions and
  SEO use `DRAFT → REVIEW → PUBLISHED` and carry no verification to invalidate.
  Only the fields in `MATERIAL_CLAIM_FIELDS` are in scope, plus per-milestone
  verification.
- **Verification is not a permission.** Whoever may edit a project need not be
  whoever may verify a fact. Separating them is what makes the second signature
  worth anything, and it is a natural fit for the existing RBAC groups.

## Fields in scope

Everything wrapped in `VerifiedFact` on `PublicProject`: `currentStage`,
`currentPhase`, `existingUnits`, `proposedUnits`, `buildingCount`,
`planningStatus`, `developer`, `professionals`, `approvals`, `permits`,
`materialDates` — plus `ProjectMilestone.verification`.

`MATERIAL_CLAIM_FIELDS` in `packages/api-contracts/src/verification.ts` is
exported as data so the CMS can drive this from the contract rather than from a
second hand-maintained list.

---

# Appendix B. Project content localisation

*Added during Real Project Pilot 1, which is the first time real Hebrew project
content rendered on the English site.*

## Current state

`CmsPage` content is fully localised: every editorial string is `LocalizedText`
and resolved once at the page boundary. **Project records are not.** Several
project fields are plain `string`, so a Hebrew value renders unchanged on
`/en`.

| Field | Type today | Should be |
|---|---|---|
| `name` | `string` | **stays `string`** — see below |
| `location.city` | `string` | `LocalizedText` |
| `location.neighborhood` | `string` | `LocalizedText` |
| `location.street` | `string` | **stays `string`** |
| `summary` | `string` | `LocalizedText` |
| `description` | `string` | `LocalizedText` |
| `seo` | `SeoMetadata` | per-locale, as `CmsPage.seo` already is |
| `MediaAsset.caption` | `string` | `LocalizedText` |
| `MediaAsset.alt` | `string` | `LocalizedText` |
| `ProjectParty.name` | `string` | **stays `string`** |
| `ProjectApproval.authority` | `string` | `LocalizedText` |

## Why some fields deliberately stay single-language

**Do not mechanically transliterate proper nouns.** A complex is called
החיד"א 26 and a company is called what it is called. "HaHida 26" is not a
translation; it is a spelling nobody uses, it matches no municipal record, no
sign on the building and no search a resident would type. A single-language
identity is correct, not a gap — the same reason a French address is not
rewritten in an English document.

Cities and neighbourhoods are different: ירושלים genuinely has an established
English form, and a reader of the English site expects it.

If an official English name for a complex is later adopted — by the
representation, or in an English-language document — the right shape is an
explicit optional field (`nameEn`, or `LocalizedText` with an optional `en`)
that an editor fills deliberately. It is never derived.

## Sequencing

This is a breaking contract change touching the card projection, search, the
sitemap and the CRM's own project shape. **It was deliberately not done during
Pilot 1**, where the goal was to prove the sparse-data architecture against a
real record. It should be a single planned migration rather than a field at a
time, since each partial change leaves the English site in a differently mixed
state.

Until then the English project page correctly shows Hebrew identity with
English UI chrome and English editorial framing, which is honest and readable.

---

# Appendix C. The four layers, and the editor that has to respect them

*Added during Real Project Pilot 2, which is the first time a project arrived
with confidential material attached.*

## What the pilot exposed

The Tchernichovsky-Shimoni feasibility workbook contains, in one file and all
attached to one complex: a registered parcel area, a demolition estimate, a
unit-mix scenario, and a developer's profit figure.

Any model that accepted those onto `PublicProject` would put a margin one
`publishState` flag away from the public internet. The layers are not a tidiness
preference; they are what stops a publish button from being a disclosure.

## The four layers

| Layer | Holds | Audience |
|---|---|---|
| 1. **Public content** | `PublicProject` | anyone |
| 2. **Internal project data** | measured/registered detail, candidate boundary, working stage | staff |
| 3. **Verification / provenance** | sources, quality flags, fact candidates | staff |
| 4. **Feasibility scenarios** | assumptions, modelled outputs | staff, narrower |

Types for 2, 3 and 4 are defined in
`packages/api-contracts/src/project-internal.ts`. **Types only** — no data, no
runtime value, nothing in any bundle. Nothing implements them yet.

### The one-way rule

A value moves from layers 2–4 into layer 1 **one field at a time, by a person,
through verification**, arriving as a `VerifiedFact`.

There is deliberately **no `toPublic(internal)` helper**, and there must never
be one. A function that maps an internal object to a public one is precisely
the accident this separation exists to prevent: it turns a reviewed,
field-by-field decision into a single call somebody can make without reading
what is in it.

**Publishing a project must never publish layers 2–4.** Publication is a
property of the public record, not of the complex.

## The editor

A project editor needs these as separate areas, and an administrator must be
able to work in all of them without code:

| Tab | Contents |
|---|---|
| **Public content** | name, slug, city, neighbourhood, street, summary, description, role override |
| **Internal data** | candidate boundary, registered/measured areas, sub-parcel counts, working stage |
| **Verification** | sources, reliability, quality flags, fact candidates and their classification |
| **Feasibility** | scenarios, assumptions, outputs — read-mostly, imported not typed |
| **Media** | hero, gallery, ordering, focal point, alt text, captions, classification |
| **Timeline** | milestones, state, date or approximate period, ordering |
| **SEO** | title, description, noIndex |
| **Publication** | draft / review / published / archived, visibility |

### Rules the editor must enforce

1. **Changing a verified fact invalidates its verification.** Appendix A.
2. **Internal data never becomes public because a project was published.** The
   publish action touches layer 1 only.
3. **A scenario output is never offered as a public fact.** No "copy to public"
   affordance on layer 4 at all — not even a guarded one.
4. **A blocking source quality flag prevents verification** of anything drawn
   from that source, whatever its overall reliability says.
5. **Verifying is a separate permission from editing.** A second signature that
   the same person can supply is not a second signature.
6. **Values are captured as written.** "greater of 22 sqm or 22%" and
   "337.18" are stored as read. Parsing at capture time discards the
   qualification that is often the point, and invites the rounding that turns
   a calculation into a claim.

## Present state

The website reads layer 1 only, and has no access to the others because they do
not exist as data anywhere it can reach. Pilot 2's actual values live in
`docs/ODG_PILOT_2_SOURCE_RECORD.md`, which `apps/website` does not import — a
number outside the module graph cannot leak from it.

---

# Appendix D. Pass 4A: what was built

*The foundation. Routing, navigation, the localisation architecture and the
domain model. No editor, no persistence, no API.*

## D.1 The amended self-verification policy

**Superseding Appendix C, rule 5.** The design gate forbade anyone from
verifying a value they had edited. That is now permitted, and recorded.

`content.edit` and `fact.verify` remain **separate capabilities**, and most
editors hold only the first. But a user who holds both may verify their own
edit, and the result is stored as `SELF_VERIFIED` rather than refused.

**Why the prohibition was wrong.** In a two-person company its practical effect
is that nothing can ever be published, so it gets worked around by sharing a
login — which destroys the audit trail rather than merely annotating it.
Recording what happened honestly beats prohibiting what will happen anyway.

`SELF_VERIFIED` is an **audit outcome, not an error**. It is publishable exactly
like `VERIFIED`. The UI reports it quietly, in the verification history, and
does not warn or block.

### The future second review

`SECOND_REVIEW_REQUIRED` exists in `VerificationStatus` now, and
`deriveVerificationStatus` already honours a `requiresSecondReview` flag.
`SECOND_REVIEW_FIELDS` is an **empty list** in V1.

Turning it on for a category of fact is an edit to that list. No verification
logic changes, and no four-eyes workflow is built in this pass.

## D.2 Localisation architecture

`LocalizedText` (both languages required) is unchanged and still correct for
the site's own fixed copy: we wrote it twice, so a missing half is a bug.

**`LocalizedContent` is new** and is what every editor-authored field uses:

```ts
interface LocalizedContent { he: string; en?: string }
```

Hebrew is required because it is the source. English is absent until a person
supplies one, and **English is never a condition of saving**.

### Fallback policy, per field category

Neither answer is right everywhere, so the policy travels with the field.
`PROJECT_TEXT_FALLBACK` exports the map as data, and the CMS drives its editor
warnings from the same map.

| Policy | Behaviour on `/en` with no English | Fields |
|---|---|---|
| **`SOURCE`** | renders the Hebrew | `name`, `location.city`, `location.neighborhood`, `summary`, `media.alt`, `media.caption`, `approval.label`, `approval.authority`, `milestone.title`, `dateRecord.label` |
| **`OMIT`** | renders nothing; the section disappears | `description`, `role`, `timelineNote`, `milestone.note` |

`SOURCE` for a name or a card summary: a Hebrew phrase in an English sentence
reads as untranslated, an empty card reads as broken. `OMIT` for long-form
editorial: three Hebrew paragraphs under an English heading serve nobody.

### Fields that stay single-language, deliberately

`location.street`, `ProjectParty.name`, `MediaAsset.credit`. A street address, a
company's registered name and a photographer's name are written once and are not
translated. A language pair there would invite a transliteration — and
"HaHida 26" is a spelling nobody uses, that matches no municipal record, and
that no resident would search for.

### One interaction worth knowing

`role` carries `OMIT`. A project whose role override has no English therefore
falls back on `/en` to the **reviewed site-level role description**, not to an
empty column. The renderer branches on the resolved value, not on the field's
presence.

## D.3 CMS route map

Inside `apps/crm`, under `/site`. Same shell, same sign-in, same tenant context.

```
/site                      dashboard
/site/pages                the eight fixed pages
/site/projects             project list
/site/projects/[slug]      project editor (eight areas, Pass 4B+)
/site/knowledge            articles
/site/faq                  questions
/site/media                media library
/site/navigation           main menu
/site/seo                  search titles and descriptions
/site/settings             contact details and site defaults
```

`SITE_NAV` in `components/site/site-nav.ts` is the single definition; the rail,
the section headers and the breadcrumbs all read it, so a route cannot appear in
one and be missing from another.

**One entry in the CRM sidebar** leads here. Nine would bury both sets and blur
the distinction between managing a renewal process and managing what the public
can read.

## D.4 Domain model

Types only. No table, no migration, no endpoint.

| Type | Holds |
|---|---|
| `ExposureLevel` | `PUBLIC` · `INTERNAL` · `FEASIBILITY` |
| `CmsContentItem<T>` | the editorial envelope: state, SEO, authorship, revision pointers |
| `PublicationState` | `DRAFT` · `IN_REVIEW` · `PUBLISHED` · `ARCHIVED` |
| `CmsRevision<T>` | full snapshots, never deltas; publish revisions never thinned |
| `CmsMediaItem` | classification and alt text both required |
| `CmsRole` / `CmsCapability` | separate from `UserRole`, mapped from it |
| `VerificationRecord<T>` | value **and** `verifiedValue`, editor **and** verifier |
| `VerificationAuditEntry` | append-only; never updated, never deleted |

`verifiedValue` is the field the model turns on. Comparing it against `value` is
what makes "editing invalidates verification" a **mechanism** rather than an
intention — without it the rule depends on every write path remembering to clear
a flag, and the one that forgets is the one that publishes a corrected number
under someone else's signature.

## D.5 The public boundary

Unchanged from Pilot 2 and reinforced:

- The website consumes `PublicProject` only. `PublicVerifiedFact` has neither a
  verifier nor a source; both are stripped at the repository boundary.
- `ProjectInternalData` and `FeasibilityScenario` are types with no data and no
  reader in `apps/website`.
- **There is deliberately no generic `toPublic(item)`.** A function that maps an
  arbitrary item to its public form without consulting exposure is precisely the
  accident the separation exists to prevent, and there is no `publishAll`.
- Pilot 2's workbook figures live in `docs/`, which `apps/website` does not
  import. A number outside the module graph cannot leak from it.

## D.6 Implementation sequence

| Phase | Ships | Exit gate |
|---|---|---|
| **4A** *(this pass)* | contracts, localisation, CMS shell, routes | every page renders identically before and after the migration |
| 4B | pages list, block editor, draft/review/publish, preview, revisions | edit a sentence and publish it, end to end, without code |
| 4C | media library over MinIO | an image without classification or alt text cannot publish |
| 4D | project editor, verification, publication check | publishing an unverified fact fails in the API, not just the UI |
| 4E | knowledge, FAQ, navigation, settings; delete the fixtures | no site content is edited in code |

Persistence, the API and permission enforcement arrive with 4B, which is the
first phase that writes anything. A permission gate in front of a read-only
shell would read as protection while providing none.
