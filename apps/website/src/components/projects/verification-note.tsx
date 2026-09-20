import { getTranslations } from 'next-intl/server'
import { STROKE } from '@/components/brand/architecture'

/**
 * One quiet statement about the information in a section.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  VERIFICATION IS A PUBLICATION CONDITION, NOT A BADGE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Nothing unverified reaches this page. A material fact without a
 * `VerifiedFact` wrapper is simply absent — so every number the reader can see
 * is already verified, and stamping each one with a tick would decorate a
 * property that is universally true of what is on screen.
 *
 * Worse, per-number badges invert the meaning: once some figures are marked,
 * an unmarked one looks doubtful. There is no unmarked one, because there is
 * no unverified one.
 *
 * So: one note, at section level, carrying the OLDEST verification date in the
 * block. Oldest because the note vouches for the whole section, and the newest
 * date would let one freshly checked figure speak for four stale ones.
 *
 * ── THE VERIFIER IS NOT NAMED ──────────────────────────────────────────────
 *
 * `verifiedByName` is required by the type and kept in the record, because the
 * value of the model is that there is always someone to ask. It is never
 * rendered: publishing staff names on a public page exposes individuals to
 * approaches about a project's facts, and adds nothing a reader can act on.
 */
export async function VerificationNote({
  verifiedAt,
  locale,
}: {
  /** ISO date. Absent verification means the caller should not render this. */
  verifiedAt: string
  locale: string
}) {
  const t = await getTranslations('verification')

  // Day-month-year, in the reader's locale. An ISO string is a machine format
  // and reads as a serial number to everyone else.
  const shown = new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(verifiedAt))

  return (
    <aside className="relative bg-surface-sunken p-6 sm:p-7">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 w-[34%]"
        style={{ background: STROKE.teal }}
      />
      <h3 className="text-[15px] font-bold text-gray-900">{t('heading')}</h3>
      <p className="mt-3.5 text-[13.5px] leading-relaxed text-gray-600">
        {t('checked')}{' '}
        <span className="whitespace-nowrap font-semibold text-gray-800">{shown}</span>.
      </p>
      <p className="mt-3 text-[13.5px] leading-relaxed text-gray-600">{t('absent')}</p>
    </aside>
  )
}

/**
 * The note that rides alongside genuinely volatile information.
 *
 * Planning status, approvals and permits are the three fields whose value can
 * be correct today and wrong next month through nobody's error. Unit counts
 * and building counts are not: those change only when the project itself
 * changes, and a note on them would be noise.
 *
 * That distinction is why this is a separate component with named call sites
 * rather than a prop on every row.
 */
export async function VolatilityNote({ kind }: { kind: 'planning' | 'approvals' }) {
  const t = await getTranslations('verification')
  return (
    <span className="mt-1.5 block text-[13px] leading-relaxed text-gray-600">
      {t(kind === 'planning' ? 'planningMayChange' : 'approvalsMayChange')}
    </span>
  )
}
