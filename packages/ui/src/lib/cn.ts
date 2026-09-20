import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Class merge helper.
 *
 * Identical in behaviour to the `cn` already used across the CRM and Portal
 * (`apps/*​/src/lib/utils.ts`). Duplicated here on purpose rather than imported
 * from an app: a shared package must not depend on a consumer. When the apps
 * eventually adopt this package they can re-export from here and delete their
 * copy, which is a one-line change with no behavioural difference.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
