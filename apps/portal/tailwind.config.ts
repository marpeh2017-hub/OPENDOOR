// A RELATIVE import on purpose. Tailwind tells the build which files its
// config depends on, and it follows only relative imports: through the
// package name, a change to the design system's tokens went unnoticed by
// Next's build cache, which kept serving the old colours across restarts.
// Relative, the preset and its ./src/tokens are both tracked.
import baseConfig from '../../packages/design-system/tailwind.config'
import type { Config } from 'tailwindcss'

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
}

export default config
