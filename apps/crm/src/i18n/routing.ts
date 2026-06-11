import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['he', 'en', 'ru', 'ar'],
  defaultLocale: 'he',
  localePrefix: 'always',
})
