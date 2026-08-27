/**
 * Navigation model.
 *
 * Defined once so the desktop nav, the mobile nav, the footer and the eventual
 * CMS-managed navigation all agree. `key` indexes the `nav` message namespace
 * rather than carrying literal text, so no label is hardcoded in a component.
 */
export interface NavItem {
  key: string
  href: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'about',        href: '/about' },
  { key: 'whyOrganizer', href: '/why-organizer' },
  { key: 'howWeWork',    href: '/how-we-work' },
  { key: 'projects',     href: '/projects' },
  { key: 'knowledge',    href: '/knowledge' },
  { key: 'faq',          href: '/faq' },
  { key: 'contact',      href: '/contact' },
] as const

/**
 * Where the resident portal lives.
 *
 * TODAY it is a separate app on :3002 with no shared origin, so this is a
 * placeholder route inside the website that explains the situation rather than
 * a dead link to a port a visitor cannot reach.
 *
 * AFTER the Phase 2 cutover documented in `docs/ODG_WEBSITE_PHASE1_PLAN.md`
 * §3.3, the Portal is served at `/resident` on this origin and this constant
 * becomes `/resident`. One edit, because nothing else hardcodes it.
 */
export const RESIDENT_PORTAL_HREF = '/resident-portal'

/** Footer groups. Mirrors §63 without inventing registration numbers or
 *  addresses, which the specification explicitly forbids. */
export const FOOTER_GROUPS: readonly { titleKey: string; items: readonly NavItem[] }[] = [
  {
    titleKey: 'company',
    items: [
      { key: 'about', href: '/about' },
      { key: 'whyOrganizer', href: '/why-organizer' },
      { key: 'trust', href: '/trust' },
    ],
  },
  {
    titleKey: 'urbanRenewal',
    items: [
      { key: 'howWeWork', href: '/how-we-work' },
      { key: 'projects', href: '/projects' },
    ],
  },
  {
    titleKey: 'knowledge',
    items: [
      { key: 'knowledge', href: '/knowledge' },
      { key: 'faq', href: '/faq' },
    ],
  },
] as const
