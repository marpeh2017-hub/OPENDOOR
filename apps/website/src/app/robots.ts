import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-config'

/**
 * robots.txt.
 *
 * No route is disallowed: the stub pages carry their own `noindex` via
 * `STUB_ROBOTS` (see `src/lib/seo.ts`), which is the correct signal for a page
 * that exists and should be crawled for its links but not shown in search
 * results. A blanket `Disallow` would instead stop the crawler from ever
 * reading those pages at all, hiding the links on them too.
 */
export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL

  return {
    rules: { userAgent: '*', allow: '/' },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  }
}
