'use client'

import { useEffect, useRef } from 'react'
import { STROKE } from '@/components/brand/architecture'

/**
 * Shared form parts.
 *
 * Small pieces both forms need, kept together so the two conversion flows
 * cannot drift apart in the details that matter most: how errors are
 * announced, how the optional fields are separated, and what the threshold
 * moment looks like.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * ERROR SUMMARY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── WHY A SUMMARY AND NOT ONLY PER-FIELD ERRORS ────────────────────────────
 *
 * Per-field messages alone fail two people. A screen-reader user submitting a
 * long form hears nothing change and has to hunt for what went wrong. A
 * sighted user on a phone may have the failed field scrolled off-screen
 * entirely, so the form appears to have done nothing at all.
 *
 * The summary answers "what happened" in one place, and each entry is a link
 * straight to the field that needs fixing.
 *
 * ── FOCUS, NOT JUST ANNOUNCEMENT ───────────────────────────────────────────
 *
 * The summary takes focus when it appears. `role="alert"` alone announces the
 * text but leaves the keyboard where it was, which for someone on a phone
 * means the message is read out while the viewport shows something else.
 * Moving focus puts the reader and the viewport in the same place.
 */
export function ErrorSummary({
  title,
  errors,
  submitAttempt,
}: {
  title: string
  /** Field id → message. Order is the form's field order, not object order. */
  errors: { id: string; message: string }[]
  submitAttempt: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only failed submissions move focus, never a keystroke or checkbox edit.
    if (submitAttempt > 0) ref.current?.focus()
  }, [submitAttempt])

  if (errors.length === 0) return null

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="border-2 border-red-600 bg-red-50 p-5 outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
    >
      <p className="text-[15px] font-semibold text-red-800">{title}</p>
      <ul className="mt-3 space-y-1.5 ps-5" style={{ listStyleType: 'disc' }}>
        {errors.map((error) => (
          <li key={error.id} className="text-sm text-red-800">
            <a
              href={`#${error.id}`}
              className="underline underline-offset-2"
              onClick={(event) => {
                // Anchor navigation alone scrolls but does not focus, and a
                // focused field is what lets someone start typing the fix
                // immediately.
                event.preventDefault()
                document.getElementById(error.id)?.focus()
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * OPTIONAL DIVIDER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The device that replaced a two-step flow. It tells the visitor, at exactly
 * the moment it matters, that the required part is behind them — which is most
 * of what a step counter would have communicated, without a second page.
 *
 * Decorative: the requirement itself is carried by `required` on each control,
 * which is what assistive tech reads. This is `aria-hidden` so a screen reader
 * does not hear a rule described as content.
 */
export function OptionalDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 pt-2" aria-hidden="true">
      <span className="h-px flex-1 bg-gray-300" />
      <span className="whitespace-nowrap text-xs font-semibold text-gray-600">{label}</span>
      <span className="h-px flex-1 bg-gray-300" />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * SUBMISSION FAILURE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Shown when the adapter reports the submission did not arrive. Never shows a
 * technical reason: the visitor cannot act on "NOT_CONFIGURED", and printing
 * it would leak how the system is wired. What they need is that it failed,
 * that their typing is safe, and that they can try again.
 */
export function SubmissionFailureNotice({
  title,
  body,
  retryLabel,
  onRetry,
}: {
  title: string
  body: string
  retryLabel: string
  onRetry: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="border-s-[3px] border-red-600 bg-red-50 p-5 outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
    >
      <p className="text-[15px] font-semibold text-red-800">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-red-800">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
      >
        {retryLabel}
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * SUCCESS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The page's one threshold moment: head interrupted, sill in teal, the same
 * frame the homepage closes on. It is used here and nowhere else on the form
 * page, which is what makes it register.
 *
 * REACHABLE ONLY AFTER A GENUINE SUCCESS. The development adapter never
 * reports one, so this cannot be rendered by accident during development —
 * see `development.adapter.ts`.
 *
 * The heading takes focus so a screen-reader user hears the confirmation
 * rather than being left at the top of a form that has silently vanished.
 */
export function SubmissionSuccess({
  title,
  body,
  children,
}: {
  title: string
  body: string
  /** An onward link. Optional: a confirmation with nothing to do next is fine. */
  children?: React.ReactNode
}) {
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className="relative bg-white px-6 py-12 sm:px-12 sm:py-14">
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span
          className="absolute start-0 top-0 h-[2px] w-[18%]"
          style={{ background: STROKE.teal }}
        />
        <span
          className="absolute end-0 top-0 h-[2px] w-[46%]"
          style={{ background: STROKE.teal }}
        />
        <span
          className="absolute bottom-0 start-0 h-[2px] w-full"
          style={{ background: STROKE.tealDeep }}
        />
        <span
          className="absolute bottom-0 start-0 top-0 w-px"
          style={{ background: STROKE.faint }}
        />
        <span
          className="absolute bottom-0 end-0 top-0 w-px"
          style={{ background: STROKE.faint }}
        />
      </span>

      <div className="relative max-w-[46ch]">
        <h2
          ref={ref}
          tabIndex={-1}
          className="text-2xl font-bold leading-tight tracking-tight text-gray-900 outline-none sm:text-3xl"
        >
          {title}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-gray-700">{body}</p>
        {children && (
          <>
            <span aria-hidden="true" className="mt-7 block h-0.5 w-16 bg-teal-600" />
            <div className="mt-6">{children}</div>
          </>
        )}
      </div>
    </div>
  )
}
