import { defineRouting } from 'next-intl/routing'

/**
 * Hebrew and English only, for now.
 *
 * Russian and Arabic were listed from the start, for the residents who read
 * them, but their message files were never written. Listed, they made a
 * browser set to Russian or Arabic land on /ru or /ar, whose missing file
 * failed every page with a server error. Unlisted, such a browser gets the
 * Hebrew personal area. Adding them back is one entry each here plus a
 * reviewed messages/ru.json or ar.json (the forms' wording is legal text, so
 * not a machine translation); `rtlLocales` in the root layout already knows
 * Arabic is right to left.
 */
export const routing = defineRouting({
  locales: ['he', 'en'],
  defaultLocale: 'he',
  localePrefix: 'always',
})
