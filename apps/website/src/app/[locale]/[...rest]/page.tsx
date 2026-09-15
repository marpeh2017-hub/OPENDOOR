import { notFound } from 'next/navigation'

/**
 * Catch-all inside the locale segment.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * `[locale]/not-found.tsx` only renders when `notFound()` is called from INSIDE
 * that segment's tree. A URL that matches no route never enters the segment at
 * all, so Next falls back to its built-in 404 — an untranslated, LTR page with
 * no header or footer. That was the observed behaviour before this route
 * existed.
 *
 * Matching everything under `/[locale]/` and calling `notFound()` explicitly
 * puts the request inside the segment, so the localised not-found renders with
 * the full site chrome and correct text direction.
 *
 * The alternative — a root `app/layout.tsx` plus a root `not-found.tsx` — would
 * mean a second html/body shell to keep in sync with the locale layout, and
 * would still produce an unlocalised page. None of the other apps in this
 * monorepo have a root layout either.
 */
export default function CatchAllNotFound() {
  notFound()
}
