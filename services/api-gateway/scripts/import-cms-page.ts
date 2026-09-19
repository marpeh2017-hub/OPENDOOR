/**
 * Import one website page fixture into the CMS, and PROVE the import was
 * lossless before leaving it published.
 *
 * ── WHY THE COMPARISON IS THE POINT ────────────────────────────────────────
 *
 * Moving content from code into a database is the step where content quietly
 * changes: a field the projection does not recognise is dropped, an ordering
 * assumption is baked in, a nested object is flattened. None of that fails
 * loudly. The page still renders, just saying something slightly different
 * from what it said yesterday, and nobody reads a 5,000-word page closely
 * enough to notice one missing sentence.
 *
 * So this script does not merely write rows. It reads back what the WEBSITE
 * would now be served — the frozen public projection — and compares it, deep
 * and byte-exact, with the fixture that was the source of truth a moment ago.
 * A mismatch aborts and leaves the page unpublished, so the website keeps
 * serving the code fallback rather than a lossy copy.
 *
 *   pnpm --filter @urban-renewal/website exec tsx \
 *     ../../services/api-gateway/scripts/import-cms-page.ts <file.json> [--publish]
 *
 * Idempotent: re-running updates the same row and appends a revision, which is
 * what makes it safe to run again after fixing the fixture.
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import { toPublicProjection, findPrivateLeaks } from '../src/cms/cms.projection'

const TENANT_SLUG = process.env['CMS_IMPORT_TENANT'] ?? 'opendoor'
const file = process.argv[2]
const shouldPublish = process.argv.includes('--publish')

if (!file) {
  console.error('usage: import-cms-page.ts <file.json> [--publish]')
  process.exit(2)
}

const prisma = new PrismaClient()

/** Stable stringify, so key order can never make two equal objects compare unequal. */
function canonical(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map(walk)
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, walk(val)]),
    )
  }
  return JSON.stringify(walk(value))
}

/** Report the first differing path, because "not equal" is not actionable. */
function firstDifference(a: unknown, b: unknown, path = ''): string | null {
  if (canonical(a) === canonical(b)) return null
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return `${path || '(root)'}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array/object mismatch`
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} -> ${b.length}`
    for (let i = 0; i < a.length; i++) {
      const d = firstDifference(a[i], b[i], `${path}[${i}]`)
      if (d) return d
    }
    return null
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    if (!(k in bo)) return `${path}.${k}: DROPPED by the import`
    if (!(k in ao)) return `${path}.${k}: ADDED by the import`
    const d = firstDifference(ao[k], bo[k], `${path}.${k}`)
    if (d) return d
  }
  return null
}

async function main() {
  const source = JSON.parse(fs.readFileSync(file, 'utf8'))
  const slug: string = source.slug
  const blocks = source.blocks
  console.log(`\nImporting page "${slug}" (${blocks.length} blocks) from ${file}`)

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`No tenant with slug "${TENANT_SLUG}". Set CMS_IMPORT_TENANT.`)

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: { in: ['SUPER_ADMIN', 'COMPANY_ADMIN'] } },
    orderBy: { createdAt: 'asc' },
  })
  if (!user) throw new Error(`Tenant "${TENANT_SLUG}" has no admin user to attribute the import to.`)
  console.log(`  tenant ${tenant.slug} (${tenant.id}), attributed to ${user.email}`)

  // ── Gate BEFORE writing: would publishing this lose anything? ────────────
  const projected = toPublicProjection(blocks)
  const leaks = findPrivateLeaks(projected)
  if (leaks.length) {
    throw new Error(`The fixture contains private keys: ${leaks.join(', ')}`)
  }
  const drift = firstDifference(blocks, projected)
  if (drift) {
    throw new Error(
      `The public projection is NOT lossless for this page, so importing it would ` +
      `silently change the website.\n  First difference: ${drift}`,
    )
  }
  console.log('  projection is lossless (deep, key-order independent)')

  const draft = { blocks, title: source.title }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.cmsContent.findFirst({
      where: { tenantId: tenant.id, kind: 'PAGE', slug },
    })

    const content = existing
      ? await tx.cmsContent.update({
          where: { id: existing.id },
          data: { draft: draft as never, seo: source.seo as never, updatedById: user.id },
        })
      : await tx.cmsContent.create({
          data: {
            tenantId: tenant.id, kind: 'PAGE', slug, state: 'DRAFT', exposure: 'PUBLIC',
            draft: draft as never, seo: source.seo as never,
            createdById: user.id, updatedById: user.id,
          },
        })

    const last = await tx.cmsRevision.findFirst({
      where: { contentId: content.id }, orderBy: { sequence: 'desc' }, select: { sequence: true },
    })
    const revision = await tx.cmsRevision.create({
      data: {
        tenantId: tenant.id, contentId: content.id,
        sequence: (last?.sequence ?? 0) + 1, reason: 'SAVE',
        snapshot: draft as never, seo: source.seo as never,
        stateAtRevision: 'DRAFT', authorId: user.id,
        summary: `ייבוא מהקוד: ${slug}`,
      },
    })
    await tx.cmsContent.update({
      where: { id: content.id }, data: { currentRevisionId: revision.id },
    })
    return { contentId: content.id, revisionId: revision.id, created: !existing }
  })

  console.log(`  ${result.created ? 'created' : 'updated'} cms_content ${result.contentId}`)

  if (!shouldPublish) {
    console.log('\n  Imported as a DRAFT. The website still serves the code fallback.')
    console.log('  Re-run with --publish once the draft has been reviewed.\n')
    return
  }

  const published = await prisma.$transaction(async (tx) => {
    const content = await tx.cmsContent.findUniqueOrThrow({ where: { id: result.contentId } })
    const snapshot = toPublicProjection(content.draft)
    const stillLeaking = findPrivateLeaks(snapshot)
    if (stillLeaking.length) throw new Error(`Refusing to publish: ${stillLeaking.join(', ')}`)

    const last = await tx.cmsRevision.findFirst({
      where: { contentId: content.id }, orderBy: { sequence: 'desc' }, select: { sequence: true },
    })
    const revision = await tx.cmsRevision.create({
      data: {
        tenantId: tenant.id, contentId: content.id,
        sequence: (last?.sequence ?? 0) + 1, reason: 'PUBLISH',
        snapshot: content.draft as never, seo: content.seo as never,
        stateAtRevision: 'PUBLISHED', authorId: user.id,
      },
    })
    const publication = await tx.cmsPublication.create({
      data: {
        tenantId: tenant.id, contentId: content.id, revisionId: revision.id,
        snapshot: snapshot as never, seo: content.seo as never, publishedById: user.id,
      },
    })
    return tx.cmsContent.update({
      where: { id: content.id },
      data: {
        state: 'PUBLISHED', currentRevisionId: revision.id, livePublicationId: publication.id,
        updatedById: user.id,
        ...(content.firstPublishedAt ? {} : { firstPublishedAt: new Date() }),
      },
      include: { livePublication: true },
    })
  })

  // ── The comparison that matters: what will the WEBSITE now be served? ────
  const served = (published.livePublication!.snapshot as { blocks?: unknown }).blocks
  const diff = firstDifference(blocks, served)
  if (diff) {
    // Leave the page unpublished rather than serving a lossy copy.
    await prisma.cmsContent.update({
      where: { id: result.contentId },
      data: { state: 'DRAFT', livePublicationId: null },
    })
    throw new Error(
      `BEFORE/AFTER MISMATCH — the published page differs from the fixture.\n` +
      `  First difference: ${diff}\n` +
      `  The page has been un-published; the website keeps serving the code fallback.`,
    )
  }

  console.log('\n  ✓ BEFORE/AFTER IDENTICAL')
  console.log(`    fixture blocks : ${blocks.length}`)
  console.log(`    served blocks  : ${(served as unknown[]).length}`)
  console.log(`    canonical bytes: ${canonical(blocks).length} === ${canonical(served).length}`)
  console.log(`    publication    : ${published.livePublicationId}`)
  console.log('\n  The CMS is now authoritative for this page.\n')
}

main()
  .catch((e) => {
    console.error(`\n  ✗ ${e instanceof Error ? e.message : String(e)}\n`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
