/**
 * The site's line icons: one closed set, drawn here and named in content.
 *
 * ── WHY A CLOSED SET ───────────────────────────────────────────────────────
 *
 * Content names an icon (`icon: 'users'`); it never uploads one. An editor who
 * can upload an icon per item produces a page with eight visual languages, and
 * a renderer that draws its own private set produces a site with five. Every
 * block that shows an icon draws it from here, on the same 24-unit grid with
 * the same stroke, so a checklist tile and a process stage read as one family.
 *
 * An unknown name renders nothing rather than a broken image, for the same
 * reason an unknown block renders nothing. Icons are always decorative: the
 * text beside them carries the meaning, so they are hidden from screen readers.
 */
const PATHS = {
  chart: (
    <>
      <path d="M3 20h18" />
      <path d="M6 20v-7" />
      <path d="M11 20V8" />
      <path d="M16 20v-4" />
      <path d="M21 20V5" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  'document-check': (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 14l2 2 4-4" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17v.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.6c2 .2 3.6 1.6 4.3 4.4" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16" />
      <path d="M6 20h12" />
      <path d="M5 8h14" />
      <path d="M5 8l-2.5 5h5z" />
      <path d="M19 8l-2.5 5h5z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9z" />
      <path d="M8.5 12h7" />
      <path d="M8.5 16h5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8" />
      <path d="M16 7l2 2" />
      <path d="M14 9l2 2" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3" width="10" height="18" rx="1" />
      <path d="M15 9h4v12h-4" />
      <path d="M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.3l2.7 2.7L16 9.5" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .9-1 1.6v.5" />
      <path d="M12 16.8v.2" />
    </>
  ),
  files: (
    <>
      <path d="M9 3h7l4 4v11H9z" />
      <path d="M16 3v4h4" />
      <path d="M6 7v14h10" />
    </>
  ),
  cone: (
    <>
      <path d="M10.4 4h3.2L18 19H6z" />
      <path d="M8.5 10.5h7" />
      <path d="M7.3 14.8h9.4" />
      <path d="M4 19h16" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H10l-5 4v-4H4z" />
      <path d="M8 9.5h8" />
      <path d="M8 12.5h5" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20l4-1 11-11-3-3L5 16z" />
      <path d="M14 7l3 3" />
    </>
  ),
} as const

export type LineIconName = keyof typeof PATHS

export function isLineIcon(name: string | undefined): name is LineIconName {
  return Boolean(name && name in PATHS)
}

export function LineIcon({
  name,
  size = 24,
  strokeWidth = 1.6,
  className = '',
}: {
  name: string | undefined
  size?: number
  strokeWidth?: number
  className?: string
}) {
  if (!isLineIcon(name)) return null
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name]}
    </svg>
  )
}
