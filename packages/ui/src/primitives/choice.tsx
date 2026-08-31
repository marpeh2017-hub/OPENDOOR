import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '../lib/cn'

/**
 * Checkbox and radio group.
 *
 * ── WHY THESE ARE NOT `Input type="checkbox"` ──────────────────────────────
 *
 * A native checkbox cannot be styled to match the rest of this design system
 * without `appearance: none`, at which point you have re-implemented its
 * focus, checked and indeterminate states by hand and usually lost one. Radix
 * keeps the semantics and the keyboard behaviour and hands over the painting.
 *
 * Both packages are ALREADY dependencies of this package, and both are already
 * used by the CRM — so this file adds no install and no bundle a second app is
 * not paying for.
 *
 * ── THE TARGET IS THE LABEL, NOT THE BOX ───────────────────────────────────
 *
 * A 20px box is well under the 44px comfortable touch target, and shrinking a
 * finger is not an option. So the control and its label are one `<label>`
 * element with the padding on the label: the whole row is the hit area, which
 * is both easier to tap and what a sighted mouse user already expects.
 *
 * ── CONSENT IS NEVER PRE-TICKED ────────────────────────────────────────────
 *
 * `Checkbox` has no `defaultChecked` convenience and this is deliberate. The
 * one place this site uses a checkbox is privacy consent, where a pre-ticked
 * box is not consent at all. Callers that genuinely need a default can pass
 * `checked`, which makes the decision visible in the calling code.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * CHECKBOX
 * ══════════════════════════════════════════════════════════════════════════ */

export interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'children'> {
  /** The visible label. Required: an unlabelled checkbox is unusable. */
  label: React.ReactNode
  /** Rendered under the label, in the muted tone. */
  description?: React.ReactNode
  /** Presence of a message marks the control invalid. */
  error?: string | null
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, error, id, ...props }, ref) => {
  const generated = React.useId()
  const controlId = id ?? generated
  const errorId = `${controlId}-error`
  const descriptionId = `${controlId}-description`

  const describedBy =
    [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className="space-y-1.5">
      {/* The label wraps the control, so the whole row is the target. */}
      <label
        htmlFor={controlId}
        className={cn(
          'flex cursor-pointer items-start gap-3 py-2',
          props.disabled && 'cursor-not-allowed opacity-60',
          className,
        )}
      >
        <CheckboxPrimitive.Root
          ref={ref}
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 bg-white',
            'border-gray-300 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2',
            'data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600',
            'aria-[invalid]:border-red-500',
            'disabled:cursor-not-allowed',
          )}
          {...props}
        >
          <CheckboxPrimitive.Indicator className="text-white">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path
                d="M5 10.5l3.5 3.5L15 7"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>

        <span className="text-sm leading-relaxed text-gray-800">
          {label}
          {description && (
            <span id={descriptionId} className="mt-0.5 block text-sm text-gray-600">
              {description}
            </span>
          )}
        </span>
      </label>

      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
})
Checkbox.displayName = 'Checkbox'

/* ══════════════════════════════════════════════════════════════════════════
 * RADIO GROUP
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── WHY A RADIO GROUP AND NOT A SELECT ─────────────────────────────────────
 *
 * The eligibility form asks how far along the owners are, with four answers.
 * A `<select>` hides all four until opened, which means the visitor has to
 * work to discover that "we have not started" is an acceptable answer — and
 * that is the answer most likely to make someone abandon the form if they
 * think it disqualifies them. Four visible options answer that worry before
 * it forms.
 *
 * Rule of thumb this encodes: five options or fewer, and the options
 * themselves carry reassurance → radio. More than that → select.
 */

export interface RadioOption {
  value: string
  label: React.ReactNode
  /** One line under the label. Use sparingly; long options stop being scannable. */
  description?: React.ReactNode
}

export interface RadioGroupProps
  extends Omit<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, 'children'> {
  options: readonly RadioOption[]
  /** Names the group for assistive tech. Required — a set of radios with no
   *  group label is announced as unrelated controls. */
  ariaLabel?: string
  ariaLabelledBy?: string
  error?: string | null
}

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, options, ariaLabel, ariaLabelledBy, error, id, ...props }, ref) => {
  const generated = React.useId()
  const groupId = id ?? generated
  const errorId = `${groupId}-error`

  return (
    <div className="space-y-1.5">
      <RadioGroupPrimitive.Root
        ref={ref}
        id={groupId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={cn('flex flex-col gap-2.5', className)}
        {...props}
      >
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border border-gray-300 bg-white p-3.5',
                'transition-colors hover:border-gray-400',
                // The whole row reflects selection, not just the dot — a 8px
                // dot is a very small thing to ask someone to notice.
                'has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50/60',
              )}
            >
              <RadioGroupPrimitive.Item
                id={optionId}
                value={option.value}
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white',
                  'border-gray-300 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2',
                  'data-[state=checked]:border-teal-600',
                )}
              >
                <RadioGroupPrimitive.Indicator className="block h-2 w-2 rounded-full bg-teal-600" />
              </RadioGroupPrimitive.Item>

              <span className="text-sm leading-relaxed text-gray-800">
                {option.label}
                {option.description && (
                  <span className="mt-0.5 block text-sm text-gray-600">{option.description}</span>
                )}
              </span>
            </label>
          )
        })}
      </RadioGroupPrimitive.Root>

      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
})
RadioGroup.displayName = 'RadioGroup'
