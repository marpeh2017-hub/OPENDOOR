/**
 * OpenDoor Urban Renewal – Brand Design Tokens
 * Derived from the OpenDoor logo identity (teal shield + door icon)
 */

export const colors = {
  // ── Primary Teal (main brand color) ──────────────────────────────
  teal: {
    50:  '#eef9f9',
    100: '#d5f1f2',
    200: '#aee4e5',
    300: '#7dd0d2',
    400: '#4ab6b9',
    500: '#2F9DA0', // PRIMARY – buttons, links, highlights
    600: '#22797D', // DARK TEAL – hover, active, nav accents
    700: '#1b5f62',
    800: '#164a4c',
    900: '#103839',
    950: '#091f20',
  },

  // ── Gray Scale ───────────────────────────────────────────────────
  gray: {
    50:  '#F5F7F8', // light-gray – backgrounds, cards
    100: '#eaecee',
    200: '#d5d8db',
    300: '#b8bdc2',
    400: '#959ba2',
    500: '#6D7378', // steel-gray – secondary UI
    600: '#555a5f',
    700: '#43474b',
    800: '#3A3A3A', // dark-graphite – headings, primary text
    900: '#242729',
    950: '#141618',
  },

  // ── Semantic Colors ──────────────────────────────────────────────
  success: {
    50:  '#f0fdf4',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  warning: {
    50:  '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  error: {
    50:  '#fef2f2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  info: {
    50:  '#eff6ff',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },

  // ── Signature Status Colors ──────────────────────────────────────
  signature: {
    draft:    '#6D7378',
    sent:     '#3b82f6',
    viewed:   '#8b5cf6',
    pending:  '#f59e0b',
    signed:   '#22c55e',
    rejected: '#ef4444',
    expired:  '#9ca3af',
  },

  // ── Project Stage Colors ─────────────────────────────────────────
  stage: {
    discovery:        '#94a3b8',
    feasibility:      '#64748b',
    organization:     '#3b82f6',
    signatures:       '#8b5cf6',
    developerSelect:  '#f59e0b',
    planning:         '#06b6d4',
    municipal:        '#22797D',
    permit:           '#2F9DA0',
    evacuation:       '#f97316',
    construction:     '#84cc16',
    delivery:         '#22c55e',
    postDelivery:     '#10b981',
  },
} as const

export const spacing = {
  xs:   '0.25rem',  // 4px
  sm:   '0.5rem',   // 8px
  md:   '1rem',     // 16px
  lg:   '1.5rem',   // 24px
  xl:   '2rem',     // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
} as const

export const typography = {
  fontFamily: {
    hebrew:    ['Heebo', 'Assistant', 'Arial', 'sans-serif'] as string[],
    sans:      ['Inter', 'Heebo', 'Arial', 'sans-serif'] as string[],
    mono:      ['JetBrains Mono', 'Fira Code', 'monospace'] as string[],
  },
  fontSize: {
    xs:   ['0.75rem',  { lineHeight: '1rem' }],
    sm:   ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem',     { lineHeight: '1.5rem' }],
    lg:   ['1.125rem', { lineHeight: '1.75rem' }],
    xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem',  { lineHeight: '2rem' }],
    '3xl': ['1.875rem',{ lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem',    { lineHeight: '1' }],
    '6xl': ['3.75rem', { lineHeight: '1' }],
  },
} as const

export const borderRadius = {
  sm:   '0.375rem',  // 6px
  md:   '0.5rem',    // 8px
  lg:   '0.75rem',   // 12px
  xl:   '1rem',      // 16px
  '2xl': '1.5rem',   // 24px
  full: '9999px',
} as const

export const shadows = {
  sm:  '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md:  '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
  lg:  '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
  xl:  '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.04)',
  card: '0 2px 8px 0 rgb(47 157 160 / 0.08)',
  teal: '0 4px 14px 0 rgb(47 157 160 / 0.25)',
} as const

export const animation = {
  duration: {
    fast:   '100ms',
    base:   '200ms',
    slow:   '300ms',
    slower: '500ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in:      'cubic-bezier(0.4, 0, 1, 1)',
    out:     'cubic-bezier(0, 0, 0.2, 1)',
    bounce:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const
