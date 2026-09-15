'use client'
import { useState, type ImgHTMLAttributes, type ReactNode } from 'react'
export function SafeImage({
  fallback,
  fill,
  priority,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  fallback?: ReactNode
  fill?: boolean
  priority?: boolean
}) {
  const [failedSrc, setFailedSrc] = useState<ImgHTMLAttributes<HTMLImageElement>['src']>()
  if (failedSrc === props.src)
    return (
      <>
        {fallback ?? (
          <div aria-hidden="true" className="h-full min-h-32 w-full bg-surface-sunken" />
        )}
      </>
    )
  // Signed media URLs are already served by storage and must not be cached by an image proxy.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Signed storage URLs must bypass the image proxy.
    <img
      {...props}
      alt={props.alt ?? ''}
      loading={priority ? 'eager' : (props.loading ?? 'lazy')}
      style={{
        ...(fill
          ? ({ position: 'absolute', inset: 0, width: '100%', height: '100%' } as const)
          : {}),
        ...props.style,
      }}
      onError={() => setFailedSrc(props.src)}
    />
  )
}
