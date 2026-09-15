import * as React from 'react'
import { cn } from '../lib/cn'
import { Button, Spinner } from '../primitives/button'

/**
 * The four states every data-backed screen needs (§49).
 *
 * Shared rather than per-app because the CRM already proves what happens
 * otherwise: it has `query-states.tsx` with its own `QueryError` / `EmptyState`,
 * the Portal has none, and the two behave differently for the same situation.
 *
 * ── THE TONE RULE ──────────────────────────────────────────────────────────
 *
 * §49 asks that these stay "calm and helpful". That is a real constraint, not a
 * pleasantry: the people reading them are apartment owners in the middle of a
 * process that decides what happens to their home. An empty document list is
 * not an error and must not look like one, and a failed request should say what
 * to do next rather than what went wrong internally.
 */

export interface EmptyStateProps {
  title: string
  /** What to do about it, if anything. */
  hint?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, hint, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed',
        'border-gray-300 bg-white px-6 py-12 text-center',
        className,
      )}
    >
      {icon && <div className="mb-3 text-gray-400" aria-hidden="true">{icon}</div>}
      <p className="text-sm font-medium text-gray-800">{title}</p>
      {hint && <p className="mt-1 max-w-prose text-sm text-gray-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export interface ErrorStateProps {
  /** User-facing, in Hebrew. Never a stack trace or an internal code. */
  title: string
  hint?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

/**
 * `role="alert"` so the failure is announced rather than only drawn.
 *
 * The underlying error object is deliberately NOT a prop. Rendering
 * `error.message` puts backend internals on screen for a resident, and those
 * messages routinely contain identifiers and table names. Callers log the real
 * error; users get a sentence they can act on.
 */
export function ErrorState({
  title, hint, onRetry, retryLabel = 'נסו שוב', className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center',
        className,
      )}
    >
      <p className="text-sm font-medium text-red-800">{title}</p>
      {hint && <p className="mt-1 text-sm text-red-700">{hint}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

export interface LoadingStateProps {
  /** Announced to screen readers. Visible only to sighted users if `showLabel`. */
  label?: string
  showLabel?: boolean
  className?: string
}

/**
 * `role="status"` with `aria-live="polite"`: announced when it appears, but
 * without interrupting whatever the user is currently reading. `assertive`
 * would be wrong — a loading spinner is not urgent.
 */
export function LoadingState({
  label = 'טוען…', showLabel = false, className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-center gap-2 py-8 text-gray-500', className)}
    >
      <Spinner className="h-5 w-5" />
      <span className={showLabel ? 'text-sm' : 'sr-only'}>{label}</span>
    </div>
  )
}

/**
 * Skeleton placeholder.
 *
 * `aria-hidden`: a screen reader must not read out a shimmering rectangle. The
 * loading fact is announced once by the surrounding `LoadingState` or by
 * `aria-busy` on the region — not per placeholder, which would produce a burst
 * of announcements.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
      {...props}
    />
  )
}

/** Rows of skeletons for list/table placeholders. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}

/**
 * Visually hidden but available to assistive technology.
 *
 * Not `display: none` and not `visibility: hidden` — both remove the content
 * from the accessibility tree, which defeats the purpose. This is the standard
 * clip-rect technique.
 */
export function VisuallyHidden({
  children, ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className="sr-only" {...props}>{children}</span>
}
