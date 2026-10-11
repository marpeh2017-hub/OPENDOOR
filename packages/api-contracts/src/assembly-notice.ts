import type { ProtocolText } from './representation-protocol'

/**
 * "הודעה על כינוס בעלי דירות", the owner's notice of an owners' assembly, as
 * data.
 *
 * ── THE WORDING IS THE OWNER'S ─────────────────────────────────────────────
 *
 * Copied word for word from the owner's Word file (2026-10-11), with its bold.
 * The changes they approved on 2026-10-11, and nothing else:
 *
 *   - The title's long dash became a colon.
 *   - The company's name without the hyphen: "קבוצת אופן דור יזמות והתחדשות".
 *   - The email line, blank in the file, is the company's address.
 *
 * The agenda is numbered 1 to 7 and the contact lines are bullets, as in the
 * file. The four details at the top are filled in for each assembly; the
 * website prints them blank.
 *
 * `version` names the wording: change it whenever a word changes. A notice
 * sent to owners records the version it was sent with.
 */

export interface NoticeField {
  key: 'compound' | 'meetingDate' | 'meetingTime' | 'meetingPlace'
  label: string
}

export interface NoticeAgendaItem {
  /** The bold opening, "מהות הפרויקט והתהליך:". */
  lead: string
  text: string
}

export interface AssemblyNotice {
  id: string
  version: string
  header: string
  title: string
  fields: readonly NoticeField[]
  addresseeLabel: string
  addressee: string
  greeting: string
  intro: readonly ProtocolText[]
  agendaHeading: string
  agenda: readonly NoticeAgendaItem[]
  importanceHeading: string
  importance: string
  closing: string
  signOff: string
  company: string
  contacts: readonly { label: string; value: string }[]
}

export const ASSEMBLY_NOTICE: AssemblyNotice = {
  id: 'assembly-notice',
  /** Names the wording. Change it whenever a word changes. */
  version: '2026-10-11',
  header: 'בס"ד',
  title: 'הודעה על כינוס בעלי דירות: פרויקט התחדשות עירונית',

  fields: [
    { key: 'compound', label: 'מתחם / כתובת' },
    { key: 'meetingDate', label: 'תאריך הכינוס' },
    { key: 'meetingTime', label: 'שעת הכינוס' },
    { key: 'meetingPlace', label: 'מקום הכינוס' },
  ],

  addresseeLabel: 'לכבוד:',
  addressee: 'בעלות ובעלי הדירות במתחם,',
  greeting: 'שלום רב,',

  intro: [
    'הנכם מוזמנים לכינוס בעלי דירות ראשוני, אשר ייערך במטרה להציג בפניכם מידע מקיף, שקוף ומסודר בנוגע לקידום פרויקט התחדשות עירונית במתחם המגורים שלכם.',
    'הכינוס מתקיים בהתאם להוראות **חוק התחדשות עירונית (הסכמים לארגון עסקאות), התשע"ז-2017**, ובמסגרתו יוצגו הנושאים הבאים:',
  ],

  agendaHeading: 'סדר היום ונושאי הכינוס:',
  agenda: [
    { lead: 'מהות הפרויקט והתהליך:', text: 'הסבר על שלבי המפתח בקידום פרויקט התחדשות עירונית, החל משלב ההתארגנות ועד למימושו.' },
    { lead: 'זכויות בעלי הדירות:', text: 'סקירת הזכויות וההגנות המוקנות לכם על פי חוק התחדשות עירונית.' },
    { lead: 'זהות המארגן ופועלו:', text: 'הצגת ניסיונה ופעילותה של החברה בקידום הפרויקט.' },
    { lead: 'גילוי נאות ושקיפות:', text: 'הבהרה לגבי זיקת המארגן ליזמים/גורמים שונים (ככל שקיימת).' },
    { lead: 'שכר טרחה ותמורה:', text: 'הצגת מידע מלא בדבר מנגנון התמורה או שכר הטרחה של המארגן.' },
    {
      lead: 'גורמים מלווים ומפקחים:',
      text: 'מתן מידע על פעילות הרשות הממשלתית להתחדשות עירונית, המנהלת העירונית והממונה על פניות דיירים.',
    },
    { lead: 'דיון פתוח:', text: 'מענה מפורט לשאלות, הקשבה לצרכי הדיירים ושיח משותף.' },
  ],

  importanceHeading: 'חשיבות השתתפותכם:',
  importance: 'נוכחותכם בכינוס חשובה ביותר לצורך קבלת החלטות מושכלות, הגנה על זכויותיכם וקידום מוצלח של הפרויקט.',
  closing: 'נשמח לראותכם,',
  signOff: 'בברכה,',
  company: 'קבוצת אופן דור יזמות והתחדשות',
  contacts: [
    { label: 'נציג החברה', value: 'מיכאל רוזנבך' },
    { label: 'טלפון ליצירת קשר', value: '054-8018613' },
    { label: 'דוא"ל', value: 'info@odg.co.il' },
  ],
}

/** Topics on the agenda: 7. */
export const NOTICE_AGENDA_COUNT = ASSEMBLY_NOTICE.agenda.length
