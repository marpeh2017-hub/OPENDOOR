import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

/**
 * Badge.
 *
 * Every variant is a colour PLUS text. Colour alone is never the only carrier
 * of meaning — WCAG 1.4.1. A "פעילה" badge that differs from "כבויה" only by
 * hue is unreadable to a colour-blind user, and the automations screen already
 * showed how easily that happens.
 *
 * Foreground/background pairs are chosen to clear 4.5:1; the `-800` text on
 * `-100` background combinations all do.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:  'bg-teal-100 text-teal-800',
        neutral:  'bg-gray-100 text-gray-700',
        success:  'bg-green-100 text-green-800',
        warning:  'bg-amber-100 text-amber-900',
        danger:   'bg-red-100 text-red-800',
        info:     'bg-blue-100 text-blue-800',
        outline:  'border border-gray-300 text-gray-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
