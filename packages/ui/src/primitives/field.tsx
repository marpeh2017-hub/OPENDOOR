import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '../lib/cn'

/**
 * Form field primitives.
 *
 * ── THE PROBLEM THESE SOLVE ────────────────────────────────────────────────
 *
 * §50 requires accessible labels, required indicators, clear error messages and
 * RTL layout on every form. Getting that right per-field means wiring four
 * relationships by hand each time: label→input, input→description,
 * input→error, and `aria-invalid`. Every hand-wired instance is a chance to
 * forget one, and the one people forget is `aria-describedby` — which is
 * exactly the one that makes an error message reach a screen reader.
 *
 * `Field` derives all of them from a single `id`, so a field is correct by
 * construction rather than by review.
 */

interface FieldContextValue {
  id: string
  descriptionId: string
  errorId: string
  hasError: boolean
  required: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

function useField(component: string): FieldContextValue {
  const ctx = React.useContext(FieldContext)
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <Field>`)
  }
  return ctx
}

export interface FieldProps {
  /** Stable id. Everything else is derived from it. */
  id: string
  required?: boolean
  /** Presence of a message is what marks the field invalid. */
  error?: string | null
  children: React.ReactNode
  className?: string
}

export function Field({ id, required = false, error, children, className }: FieldProps) {
  const value = React.useMemo<FieldContextValue>(
    () => ({
      id,
      descriptionId: `${id}-description`,
      errorId: `${id}-error`,
      hasError: Boolean(error),
      required,
    }),
    [id, error, required],
  )

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('space-y-1.5', className)}>
        {children}
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </FieldContext.Provider>
  )
}

export function FieldLabel({
  className, children, ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  const field = useField('FieldLabel')
  return (
    <LabelPrimitive.Root
      htmlFor={field.id}
      className={cn('block text-sm font-medium text-gray-800', className)}
      {...props}
    >
      {children}
      {field.required && (
        <>
          {/* The asterisk is decorative; the requirement itself is conveyed by
              `required` on the control, which is what assistive tech reads. */}
          <span aria-hidden="true" className="ms-1 text-red-600">*</span>
          <span className="sr-only"> (שדה חובה)</span>
        </>
      )}
    </LabelPrimitive.Root>
  )
}

export function FieldDescription({
  className, ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const field = useField('FieldDescription')
  return (
    <p id={field.descriptionId} className={cn('text-xs text-gray-500', className)} {...props} />
  )
}

/**
 * `role="alert"` so the message is announced when it appears after a failed
 * submit — a visually-styled paragraph alone is silent to a screen reader.
 */
export function FieldError({
  className, ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const field = useField('FieldError')
  return (
    <p
      id={field.errorId}
      role="alert"
      className={cn('text-xs font-medium text-red-600', className)}
      {...props}
    />
  )
}

/** The wiring every control needs. Spread onto the input/select/textarea. */
function useControlProps() {
  const field = useField('control')
  return {
    id: field.id,
    required: field.required,
    'aria-invalid': field.hasError || undefined,
    // Points at BOTH, so a field with help text and an error announces both.
    'aria-describedby': [field.hasError ? field.errorId : null, field.descriptionId]
      .filter(Boolean)
      .join(' ') || undefined,
  }
}

const controlBase =
  'w-full rounded-md border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 ' +
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ' +
  'aria-[invalid]:border-red-500 border-gray-300'

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  const control = useControlProps()
  return <input ref={ref} className={cn(controlBase, 'h-10', className)} {...control} {...props} />
})
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  const control = useControlProps()
  return (
    <textarea ref={ref} className={cn(controlBase, 'py-2 min-h-24', className)} {...control} {...props} />
  )
})
Textarea.displayName = 'Textarea'

/**
 * Native `<select>` rather than a custom listbox.
 *
 * On mobile — which §36 says to design for first — the native control opens the
 * platform picker, which is faster, familiar, and correct with a screen reader
 * without any work. A custom listbox is warranted when it must show rich
 * content; none of the Phase 1 forms do.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  const control = useControlProps()
  return (
    <select ref={ref} className={cn(controlBase, 'h-10', className)} {...control} {...props}>
      {children}
    </select>
  )
})
Select.displayName = 'Select'
