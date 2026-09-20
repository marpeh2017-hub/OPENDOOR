import {
  LayoutGrid, FileText, FolderOpen, BookOpen, HelpCircle,
  Image as ImageIcon, Link2, Settings, ClipboardCheck,
} from 'lucide-react'

/**
 * The Site Manager's navigation, and the single definition of its route map.
 *
 * ── WHY THE CMS LIVES INSIDE THE CRM ───────────────────────────────────────
 *
 * Same RTL shell, same sign-in, same tenant context. A separate application
 * would have duplicated authentication, navigation and the design system to
 * serve the same three people, and every one of those duplicates is a place the
 * two can drift.
 *
 * The separation that matters is by PATH and by PERMISSION, not by deployment:
 * everything here sits under `/site`, and the capability checks in
 * `@urban-renewal/api-contracts` (`CmsRole`, `CmsCapability`) gate it. If the
 * editing team later turns out to be separate from the operations team, moving
 * this out becomes a navigation change rather than a rebuild.
 *
 * ── WHY THIS IS DATA ───────────────────────────────────────────────────────
 *
 * The sidebar, the section headers and the breadcrumbs all read this array, so
 * a route cannot appear in one and be missing from another. The CRM's own
 * sidebar does the same thing, and this follows it deliberately.
 */
export interface SiteNavItem {
  href: string
  label: string
  icon: typeof LayoutGrid
  /** One line, shown on the section's own page while it is still a shell. */
  description: string
}

export interface SiteNavGroup {
  group: string
  items: SiteNavItem[]
}

export const SITE_NAV: SiteNavGroup[] = [
  {
    group: 'ניהול האתר',
    items: [
      {
        href: '/site',
        label: 'לוח בקרה',
        icon: LayoutGrid,
        description: 'מה דורש טיפול: טיוטות, פריטים שממתינים לבדיקה ונתונים שממתינים לאימות.',
      },
      {
        href: '/site/pages',
        label: 'עמודים',
        icon: FileText,
        description: 'העמודים הקבועים של האתר. עריכת טקסטים ותמונות, סדר החלקים והסתרתם.',
      },
      {
        href: '/site/projects',
        label: 'פרויקטים',
        icon: FolderOpen,
        description: 'מידע ציבורי, אימות נתונים, אבני דרך ותמונות. מידע פנימי והיתכנות נשמרים בנפרד.',
      },
      {
        href: '/site/review',
        label: 'בדיקה',
        icon: ClipboardCheck,
        description: 'תוכן שסומן לבדיקה: מי ערך, מתי, ומה חוסם אותו מפרסום.',
      },
    ],
  },
  {
    group: 'תוכן',
    items: [
      {
        href: '/site/knowledge',
        label: 'מרכז ידע',
        icon: BookOpen,
        description: 'כתבות מרכז הידע, הקטגוריות שלהן והקישור שלהן לפרויקטים.',
      },
      {
        href: '/site/faq',
        label: 'שאלות ותשובות',
        icon: HelpCircle,
        description: 'השאלות הנפוצות, סדר הופעתן באתר והקטגוריות שלהן.',
      },
      {
        href: '/site/media',
        label: 'ספריית מדיה',
        icon: ImageIcon,
        description: 'כל התמונות באתר, הסיווג שלהן והמקומות שבהם הן מופיעות.',
      },
    ],
  },
  {
    group: 'מבנה האתר',
    items: [
      {
        href: '/site/navigation',
        label: 'תפריטים',
        icon: Link2,
        description: 'התפריט הראשי, סדר הפריטים ואילו עמודים מופיעים בו.',
      },
      {
        href: '/site/seo',
        label: 'SEO',
        icon: Settings,
        description: 'כותרות ותיאורים לגוגל, וברירות המחדל של האתר.',
      },
      {
        href: '/site/settings',
        label: 'הגדרות אתר',
        icon: Settings,
        description: 'פרטי קשר, שם האתר וההגדרות המשותפות לכל העמודים.',
      },
    ],
  },
]

/** Flat lookup, for breadcrumbs and page headers. */
export const SITE_ROUTES: SiteNavItem[] = SITE_NAV.flatMap((g) => g.items)

export function findSiteRoute(pathname: string): SiteNavItem | undefined {
  // Longest match first, so `/site/projects` does not resolve to `/site`.
  return [...SITE_ROUTES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((r) => pathname.endsWith(r.href) || pathname.includes(`${r.href}/`))
}
