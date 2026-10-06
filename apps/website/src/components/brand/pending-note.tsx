/**
 * A marked placeholder for content the company still owes.
 *
 * ── WHERE IT RENDERS ───────────────────────────────────────────────────────
 *
 * In development and in the preview build (`WEBSITE_PREVIEW=true`), where the
 * company reviews the site, and nowhere else. A placeholder that reached
 * production would put a note to an editor in front of an apartment owner;
 * one that rendered nowhere would let the missing text be forgotten. The page
 * around it is written to read as complete without it.
 *
 * It never stands in for the content itself: no invented sentence, number or
 * quotation fills the gap, which is the rule this component exists to keep.
 */
export const SHOW_PENDING =
  process.env.NODE_ENV !== 'production' || process.env.WEBSITE_PREVIEW === 'true'

export function PendingNote({ text, className = '' }: { text: string; className?: string }) {
  if (!SHOW_PENDING || !text.trim()) return null

  return (
    <p
      role="note"
      className={`rounded-md border-2 border-dashed border-amber-500 bg-amber-50 px-4 py-3 text-[15px] font-medium leading-relaxed text-amber-900 ${className}`}
    >
      <span className="me-2 inline-block rounded-sm bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
        placeholder
      </span>
      {text}
    </p>
  )
}
