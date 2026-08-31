# OpenDoor Group — Site Completion, Content & QA Pass

Date: 2026-08-30. Base: Home V3 (`9b7af34`). Scope: `apps/website` only —
no backend, CRM, Portal app, Prisma, auth or production integration touched.

---

## 1. Route inventory

| Route | He | En | Notes |
|---|---|---|---|
| `/` | 200 → redirects to default locale | | |
| `/[locale]` (Home) | 200 | 200 | Full content, V3 |
| `/[locale]/about` | 200 | 200 | Stub (`PageShell`) |
| `/[locale]/why-organizer` | 200 | 200 | Stub |
| `/[locale]/how-we-work` | 200 | 200 | Stub |
| `/[locale]/projects` | 200 | 200 | Stub |
| `/[locale]/projects/[slug]` | 200 / 404 | 200 / 404 | Stub content; **routing fixed this pass** |
| `/[locale]/trust` | 200 | 200 | Stub |
| `/[locale]/knowledge` | 200 | 200 | Stub |
| `/[locale]/knowledge/[slug]` | 200 / 404 | 200 / 404 | **Route did not exist before this pass** |
| `/[locale]/faq` | 200 | 200 | Stub |
| `/[locale]/contact` | 200 | 200 | Stub, no form |
| `/[locale]/eligibility` | 200 | 200 | Stub, no form |
| `/[locale]/search` | 200 | 200 | Stub |
| `/[locale]/privacy` | 200 | 200 | Stub |
| `/[locale]/terms` | 200 | 200 | Stub |
| `/[locale]/resident-portal` | 200 | 200 | **Route did not exist before this pass** |
| `/[locale]/[...rest]` | 404 (localised) | 404 (localised) | Catch-all, correct |
| `/robots.txt` | — | — | **Added this pass** |
| `/sitemap.xml` | — | — | **Added this pass** |

All 200s and 404s above were verified by actually requesting each URL against
a running dev server, not inferred from the route tree.

---

## 2. Link audit

| Link | Source | Classification |
|---|---|---|
| Header primary nav (5 items) | `site-header.tsx` | WORKING |
| Header eligibility CTA | `site-header.tsx` | WORKING (destination is a content stub) |
| Header resident-portal link | `site-header.tsx` | **FIXED** — was a dead link (no route existed); now resolves to a placeholder. Real functionality is FUTURE INTEGRATION (Portal app cutover) |
| Mobile menu (full 7-item list + resident portal) | `mobile-nav.tsx` | WORKING |
| Footer nav (3 groups) | `site-footer.tsx` | WORKING |
| Footer privacy/terms | `site-footer.tsx` | WORKING (destination is a content stub) |
| Language switcher | `language-switcher.tsx` | WORKING — preserves current path across locales, verified on both directions |
| Homepage → Projects card links | `projects-block.tsx` | WORKING |
| Homepage → Knowledge article links | `knowledge-block.tsx` | **FIXED** — every one of these 404'd; no `/knowledge/[slug]` route existed |
| Homepage → "all projects" / "all questions" / "knowledge centre" links | various blocks | WORKING |
| Homepage → why-organizer CTA (from TEXT_SECTION) | `page.tsx` | WORKING |
| Homepage → eligibility (hero + closing CTA) | `hero-block.tsx`, `cta-block.tsx` | WORKING (destination is a content stub) |
| Homepage → resident-portal (hero secondary CTA) | `hero-block.tsx` | **FIXED**, same as header |
| `/projects/[slug]` for an unknown slug | — | **FIXED** — previously rendered 200 with the raw slug as a title; now 404s correctly |
| External resources (gov.il, consumer authority) | `knowledge.ts` fixture | Not currently linked from any page — see content questions §6. No broken link exists because nothing points at it yet |
| `href="#"` anywhere | — | None found |
| `target="_blank"` anywhere | — | None found (so no missing `rel="noopener"` risk either) |
| Hardcoded `localhost` anywhere | — | None found |
| Duplicate routes | — | None found |
| Orphan pages (built but unlinked from anywhere) | — | None found |

**Total dead links found**: 2 route classes (resident-portal, every knowledge
article link) — both now fixed by scaffolding the missing routes to the same
`PageShell` skeleton pattern already used everywhere else. Nothing was
faked: no login form, no article body, no functionality that would only
pretend to work.

---

## 3. Technical fixes applied (unambiguous, no content invented)

1. **`/knowledge/[slug]` route created.** Resolves via `getArticleBySlug`,
   404s on no match. Was previously fully absent — every knowledge link on
   the site 404'd.
2. **`/resident-portal` route created.** Placeholder shell only, per
   `RESIDENT_PORTAL_HREF`'s own documented plan for a future cross-app
   cutover. No fake authentication was built.
3. **`/projects/[slug]` now 404s for an unknown slug**, and its metadata
   (`<title>`, description) now comes from the resolved project's real name
   and summary instead of the raw URL slug.
4. **`STUB_ROBOTS` (`noindex, follow`) applied to all 13 placeholder pages**
   (about, why-organizer, how-we-work, projects listing, trust, knowledge
   listing, faq, contact, eligibility, search, privacy, terms,
   resident-portal). Prevents search engines from indexing thirteen
   near-identical "coming soon" pages as duplicate/thin content. Remove it
   from each page in the same change that gives it real content.
5. **`robots.txt` and `sitemap.xml` added.** The sitemap is generated from
   the same repository functions every page already uses (published/public
   projects, published articles), with locale alternates, and emits nothing
   without `NEXT_PUBLIC_SITE_URL` configured (a relative sitemap URL is
   invalid). Both were completely absent before this pass.
6. **Open Graph / Twitter metadata structure added** to the root layout
   (type, site name, locale, title, description). No image — none exists;
   see `ODG_IMAGE_REQUIREMENTS.md`. Shipping the structure now makes adding
   the image later a one-line change.
7. **Header's resident-portal link now uses the `RESIDENT_PORTAL_HREF`
   constant** instead of a second hardcoded literal, so the two cannot drift
   when the Phase 2 cutover changes the path.

None of the above touched copy, layout, the visual system, or any approved
V2/V3 decision.

---

## 4. Editorial style fix — maqaf and em dash removed

Per the new permanent OpenDoor style rule, every real (non-comment) occurrence
of `—` (em dash, U+2014) and `־` (Hebrew maqaf, U+05BE) was removed from
user-facing content across `apps/website` — messages, mock content, headings,
buttons, SEO titles/descriptions, and the internal image-inventory spec text.

**Method**: every `.ts`/`.tsx` file was scanned with a comment-aware script
that separates real content strings from `/** */` and `{/* */}` developer
comments (comments were left untouched — they are not user-facing and this
rule does not apply to them). 27 real content occurrences were found and
rewritten *naturally* — commas, colons, or sentence restructuring, per your
exact examples — never mechanically deleted. A few notable rewrites:

- Brand name: אופן־דور → **אופן-דור** (maqaf → standard hyphen; this is a
  proper-noun compound, the one case the rule itself calls "genuinely
  necessary" for a hyphen)
- `פינוי־בינוי` → **פינוי בינוי** (space, exactly your own worked example)
- `חברה מארגנת — לא יזם` → **חברה מארגנת, לא יזם**
- `OpenDoor Group — representing...` (SEO title) → **OpenDoor Group:
  representing...**
- Three fictional demo-project names (`מתחם הדוגמה — שלב ביניים` etc.) →
  comma-joined

**Verification**: the fix was re-checked twice — once by re-scanning every
source file, and once by fetching the actually-rendered HTML of every route in
both locales (`/he/*` and `/en/*`, twelve routes) and counting real Unicode
codepoints U+05BE and U+2014 in each. **Result: zero in both passes.**
The only remaining occurrences anywhere in the codebase are inside developer
`/** */` comments, which are never sent to a browser.

This is now recorded as a permanent editorial rule — see the note at the top
of `src/mock/fixtures/pages.ts` is the natural place to add a one-line pointer
if a future editor needs the reminder; I have not done so as it wasn't asked
for, but can add it on request.

---

## 5. SEO

| Check | Status |
|---|---|
| Unique `<title>` per page | Working — every route has its own via `generateMetadata`, using real content since fix #3 above |
| Meta description | Homepage: unique, real. Stub pages: none (acceptable — they're `noindex`) |
| Canonical strategy | **Not implemented.** Blocked on the locale-URL-strategy decision already recorded in Phase 1 planning docs; not re-opened in this pass |
| Robots (page-level) | Fixed — see §3.4 |
| Robots.txt / sitemap.xml | Fixed — see §3.5, previously absent |
| Open Graph / Twitter | Structure added, no image — see §3.6 |
| Heading hierarchy | One `h1` per page, no skips, verified on Home; stub pages are a single h1 with two paragraphs |
| Internal linking | All working per §2 |
| Descriptive link text | Yes — no "click here" pattern anywhere |
| Image alt strategy | Every rendered image slot has a required `alt`; decorative SVG is `aria-hidden` |
| Structured data (Organization/WebSite/BreadcrumbList/FAQPage) | **Not added.** See below |

**Structured data was deliberately not added.** An `Organization` schema
without a verified registration number, address or logo would either omit
fields search engines expect or fabricate them — both are worse than absence.
A minimal `WebSite` schema (name + URL) is safe once the production domain
and the exact legal/marketing name are confirmed (see
`ODG_CONTENT_QUESTIONS.md` §3). `FAQPage` schema is worth adding once `/faq`
has real, stable content rather than a five-item preview list still marked as
mock data.

---

## 6. Accessibility

No regression found on Home V3: **re-measured at 211 elements checked, 0
contrast failures**, one `h1`, no heading skips, no horizontal overflow at any
of the five required widths, identical to the figures reported at the V3 gate.

Stub pages (13 routes, one shared component `PageShell`): single `h1`,
correct landmark structure inherited from the root layout (header/main/footer
are real elements), no overflow at 375px, `noindex` correctly present in the
rendered `<head>` (spot-checked on `/about`).

No keyboard, focus-order, or reduced-motion issues were introduced — this
pass touched no interactive component.

---

## 7. Responsive

Re-verified at 1440 / 1024 / 768 / 390 / 375 on the homepage post-edit: no
overflow, no broken line breaks introduced by the punctuation rewrites (all
were checked for length against their containers). Spot-checked `/about` at
375px: no overflow.

---

## 8. Performance

No new client components, no new dependencies, no new render-blocking
resources. `robots.ts` and `sitemap.ts` are server-only route handlers with
zero client JS. `lib/seo.ts` exports one constant object. First Load JS is
unchanged from the V3 baseline (102 kB shared, homepage 115 kB) — confirmed
by rebuilding after all changes.

---

## 9. Trust / legal claims requiring verification

See `ODG_CONTENT_QUESTIONS.md` §1 for the full write-up. One claim, repeated
four times across the site, needs your explicit confirmation: **"the service
involves no direct cost to the apartment owners."** Nothing was changed —
this is existing, previously-approved copy — but the audit brief specifically
asks that this category of claim be surfaced, not silently left alone.

No other guarantee, timeline commitment, approval claim, developer-selection
claim, or savings figure was found anywhere in the current copy. The absence
is deliberate and pre-dates this pass (the provenance rules enforced since
Phase 1 already forbid inventing any of these).

---

## 10. What still needs you

Everything in this section is also in `ODG_CONTENT_QUESTIONS.md`, restated
here as a priority-ordered punch list:

1. **Build `/contact` and `/eligibility` as real forms.** This is the
   biggest gap on the site — every primary conversion path currently ends at
   a placeholder. Needs a scoping decision (where does a submission go)
   before it can be built.
2. Confirm or revise the "no direct cost" claim (§9 above).
3. Decide on English translations for the six Knowledge Centre articles and
   five FAQ entries (currently Hebrew-only by content-model design).
4. Supply legal/registration details for the footer and for `/privacy` and
   `/terms` to become real pages.
5. Supply (or commission) the image assets in `ODG_IMAGE_REQUIREMENTS.md` —
   none currently exist; the site works correctly without them via the
   generated OpenDoor graphics, but the Open Graph share image (P1) has no
   fallback at all today.

No further visual redesign, and no propagation of the Home V3 visual system
to other pages, was done in this pass — as instructed.
