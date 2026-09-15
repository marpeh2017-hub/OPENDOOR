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
  hasDescription: boolean
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
  const hasDescription = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === FieldDescription,
  )
  const value = React.useMemo<FieldContextValue>(
    () => ({
      id,
      descriptionId: `${id}-description`,
      errorId: `${id}-error`,
      hasError: Boolean(error),
      hasDescription,
      required,
    }),
    [id, error, hasDescription, required],
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
  className, children, requiredLabel = 'שדה חובה', ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
  /**
   * Screen-reader text for the required marker.
   *
   * ── WHY THIS IS A PROP ─────────────────────────────────────────────────
   *
   * It used to be a hardcoded Hebrew string, which meant an English page
   * announced "Full name, (שדה חובה)" to a screen reader — visually invisible,
   * so it survived every visual review. The default stays Hebrew so the CRM,
   * which is Hebrew-only, renders exactly as before; the website passes its
   * own translated string.
   */
  requiredLabel?: string
}) {
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
          <span className="sr-only"> ({requiredLabel})</span>
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
    'aria-describedby': [
      field.hasError ? field.errorId : null,
      field.hasDescription ? field.descriptionId : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined,
  }
}

const controlBase =
  'w-full rounded-md border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 ' +
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ' +
  'aria-[invalid]:border-red-500 border-gray-300'

/**
 * Control height.
 *
 * ── WHY THIS IS A VARIANT RATHER THAN A NEW DEFAULT ────────────────────────
 *
 * `default` is 40px, which is right for the CRM: a dense internal tool where
 * an operator fills the same form many times a day with a mouse and keyboard,
 * and vertical space is the scarce resource.
 *
 * `comfortable` is 44px, which is what a PUBLIC form on a phone needs — a
 * visitor filling it once, with a thumb, possibly one-handed on a bus. 40px is
 * under the comfortable touch target and it shows.
 *
 * Both exist because neither is wrong; they serve different users. Making
 * `comfortable` the default would silently change every CRM form, which is a
 * visual change nobody asked for and nobody would have reviewed. Opting in is
 * one prop at the call site and leaves the CRM byte-identical.
 */
export type ControlSize = 'default' | 'comfortable'

const controlHeight: Record<ControlSize, string> = {
  default: 'h-10',
  // 44px everywhere, plus 16px text below `sm`: iOS zooms the whole page when
  // a focused input's text is under 16px, which throws the visitor out of the
  // layout mid-form. The `sm:text-sm` restores the normal scale on desktop.
  comfortable: 'h-11 text-base sm:h-10 sm:text-sm',
}

export interface ControlProps {
  /** See `ControlSize`. Defaults to `default` so existing callers are unchanged. */
  controlSize?: ControlSize
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & ControlProps
>(({ className, controlSize = 'default', ...props }, ref) => {
  const control = useControlProps()
  return (
    <input
      ref={ref}
      className={cn(controlBase, controlHeight[controlSize], className)}
      {...control}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & ControlProps
>(({ className, controlSize = 'default', ...props }, ref) => {
  const control = useControlProps()
  return (
    <textarea
      ref={ref}
      className={cn(
        controlBase,
        'py-2 min-h-24',
        // A textarea has no fixed height to grow, so `comfortable` only needs
        // the 16px text that stops iOS zooming on focus.
        controlSize === 'comfortable' && 'text-base sm:text-sm',
        className,
      )}
      {...control}
      {...props}
    />
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
  React.SelectHTMLAttributes<HTMLSelectElement> & ControlProps
>(({ className, children, controlSize = 'default', ...props }, ref) => {
  const control = useControlProps()
  return (
    <select
      ref={ref}
      className={cn(controlBase, controlHeight[controlSize], className)}
      {...control}
      {...props}
    >
      {children}
    </select>
  )
})
Select.displayName = 'Select'
