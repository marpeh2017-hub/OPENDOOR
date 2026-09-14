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

/**
 * PRIMARY navigation — what the desktop header shows.
 *
 * Five items. V1 showed seven, which at Hebrew label lengths crowded the bar
 * against the two persistent actions and the language switcher, leaving the
 * header with no breathing room at 1024px.
 *
 * FAQ and contact are NOT removed as routes — they remain in `NAV_ITEMS`, in
 * the mobile menu, in the footer, and as in-page links from the FAQ and CTA
 * sections. This reduces top-level density; it does not reduce reachability.
 */
export const PRIMARY_NAV_KEYS = [
  'about',
  'whyOrganizer',
  'howWeWork',
  'projects',
  'knowledge',
] as const

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'about', href: '/about' },
  { key: 'services', href: '/services' },
  { key: 'whyOrganizer', href: '/why-organizer' },
  { key: 'howWeWork', href: '/how-we-work' },
  { key: 'projects', href: '/projects' },
  { key: 'knowledge', href: '/knowledge' },
  { key: 'faq', href: '/faq' },
  { key: 'contact', href: '/contact' },
  { key: 'search', href: '/search' },
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
      { key: 'contact', href: '/contact' },
    ],
  },
  {
    titleKey: 'urbanRenewal',
    items: [
      { key: 'services', href: '/services' },
      { key: 'howWeWork', href: '/how-we-work' },
      { key: 'projects', href: '/projects' },
    ],
  },
  {
    titleKey: 'knowledge',
    items: [
      { key: 'knowledge', href: '/knowledge' },
      { key: 'faq', href: '/faq' },
      { key: 'search', href: '/search' },
    ],
  },
] as const
