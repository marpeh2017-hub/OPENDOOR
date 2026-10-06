import type { DoorsBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { Section, SectionHeading } from './section'

/**
 * "מאיפה להתחיל" — three doors into the site.
 *
 * ── WHY THE HOMEPAGE HAS THIS INSTEAD OF THE ARGUMENTS ─────────────────────
 *
 * The design review found the homepage restating, in full, what /about,
 * /why-organizer and /how-we-work each say. This section is what replaced
 * those restatements: one card per page, a drawing, one line and a link. A
 * visitor who wants the argument knows where it is; one who does not gets
 * past it in a single screen.
 *
 * ── ONE LINK PER CARD ──────────────────────────────────────────────────────
 *
 * The title is the link, and a pseudo-element stretches it over the card, so
 * the whole card is a 44px-plus target while a screen reader hears one short
 * link ("מי אנחנו") rather than the card's every word. The "הכירו אותנו ←"
 * line is the visible cue for the same link, so it is hidden from assistive
 * technology instead of being announced as a second one.
 *
 * On a phone each card is a row, the drawing beside the text, so the three
 * doors take one screen rather than three; from `md` the drawing sits on top.
 *
 * ── THE DRAWINGS ───────────────────────────────────────────────────────────
 *
 * A closed set, drawn here in line art in the brand teal: no stock photos and
 * no people's faces. The two that show movement (scattered to organised, a
 * route to a door) read in the page's direction, so they are mirrored on the
 * English site. All are decorative; the text carries the meaning.
 */
const BRAND = '#0D8B8B'
const WASH = '#E8F4F4'
const STRUCTURE = '#82878A'

const ART: Record<string, { mirror: boolean; node: React.ReactNode }> = {
  // Two figures in one doorway: the owner, and someone standing with them.
  side: {
    mirror: false,
    node: (
      <>
        <rect x="38" y="8" width="44" height="64" rx="3" fill={WASH} stroke={BRAND} strokeWidth="2" />
        <path d="M28 72h64" stroke={BRAND} strokeWidth="2" strokeLinecap="round" />
        <circle cx="51" cy="37" r="6" fill="none" stroke={BRAND} strokeWidth="2" />
        <path d="M41 66c1-9 5-14 10-14s9 5 10 14" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" />
        <circle cx="70" cy="37" r="6" fill={BRAND} />
        <path d="M60 66c1-9 5-14 10-14s9 5 10 14z" fill={BRAND} />
      </>
    ),
  },
  // Scattered households becoming one organised group.
  organise: {
    mirror: true,
    node: (
      <>
        <circle cx="94" cy="20" r="4" fill="none" stroke={STRUCTURE} strokeWidth="2" />
        <circle cx="108" cy="38" r="4" fill="none" stroke={STRUCTURE} strokeWidth="2" />
        <circle cx="88" cy="52" r="4" fill="none" stroke={STRUCTURE} strokeWidth="2" />
        <circle cx="104" cy="64" r="4" fill="none" stroke={STRUCTURE} strokeWidth="2" />
        <circle cx="80" cy="34" r="4" fill="none" stroke={STRUCTURE} strokeWidth="2" />
        <path d="M70 42H48M54 36l-6 6 6 6" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="6" y="20" width="36" height="42" rx="6" fill={WASH} />
        <circle cx="15" cy="32" r="5" fill={BRAND} />
        <circle cx="29" cy="32" r="5" fill={BRAND} />
        <circle cx="15" cy="49" r="5" fill={BRAND} />
        <circle cx="29" cy="49" r="5" fill={BRAND} />
        <circle cx="22" cy="40.5" r="5" fill={BRAND} />
      </>
    ),
  },
  // A stalled route that clears its obstacle and carries on.
  unstuck: {
    mirror: true,
    node: (
      <>
        <path d="M112 58H98" fill="none" stroke={BRAND} strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
        <rect x="64" y="46" width="24" height="8" rx="1.5" fill={WASH} stroke={STRUCTURE} strokeWidth="2" />
        <path d="M71 46l-4 8M79 46l-4 8M87 46l-4 8" fill="none" stroke={STRUCTURE} strokeWidth="1.5" />
        <path d="M68 54v14M84 54v14" fill="none" stroke={STRUCTURE} strokeWidth="2" strokeLinecap="round" />
        <path d="M98 58C98 12 54 12 54 58" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" />
        <path d="M54 58H12M20 51l-8 7 8 7" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  // A route of stages ending at a door.
  route: {
    mirror: true,
    node: (
      <>
        <path d="M108 66C86 66 88 42 64 42S42 22 30 22" fill="none" stroke={BRAND} strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
        <circle cx="108" cy="66" r="5" fill="#FFFFFF" stroke={BRAND} strokeWidth="2" />
        <circle cx="64" cy="42" r="5" fill="#FFFFFF" stroke={BRAND} strokeWidth="2" />
        <rect x="6" y="6" width="22" height="30" rx="2" fill={WASH} stroke={BRAND} strokeWidth="2" />
        <path d="M13 36v-9h8v9" fill="none" stroke={BRAND} strokeWidth="2" />
      </>
    ),
  },
}

export function DoorsBlockView({ block, t }: { block: DoorsBlock; t: Localizer }) {
  return (
    <Section tone="wash" size="md">
      <SectionHeading heading={block.heading} t={t} />

      {/* Three doors sit in one row from md; four go two by two until xl,
          where each still has room for its drawing and line. */}
      <ul
        className={`mt-10 grid gap-5 lg:gap-6 ${
          block.doors.length === 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'
        }`}
      >
        {block.doors.map((door) => {
          const art = door.art ? ART[door.art] : undefined
          return (
            <li
              key={door.id}
              className="group relative flex items-start gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(20,49,47,0.08)] transition-shadow focus-within:ring-2 focus-within:ring-teal-600 focus-within:ring-offset-2 focus-within:ring-offset-teal-50 hover:shadow-[0_10px_24px_-12px_rgba(20,49,47,0.35)] md:flex-col md:items-stretch md:gap-0 md:p-6 lg:p-7"
            >
              {art && (
                <svg
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 120 80"
                  className={`h-16 w-24 shrink-0 md:mb-5 md:h-24 md:w-full lg:h-32 ${art.mirror ? 'ltr:-scale-x-100' : ''}`}
                >
                  {art.node}
                </svg>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="type-h3 font-bold text-gray-900">
                  <Link
                    href={door.href}
                    className="text-gray-900 focus-visible:outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:text-gray-900"
                  >
                    {t(door.title)}
                  </Link>
                </h3>
                <p className="mt-2 type-body text-gray-600">{t(door.body)}</p>
                <span
                  aria-hidden="true"
                  className="mt-auto inline-flex items-center gap-2 pt-3 type-body font-semibold text-teal-600 group-hover:text-teal-700 md:pt-5"
                >
                  {t(door.linkLabel)}
                  <span className="inline-block rtl:rotate-180 motion-safe:transition-transform motion-safe:ltr:group-hover:translate-x-1 motion-safe:rtl:group-hover:-translate-x-1">
                    →
                  </span>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
