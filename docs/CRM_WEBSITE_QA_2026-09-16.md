# CRM + Website QA Pass — 2026-09-16

Scope: the CRM's image-management flow end to end (login → upload → arrange →
save/publish → live on the website), plus a design and Hebrew-copy review of
the public website. Driven live in a real browser (Playwright) against the
running dev stack, not inferred from code reading alone. Two commits landed on
`feat/odg-website-phase1` and were pushed to origin; everything else below is
either a local dev-environment fix (no commit) or an open finding.

---

## Fixed and shipped

### 1. CRM sidebar — "מנהל האתר" was undiscoverable — `135f804`

The Site Manager link existed and worked, but sat under a group named
"מערכת" (not "ניהול", where people actually look for it) and could be
clipped below the fold on a normal laptop window height (confirmed at
1440×700 and even 1440×1000) with **no scroll indicator at all** — the list
just looked finished.

**Fix** (`apps/crm/src/components/layout/sidebar.tsx`): moved "מנהל האתר"
into the "ניהול" group; added a bottom fade overlay on the nav rail that
shows only when the list is actually scrollable and not already at the
bottom (`scrollHeight`/`clientHeight`/`scrollTop` check on scroll + resize).
Verified at three viewport heights, in the mobile off-canvas drawer, and
via `impeccable detect` (zero findings) before commit. A design comp was
shown and approved before writing the code.

### 2. Website copy — owner/resident terminology drift + an ARIA bug — `452cb22`

Three spots had slipped into "הדיירים" (residents) where the rest of the
site is deliberate about "בעלי הדירות" (owners) — a distinction with real
legal weight in pinuy-binuy, since only owners hold decision/signature
rights. A fourth spot ("עם מקדם" on the `/services` comparison table) used
a term never defined anywhere else on the site instead of the established
"חברה מארגנת".

Separately, the eligibility form's organizing-status `<fieldset>` legend
concatenated its label and the "optional" badge with **no space** in the
computed accessible name (`"מצב ההתארגנותרשות"` — what a screen reader
would announce).

**Fix:** `apps/website/src/components/forms/eligibility-form.tsx` (ARIA
space) and `apps/website/src/mock/fixtures/core-pages.ts` (4 copy fixes).
**Important wrinkle found mid-fix:** `/how-we-work` is CMS-managed
(`CMS_MANAGED_SLUGS` in `cms-source.ts`) — it's served live from the
database via the gateway, `cache: 'no-store'`, and never reads the static
fixture except as a gateway-down fallback. The fixture edit alone would
have been dead code; the actual copy was also corrected and republished
through the CRM (`/site/pages/how-we-work`). `/services` is not
CMS-managed, so its fixture fix is live directly. All four fixes verified
live via curl + browser, `impeccable detect` clean, `tsc --noEmit` clean.

---

## Fixed, but as local dev-environment state (no commit — nothing to push)

### 3. Image upload was completely broken (500 on every upload)

Root cause: MinIO (the local S3-compatible store) wasn't running. This
machine uses a standalone `minio.exe` (not Docker — Docker isn't installed
here at all), with data and a bucket already in place at `C:\Users\Me\minio`
matching `S3_BUCKET=urban-renewal`. Started it via the existing
`scripts/dev-infra/start-minio.cmd`. **Its scheduled task ("UROS MinIO") was
never actually registered on this machine**, so it won't survive a reboot —
run `scripts/dev-infra/register-dev-infra.ps1` if you want it to start
automatically at logon (not done; that's a standing decision, not a bug).

Along the way the api-gateway also needed a `pnpm install` (a dependency,
`@anthropic-ai/sdk`, had landed in `package.json` via an unrelated upstream
commit but was never installed) before it would boot at all.

**Verified end to end:** uploaded two real images through the CRM, reordered
them, set alt text, saved, published, and confirmed the correctly-classified
one ("צילום מהפרויקט") rendered as the live hero image on the public site
with the honesty badge overlay — then removed the test images and
republished to restore the project's original clean state.

### 4. `FIELD_ENCRYPTION_KEY` — investigated, left untouched by your instruction

The API logs `FIELD_ENCRYPTION_KEY not set — using insecure dev key` and
falls back to a **fixed, deterministic** key
(`sha256("dev-insecure-key-do-not-use-in-prod")`) — this only throws in
`NODE_ENV=production`, so it never actually blocks anything in normal dev
use. Checked exhaustively: the real key is not in the current
`services/api-gateway/.env`, nor in any of the 7 `.env.backup-*` snapshots
(2026-09-10 through 2026-09-15). It was never configured on this machine at
all, in any snapshot — not a case of it being lost. Per your decision, left
exactly as-is; no replacement key was generated.

### 5. The "stuck at login" test copy on port 4305 — not actually broken

Re-launched it in isolation (only 4305; 3000/3001/3003/MinIO untouched) and
logged in for real, cookies cleared first: `POST /api/auth/login → 200`,
dashboard rendered with real data, zero console errors, `/site/media` also
clean. Its `.env.local` points at the exact same shared api-gateway
(`localhost:4000`) as the main checkout — it has no backend of its own — so
whatever "stuck" state was seen earlier was almost certainly the shared
gateway being down at that moment (which happened more than once during
today's session, for the unrelated dependency reason above), not a defect
in that build. Shut back down after the check.

### 6. Stale worktree and branch removed

`git diff` (not just commit messages) between `codex/website-integration`
and `feat/odg-website-phase1`, file by file across all 43 files the branch
had touched since its fork point (`f3e62d0`): 42 identical, 1 differing by
exactly the ARIA-space fix from item 2 (made after that branch was frozen).
Confirmed fully merged. Removed with your approval:
`git worktree remove --force .worktrees/website-integration` and
`git branch -D codex/website-integration`. No remote copy existed. A handful
of empty, content-less, non-git-tracked directory husks under
`.worktrees/website-integration/` would not delete (Windows "resource busy",
likely a transient file-lock from something like antivirus/indexing) —
harmless, safe to remove by hand later if it still bothers you.

---

## Found, reported, **not** fixed — open for your decision

- **`/site/media` request storm (429s).** Every `MediaPicker` instance (8
  site image slots) plus `MediaLibrary` independently call
  `getOrCreateMediaLibrary()` on mount with no shared cache — ~15 parallel
  identical requests, reliably rate-limited. Harmless while the library is
  empty; once it has real images, some slots will likely show "no images"
  incorrectly because their request got throttled.
  `media-picker.tsx:31`, `media-library.tsx:78`, `image-slots-editor.tsx:25`.
- **Mobile "פאנל לידים" bar chart** on the CRM dashboard: category labels
  truncate to a single illegible letter at 390px width, overlapping the
  bars.
- **`animate-bounce`** in `apps/website/src/components/faq/faq-chat-widget.tsx:167`
  — flagged by `impeccable detect` as dated easing.
- **CRM dev server crashed unprompted more than once** during today's
  session. Timing suggests a possible relationship to the request-storm
  bug above, but this was never confirmed — worth keeping an eye on.
- **Auth cookie is shared across ports on `localhost`** (noticed while
  testing 4305 — an existing 3001 session auto-authenticated it). Standard
  browser cookie behavior (cookies aren't port-scoped), not unique to this
  app, but worth knowing if isolated local previews are used again.
- `/projects` on the public site looks visually sparse with only one
  published project sitting in a generously-padded grid — by design
  (`Section size="lg"`), not a bug, but worth a second look once more
  projects are live.
