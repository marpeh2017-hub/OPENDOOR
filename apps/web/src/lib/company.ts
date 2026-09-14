/*
 * Company details used across the legal pages.
 *
 * TODO(legal): every value marked TBD is a placeholder. Replace all of them
 * before these pages go live — they are rendered on screen in a highlighted
 * style so an unreplaced placeholder is obvious on the page itself.
 */

/** Marks a value that still has to be supplied by the business. */
export const TBD = (what: string) => `[[ ${what} — להשלמה ]]`

export const company = {
  /** Trading name, as already published across the site. */
  brandName: 'OpenDoor התחדשות עירונית',

  /** TBD: the registered company name as it appears in the companies register. */
  legalName: TBD('שם החברה הרשום'),

  /** TBD: company number / licensed dealer number. */
  registrationNumber: TBD('ח.פ. / ע.מ.'),

  website: 'odg.co.il',

  offices: [
    { label: 'סניף ירושלים (ראשי)', address: 'נחום חפצדי 17, מגדלי רם, ירושלים', phone: '054-8018613' },
    { label: 'סניף מרכז', address: 'מגדלי בסר 3, רחוב מצדה 9, בני ברק', phone: '03-5098264' },
  ],

  generalEmail: 'info@odg.co.il',

  /** TBD: address for privacy requests (access, correction, deletion). */
  privacyEmail: TBD('כתובת דוא"ל לפניות בנושא פרטיות'),

  /** TBD: person responsible for privacy requests. */
  privacyOfficer: TBD('שם הממונה על הגנת הפרטיות'),

  /** TBD: accessibility coordinator, required by the 2013 regulations. */
  accessibilityCoordinator: {
    name: TBD('שם רכז/ת הנגישות'),
    phone: TBD('טלפון רכז/ת הנגישות'),
    email: TBD('דוא"ל רכז/ת הנגישות'),
  },

  /** TBD: the court district to name as exclusive venue in the terms. */
  jurisdiction: TBD('מחוז השיפוט (למשל: ירושלים / תל אביב)'),

  /** TBD: the date the accessibility audit was actually performed. */
  accessibilityAuditDate: TBD('תאריך בדיקת הנגישות'),
} as const

/** Last review date shown on the legal pages. Update on every revision. */
export const legalLastUpdated = '14 בספטמבר 2026'
