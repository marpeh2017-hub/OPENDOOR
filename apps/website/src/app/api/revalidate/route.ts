import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { isCmsManaged, pageTag } from '@/lib/cms-source'

/**
 * Refresh one page after it is published.
 *
 * ── WHY A WEBHOOK AND NOT A SHORTER CACHE ──────────────────────────────────
 *
 * Without this the choice is between a revalidation window during which an
 * editor has published and the site still shows the old text — the moment
 * where people click Publish repeatedly and then file a bug — and `no-store`,
 * which puts a network round trip on every request for content that changes a
 * few times a year. Tag-based invalidation gives immediate publication AND a
 * cached site.
 *
 * ── WHY THE SECRET, AND WHY IT IS COMPARED THE WAY IT IS ───────────────────
 *
 * Revalidation is cheap but not free, and an open endpoint that drops caches
 * on demand is a denial-of-service primitive. The secret is compared in
 * constant time, and a missing configured secret REFUSES rather than allowing:
 * a deployment that forgot to set it should stop revalidating, not start
 * accepting anonymous requests.
 *
 * Only tags for slugs the CMS actually manages are honoured, so this cannot be
 * used to enumerate or invalidate arbitrary cache entries.
 */
export const runtime = 'nodejs'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function POST(request: Request) {
  const secret = process.env['CMS_REVALIDATE_SECRET']
  if (!secret) {
    return NextResponse.json({ revalidated: false, reason: 'not-configured' }, { status: 503 })
  }

  const provided = request.headers.get('x-revalidate-secret') ?? ''
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ revalidated: false }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { slug?: string }
  const slug = body.slug
  if (!slug || !isCmsManaged(slug)) {
    // Not an error: publishing a page the website does not yet read from the
    // CMS is a normal step during migration, and there is simply nothing to
    // invalidate.
    return NextResponse.json({ revalidated: false, reason: 'not-managed', slug })
  }

  revalidateTag(pageTag(slug))
  return NextResponse.json({ revalidated: true, tag: pageTag(slug) })
}
