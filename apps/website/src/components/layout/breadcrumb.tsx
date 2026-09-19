import { Link } from '@/i18n/navigation'

/**
 * Breadcrumb.
 *
 * ── WHY THE SEPARATOR IS NOT A CHARACTER ───────────────────────────────────
 *
 * The usual `/` or `›` between crumbs is a text node, which means it is read
 * aloud by a screen reader ("projects slash my complex") and, worse in this
 * codebase, `›` points the wrong way in RTL unless mirrored. A small rotated
 * square is direction-neutral, `aria-hidden`, and reads as punctuation rather
 * than as content. It is also the same diamond marker the journey thread and
 * the section connectors use, so the device is already part of the language.
 *
 * ── SEMANTICS ──────────────────────────────────────────────────────────────
 *
 * `nav` + `aria-label` so it is a landmark a screen-reader user can jump to
 * and skip, `ol` because the order is meaningful, and `aria-current="page"` on
 * the last crumb. The last crumb is NOT a link: linking the page you are
 * already on is a control that does nothing.
 */
export function Breadcrumb({
  items,
  label,
}: {
  /** In order, root first. The last item is the current page. */
  items: readonly { label: string; href?: string }[]
  /** Names the landmark, e.g. "מסלול ניווט". Content, so the caller supplies it. */
  label: string
}) {
  if (items.length === 0) return null

  return (
    <nav aria-label={label} className="mb-6">
      <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-gray-600">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2.5">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rotate-45 bg-gray-300"
                />
              )}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="font-medium text-gray-900"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="rounded-sm underline-offset-4 transition-colors hover:text-teal-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
