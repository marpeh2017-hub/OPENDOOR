import type { ReactNode } from 'react'
import { ACCESSIBILITY, COMPANY, CONTACT, LEGAL_LAST_UPDATED, LEGAL_LAST_UPDATED_EN } from '@/lib/site-config'

type Section = { title: string; body: ReactNode }

/**
 * Highlights a value the business has not supplied yet, so an unfilled
 * placeholder is impossible to miss when reviewing the page itself.
 */
function Pending({ children }: { children: string }) {
  if (!children.includes('[[')) return <>{children}</>
  return <mark className="rounded bg-amber-100 px-1 py-0.5 font-semibold text-amber-900">{children}</mark>
}

function withPending(body: string): ReactNode {
  const parts = body.split(/(\[\[[^\]]*\]\])/g)
  if (parts.length === 1) return body
  return parts.map((part, i) => (part.startsWith('[[') ? <Pending key={i}>{part}</Pending> : part))
}

export function LegalSections({ sections, updated }: { sections: Section[]; updated: string }) {
  return <div className="max-w-3xl space-y-8 text-[15px] leading-8 text-gray-700">
    {sections.map(s => <section key={s.title}><h2 className="text-xl font-semibold text-gray-900">{s.title}</h2><p className="mt-2 whitespace-pre-line">{typeof s.body === 'string' ? withPending(s.body) : s.body}</p></section>)}
    <p className="border-t border-gray-200 pt-5 text-sm">ליצירת קשר: <a className="underline" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> · <a className="underline" href={CONTACT.phoneHref} dir="ltr">{CONTACT.phone}</a></p>
    <p className="text-sm text-gray-600">{updated}</p>
  </div>
}

const ENTITY_HE = `${COMPANY.legalName} (ח.פ. ${COMPANY.registrationNumber})`
const ENTITY_EN = `${COMPANY.legalNameEn} (company no. ${COMPANY.registrationNumber})`

/* ── Privacy ─────────────────────────────────────────────────────────────── */

const hePrivacy: Section[] = [
  { title: 'מי אנחנו', body: `האתר מופעל על ידי ${ENTITY_HE}, הפועלת תחת השם OpenDoor Group, המארגנת ומייצגת בעלי דירות בתהליכי התחדשות עירונית. החברה היא בעלת מאגר המידע כמשמעותו בחוק הגנת הפרטיות, התשמ״א-1981. מדיניות זו מסבירה כיצד אנו מטפלים במידע שמתקבל דרך האתר.` },
  { title: 'איזה מידע אנו מקבלים', body: 'כאשר אתם פונים אלינו או משתמשים בטופס פנייה, אנו מקבלים את הפרטים שבחרתם למסור: שם, טלפון, ובאופן אופציונלי דוא״ל, כתובת הבניין, מספר הדירות ותוכן הפנייה. אנו מתעדים גם את אישורי ההסכמה שסימנתם ואת מועד מסירתם. האתר מקבל גם מידע טכני הנדרש להפעלה ולאבטחה.' },
  { title: 'מסירת המידע אינה חובה', body: 'אינכם חייבים למסור לנו מידע, ומסירתו תלויה ברצונכם בלבד. בלא הפרטים המסומנים כשדות חובה לא נוכל ליצור עמכם קשר או לטפל בפנייה. הודעה זו ניתנת לפי סעיף 11 לחוק הגנת הפרטיות.' },
  { title: 'לשם מה אנו משתמשים במידע', body: 'אנו משתמשים במידע כדי להשיב לפניות, לבחון אם מתאים לקיים שיחה על בניין, למסור מידע שביקשתם, לשמור על אבטחת האתר ולעמוד בחובות שבדין. איננו עושים במידע שימוש לדיוור פרסומי ללא הסכמה נפרדת ומפורשת מראש.' },
  { title: 'מסירה לספקים', body: 'אנו עשויים להשתמש בספקים לצורכי אירוח, אחסון, תקשורת ואבטחה. הספקים מקבלים גישה רק ככל שנדרש לשירות ועליהם להגן על המידע. איננו מוכרים מידע אישי. ככל שמידע יישמר מחוץ לישראל, הדבר ייעשה בכפוף לתקנות הגנת הפרטיות (העברת מידע אל מאגרי מידע שמחוץ לגבולות המדינה), התשס״א-2001.' },
  { title: 'כמה זמן נשמר המידע', body: 'פנייה שלא הבשילה להתקשרות נשמרת עד 24 חודשים ממועד הפנייה האחרונה, ולאחר מכן נמחקת או עוברת אנונימיזציה. פנייה שהבשילה להתקשרות נשמרת למשך ההתקשרות ובהתאם לתקופות השמירה הקבועות בדין, לרבות חובות שמירת מסמכים לפי דיני המס. מידע יימחק מוקדם יותר לפי בקשתכם, בכפוף לחובה חוקית המחייבת את שמירתו.' },
  { title: 'אבטחת מידע', body: 'אנו מפעילים אמצעי הגנה טכניים וארגוניים סבירים, בהתאם לתקנות הגנת הפרטיות (אבטחת מידע), התשע״ז-2017, לרבות הצפנת התעבורה והגבלת ההרשאות לעובדים הזקוקים למידע לצורך תפקידם. אין אפשרות להבטיח אבטחה מוחלטת בהעברה באינטרנט.' },
  { title: 'הזכויות שלכם', body: `ניתן לפנות אלינו בבקשה לעיין במידע אישי (סעיף 13 לחוק), לתקנו (סעיף 14 לחוק), למחוק אותו, לחזור בכם מהסכמה שנתתם, ולשאול כיצד נעשה בו שימוש. נשיב לפנייה בתוך 30 ימים. ייתכן שנבקש לאמת זהות, ונשמור מידע כאשר הדין מאפשר או מחייב זאת. לפניות בנושא פרטיות: ${CONTACT.email} או ${CONTACT.phone}.` },
  { title: 'זכות תלונה', body: 'אם סברתם שזכויותיכם לפי חוק הגנת הפרטיות נפגעו, באפשרותכם להגיש תלונה לרשות להגנת הפרטיות במשרד המשפטים.' },
  { title: 'עוגיות', body: 'האתר אינו משתמש בעוגיות מעקב, בפיקסלים או בכלי אנליטיקה, ואינו טוען משאבים משרתים חיצוניים. אם בעתיד יופעלו כלי מדידה או שיווק שאינם הכרחיים, המדיניות תעודכן ותוצג בקשת הסכמה לפני הצבתם.' },
]

const enPrivacy: Section[] = [
  { title: 'Who we are', body: `This site is operated by ${ENTITY_EN}, trading as OpenDoor Group, which organises and represents apartment owners in urban-renewal processes. The company is the database owner under the Protection of Privacy Law, 5741-1981.` },
  { title: 'Information we receive', body: 'When you contact us or use an enquiry form we receive the details you choose to provide: name and telephone, and optionally email, building address, number of apartments and your message. We also record the consents you ticked and when you gave them, plus technical information needed to operate and secure the site.' },
  { title: 'Providing information is voluntary', body: 'You are not obliged to give us any information. Without the fields marked as required we cannot contact you or handle your enquiry. This notice is given under section 11 of the Protection of Privacy Law.' },
  { title: 'Use and sharing', body: 'We use information to answer enquiries, consider whether a conversation about a building is appropriate, provide requested information, maintain security and comply with law. Service providers may process information for hosting, storage, communications and security. We do not sell personal information, and we do not use it for marketing without separate, explicit prior consent. Any storage outside Israel is subject to the Protection of Privacy (Transfer of Data Abroad) Regulations, 5761-2001.' },
  { title: 'Retention', body: 'An enquiry that does not lead to an engagement is kept for up to 24 months from your last contact, then deleted or anonymised. An enquiry that leads to an engagement is kept for its duration and for the retention periods required by law, including tax record-keeping. We will delete earlier on request, subject to any legal obligation to retain.' },
  { title: 'Security', body: 'We apply reasonable technical and organisational safeguards under the Protection of Privacy (Data Security) Regulations, 5777-2017, including encrypted transport and access limited to staff who need it. No internet transmission can be guaranteed absolutely secure.' },
  { title: 'Your rights', body: `You may ask to access your personal information (section 13), correct it (section 14), delete it, withdraw a consent you gave, and ask how it is used. We respond within 30 days. We may ask you to verify your identity, and we retain information where the law permits or requires. Privacy contact: ${CONTACT.email} or ${CONTACT.phone}.` },
  { title: 'Right to complain', body: 'If you believe your rights under the Protection of Privacy Law have been infringed, you may complain to the Privacy Protection Authority at the Ministry of Justice.' },
  { title: 'Cookies', body: 'This site uses no tracking cookies, pixels or analytics tools, and loads no resources from third-party servers. If optional measurement or marketing tools are introduced, this policy will be updated and consent will be requested before they are set.' },
]

export function PrivacyContent({ english = false }: { english?: boolean }) {
  return <LegalSections sections={english ? enPrivacy : hePrivacy}
    updated={english ? `Last updated: ${LEGAL_LAST_UPDATED_EN}` : `עדכון אחרון: ${LEGAL_LAST_UPDATED}`} />
}

/* ── Terms ───────────────────────────────────────────────────────────────── */

const heTerms: Section[] = [
  { title: 'על התנאים', body: `תנאים אלה חלים על אתר OpenDoor Group, המופעל על ידי ${ENTITY_HE}. השימוש באתר מותר בכפוף לדין ולשימוש אחראי. התנאים מנוסחים בלשון זכר מטעמי נוחות ומתייחסים לכל המגדרים.` },
  { title: 'מידע כללי בלבד', body: 'האתר מוסר מידע כללי על ארגון וייצוג בעלי דירות. אין לראות בו ייעוץ משפטי, תכנוני, שמאי, מס או השקעות, והוא אינו מחליף ייעוץ מקצועי עצמאי.' },
  { title: 'אין התחייבות לפרויקט', body: 'תיאורי התהליך, הדוגמאות והתמונות הם כלליים או להמחשה. הם אינם התחייבות לאישור, מימון, בנייה או השלמה של פרויקט, ואינם מתארים פרויקט מאומת של OpenDoor אלא אם נאמר במפורש אחרת. הליכי התחדשות עירונית תלויים בהחלטות רשויות התכנון ובהסכמות בעלי הדירות, שאינן בשליטת החברה.' },
  { title: 'פניות וקניין רוחני', body: 'שליחת פנייה אינה יוצרת הסכם ייצוג או התחייבות להתקשר. כל התקשרות כפופה להסכם נפרד בכתב חתום על ידי מורשי החתימה של החברה. תוכן האתר שייך ל־OpenDoor Group או למורשים מטעמה, ואין להעתיקו או לעשות בו שימוש מסחרי ללא רשות.' },
  { title: 'הגבלת אחריות', body: 'האתר מוצע כמות שהוא. איננו מתחייבים לזמינות רציפה, לתקינות מלאה או להיעדר תקלות, ואנו רשאים לשנות או להפסיק את פעילותו. בכפוף להוראות כל דין, לא נישא באחריות לנזק עקיף, תוצאתי או מיוחד שנגרם משימוש באתר או מהסתמכות על תכניו. אין באמור כדי לגרוע מאחריות שלא ניתן להגבילה על פי דין.' },
  { title: 'דין וסמכות שיפוט', body: `על תנאים אלה חל דין מדינת ישראל בלבד. סמכות השיפוט הבלעדית בכל עניין הנובע מהם נתונה לבתי המשפט המוסמכים ב${COMPANY.jurisdiction}.` },
]

const enTerms: Section[] = [
  { title: 'About these terms', body: `These terms apply to the OpenDoor Group website, operated by ${ENTITY_EN}. Use of the site must be lawful and responsible.` },
  { title: 'General information', body: 'The site provides general information about organising and representing apartment owners. It is not legal, planning, appraisal, tax or investment advice and does not replace independent professional advice.' },
  { title: 'No project promise', body: 'Process descriptions, examples and images are general or illustrative. They do not promise approval, funding, construction or completion, and do not describe a verified OpenDoor project unless expressly stated. Urban-renewal processes depend on planning authorities and on owner agreement, neither of which is within the company’s control.' },
  { title: 'Enquiries and intellectual property', body: 'An enquiry does not create a representation agreement or obligation to proceed. Any engagement is subject to a separate written agreement signed by the company’s authorised signatories. Site content belongs to OpenDoor Group or its licensors and may not be commercially reused without permission.' },
  { title: 'Limitation of liability', body: 'The site is provided as is. We do not guarantee continuous availability or freedom from faults, and may change or discontinue it. Subject to applicable law, we are not liable for indirect, consequential or special loss arising from use of the site or reliance on its content. Nothing here limits liability that cannot be limited by law.' },
  { title: 'Law and jurisdiction', body: `These terms are governed by the laws of Israel. The competent courts of ${COMPANY.jurisdictionEn} have exclusive jurisdiction over any matter arising from them.` },
]

export function TermsContent({ english = false }: { english?: boolean }) {
  return <LegalSections sections={english ? enTerms : heTerms}
    updated={english ? `Last updated: ${LEGAL_LAST_UPDATED_EN}` : `עדכון אחרון: ${LEGAL_LAST_UPDATED}`} />
}

/* ── Accessibility ───────────────────────────────────────────────────────── */

const heAccessibility: Section[] = [
  { title: 'המחויבות שלנו', body: `${ENTITY_HE}, הפועלת תחת השם OpenDoor Group, רואה בהנגשת שירותיה חובה חוקית וערך מקצועי, ופועלת לאפשר לכל אדם, לרבות אנשים עם מוגבלות, לקבל את שירותיה באופן שוויוני, מכובד ועצמאי. הצהרה זו ניתנת לפי חוק שוויון זכויות לאנשים עם מוגבלות, התשנ״ח-1998, ותקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע״ג-2013.` },
  { title: 'מצב ההנגשה של האתר', body: `תקנה 35 לתקנות מחילה על שירותי אינטרנט את התקן הישראלי ת״י 5568 ברמת התאמה AA. נכון לתאריך הבדיקה, האתר עומד בדרישות אלה. הבדיקה נערכה ביום ${ACCESSIBILITY.auditDate} וכללה בדיקה אוטומטית בכלי axe-core על כלל עמודי האתר, בתצוגת מחשב ובתצוגת מכשיר נייד, לצד בדיקה ידנית של ניווט מקלדת מלא, סדר המעבר, נראות המיקוד, מבנה הכותרות, אזורי התוכן והטקסט החלופי לתמונות. לא נמצאו ליקויים.` },
  { title: 'התאמות שבוצעו', body: 'האתר תומך בניווט מקלדת מלא לכל רכיביו, בקישור לדילוג לתוכן הראשי בראש כל עמוד, במיקוד גלוי, בכותרות ובאזורי תוכן סמנטיים, בטקסט חלופי לתמונות, בשמות נגישים לשדות הטופס ולאישורי ההסכמה, בהודעות שגיאה המשויכות לשדה הרלוונטי, בהגדרת שפת העמוד וכיווניות מימין לשמאל, בתצוגה מותאמת למסכים קטנים ללא גלילה אופקית, ובכיבוד העדפת המשתמש להפחתת תנועה.' },
  { title: 'מגבלות ידועות', body: 'תוכן צד שלישי, מסמכים להורדה או תוכן חדש הנוסף דרך מערכת ניהול התוכן עשויים לדרוש התאמות נוספות, ואינם מכוסים בהכרח בבדיקה שלעיל. כל מסמך שאינו נגיש יימסר לפי בקשה בפורמט נגיש.' },
  { title: 'נגישות המשרדים', body: ACCESSIBILITY.premises },
  { title: 'דרכים חלופיות לקבלת השירות', body: `אם אינכם יכולים להשתמש באתר או נתקלתם בקושי, ניתן לקבל את אותו מידע ולבצע את אותה פנייה בטלפון ${CONTACT.phone} או בדוא״ל ${CONTACT.email}. נשמח למסור את המידע או למלא את הפנייה עבורכם.` },
  { title: 'רכז הנגישות ודיווח על תקלה', body: `בהתאם לתקנה 91 לתקנות מונה בחברה רכז נגישות: ${ACCESSIBILITY.coordinatorName}. טלפון: ${CONTACT.phone}. דוא״ל: ${CONTACT.email}. אם נתקלתם בבעיה, כתבו לנו מה קרה, באיזה עמוד, באיזה דפדפן או טכנולוגיה מסייעת השתמשתם, וכיצד ניתן לחזור אליכם. נטפל בפנייה ונשיב לה בתוך זמן סביר.` },
  { title: 'אם הפנייה לא נפתרה', body: `אם פנייתכם בנושא נגישות לא נפתרה לשביעות רצונכם, באפשרותכם לפנות לנציבות שוויון זכויות לאנשים עם מוגבלות במשרד המשפטים. תאריך ההצהרה: ${ACCESSIBILITY.statementDate}.` },
]

const enAccessibility: Section[] = [
  { title: 'Our commitment', body: `${ENTITY_EN}, trading as OpenDoor Group, treats accessibility as both a legal duty and a professional standard, so that everyone, including people with disabilities, can use its services equally, with dignity and independently. This statement is given under the Equal Rights for Persons with Disabilities Law, 5758-1998, and the Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations, 5773-2013.` },
  { title: 'Conformance status', body: `Regulation 35 applies Israeli Standard 5568 at level AA to internet services. As at the audit date the site meets those requirements. The audit was carried out on ${ACCESSIBILITY.auditDateEn}: automated testing with axe-core across every page, at desktop and mobile widths, alongside manual testing of full keyboard navigation, focus order and visibility, heading structure, landmarks and text alternatives. No defects were found.` },
  { title: 'Features', body: 'The site supports full keyboard navigation, a skip-to-content link on every page, visible focus, semantic headings and landmarks, text alternatives, accessible names for form fields and consent controls, errors tied to the field they concern, declared page language and direction, responsive layouts without horizontal scrolling, and the reduced-motion preference.' },
  { title: 'Known limits', body: 'Third-party content, downloadable documents and new content added through the content management system may need further remediation and are not necessarily covered by the audit above. Any document that is not accessible will be supplied in an accessible format on request.' },
  { title: 'Physical offices', body: ACCESSIBILITY.premisesEn },
  { title: 'Alternative ways to reach us', body: `If you cannot use the site, the same information and the same enquiry are available by phone on ${CONTACT.phone} or by email at ${CONTACT.email}. We are glad to provide the information or complete the enquiry for you.` },
  { title: 'Accessibility coordinator and reporting', body: `Under regulation 91 the company has appointed an accessibility coordinator: ${ACCESSIBILITY.coordinatorNameEn}. Phone: ${CONTACT.phone}. Email: ${CONTACT.email}. Please tell us what happened, the page, your browser or assistive technology, and how to reach you.` },
  { title: 'If your report is not resolved', body: `If an accessibility report is not resolved to your satisfaction, you may contact the Commission for Equal Rights of Persons with Disabilities at the Ministry of Justice. Statement date: ${ACCESSIBILITY.statementDateEn}.` },
]

export function AccessibilityContent({ english = false }: { english?: boolean }) {
  return <LegalSections sections={english ? enAccessibility : heAccessibility}
    updated={english ? `Last updated: ${LEGAL_LAST_UPDATED_EN}` : `עדכון אחרון: ${LEGAL_LAST_UPDATED}`} />
}
