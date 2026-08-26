'use client'

import { AlertTriangle, Inbox } from 'lucide-react'

/**
 * Shared loading / error / empty states so every wired screen reports the same
 * way. Mirrors the pattern already used in components/data-quality/dq-dashboard.
 */

export function QueryError({
  message,
  error,
  onRetry,
}: {
  message: string
  error?: unknown
  onRetry?: () => void
}) {
  return (
    <div className="card-surface p-6 text-center space-y-3" role="alert">
      <AlertTriangle className="mx-auto text-red-600" size={22} />
      <p className="text-sm text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">
        {error instanceof Error ? error.message : 'נסו שוב מאוחר יותר'}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-teal-600 hover:underline">
          נסו שוב
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="p-8 text-center space-y-2">
      <Inbox className="mx-auto text-muted-foreground" size={22} />
      <p className="text-sm text-muted-foreground">{message}</p>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  )
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-8 w-full rounded" />
      ))}
    </div>
  )
}
