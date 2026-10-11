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
  // Services rather than projects since 2026-10: the projects page is empty
  // until the first project is published, and it stays in the footer until
  // then. Put 'projects' back here when the homepage's projects block is
  // unhidden.
  'services',
  // FAQ: it has content, where the knowledge centre that once competed for
  // this place had none. Since 2026-10-07 there is no knowledge centre; the
  // forms page took its place in the mobile menu and the footer.
  'faq',
] as const

/**
 * Every route in the menu, in reading order. The desktop bar shows the
 * PRIMARY_NAV_KEYS subset in this same order, so the order here is the bar's.
 * Projects is footer-only for now, for the reason given above.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'about', href: '/about' },
  { key: 'whyOrganizer', href: '/why-organizer' },
  { key: 'howWeWork', href: '/how-we-work' },
  { key: 'services', href: '/services' },
  // Menu and footer only: the bar holds five routes at 1024px, and the
  // homepage's second door leads here.
  { key: 'stalledProjects', href: '/stalled-projects' },
  { key: 'faq', href: '/faq' },
  { key: 'forms', href: '/forms' },
  { key: 'contact', href: '/contact' },
  { key: 'search', href: '/search' },
] as const

/** The representation-appointment protocol's full text, under /forms. */
export const REPRESENTATION_PROTOCOL_HREF = '/forms/representation-protocol'

/** The owners' assembly notice and the organizing agreement, under /forms. */
export const ASSEMBLY_NOTICE_HREF = '/forms/assembly-notice'
export const ORGANIZING_AGREEMENT_HREF = '/forms/organizing-agreement'

/**
 * The page that EXPLAINS the residents' personal area: how access works, and
 * how to reach us if signing in does not. It is not the sign-in itself.
 */
export const RESIDENT_PORTAL_HREF = '/resident-portal'

/**
 * Where every "personal area" link points. `/portal` forwards to the portal
 * app when `NEXT_PUBLIC_PORTAL_URL` is set, and to `RESIDENT_PORTAL_HREF` when
 * it is not — so a link labelled as a sign-in is never a dead address, and
 * the Phase 2 cutover in `docs/ODG_WEBSITE_PHASE1_PLAN.md` §3.3 is a change to
 * that variable rather than to any link.
 */
export const PERSONAL_AREA_HREF = '/portal'

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
      { key: 'stalledProjects', href: '/stalled-projects' },
      { key: 'projects', href: '/projects' },
    ],
  },
  {
    // What an owner comes back for: the forms to read and print, the
    // questions, and search. It was "ידע", around the knowledge centre.
    titleKey: 'forOwners',
    items: [
      { key: 'forms', href: '/forms' },
      { key: 'faq', href: '/faq' },
      { key: 'search', href: '/search' },
    ],
  },
] as const
