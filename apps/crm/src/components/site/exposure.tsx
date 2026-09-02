import type { ExposureLevel } from '@urban-renewal/api-contracts'
import { Globe, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The three exposure levels, as one component.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THREE SIGNALS, AND NONE OF THEM IS THE COLOUR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every region of the Site Manager declares how far its contents may travel,
 * and the distinction has to survive a colourblind editor and a page printed in
 * black and white. So each level carries a SURFACE, a WORD and an ICON, and
 * losing any one of them still leaves two.
 *
 * That is why this is a component and not a set of Tailwind classes people
 * apply by hand: a hand-applied convention is one that gets applied incompletely
 * on the screen nobody reviewed, and the screen nobody reviewed is where
 * internal figures end up looking publishable.
 *
 * ── THE LEVELS ────────────────────────────────────────────────────────────
 *
 *   PUBLIC       white, "ציבורי", globe. May reach the site once verified.
 *   INTERNAL     grey, "פנימי בלבד", lock. Never published.
 *   FEASIBILITY  sand, "היתכנות, פנימי", lock. Cannot become a public fact
 *                even after verification, which is the distinction from
 *                INTERNAL: an internal figure may one day be verified and
 *                published, a scenario output may not.
 */
const LEVELS: Record<
  ExposureLevel,
  { surface: string; border: string; accent: string; label: string; note: string }
> = {
  PUBLIC: {
    surface: 'bg-white',
    border: 'border-teal-300',
    accent: 'text-teal-700',
    label: 'ציבורי',
    note: 'יכול להופיע באתר, אחרי אימות ואחרי פרסום.',
  },
  INTERNAL: {
    surface: 'bg-gray-50',
    border: 'border-gray-300',
    accent: 'text-gray-600',
    label: 'פנימי בלבד',
    note: 'נשמר במערכת ואינו מתפרסם. אין כאן פעולת פרסום.',
  },
  FEASIBILITY: {
    surface: 'bg-[#f4f1ec]',
    border: 'border-[#d8cdb8]',
    // 4.30:1 on the sand surface fails AA; #7d6234 is the nearest value in
    // the same family that passes at 5.08:1.
    accent: 'text-[#7d6234]',
    label: 'היתכנות, פנימי',
    note: 'תרחיש. אינו יכול להפוך לנתון ציבורי, גם לא אחרי אימות.',
  },
}

/** A labelled strip introducing an area of the editor. */
export function ExposureBanner({
  level,
  children,
  className,
}: {
  level: ExposureLevel
  /** Overrides the default note where a screen needs to say something sharper. */
  children?: React.ReactNode
  className?: string
}) {
  const l = LEVELS[level]
  const Icon = level === 'PUBLIC' ? Globe : Lock

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-e-4 p-3.5',
        l.surface, l.border, className,
      )}
    >
      <Icon size={17} className={cn('mt-0.5 flex-shrink-0', l.accent)} aria-hidden="true" />
      <div>
        <div className={cn('text-[13px] font-bold', l.accent)}>{l.label}</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-600">
          {children ?? l.note}
        </p>
      </div>
    </div>
  )
}

/** The compact form, for a tab label or a table row. */
export function ExposureChip({ level }: { level: ExposureLevel }) {
  const l = LEVELS[level]
  const Icon = level === 'PUBLIC' ? Globe : Lock
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        l.surface, l.border, l.accent,
      )}
    >
      <Icon size={12} aria-hidden="true" />
      {l.label}
    </span>
  )
}
