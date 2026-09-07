// Contact details and domain approved by the owner on 2026-09-06.
export const SITE_URL = (process.env['NEXT_PUBLIC_SITE_URL'] || 'https://odg.co.il').replace(
  /\/+$/,
  '',
)
export const CONTACT = {
  phone: '054-8018613',
  phoneHref: 'tel:+972548018613',
  email: 'info@odg.co.il',
} as const
