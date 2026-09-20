'use client'

import { useId } from 'react'
import { AlertTriangle, Check, Info, Lock, ShieldCheck, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  STATUS_LABEL, STATUS_EFFECT, type VerificationStatus,
} from './types'

/**
 * The field primitives every project tab shares.
 *
 * ── WHY THESE ARE COMPONENTS AND NOT CLASS CONVENTIONS ─────────────────────
 *
 * A convention gets applied incompletely on the screen nobody reviewed, and
 * the screen nobody reviewed is where an unverified figure ends up looking
 * publishable. Making them components means a tab cannot accidentally render a
 * fact without its status, or a private field without saying it is private.
 */

// ══════════════════════════════════════════════════════════════════════════
//  TEXT
// ══════════════════════════════════════════════════════════════════════════

/**
 * Hebrew required, English optional, and the fallback stated in words.
 *
 * The `fallback` prop is not decoration. Pass 4A's localisation model gives
 * each field one of two behaviours when English is missing, and an editor who
 * cannot tell which applies will either chase translations that do not matter
 * or leave out one that does.
 */
export function LocalizedField({
  label, value, onChange, fallback, multiline, hint, disabled,
}: {
  label: string
  value: { he: string; en?: string } | undefined
  onChange: (v: { he: string; en?: string }) => void
  /** SOURCE: the site shows Hebrew. OMIT: the site drops the field entirely. */
  fallback: 'SOURCE' | 'OMIT'
  multiline?: boolean
  hint?: string
  disabled?: boolean
}) {
  const he = value?.he ?? ''
  const en = value?.en
  /*
   * `useId`, not a slug of the label.
   *
   * Deriving the id from the label text produced DUPLICATE ids the moment two
   * milestones both had a field called "כותרת" — and a duplicate id silently
   * breaks `htmlFor`, so every field after the first lost its label. The
   * browser reports no error; only an audit that counts unlabelled inputs
   * catches it, which is how this one was found.
   */
  const id = useId()
  const Input = multiline ? 'textarea' : 'input'

  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] font-semibold text-gray-800">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-gray-600">{hint}</p>}

      <Input
        id={id}
        {...(multiline ? { rows: Math.min(10, Math.ceil(he.length / 80) + 2) } : { type: 'text' })}
        value={he}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange({ he: e.target.value, ...(en !== undefined ? { en } : {}) })}
        className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-teal-600 disabled:bg-gray-50 disabled:text-gray-600"
      />

      <label htmlFor={`${id}-en`} className="mt-2 block text-[12px] text-gray-600">
        אנגלית (לא חובה)
      </label>
      <Input
        id={`${id}-en`}
        {...(multiline ? { rows: Math.min(10, Math.ceil((en ?? '').length / 80) + 2) } : { type: 'text' })}
        dir="ltr"
        value={en ?? ''}
        disabled={disabled}
        placeholder="ללא תרגום מאושר"
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange({ he, en: e.target.value })}
        className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-[13px] text-gray-900 focus:border-teal-600 disabled:bg-gray-50"
      />
      <p className="mt-1 text-[11.5px] leading-relaxed text-gray-600">
        {fallback === 'SOURCE'
          ? 'בלי אנגלית מאושרת, האתר באנגלית יציג את הטקסט העברי.'
          : 'בלי אנגלית מאושרת, החלק הזה לא יופיע כלל באתר באנגלית.'}
      </p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  VERIFICATION STATUS
// ══════════════════════════════════════════════════════════════════════════

/**
 * A verification status, shown with THREE signals: a word, an icon and a
 * surface. Never colour alone — this has to survive a colourblind editor and a
 * page printed in black and white, and the distinction it carries is whether
 * something is about to be published to the public.
 */
export function StatusBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  const MAP: Record<VerificationStatus, { cls: string; Icon: typeof Check }> = {
    UNVERIFIED: { cls: 'border-gray-300 bg-gray-50 text-gray-700', Icon: Info },
    VERIFIED: { cls: 'border-teal-300 bg-teal-50 text-teal-800', Icon: ShieldCheck },
    SELF_VERIFIED: { cls: 'border-teal-300 bg-white text-teal-800', Icon: Check },
    SECOND_REVIEW_REQUIRED: { cls: 'border-[#d8cdb8] bg-[#f4f1ec] text-[#7d6234]', Icon: ShieldAlert },
  }
  const { cls, Icon } = MAP[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold',
        cls, className,
      )}
    >
      <Icon size={12} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  )
}

/** The status, plus what it MEANS for the website. */
export function StatusEffect({ status }: { status: VerificationStatus }) {
  return <p className="text-[12px] leading-relaxed text-gray-600">{STATUS_EFFECT[status]}</p>
}

// ══════════════════════════════════════════════════════════════════════════
//  PRIVACY
// ══════════════════════════════════════════════════════════════════════════

/**
 * The banner every private area carries.
 *
 * Stated as a promise about behaviour rather than a colour: "this is not
 * published, and there is no button here that publishes it". The second half
 * matters — an editor holding a screen full of confidential figures needs to
 * know that no control on it can make them public, not merely that they are
 * currently private.
 */
export function PrivateBanner({
  level = 'INTERNAL',
  children,
}: {
  level?: 'INTERNAL' | 'FEASIBILITY'
  children?: React.ReactNode
}) {
  const feasibility = level === 'FEASIBILITY'
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-e-4 p-3.5',
        feasibility
          ? 'border-[#d8cdb8] bg-[#f4f1ec]'
          : 'border-gray-300 bg-gray-50',
      )}
    >
      <Lock
        size={17}
        className={cn('mt-0.5 flex-shrink-0', feasibility ? 'text-[#7d6234]' : 'text-gray-700')}
        aria-hidden="true"
      />
      <div>
        <div className={cn('text-[13px] font-bold', feasibility ? 'text-[#7d6234]' : 'text-gray-800')}>
          {feasibility ? 'היתכנות, פנימי בלבד' : 'פנימי בלבד'}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-700">
          {children ?? (feasibility
            ? 'תרחיש. אינו מתפרסם ואינו יכול להפוך לנתון ציבורי, גם לא אחרי אימות. אין בלשונית הזאת פעולה שמפרסמת דבר.'
            : 'המידע בלשונית הזאת אינו מתפרסם באתר בשום מצב. אין כאן פעולה שמפרסמת אותו.')}
        </p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  READ-ONLY VALUES
// ══════════════════════════════════════════════════════════════════════════

/**
 * A number shown exactly as stored.
 *
 * `toLocaleString` is deliberately NOT used on feasibility figures: it rounds
 * by default, and 337.18 rendered as "337" is the precise failure this whole
 * area exists to prevent. The raw value is printed, and the unit beside it.
 */
export function ExactValue({
  value, unit, note,
}: {
  value: number | string
  unit?: string
  note?: string
}) {
  return (
    <div>
      <span className="font-mono text-[15px] font-semibold text-gray-900" dir="ltr">
        {String(value)}
      </span>
      {unit && <span className="ms-1.5 text-[12.5px] text-gray-600">{unit}</span>}
      {note && <p className="mt-0.5 text-[12px] leading-relaxed text-gray-600">{note}</p>}
    </div>
  )
}

export function Callout({
  tone, title, children,
}: {
  tone: 'info' | 'warning' | 'blocking'
  title?: string
  children: React.ReactNode
}) {
  const MAP = {
    info: { cls: 'border-border bg-white text-gray-700', Icon: Info, icon: 'text-gray-600' },
    warning: { cls: 'border-[#d8cdb8] bg-[#f4f1ec] text-[#7d6234]', Icon: AlertTriangle, icon: 'text-[#7d6234]' },
    blocking: { cls: 'border-red-300 bg-red-50 text-red-800', Icon: AlertTriangle, icon: 'text-red-700' },
  } as const
  const { cls, Icon, icon } = MAP[tone]
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border p-3', cls)}>
      <Icon size={16} className={cn('mt-0.5 flex-shrink-0', icon)} aria-hidden="true" />
      <div className="min-w-0">
        {title && <div className="text-[13px] font-bold">{title}</div>}
        <div className="text-[12.5px] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

/** A titled area inside a tab. */
export function Section({
  title, description, children, className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-white p-5', className)}>
      <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-gray-600">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** A plain definition row, for read-only internal data. */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-2 last:border-0">
      <dt className="text-[12.5px] font-medium text-gray-700">{label}</dt>
      <dd className="text-[13px] text-gray-900">{children}</dd>
    </div>
  )
}
