# OpenDoor — Typography Direction

**Status: PROPOSAL. Nothing in section 3 has been implemented.**
No font file was added, no dependency introduced, no `@font-face` shipped.
The homepage still loads Heebo and only Heebo.

---

## 1. What was tested first, as instructed

The brief asked whether the existing family could be elevated before reaching
for a new one. It can, and it was — Home V3 applies all of it:

| Lever | V2 | V3 |
|---|---|---|
| H1 size (desktop) | 64px | 64px, but at a **15ch measure** |
| H1 tracking | `-0.02em` | `-0.02em`, held at display sizes only |
| H1 leading | 1.1 | **1.08** |
| H1 line count | 2–3, ragged | **3–4, near-equal length** |
| Hero subhead | 20px / 1.6 | 20px / **1.65**, narrower column |
| Eyebrow tracking | `0.16em` | **`0.18em`** |

The single most effective change was not a size — it was the **measure**.
Constraining the H1 to roughly 15 Hebrew characters forces it to break into a
stacked block with a flat edge, which reads as a built form rather than as a
sentence that happens to wrap. That is what "treat the headline as
architecture" actually cashes out to, and it costs nothing.

**Hebrew was composed first.** The leading was set against the Hebrew string,
which has no ascender/descender rhythm to open the lines up and therefore
needs a tighter line-height than the same size in Latin would suggest. The
English hero then takes a slightly wider measure of its own rather than
inheriting one tuned for another script.

## 2. The honest verdict on Heebo

Heebo is not the reason the page looked generic — the uniform composition was,
and that is now fixed. Heebo is a competent, highly legible, neutral UI face.

But neutral is exactly the criticism. It is Google's default-issue Hebrew
grotesque, it is on a very large number of Israeli sites, and it carries no
institutional character. At body and UI sizes that is a virtue. **At 64px it is
the weakest element in the hero** — the composition is doing all the work and
the letterforms are contributing nothing.

So: keep it for body and UI, and consider a display face above ~32px.

## 3. Proposed direction — REQUIRES YOUR APPROVAL

**Recommendation: Option B — a display face for headlines, Heebo for
everything else.**

Option A (one family throughout) is simpler and cheaper, but it means either
accepting a neutral hero or replacing a body face that is currently doing its
job well. Not worth it.

### Display candidates, in preference order

**1. Ploni (Masterfont) — recommended.**
Contemporary Israeli, architectural, high-contrast at display sizes, real
weight range. Reads as institutional rather than fashionable. *Commercial
licence required — this is the cost of the recommendation and needs your
budget decision.*

**2. Simpler Pro (Fontef).**
Precise, geometric, very confident large. Slightly cooler than Ploni; strong
if you want to lean further toward "planning authority" than "human". *Also
commercial.*

**3. Asimon (Fontef).**
More warmth, more humanist. The safest of the three against the "cold
institution" risk, the weakest against the "generic" risk.

**Free fallback if no budget:** keep Heebo for display but drop to **weight
800** with `-0.03em` tracking above 48px. This buys perhaps 60% of the effect
for nothing. It is a real option, not a consolation.

### Explicitly rejected

- **Frank Rühl / any newspaper serif** — the brief rules out newspaper
  aesthetics, and it would read as a legal notice.
- **Anything geometric-futuristic** (Rubik at heavy weights, tech sans) —
  reads startup, which is the wrong promise for a company handling people's
  homes.
- **Display faces with decorative Hebrew** — trust cost, no benefit.

### What adopting Option B would cost

- Two font files (display 700 + 800), self-hosted, ~40–60 kB subset to Hebrew
  + Latin.
- `next/font/local` with `display: swap` and an explicit `size-adjust` against
  the Heebo fallback, so the swap does not shift the hero. **This is the part
  that must not be skipped** — a display swap on the LCP element without
  metric matching is a CLS regression.
- Applied to `display-sm/md/lg` only. Body, UI, buttons and captions stay
  Heebo.

## 4. What I need from you

1. Option A or **Option B**?
2. If B — is a commercial licence in budget, or do we take the Heebo-800
   fallback?
3. If a licence: Ploni, Simpler Pro or Asimon?

Nothing further happens on typography until those are answered. The homepage
is complete and shippable as it stands.
