// A RELATIVE import on purpose. Tailwind tells the build which files its
// config depends on, and it follows only relative imports: through the
// package name, a change to the design system's tokens went unnoticed by
// Next's build cache, which kept serving the old colours across restarts.
// Relative, the preset and its ./src/tokens are both tracked.
import baseConfig from '../../packages/design-system/tailwind.config'
import type { Config } from 'tailwindcss'

/**
 * The teal comes from the design system (packages/design-system/src/tokens.ts),
 * anchored on the brand colour #0d8b8b, with its four roles and their contrast
 * documented there.
 *
 * The 2026-10 design review gave the website this ramp as its own override,
 * when the shared scale (#2F9DA0 at 500) was still the CRM's and the Portal's.
 * Since 2026-10-07 the shared scale IS this ramp, so all three read as one
 * company and the override is gone: every `teal-*` and `brand-*` class here,
 * including those inside packages/ui, resolves to the same values as before.
 */
const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
    // Required: packages/ui styles with utility classes, so Tailwind must scan
    // it or every shared component ships unstyled.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
}

export default config
