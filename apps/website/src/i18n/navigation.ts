import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Locale-aware navigation primitives.
 *
 * Every internal link in this app MUST come from here rather than from
 * `next/link`. Two reasons, and the second is the one that bites later:
 *
 *   1. These preserve the active locale automatically, so a Hebrew visitor
 *      clicking through stays in `/he`.
 *   2. They emit paths WITHOUT a hardcoded prefix, which is what makes the app
 *      basePath-compatible. When the site eventually sits behind a proxy, a
 *      literal `href="/projects"` breaks; this does not.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
