import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const config: NextConfig = {
  // maplibre-gl is ESM-only and spawns its renderer in a web worker via
  // `new Worker(new URL('./maplibre-gl-worker.mjs', import.meta.url))`. Left
  // untranspiled, the bundler does not rewrite that URL, the worker request
  // falls through to the Next router and returns HTML — the map then renders
  // an empty canvas with no tiles, no attribution and no markers, and fails
  // silently because `load` never fires. Transpiling it makes webpack emit the
  // worker as a real asset.
  transpilePackages: ['@urban-renewal/design-system', '@urban-renewal/db', 'maplibre-gl'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'odg.co.il' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
}

export default withNextIntl(config)
