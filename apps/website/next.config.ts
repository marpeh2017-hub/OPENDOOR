import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const config: NextConfig = {
  // Workspace packages ship TypeScript source rather than build output, so Next
  // must compile them. `api-contracts` is types-only and erases, but it is
  // listed anyway: it exports one runtime constant (PROJECT_STAGE_ORDER).
  transpilePackages: [
    '@urban-renewal/design-system',
    '@urban-renewal/ui',
    '@urban-renewal/api-contracts',
  ],
}

export default withNextIntl(config)
