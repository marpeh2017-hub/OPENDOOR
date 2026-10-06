import baseConfig from '@urban-renewal/design-system/tailwind'
import type { Config } from 'tailwindcss'

/**
 * The website's teal, anchored on the brand colour #0d8b8b.
 *
 * ── WHY THE WEBSITE OVERRIDES THE SHARED SCALE ─────────────────────────────
 *
 * The design review (2026-10) counted nine teals on the site and none of them
 * the brand's. The shared scale is also the CRM's and the Portal's, so it is
 * replaced HERE, for this app only: every existing `teal-*` class on the site,
 * including those inside packages/ui, now resolves to one ramp of one hue.
 *
 * Four roles, and the contrast that decides each (WCAG 2.1, on white unless
 * stated):
 *
 *   500  BRAND   #0D8B8B  graphics, icons, rules, display headings.
 *                         4.1:1, so never small text and never a button fill.
 *   600  ACTION  #0B7A7A  text, links, buttons. 5.2:1; 4.6:1 on the wash.
 *   950  DEPTH   #14312F  the dark surface (= surface.inverse).
 *   50   WASH    #E8F4F4  tinted bands and icon grounds.
 *
 * The other steps are tints and shades of the same hue. 300 and 400 exist for
 * text on the dark surface (6.6:1 and 4.7:1 on #14312F); 700 is the action
 * colour's hover. The logo keeps its own colours: it is artwork, not a token.
 */
const teal = {
  50: '#E8F4F4',
  100: '#D3EAEA',
  200: '#A8D5D5',
  300: '#7ABFBF',
  400: '#42A5A5',
  500: '#0D8B8B',
  600: '#0B7A7A',
  700: '#095F5F',
  800: '#0D4F4E',
  900: '#113F3D',
  950: '#14312F',
}

const baseExtend = baseConfig.theme?.extend ?? {}

const config: Config = {
  ...baseConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
    // Required: packages/ui styles with utility classes, so Tailwind must scan
    // it or every shared component ships unstyled.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseExtend,
      colors: {
        ...(baseExtend.colors as Record<string, unknown>),
        teal,
        brand: teal,
      },
    },
  },
}

export default config
