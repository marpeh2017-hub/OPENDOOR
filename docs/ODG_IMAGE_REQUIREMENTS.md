# OpenDoor Group — Image Requirements

No images were generated for this document. This is an inventory of every
place a photograph would improve the site, cross-referenced with the slots
already built into the code (`src/mock/fixtures/images.ts`) where they exist,
and proposing new ones only where a real gap was found during this pass.

Every entry states a purpose before a subject — an image requested to fill
whitespace is not in this list.

---

## Already specified in code (Home V3)

These three already have a full slot (`ImageSlotSpec`) in
`src/mock/fixtures/images.ts`, complete with ratios, minimum resolution, alt
intent and sourcing direction. Restated here for one complete reference; the
authoritative version is the code.

### HERO_JERUSALEM_ARCHITECTURE

| Field | Value |
|---|---|
| Page | Home |
| Section | Hero, the aperture |
| Purpose | First visual the visitor sees; establishes place and subject before any text is read |
| Subject | Contemporary Jerusalem residential architecture: stone-faced apartment blocks, balconies, stepped hillside density |
| Type | EDITORIAL_CONTEXT |
| Aspect ratio | 3:4 desktop, 16:10 mobile |
| Pixel size | 1600×2133 desktop (2×); separate 1200×750 mobile crop |
| Desktop crop | Portrait, subject filling frame, daylight, flat or overcast light |
| Mobile crop | Wide, same subject, different composition — not a crop of the portrait |
| Alt text intent | Describe the residential fabric shown, without naming a project or implying OpenDoor involvement |
| Priority | **P0** — highest-impact single image on the site |
| Notes | No Old City, no tourist viewpoint, no luxury tower, no construction cranes, no CGI |

### JERUSALEM_LIGHT_RAIL

| Field | Value |
|---|---|
| Page | Home |
| Section | City band, between "How we work" and "Projects" |
| Purpose | Marks the page's turn from process to place; "the city is changing" |
| Subject | The light rail inside its street — track, catenary, residential frontage, ordinary people |
| Type | EDITORIAL_CONTEXT |
| Aspect ratio | 21:9 desktop, 3:2 mobile |
| Pixel size | 2400×1030 |
| Desktop crop | Full-bleed panoramic, train small in frame |
| Mobile crop | Tighter, same idea |
| Alt text intent | The light rail as part of the city, explicitly not an OpenDoor project |
| Priority | P1 |
| Notes | No promotional train close-up, no empty platform |

### JERUSALEM_CHORDS_BRIDGE

| Field | Value |
|---|---|
| Page | Home |
| Section | Final CTA, the closing threshold |
| Purpose | The city on the far side of the journey the page describes; the homepage's one landmark |
| Subject | The bridge as structure — mast, cable geometry, deck |
| Type | EDITORIAL_CONTEXT |
| Aspect ratio | 2:1 desktop, 4:3 mobile |
| Pixel size | 2000×1000 |
| Desktop crop | Architectural, overcast or blue-hour flat light |
| Mobile crop | Tighter on the mast/cable geometry |
| Alt text intent | The bridge as a Jerusalem landmark; must not suggest OpenDoor involvement |
| Priority | P1 |
| Notes | No sunset postcard, no light-trail long exposure, no symmetrical monument portrait |

### JERUSALEM_URBAN_FABRIC and ARCHITECTURAL_DETAIL

Both specified in code, both currently **unused on the homepage** by design —
the page already carries three photographic moments, and a fourth would cost
it the quiet stretch between them (Trust, Knowledge, FAQ). Held in reserve for
an interior page. See code for full specification.

---

## New gaps found in this pass

### Knowledge Centre — lead article

| Field | Value |
|---|---|
| Page | Home (Knowledge preview) and `/knowledge` |
| Section | Lead article card |
| Purpose | Currently rendered as a generated `ProjectPattern` graphic — deliberate, and it works, but a real editorial photograph would raise the section above every other index-style list on the site |
| Subject | An architectural detail or Jerusalem streetscape unconnected to any specific article's factual content — this is decorative/editorial, not documentary |
| Type | EDITORIAL_CONTEXT or ARCHITECTURAL_PATTERN (the existing generated graphic is a legitimate permanent choice here) |
| Aspect ratio | 16:9 |
| Pixel size | 1600×900 |
| Priority | **P3 — optional.** The generated pattern is a complete, shippable answer; this is an upgrade, not a gap. |

### Open Graph / social share image

| Field | Value |
|---|---|
| Page | Site-wide (every page, via the root layout) |
| Section | `<meta property="og:image">` / Twitter card |
| Purpose | What appears when a link to the site is shared on WhatsApp, Facebook, LinkedIn, etc. Currently absent entirely — a shared link shows no image |
| Subject | A single branded image: the OpenDoor wordmark (once supplied) over an architectural graphic, or the hero composition |
| Type | DECORATIVE / brand asset, not editorial |
| Aspect ratio | 1.91:1 (fixed requirement of the format) |
| Pixel size | 1200×630 minimum |
| Priority | **P1** — this is visible on every single share of the site, not just one page |
| Notes | The metadata *structure* for this is already wired in `[locale]/layout.tsx` (`openGraph`, `twitter`); adding the image is a one-line change once the asset exists |

### Project cards — verified photography, when it exists

| Field | Value |
|---|---|
| Page | Home (Projects section) and `/projects` |
| Section | Project cards |
| Purpose | Replace the generated `ProjectPattern` with a real photograph, for any project where one is confirmed to depict that specific building |
| Subject | The actual building, exterior |
| Type | **VERIFIED_PROJECT_PHOTO only** — see the truth rule below |
| Aspect ratio | 16:9 (lead card also supports 21:9 on desktop) |
| Pixel size | 1600×1100 minimum |
| Priority | P2 — the generated system already works without this |
| Notes | See "Image truth" below. This is the ONLY category of image on the site permitted to visually assert "this is that project." |

---

## Image truth — restated as a checklist

Before any image is added anywhere on the site, confirm:

- [ ] Is this a real photograph of the specific thing it appears next to
      (a named project)? → `VERIFIED_PROJECT_PHOTO`, and only then may it be
      placed inside that project's card or detail page.
- [ ] Is this a real photograph of something else true and real (a landmark,
      a street, the city) that is NOT the subject it's illustrating? →
      `EDITORIAL_CONTEXT`, and the page must state in visible text what it
      actually shows. Never place this inside a project card.
- [ ] Is this a generated graphic that asserts nothing? → `ARCHITECTURAL_PATTERN`,
      always safe, never needs a caption.

No image on the site today is `VERIFIED_PROJECT_PHOTO`. None has been supplied,
and none should be added under that label without your explicit confirmation
that it depicts the specific project.

---

## What to avoid, restated

Dubai/Manhattan-style towers, generic luxury development marketing, penthouses,
swimming pools, handshake photography, staged hard-hat construction crews,
cranes as a generic motif, futuristic CGI, anything that could not specifically
be Jerusalem.
