# Website integration handoff

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
