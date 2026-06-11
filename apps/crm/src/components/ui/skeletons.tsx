import { cn } from '@/lib/utils'

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('card-surface p-6', className)}>
      <div className="space-y-3">
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton h-8 w-1/2 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  )
}
