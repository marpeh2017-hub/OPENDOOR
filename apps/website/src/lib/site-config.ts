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

/** Marks a value the business still has to supply. Rendered highlighted. */
export const TBD = (what: string) => `[[ ${what} — להשלמה ]]`

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
 * TODO(accessibility): `coordinatorName` and `premises` must be filled in
 * before launch. Regulation 91 of the 2013 Service Accessibility Regulations
 * requires a named coordinator, and the statement has to describe the physical
 * offices as well as the website — that part needs a licensed premises
 * accessibility surveyor (מורשה נגישות מבנים, תשתיות וסביבה).
 */
export const ACCESSIBILITY = {
  coordinatorName: TBD('שם רכז/ת הנגישות'),
  coordinatorNameEn: TBD('accessibility coordinator name'),
  /** Date of the technical audit described in the statement. */
  auditDate: '14 בספטמבר 2026',
  auditDateEn: '14 September 2026',
  statementDate: '14 בספטמבר 2026',
  statementDateEn: '14 September 2026',
  premises: TBD(
    'תיאור נגישות המשרדים: חניית נכים, גישה ללא מדרגות, מעלית, שירותי נכים ועמדת שירות — דורש בדיקת מורשה נגישות מבנים',
  ),
  premisesEn: TBD('description of physical office accessibility — pending a licensed surveyor'),
} as const

/** Shown as the "last updated" line on every legal page. */
export const LEGAL_LAST_UPDATED = '14 בספטמבר 2026'
export const LEGAL_LAST_UPDATED_EN = '14 September 2026'
