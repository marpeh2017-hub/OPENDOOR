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
