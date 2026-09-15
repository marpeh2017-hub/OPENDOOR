import type { Metadata } from 'next'
import { SiteShell } from '@/components/site/site-shell'

/**
 * The Site Manager.
 *
 * Everything under `/site` manages what the PUBLIC website says. Everything
 * outside it manages the renewal process itself. Those are different audiences
 * and different consequences, and the boundary is this layout.
 *
 * ── THE PERMISSION BOUNDARY ────────────────────────────────────────────────
 *
 * `CmsRole` and `CmsCapability` in `@urban-renewal/api-contracts` define who
 * may read, edit, verify and publish here, deliberately separate from
 * `UserRole`: that enum describes what somebody is to a renewal project, not
 * whether they may publish to the company's website.
 *
 * The checks are NOT wired in this pass. Authentication is untouched by design,
 * and a permission gate that silently allows everything is worse than none —
 * it reads as protection while providing none. Wiring it is the first task of
 * the phase that adds writes, since there is nothing to protect until then.
 */
export const metadata: Metadata = {
  title: 'מנהל האתר',
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>
}
