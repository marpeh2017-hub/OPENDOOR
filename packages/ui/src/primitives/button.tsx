import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

/**
 * Button.
 *
 * ── RELATIONSHIP TO THE CRM'S BUTTON ───────────────────────────────────────
 *
 * Deliberately a SUPERSET of `apps/crm/src/components/ui/button.tsx`: same
 * variant names, same size names, same `asChild` prop, same underlying Radix
 * Slot. An existing call site can switch its import and nothing changes.
 *
 * What is added is the state the CRM's version lacks: `loading`. §61 requires
 * every interactive component to define eight states, and loading was the one
 * with no representation — every CRM screen that needs it currently open-codes
 * a disabled button with a spinner beside it, which is why "שומר…" text appears
 * inconsistently across the app.
 *
 * ── WHY LOADING IS NOT JUST `disabled` ─────────────────────────────────────
 *
 * A `disabled` button is removed from the tab order and announces nothing, so a
 * screen-reader user who activates "שמירה" and hears silence cannot tell
 * whether anything happened. This keeps the button focusable and uses
 * `aria-busy` + `aria-disabled`, so the control still announces itself and its
 * state, while `onClick` is suppressed to prevent double submission (§50).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ' +
  'transition-colors disabled:pointer-events-none disabled:opacity-50 ' +
  'aria-disabled:opacity-60 aria-disabled:cursor-progress ' +
  '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-teal-600 text-white hover:bg-teal-700',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        outline:     'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
        secondary:   'bg-gray-100 text-gray-800 hover:bg-gray-200',
        ghost:       'text-gray-800 hover:bg-gray-100',
        // teal-700 rather than teal-500: a text link must clear 4.5:1, and
        // teal.500 on white is 3.26:1.
        link:        'text-teal-700 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-9 rounded-md px-3',
        lg:      'h-11 rounded-md px-8',
        // 44px: the WCAG 2.5.5 target-size guidance, and the practical minimum
        // for a thumb on a phone.
        icon:    'h-11 w-11',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'default', size: 'default', fullWidth: false },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  /** Announced by screen readers while loading. Defaults to Hebrew. */
  loadingLabel?: string
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className, variant, size, fullWidth,
      asChild = false, loading = false, loadingLabel = 'טוען…',
      children, onClick, ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        // Focusable and announced, unlike `disabled`. See the note above.
        aria-disabled={loading || props.disabled || undefined}
        aria-busy={loading || undefined}
        onClick={loading ? (e) => e.preventDefault() : onClick}
        {...props}
      >
        {loading && <Spinner aria-hidden="true" />}
        {children}
        {/* Announced once when loading begins; invisible. */}
        {loading && <span className="sr-only">{loadingLabel}</span>}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

/**
 * Inline spinner.
 *
 * `aria-hidden` by default — the accessible announcement belongs to whatever
 * owns the loading state (the button's `aria-busy`, or a LoadingState's
 * `role="status"`). A spinner that announces itself produces double
 * announcements on every load.
 */
export function Spinner({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={cn('h-4 w-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  )
}

export { buttonVariants }
