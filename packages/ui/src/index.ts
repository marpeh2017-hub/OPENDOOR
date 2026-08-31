/**
 * @urban-renewal/ui
 *
 * Shared React primitives for the OpenDoor website, resident portal and CRM.
 *
 * ── SCOPE RULE ─────────────────────────────────────────────────────────────
 *
 * A component lives here only when a SECOND app needs it. Premature sharing
 * produces an over-parameterised component that fits nobody and couples the
 * release of one app to another. Website-only pieces (Hero, ProjectCard,
 * FormWizard, and so on) stay in `apps/website`.
 *
 * ── COMPATIBILITY WITH THE CRM ─────────────────────────────────────────────
 *
 * Built on the same stack the CRM already uses — Radix, class-variance-
 * authority, clsx, tailwind-merge — with matching component and variant names.
 * A CRM file can switch its import without other edits. Where this package
 * differs it is a SUPERSET (for example `Button` gains `loading`), never a
 * narrowing.
 */
export { Button, Spinner, buttonVariants, type ButtonProps } from './primitives/button'
export {
  Field, FieldLabel, FieldDescription, FieldError,
  Input, Textarea, Select,
  type FieldProps,
} from './primitives/field'
export {
  Checkbox, RadioGroup,
  type CheckboxProps, type RadioGroupProps, type RadioOption,
} from './primitives/choice'
export {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from './primitives/card'
export { Badge, badgeVariants, type BadgeProps } from './primitives/badge'
export {
  EmptyState, ErrorState, LoadingState, Skeleton, SkeletonRows, VisuallyHidden,
  type EmptyStateProps, type ErrorStateProps, type LoadingStateProps,
} from './states'
export { cn } from './lib/cn'
