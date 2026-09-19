import * as React from 'react'
import { cn } from '../lib/cn'

/**
 * Card.
 *
 * Matches the CRM's card API (`Card` / `CardHeader` / `CardTitle` /
 * `CardDescription` / `CardContent` / `CardFooter`) so an existing call site can
 * change its import and nothing else.
 *
 * `CardTitle` renders an `h3` by default but accepts `as`, because a card title
 * inside a section that already has an `h2` must not restart the heading
 * hierarchy — §37's "semantic HTML" and §38's "semantic headings" both fail
 * quietly when every card hardcodes the same level.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-gray-200 bg-white shadow-sm', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
}

export function CardTitle({
  className, as: Tag = 'h3', ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' }) {
  return <Tag className={cn('text-lg font-semibold text-gray-900', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-gray-500', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />
}
