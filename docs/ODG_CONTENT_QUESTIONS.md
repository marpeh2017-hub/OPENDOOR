# OpenDoor Group — Content Questions

Raised during the Site Completion, Content & QA pass. Nothing below has been
invented or filled in with a guess. Each item genuinely needs your decision or
your knowledge before it can be built or published.

---

## How to use this document

Each question states: what is missing, where it appears, why it matters,
whether the page can launch without it, and the expected format if you supply
it. Answer inline or in a reply and I will apply it without re-asking.

---

## 1. Trust / legal review — the "no cost to owners" claim

**What**: The phrase "the service involves no direct cost to the apartment
owners" (השירות לבעלי הדירות אינו כרוך בעלות ישירה מצד הדיירים) appears in
four places: the homepage hero note, the "what is an organising company"
section, the homepage FAQ, and the standalone FAQ fixture.

**Where**: Hero block, TEXT_SECTION body, FAQ item `q-cost`.

**Why it needs your review**: This is exactly the category of claim the audit
brief calls out by name (`"ללא עלות לדיירים"`). It is worded carefully
("no *direct* cost," not "free") but it is repeated four times in near-identical
language, which reads as a firm commercial promise. Before this goes live I
need you to confirm:

- Is "no direct cost" the legally precise description of the business model
  (e.g., cost is recovered from the developer's return, not billed to owners)?
- Should it carry a qualifier, a footnote, or a link to fuller terms?

**Can it launch without an answer**: The current wording already exists in
the approved V1–V3 content and has shipped through three review gates. I am
not blocking on this, but it should not go to a real audience unconfirmed.

**Format**: A yes/no on the current wording, or a replacement sentence.

---

## 2. `/contact` and `/eligibility` have no functioning form

**What**: Both routes render only the placeholder shell (title + "coming
soon"). Neither has a form, a phone number, an email address, or any way for
a visitor to actually act on the two most important calls to action on the
site — "בדיקת התאמה להתחדשות עירונית" and "צור קשר" both lead here.

**Where**: `/contact`, `/eligibility` (linked from the header, the hero, the
final CTA, and the footer, on every page).

**Why it matters**: These are not content gaps I can write around — they are
functional gaps. `ContactSubmission`/`ContactSubmissionResult` already exist
in `packages/api-contracts`, so the shape is designed; the form itself is not
built, and building it is real work: fields, validation, consent copy, a
submission target (this is a static-content site with no backend of its own —
where does a submission go? An email, a CRM webhook, a third-party form
service?).

**Can it launch without it**: No. Every primary conversion path on the site
currently ends at a "coming soon" notice. This is the single highest-priority
item in this report.

**Format**: Not a content question — a scoping decision. I need to know
where a submission should go before I can build the form, and whether phone
number, email address or both should collect.

**Also needed, once you decide to build these**: a real phone number and/or
email address to display, if you want one shown in addition to (or instead
of) a form. None exists anywhere in the current copy — the footer and every
stub page are deliberately silent rather than showing a placeholder number.

---

## 3. Company registration / legal details for the footer

**What**: The footer currently shows the brand name, tagline, the domain
`odg.co.il`, and a bare copyright line. It has no registration number
(ח״פ / עוסק מורשה), no legal entity name if different from the marketing
name, no physical address, and no phone number.

**Where**: `SiteFooter`.

**Why it matters**: An Israeli company's public website conventionally
carries at least a legal entity identifier, and it is often required for
Terms of Service and Privacy Policy pages to be complete. Right now `/terms`
and `/privacy` are empty placeholder shells for the same reason — there is
nothing genuine to put in them yet.

**Can it launch without it**: Yes, in the sense that nothing is currently
broken or dishonest. But `/terms` and `/privacy` cannot become real pages
until this exists, and a company website without any of this eventually reads
as evasive rather than careful.

**Format**: Legal entity name (if different from "OpenDoor Group" / "אופן-דור
גרופ"), registration number, registered address (if you want it public),
and whether you want a phone number displayed.

---

## 4. `/privacy` and `/terms` content

**What**: Both are placeholder shells. A real privacy policy needs to state
what is actually collected (this site sets no cookies today beyond what
Next.js itself may use, and there is no analytics installed), how it is
stored, and who can access it. A terms page needs whatever legal terms
actually govern using the site and the eligibility check.

**Why it matters**: These are the two pages most likely to have actual legal
consequences if wrong. I will not draft either from a template, because a
generic "boilerplate" privacy policy that doesn't match what the site
actually does (or doesn't do) is worse than an honest placeholder.

**Can it launch without it**: Yes for a Phase 1 preview; no for a public
launch that collects any personal data (which the eligibility check, once
built, will).

**Format**: Point me to existing counsel-reviewed text if it exists, or tell
me who should draft it. I can implement whatever you supply; I should not be
the one composing the legal substance.

---

## 5. English translations for the Knowledge Centre articles

**What**: All six Knowledge Centre articles (`MOCK_ARTICLES` in
`src/mock/fixtures/knowledge.ts`) and all five FAQ entries exist in Hebrew
only — each `KnowledgeArticle` record carries a single `locale: 'he'` field,
by original content-model design (unlike the homepage, which is one record
with a Hebrew+English pair per string).

**Where**: `/knowledge`, `/knowledge/[slug]`, and the homepage's Knowledge
preview and FAQ preview, when viewed on `/en/...`. An English-language visitor
currently sees Hebrew article titles and bodies inside the English site
chrome.

**Why it matters**: This is generic explanatory content (what pinuy-binuy is,
what an organising company does, what a residents' representation is) — not
legally or commercially sensitive, and safe to translate under the "complete
safe editorial content" rule. It has not been translated because doing so
well is a real, substantial task (six full articles plus five FAQ answers)
and changing the content model to support per-locale records is a separate
decision from writing the words.

**Can it launch without it**: Yes — this is a known, previously documented
limitation (V1's review already flagged it), not a new defect. But it should
be a deliberate decision to ship English pages with Hebrew mock content,
not an oversight.

**Format / decision needed**: Should I (a) translate the existing six
articles and five FAQ items into English now, authored independently rather
than word-for-word, or (b) leave this for the Phase 2 CMS migration where
real per-locale authoring will replace all of this mock content anyway?

---

## 6. The external resources list is built but never shown

**What**: `MOCK_EXTERNAL_RESOURCES` (three real gov.il / consumer-authority
links) exists in the content layer and is fully typed, but no page or
component currently renders it. It reads as though it belongs on the Trust
page's "professional information sources" item (`tc-sources`), which is
itself still a stub.

**Where**: `src/mock/fixtures/knowledge.ts`, unused.

**Why it matters**: Not a defect — nothing links to a broken destination — but
it is finished content sitting idle, and worth remembering when `/trust` is
built out for real.

**Can it launch without it**: Yes, trivially — it currently does nothing
either way.

**Format**: No answer needed now. Noted here so it isn't lost when `/trust`
gets its real content pass.
