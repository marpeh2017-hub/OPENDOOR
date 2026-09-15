/**
 * Export one page fixture as JSON, so it can be imported into the CMS.
 *
 * ── WHY TWO SCRIPTS AND NOT ONE ────────────────────────────────────────────
 *
 * The website has no database access and must not acquire any: its only route
 * to content is the gateway. So the migration is split at that boundary —
 * this script reads the fixture and prints JSON, and the gateway's
 * `import-cms-page.ts` reads that JSON and writes the rows. Neither side
 * gains a capability it should not have, and the JSON in between is a real
 * artefact that the before/after comparison can be run against later.
 *
 *   pnpm --filter @urban-renewal/website exec tsx scripts/export-page-fixture.ts trust
 */
import { CORE_PAGES } from '../src/mock/fixtures/core-pages'
import { MOCK_PAGES } from '../src/mock/fixtures/pages'

const slug = process.argv[2]
if (!slug) {
  console.error('usage: export-page-fixture.ts <slug>')
  process.exit(2)
}

const page = [...CORE_PAGES, ...MOCK_PAGES].find((p) => p.slug === slug)
if (!page) {
  console.error(`No fixture page with slug "${slug}"`)
  process.exit(1)
}

// Blocks are emitted EXACTLY as the fixture holds them — unsorted, unfiltered,
// hidden flags intact. The repository applies those rules at read time, and
// applying them here too would bake one reading of the data into the migration
// and make the round-trip comparison compare something other than the source.
process.stdout.write(JSON.stringify(page, null, 2))
