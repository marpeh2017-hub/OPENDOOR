# OpenDoor Group — Internal Pages: Design & Content Plan

**Status: PROPOSAL. Nothing has been implemented. Awaiting approval.**

Home V3 is untouched by everything below.

---

## 1. What exists today

Eleven internal routes exist and navigate correctly. All eleven render
`PageShell` — an `h1` and the sentence "התוכן לדף זה נמצא בהכנה". They are
honest skeletons, not broken pages, and they are all marked `noindex`.

So this is not a repair job. It is building eleven pages from a working
foundation: real routing, real landmarks, real heading structure, and a
locked visual language.

---

## 2. Brand decision, applied

Per your instruction, `OpenDoor Group` becomes the primary brand name **on the
Hebrew site as well**. `אופן-דור גרופ` is retired from user-facing copy.

Where the name currently appears and what changes:

| Location | Now | Proposed |
|---|---|---|
| `messages.brand.name` | אופן-דור גרופ | OpenDoor Group |
| `messages.brand.tagline` | ייצוג וארגון בעלי דירות בהתחדשות עירונית | unchanged |
| Header wordmark | אופן-דור גרופ | OpenDoor Group |
| Page title template | `%s \| אופן-דור גרופ` | `%s \| OpenDoor Group` |
| Homepage h1 | אופן-דור גרופ מייצגת ומארגנת... | OpenDoor Group מייצגת ומארגנת... |
| Homepage SEO title | אופן-דור גרופ: ייצוג... | OpenDoor Group: ייצוג... |
| Knowledge `attribution` ×6 | אופן-דור גרופ | OpenDoor Group |
| FAQ "האם אופן-דור היא יזם?" | — | "האם OpenDoor Group היא יזם?" |
| Role map node | אופן-דור גרופ | OpenDoor Group |
| Footer | אופן-דור גרופ | OpenDoor Group |

**Typographic note worth your attention**: a Latin brand name inside Hebrew
RTL text is completely normal in Israeli professional writing and needs no
special handling — the bidi algorithm places it correctly. It also removes the
maqaf/hyphen problem entirely, which is a real simplification. The one place
to keep the Hebrew form is any legal placeholder that eventually needs the
registered entity name.

**Positioning shift**: Jerusalem stops being the identity and becomes one
context. Concretely — the homepage keeps its Jerusalem visual moments, but
internal pages draw on Israeli urban renewal generally, and no copy anywhere
says or implies "a Jerusalem company".

---

## 3. The projects problem, stated plainly

You have asked me to remove the realistic placeholder project names
(`חיים ברלין 39-40`, `בן גוריון 8, רמת גן`, `הרצל 45, תל אביב`) and not to
invent replacements. That is the right call — those names read as claims.

**The consequence you should decide on before I build:** with them gone, and
the three fictional `מתחם הדוגמה` fixtures being internal-only, **the projects
section on the homepage and the entire `/projects` page have nothing to show.**

Three honest options:

**Option 1 — Ship the empty state (recommended).**
`/projects` renders a designed empty state: an explanation of what OpenDoor
does with complexes, and the eligibility CTA. The homepage's PROJECTS block is
hidden via its existing `hidden` flag until there is a project to show. Costs
nothing, claims nothing, and the CMS turns it back on the day you add a real
project. The empty state is designed to look deliberate, not broken.

**Option 2 — Supply one or more real projects now.**
You confirm names, cities and one-line descriptions for projects you are
willing to publish. No stages, numbers or developers needed — the card and
detail page are built to look complete without them. This is the strongest
outcome if the projects exist.

**Option 3 — Replace the section with a "how we choose complexes" explainer.**
Keeps a projects-shaped moment on the homepage without any project. Weaker
than 1 or 2; mentioned for completeness.

I recommend **Option 1 now, Option 2 as soon as you can confirm names** — they
are compatible, and Option 1 is exactly what the site should do whenever the
list is empty anyway.

---

## 4. The internal-page design system

The failure mode to avoid: eleven pages that each look like a shorter
homepage. The prevention is a small set of **composition archetypes**, chosen
per page by what the page is FOR, sharing the Home V3 visual DNA but not its
layout.

### Shared DNA (unchanged, reused)

Continuous `surface-page` ground · the threshold motif (interrupted border) ·
`ArchitecturalGrid` · `MilestoneMarker` · `ProjectPattern` · `SectionConnector`
· teal used as structure and accent, never as body text · display type for
editorial moments · `start`/`end` logical properties throughout.

### Six archetypes

**A · EDITORIAL** — text-led, argument-shaped.
Narrow prose measure, a sticky statement column alongside, one image slot,
generous whitespace. The reader is here to understand something.
→ `/about`, `/why-organizer`

**B · PROCESS** — sequential, spatial.
The five stages at full page scale: one band each, alternating side, the
process line carrying through the boundaries. This is the homepage's strongest
section given room to breathe.
→ `/how-we-work`

**C · INDEX** — a collection with a way in.
Page header, filter row, then the collection. Every index must design its
empty state as carefully as its full state.
→ `/projects`, `/knowledge`, `/search`

**D · RECORD** — one subject, evidence-led.
Breadcrumb, subject header, then only the blocks whose data exists. Nothing
reserves space for absent facts.
→ `/projects/[slug]`, `/knowledge/[slug]`

**E · ACTION** — one job, no distractions.
Two columns: the form, and a reassurance panel answering "what happens to my
details". No navigation-adjacent CTAs competing with the form. This archetype
deliberately has the least visual richness on the site.
→ `/contact`, `/eligibility`

**F · REFERENCE** — institutional, scannable.
Numbered rows, structured statements, no cards. Reads like a policy document
because it is one.
→ `/trust`, `/faq`, `/privacy`, `/terms`

### Page → archetype map

| Page | Archetype | Distinguishing move |
|---|---|---|
| `/about` | A | Company statement at display scale; no team photos (none verified) |
| `/why-organizer` | A | The role map from the homepage, expanded and made the subject |
| `/how-we-work` | B | Five full-width stage bands, process line crossing each seam |
| `/projects` | C | Empty state is the primary designed state |
| `/projects/[slug]` | D | Facts render only when verified; absence is invisible |
| `/trust` | F | Inverse surface retained; the external resources list finally rendered |
| `/knowledge` | C | Editorial index, lead article + list, category filter |
| `/knowledge/[slug]` | D | Prose body, related articles, no invented byline or date |
| `/faq` | F | Native `<details>`, grouped by category |
| `/contact` | E | Form + "what happens next" panel |
| `/eligibility` | E | Short form, the most important page on the site |
| `/search` | C | Results or a useful empty state |
| `/privacy`, `/terms` | F | Prose; content is yours to supply |
| 404 / error | — | Already correct, no change proposed |

---

## 5. New components required

Nine. Each exists because a page needs it.

| Component | Why | Where it lives |
|---|---|---|
| `PageHeader` | Every internal page needs an opening that is clearly not the homepage hero. Eyebrow, h1, standfirst, optional image slot, optional breadcrumb | `components/blocks/` |
| `Breadcrumb` | `/projects/[slug]` and `/knowledge/[slug]` currently give no way back and no sense of place | `components/layout/` |
| `StatementBlock` | The "אתם בעלי הדירות" editorial moment, generalised for about / why-organizer / trust | `components/blocks/` |
| `StepDetail` | One process stage at page scale, for `/how-we-work` | `components/blocks/` |
| `ProseBody` | Renders `\n\n`-separated body text safely (no markup interpretation — the injection surface rule stands) | `components/blocks/` |
| `FilterBar` | City/type filter for projects, category filter for knowledge | `components/blocks/` |
| `ProjectFacts` | Renders only verified facts, omits the rest, never shows an empty row | `components/blocks/` |
| `FormShell` | The two-column action layout, shared by contact and eligibility | `components/forms/` |
| `Checkbox`, `RadioGroup` | **The only two missing UI primitives.** Consent needs a checkbox; organizing status needs a radio group. Everything else (Field, Input, Textarea, Select, Button, Card, EmptyState) already ships in `packages/ui` | `packages/ui` |

No new dependency. No animation library. All CSS and inline SVG, as before.

---

## 6. The two forms

Both are **UX only** in this phase: real validation, real states, real success
screen — submitting posts to a typed client function whose body is a stub. No
parallel lead database, per your instruction. The architecture is shaped for
`Website → API gateway → CRM`, and the gateway already has auth, RBAC and rate
limiting, so the eventual endpoint has a home.

### A · Contact

| Field | Status |
|---|---|
| שם מלא | required |
| טלפון | required |
| הודעה | required |
| אימייל | optional |
| הסכמה למדיניות הפרטיות | required, unticked by default |

Matches `ContactSubmission` in the contracts exactly — no model change needed.

### B · בדיקת התאמה להתחדשות עירונית

Deliberately short. Every field that makes someone go and look something up
costs completions.

| Field | Status | Note |
|---|---|---|
| כתובת הבניין או המתחם | required | Street + city, one field, free text |
| שם מלא | required | |
| טלפון | required | |
| אימייל | optional | |
| מספר דירות משוער | optional | Free number, explicitly "משוער" |
| מצב ההתארגנות | optional | Radio, four options below |
| הערות | optional | |
| הסכמה למדיניות הפרטיות | required | |

Organizing status, exactly as you specified:
`טרם התחלנו להתארגן` · `התחלנו לדבר בין הדיירים` · `קיימת נציגות` ·
`כבר מתקיים תהליך`

**Not asked**: gush/helka, legal questions, developer questions, ownership
structure. Those belong in the first phone call.

Success screen copy, as approved, with no response-time promise:

> תודה, קיבלנו את הפרטים.
> נבצע בדיקה ראשונית וניצור איתכם קשר להמשך התהליך.

**Open blocker**: where a submission actually goes is still undecided
(`ODG_CONTENT_QUESTIONS.md` §2.1). I can build the complete UX without it; the
form cannot go live without it.

---

## 7. Content I can write, and content I cannot

**I will write** (general professional knowledge, no OpenDoor facts):
what an organising company does and does not do · how an urban-renewal process
runs stage by stage · what a residents' representation is · how professionals
are selected and who represents whom · what transparency means in practice ·
what owners should understand before signing · why organised representation
changes an owner's position.

This is substantial, genuinely useful Hebrew content, and it is the majority
of what `/about`, `/why-organizer`, `/how-we-work` and `/trust` need.

**I will not write, and will mark as internal TODO fields that render nothing**:
company founding story or history · team members · years of experience ·
project counts · client outcomes · testimonials · partner relationships ·
awards · financial or legal claims beyond the approved cost sentence · any
project fact.

Every one of those becomes a clearly-marked content field the CMS can fill
later. None appears as visible placeholder text.

**The approved commercial sentence**, used sparingly rather than four times:

> השירות אינו כרוך בתשלום ישיר מצד בעלי הדירות.

Proposed placement: `/about` once, `/faq` once. Removed from the homepage hero
and the "what is an organising company" section, so it reads as a fact stated
where it is relevant rather than a slogan. **Still flagged for legal review
before production** (`ODG_CONTENT_QUESTIONS.md` §1).

---

## 8. Editorial and accessibility rules, carried forward

No `—`, no `־` in user-facing copy. Standard `-` only where genuinely needed —
and adopting `OpenDoor Group` removes the one place that was contested.

Every page: one `h1`, no heading skips, real landmarks, `noindex` removed as
each page gains real content, logical CSS properties throughout, 44px touch
targets, WCAG AA contrast measured rather than assumed, complete without
JavaScript, and correct under `prefers-reduced-motion`.

Forms additionally: every input labelled, errors tied by `aria-describedby`,
error summary focusable on submit, and no error state conveyed by colour alone.

---

## 9. Proposed build order

Not all eleven at once. Four sequenced passes, each independently reviewable:

**Pass 1 — Foundation.** Brand rename, `PageHeader`, `Breadcrumb`, `Checkbox`,
`RadioGroup`, extended project contracts, empty project templates. Nothing
visible changes except the brand name. This is the pass that makes the other
three cheap.

**Pass 2 — The conversion pages.** `/contact` and `/eligibility`. Highest
business value, currently the site's biggest gap.

**Pass 3 — The argument pages.** `/about`, `/why-organizer`, `/how-we-work`,
`/trust`. The most content writing.

**Pass 4 — The collections.** `/projects`, `/projects/[slug]`, `/knowledge`,
`/knowledge/[slug]`, `/faq`, `/search`, plus `/privacy` and `/terms` when you
supply the legal text.

---

## 10. What I need from you before Pass 1

1. **Approve or amend this plan.**
2. **The projects decision** (§3): Option 1, 2 or 3.
3. **Confirm the brand rename** applies everywhere listed in §2, including the
   homepage `h1`.
4. **Where form submissions go** — needed before Pass 2, not before Pass 1.

Everything else in this plan I can proceed with on approval alone.
