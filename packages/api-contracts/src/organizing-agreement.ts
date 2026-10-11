import type { ProtocolTableColumn, ProtocolText } from './representation-protocol'

/**
 * "הסכם לארגון וליווי עסקת פינוי בינוי", the agreement between the owners and
 * the company as their organiser, as data.
 *
 * ── THE WORDING IS THE OWNER'S ─────────────────────────────────────────────
 *
 * Copied word for word from the owner's Word file (2026-10-11), with its bold
 * and underlining. The corrections they approved on 2026-10-11, and nothing
 * else:
 *
 *   - The signature line: "נציגות הדיירים" (the file had "הדירים").
 *   - 7: "תוקפו של הסכם זה" (was "של ההסכם זה").
 *   - 8: "וחתימה על ייפוי כוח... אין בה" (was a double negative, "ואין
 *     חתימה... אין בה").
 *   - 9: "לקראת ההתקשרות בהסכם פינוי בינוי" (the ב was missing).
 *   - 10: "את כל בעלי הדירות", and the closing words joined to the sentence,
 *     "וכן מפקח בניה, שמאי ויועצים, ככל שיידרשו לקידום הפרויקט." (they stood
 *     alone as a fragment).
 *   - 2: "על כל אחד מבעלי הדירות" (was "על כל יחיד בעלים").
 *   - The organiser by the company's full name, as in the protocol: "חברת
 *     קבוצת אופן דור יזמות והתחדשות בע״מ ח.פ. 515856334" (was "חברת אופן
 *     דור ח.פ 515856334").
 *   - 1: the city is a field, "ב{city}" (the file fixed it as "בירושלים").
 *
 * ── THE GAPS ───────────────────────────────────────────────────────────────
 *
 * The file leaves gaps for each complex: the street, the block and parcel,
 * the city, and the determining date (the day the first owner signed). They
 * are `{street}`, `{gush}`, `{helka}`, `{city}` and `{determiningDate}`
 * (document-fields.ts). The website prints them blank; a filled copy prints
 * the complex's values, and the determining date from the first signature.
 *
 * `version` names the wording: change it whenever a word changes. A signed
 * copy records the version it was signed on.
 */

export interface AgreementClause {
  number: number
  text: ProtocolText
}

export interface OrganizingAgreement {
  id: string
  version: string
  header: string
  title: ProtocolText
  /** The line under the title, naming the complex's street. */
  parties: ProtocolText
  representativesTable: { columns: readonly ProtocolTableColumn[]; blankRows: number }
  jointly: ProtocolText
  between: ProtocolText
  organizer: ProtocolText
  recitals: readonly { label: string; text: ProtocolText }[]
  agreed: string
  clauses: readonly AgreementClause[]
  /** The three signature lines under the clauses. */
  signatureRow: readonly string[]
  ownersTable: { heading: ProtocolText; columns: readonly ProtocolTableColumn[]; blankRows: number }
}

export const ORGANIZING_AGREEMENT: OrganizingAgreement = {
  id: 'organizing-agreement',
  /** Names the wording. Change it whenever a word changes. */
  version: '2026-10-11',
  header: 'בס"ד',
  title: '__**הסכם לארגון וליווי עסקת פינוי בינוי**__',
  parties: "__**שנערך ונחתם בין בעלי הזכויות ברח' {street} (להלן: \"המתחם\") באמצעות הנציגים הבאים, כדלהלן:**__",

  representativesTable: {
    columns: [
      { key: 'lastName', label: '**שם משפחה**' },
      { key: 'firstName', label: '**שם פרטי**' },
      { key: 'idNumber', label: '**ת.ז.**' },
    ],
    /** Empty rows on the printed form, as in the source. */
    blankRows: 3,
  },

  jointly: '__כולם יחד וכ"א לחוד (להלן: "הנציגות")__',
  between: '**לבין**:',
  organizer:
    '**חברת קבוצת אופן דור יזמות והתחדשות בע״מ ח.פ. 515856334 ו/או מי מטעמה באמצעות __מיכאל רוזנבך__ המורשה לחתום ולהתחייב בשמה** (להלן: "**המארגן**")',

  recitals: [
    {
      label: 'הואיל:',
      text: 'והנציגות ובעלי הדירות במתחם כאמור בכותרת הסכם זה רוצים להתקשר בהסכם קדם התקשרות לארגון וליווי בעלי הדירות לביצוע עסקת פינוי בינוי עם המארגן;',
    },
    {
      label: 'והואיל:',
      text: 'והמועד הקובע בהסכם קדם התקשרות זה הוא מועד החתימה עם הדייר הראשון במתחם שנחתם ביום {determiningDate} (להלן: "**המועד הקובע**");',
    },
  ],

  agreed: 'הוסכם והותנה, כדלהלן:',

  clauses: [
    {
      number: 1,
      text: 'בהסכם זה, המתחם הידוע בגוש {gush} חלקה {helka} ברחוב {street} ב{city} או כל חלק ממנו ולרבות חלקות נוספות סמוכות לפי שיקול דעת המארגן (להלן: "**המתחם**")',
    },
    {
      number: 2,
      text: '**הסכם קדם התקשרות זה הוא הסכם ראשוני שמטרתו לאפשר למארגן לארגן וללוות את הפרויקט ולאפשר לצדדים להיכנס למו"מ על נוסחו של הסכם פינוי - בינוי סופי ומפורט (להלן – "הסכם פינוי בינוי") ומבלי שיהיה בכך כדי להטיל כל מחויבות שהיא, לרבות כספים, על כל אחד מבעלי הדירות למעט כמפורט במסמך זה.**',
    },
    {
      number: 3,
      text: 'לא תירשם כל הערת אזהרה בלשכת רישום מקרקעין בגין חתימת הסכם זה באשר הוא איננו הסכם פינוי-בינוי.',
    },
    {
      number: 4,
      text: 'המארגן מתחייב בזאת לשוויון יחסי בין בעלי הזכויות וזאת בכפוף להוראות החוק בדבר דיירים מבוגרים ו/או קשישים ו/או מוגבלים.',
    },
    {
      number: 5,
      text: 'המארגן מתחייב לפעול מול כל בעלי הזכויות במתחם ו/או כל גורם רלוונטי אחר לשם גיבוש הסכם פינוי בינוי מחייב עם היזם שייבחר.',
    },
    {
      number: 6,
      text: 'התמורה לבעלים תיקבע בהסכם הפינוי - בינוי אך המארגן מתחייב כי התמורות לבעלים לא יפחתו מהתמורות המקובלות במתחמים דומים ובכפוף להוראות סעיף 3(א) לחוק התחדשות העירונית (הסכמים לארגון עסקאות).',
    },
    {
      number: 7,
      text: '**תוקפו של הסכם זה -** הסכם קדם התקשרות זה עומד בתוקפו בהתאם למועדים המנויים בחוק התחדשות עירונית (הסכמים לארגון עסקאות) תשע"ז-2017 לתקופה שלא תפחת מ-6 חודשים מן המועד הקובע, ויוארך מפעם לפעם לפי הוראות החוק. כל עוד הסכם זה בתוקף לא יתקשר בעל הדירה עם צד ג\' כלשהו בקשר להסכם פינוי - בינוי או הסכם התחדשות עירונית אחר ביחס למקרקעין.',
    },
    {
      number: 8,
      text: 'בעל/ת הדירה אשר חתמו על מסמך זה, רשאי לעשות כל עסקה בדירתו גם לאחר חתימת מסמך זה וחתימה על ייפוי כוח ו/או על הסכם זה אין בה כדי למנוע את הורשת הנכס ו/או כל דיספוזיציה בנכס.',
    },
    {
      number: 9,
      text: 'המארגן מתחייב לפעול לטובת בעלי הדירות באמונה ובהגינות כאמור בסעיף 11 לחוק התחדשות עירונית (הסכמים לארגון עסקאות) ומבלי לגרוע מכך כי המארגן מתחייב לפעול בתום לב במסגרת המו"מ לקראת ההתקשרות בהסכם פינוי בינוי. למען הסר ספק המארגן מתחייב לבחון מס\' הצעות מיזמים טרם בחירת היזם לפרויקט ע"י הנציגות.',
    },
    {
      number: 10,
      text: 'בעל הדירה מאשר לנציגות בעלי הדירות לבחור עו"ד אשר ייצג את כל בעלי הדירות במשא ומתן עם החברה היזמית לשם ניסוח הסכם פינוי - בינוי בין הדיירים לבין החברה היזמית, וכן מפקח בניה, שמאי ויועצים, ככל שיידרשו לקידום הפרויקט.',
    },
    {
      number: 11,
      text: 'תוצרי התכנון וכל פירות עבודתו של המארגן יהיו שייכים לו, ולא ניתן להעבירם / לעשות בהם שימוש אישי.',
    },
  ],

  signatureRow: ['נציגות הדיירים', 'תאריך', 'המארגן'],

  ownersTable: {
    heading: '__**חתימות בעלי הדירות**__',
    columns: [
      { key: 'apartment', label: "__**מס' דירה**__" },
      { key: 'fullName', label: '__**שם מלא**__' },
      { key: 'idNumber', label: '__**ת.ז**__' },
      { key: 'date', label: '__**תאריך**__' },
      { key: 'signature', label: '__**חתימה**__' },
    ],
    /** Empty rows on the printed form, as in the source. */
    blankRows: 17,
  },
}

/** Clauses: 11. */
export const AGREEMENT_CLAUSE_COUNT = ORGANIZING_AGREEMENT.clauses.length

/** The gaps a complex fills in, with the labels staff see. */
export const AGREEMENT_FIELDS = [
  { key: 'street', label: 'רחוב' },
  { key: 'city', label: 'עיר' },
  { key: 'gush', label: 'גוש' },
  { key: 'helka', label: 'חלקה' },
] as const
