# Website image management

## Scope

The homepage opens with a panorama gallery. Its first local default is the owner-supplied Jerusalem terrace image; the existing Jerusalem stone image is second. The former duplicate panorama and grey city band are omitted from the homepage.

## Editor workflow

In CRM, open `/he/site/media`:

1. Upload into the existing media library and provide descriptive alternative text.
2. In **תמונות האתר**, choose **פתיחת דף הבית — תמונות מתחלפות**.
3. Select up to eight distinct library images. Use the up/down controls to reorder them.
4. Save and use the existing publication workflow. Saving a draft does not change the public website.

Single-image slots also cover all eight process illustrations, reused by the homepage and the process page. Removing the last image explicitly hides its slot. Resetting the slot returns to its local default. Media-library files are not deleted by either operation.

## Data and permissions

Uses the existing `SETTINGS/image-slots` document and existing media endpoints; no migration or new endpoint. A slot can hold an ordered `slides` array. Its first image is also stored in the legacy top-level fields for compatibility. Old single-image documents remain readable.

The website reads only the published settings snapshot. Every managed image URL is obtained through the existing public-media authorization, which checks that the object is referenced in an active publication and enforces the tenant storage prefix. The carousel receives resolved URLs, descriptive text and display IDs; it does not receive editor credentials. Existing CMS edit/publish permissions and audit behavior remain in force.

## Playback

Six-second rotation, previous/next buttons and pause/play. Hover, keyboard interaction, hidden tabs, offscreen position and reduced-motion preference suspend rotation. Broken slides are removed from the sequence. One image has no playback controls. Local images use Next image optimization; signed storage URLs bypass that cache.

## Verification for this change

- Website and CRM TypeScript: passed.
- Local tests: 23 passed, including six new compatibility/order/hide/validation tests.
- Homepage: HTTP 200 with the gallery before the heading.
- Supplied image: optimized endpoint HTTP 200.
- Browser automation: unavailable (connection closed); playback, responsive appearance and authenticated CMS save/publish still require a browser check.
- Lint: blocked by the repository's missing ESLint 9 flat configuration.
- No production deployment, content publication or database mutation performed.

These changes live in the separate `website-prelaunch` worktree. Its CMS settings must point to the intended local API and tenant before validating the editor-to-website workflow.
