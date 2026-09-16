# Website integration handoff

> **Resolved and closed — 2026-09-16.** Every change this branch introduced
> was verified, file-by-file against its fork point, to already be present on
> `feat/odg-website-phase1` (as commits `4be4a89`/`ee383be`/`8abbff8`). The
> `codex/website-integration` branch and its worktree have been deleted. See
> `docs/CRM_WEBSITE_QA_2026-09-16.md` for that verification and everything
> else done in the same session. This file is kept for history only.

Integration branch: `codex/website-integration`, based on main `f3e62d0`.
Source design worktree: `website-prelaunch`, based on `3e1efa6` (left untouched).
Main branch and its existing pnpm-lock.yaml modification were not changed.

## Integration

Three conflicts resolved: contact form, eligibility form, mobile navigation.
Both forms retain the current useFormIdentity/read behavior together with the
design branch's synchronous submission lock, safe error handling and focus fixes.
Navigation retains the mounted portal and adds inert background/resize cleanup.
Current FAQ API, chat widget, services route, legal sections and identity hook
were verified byte-identical to main. No database changes or deployment.

## Verified

- Website and CRM TypeScript passed.
- All 23 website unit tests passed, none skipped.
- Website production build passed (40 generated pages).
- No unresolved Git conflicts; staged diff whitespace check passed.
- HTTP 200: /he, /en, /he/services, /he/contact, /he/eligibility,
  /he/faq, /he/privacy, /he/terms.
- Local built-site preview: http://127.0.0.1:4304/he.

## Still required before promotion

- Configure the isolated preview's intended local CMS API/tenant without
  copying secrets indiscriminately. CMS-managed pages fail closed without this
  connection; /he/how-we-work currently returns 404. Do not restore fixtures to
  conceal missing published content.
- Authenticated image selection/order/save/publish and website refresh check.
- Real browser desktop/mobile carousel, navigation, forms and language checks.
  Browser transport was unavailable during this integration.
- Lint: blocked by missing ESLint 9 flat configuration; not a passing gate.
- CRM production build has not been run in this integration.
- Paid chat calls and real lead submissions have not been tested or triggered.

This branch is for review only. Do not merge to main or deploy until these
remaining checks and the user's visual review are complete.

## Follow-up — September 15

- Local, ignored env files now contain only the existing local API address,
  CMS tenant slug and website preview URL (no credentials copied).
- CRM production build passed.
- Website lint configuration added using installed ESLint/Next packages.
  Scoped source/config lint passes with zero errors and four existing unused
  suppression warnings. Unit tests remain 23/23; website TypeScript passed again.
- Connected website preview: http://127.0.0.1:4306/he (`WEBSITE_PREVIEW=true`,
  separate `.next-preview` directory). Existing 4303/4304 servers untouched.
- CRM preview: http://127.0.0.1:4305/he/site/media.
- HTTP 200 verified on the connected preview: /he, /en, /he/how-we-work,
  /he/about, /he/trust, /he/why-organizer. The prior CMS 404 blocker is resolved.
- Local API started with message worker, meeting reminders and notification
  cleanup explicitly disabled, messaging simulation enabled. No data written.
- API startup warns FIELD_ENCRYPTION_KEY is not set and a dev fallback is used.
  This must be resolved against the intended existing key before write tests;
  do not generate a replacement key or migrate encrypted data as a workaround.
- Browser transport is still closed. Authenticated media selection, publication,
  actual carousel interaction and responsive QA remain unverified.
- No merge to main or production deployment.
