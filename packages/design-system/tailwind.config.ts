import type { Config } from 'tailwindcss'
import { colors, typography, borderRadius, shadows } from './src/tokens'

const config: Config = {
  darkMode: ['class'],
  content: [
    // Apps
    '../../apps/*/src/**/*.{ts,tsx}',
    '../../apps/*/app/**/*.{ts,tsx}',
    '../../apps/*/components/**/*.{ts,tsx}',
    // Shared packages
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── OpenDoor Brand ──
        teal:    colors.teal,
        brand:   colors.teal,         // alias

        // ── Semantic / CSS-var powered (dark mode safe) ──
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border:  'hsl(var(--border))',
        input:   'hsl(var(--input))',
        ring:    'hsl(var(--ring))',

        // ── Status ──
        success:  colors.success,
        warning:  colors.warning,
        error:    colors.error,
        info:     colors.info,

        // ── Grays ──
        gray: colors.gray,
      },

      fontFamily: {
        sans:   typography.fontFamily.hebrew,
        hebrew: typography.fontFamily.hebrew,
        mono:   typography.fontFamily.mono,
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fontSize: typography.fontSize as any,

      borderRadius: {
        ...borderRadius,
        // ShadCN expects these variable names
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'calc(var(--radius) - 4px)',
      },

      boxShadow: shadows,

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
      },

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        shimmer:          'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
}

export default config
