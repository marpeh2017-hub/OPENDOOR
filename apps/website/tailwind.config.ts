import baseConfig from '@urban-renewal/design-system/tailwind'
import type { Config } from 'tailwindcss'

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
