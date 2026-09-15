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

/**
 * Marks a value the business still has to supply. Rendered highlighted.
 *
 * Locale-neutral on purpose: the same constants feed the Hebrew and the
 * English pages, so a Hebrew suffix here showed up untranslated on /en.
 */
export const TBD = (what: string) => `[[ TO BE COMPLETED: ${what} ]]`

/**
 * Registered identity. The trading name "OpenDoor Group" is not enough on the
 * legal pages: the Privacy Protection Law requires the database owner to be
 * identifiable, and the terms need a named legal entity behind them.
 */
export const COMPANY = {
  legalName: 'קבוצת אופן דור יזמות והתחדשות בע"מ',
  legalNameEn: 'Kvutsat OpenDoor Yazamut VeHithadshut Ltd.',
  registrationNumber: '515856334',
  /** Court district named as exclusive venue in the terms. */
  jurisdiction: 'ירושלים',
  jurisdictionEn: 'Jerusalem',
} as const

/**
 * Accessibility statement details.
 *
 * The coordinator is named as regulation 91 of the 2013 Service Accessibility
 * Regulations requires. Their phone and email are the company's published
 * ones, so the statement reads them from CONTACT rather than repeating them
 * here and letting the two drift apart.
 *
 * The premises sentence states what the owner confirmed. It is deliberately
 * short and points a visitor with a specific need at the coordinator, because
 * which adjustments a particular person needs is not something a sentence can
 * settle. A survey by a licensed premises accessibility surveyor
 * (מורשה נגישות מבנים, תשתיות וסביבה) is still worth commissioning; it would
 * let this section describe parking, step-free access, the lift and the
 * service position specifically.
 */
export const ACCESSIBILITY = {
  coordinatorName: 'מיכאל רוזנבך',
  coordinatorNameEn: 'Michael Rosenbach',
  /** Date of the technical audit described in the statement. */
  auditDate: '14 בספטמבר 2026',
  auditDateEn: '14 September 2026',
  statementDate: '14 בספטמבר 2026',
  statementDateEn: '14 September 2026',
  premises:
    'משרדי החברה נגישים לאנשים עם מוגבלות. לבירור לגבי התאמה מסוימת לפני ההגעה, ניתן לפנות לרכז הנגישות בפרטים שלהלן.',
  premisesEn:
    'The company’s offices are accessible to people with disabilities. To ask about a particular adjustment before visiting, contact the accessibility coordinator using the details below.',
} as const

/** Shown as the "last updated" line on every legal page. */
export const LEGAL_LAST_UPDATED = '14 בספטמבר 2026'
export const LEGAL_LAST_UPDATED_EN = '14 September 2026'
