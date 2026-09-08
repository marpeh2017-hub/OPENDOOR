import type { ReactNode } from 'react'
import { CONTACT } from '@/lib/site-config'

type Section = { title: string; body: ReactNode }

export function LegalSections({ sections }: { sections: Section[] }) {
  return <div className="max-w-3xl space-y-8 text-[15px] leading-8 text-gray-700">
    {sections.map(s => <section key={s.title}><h2 className="text-xl font-semibold text-gray-900">{s.title}</h2><p className="mt-2 whitespace-pre-line">{s.body}</p></section>)}
    <p className="border-t border-gray-200 pt-5 text-sm">ליצירת קשר: <a className="underline" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> · <a className="underline" href={CONTACT.phoneHref} dir="ltr">{CONTACT.phone}</a></p>
  </div>
}

const hePrivacy: Section[] = [
  { title: 'מי אנחנו', body: 'OpenDoor Group מארגנת ומייצגת בעלי דירות בתהליכי התחדשות עירונית. מדיניות זו מסבירה כיצד אנו מטפלים במידע שמתקבל דרך האתר.' },
  { title: 'איזה מידע אנו מקבלים', body: 'כאשר אתם פונים אלינו או משתמשים בטופס פנייה, אנו עשויים לקבל את הפרטים שבחרתם למסור, כגון שם, טלפון, דוא״ל, כתובת הבניין ותוכן הפנייה. האתר עשוי לקבל גם מידע טכני הנדרש להפעלה, אבטחה ומדידת השירות.' },
  { title: 'לשם מה אנו משתמשים במידע', body: 'אנו משתמשים במידע כדי להשיב לפניות, לבחון אם מתאים לקיים שיחה על בניין, למסור מידע שביקשתם, לשמור על אבטחת האתר ולעמוד בחובות שבדין.' },
  { title: 'מסירה לספקים', body: 'אנו עשויים להשתמש בספקים לצורכי אירוח, אחסון, תקשורת ואבטחה. הספקים מקבלים גישה רק ככל שנדרש לשירות ועליהם להגן על המידע. איננו מוכרים מידע אישי.' },
  { title: 'שמירה ואבטחה', body: 'נשמור מידע כל עוד הוא נדרש למטרה שלשמה נאסף, לרישומים עסקיים ולדרישות הדין. אנו מפעילים אמצעי הגנה טכניים וארגוניים סבירים; אין אפשרות להבטיח אבטחה מוחלטת בהעברה באינטרנט.' },
  { title: 'הזכויות שלכם', body: 'ניתן לפנות אלינו בבקשה לעיין במידע אישי, לתקן אותו או למחוק אותו, וכן לשאול כיצד נעשה בו שימוש. ייתכן שנבקש לאמת זהות, ונשמור מידע כאשר הדין מאפשר או מחייב זאת.' },
  { title: 'עוגיות ועדכונים', body: 'האתר עשוי להשתמש בעוגיות הכרחיות לצורכי הפעלה ואבטחה. אם יופעלו כלי מדידה או שיווק שאינם הכרחיים, המדיניות תעודכן בהתאם. עדכון אחרון: 8 בספטמבר 2026.' },
]
const enPrivacy: Section[] = [
  { title: 'Who we are', body: 'OpenDoor Group organises and represents apartment owners in urban-renewal processes. This policy explains how we handle information received through this website.' },
  { title: 'Information we receive', body: 'When you contact us or use an enquiry form, we may receive details you choose to provide, such as name, telephone, email, building address and message. The site may also receive technical information needed to operate and secure the service.' },
  { title: 'Use and sharing', body: 'We use information to answer enquiries, provide requested information, maintain security and comply with law. Service providers may process information for hosting, storage, communications and security. We do not sell personal information.' },
  { title: 'Retention, security and rights', body: 'We retain information as needed for its purpose, legitimate records and legal requirements, using reasonable safeguards. You may contact us to request access, correction or deletion, subject to legal limits.' },
  { title: 'Cookies and updates', body: 'The site may use necessary cookies for operation and security. If optional analytics or marketing tools are enabled, this policy will be updated. Last updated: 8 September 2026.' },
]
export function PrivacyContent({ english = false }: { english?: boolean }) { return <LegalSections sections={english ? enPrivacy : hePrivacy} /> }

const heTerms: Section[] = [
  { title: 'על התנאים', body: 'תנאים אלה חלים על אתר OpenDoor Group. השימוש באתר מותר בכפוף לדין ולשימוש אחראי.' },
  { title: 'מידע כללי בלבד', body: 'האתר מוסר מידע כללי על ארגון וייצוג בעלי דירות. אין לראות בו ייעוץ משפטי, תכנוני, שמאי, מס או השקעות, והוא אינו מחליף ייעוץ מקצועי עצמאי.' },
  { title: 'אין התחייבות לפרויקט', body: 'תיאורי התהליך, הדוגמאות והתמונות הם כלליים או להמחשה. הם אינם התחייבות לאישור, מימון, בנייה או השלמה של פרויקט, ואינם מתארים פרויקט מאומת של OpenDoor אלא אם נאמר במפורש אחרת.' },
  { title: 'פניות וקניין רוחני', body: 'שליחת פנייה אינה יוצרת הסכם ייצוג או התחייבות להתקשר. כל התקשרות כפופה להסכם נפרד בכתב. תוכן האתר שייך ל־OpenDoor Group או למורשים מטעמה, ואין להעתיקו או לעשות בו שימוש מסחרי ללא רשות.' },
  { title: 'זמינות ודין', body: 'אנו פועלים לשמור על אתר זמין ומדויק, אך מידע עשוי להשתנות והאתר עשוי להיות מופרע. על תנאים אלה חל דין מדינת ישראל. עדכון אחרון: 8 בספטמבר 2026.' },
]
const enTerms: Section[] = [
  { title: 'About these terms', body: 'These terms apply to the OpenDoor Group website. Use of the site must be lawful and responsible.' },
  { title: 'General information', body: 'The site provides general information about organising and representing apartment owners. It is not legal, planning, appraisal, tax or investment advice and does not replace independent professional advice.' },
  { title: 'No project promise', body: 'Process descriptions, examples and images are general or illustrative. They do not promise approval, funding, construction or completion, and do not describe a verified OpenDoor project unless expressly stated.' },
  { title: 'Enquiries and intellectual property', body: 'An enquiry does not create a representation agreement or obligation to proceed. Any engagement is subject to a separate written agreement. Site content belongs to OpenDoor Group or its licensors and may not be commercially reused without permission.' },
  { title: 'Availability and law', body: 'Information may change and the site may be interrupted. These terms are governed by the laws of Israel. Last updated: 8 September 2026.' },
]
export function TermsContent({ english = false }: { english?: boolean }) { return <LegalSections sections={english ? enTerms : heTerms} /> }

const heAccessibility: Section[] = [
  { title: 'המחויבות שלנו', body: 'OpenDoor Group פועלת להנגיש את האתר לאנשים עם מוגבלות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, לתקנות נגישות השירות ולתקן הישראלי ת״י 5568 ברמת AA, ככל שהם חלים על השירות.' },
  { title: 'התאמות שבוצעו', body: 'האתר תומך בניווט מקלדת, בדילוג לתוכן, במיקוד גלוי, בכותרות ובאזורי תוכן סמנטיים, בטקסט חלופי לתמונות, בתצוגה מותאמת ובהעדפת הפחתת תנועה.' },
  { title: 'מגבלות ודיווח', body: 'תוכן צד שלישי, מסמכים ישנים או תוכן חדש ממערכת הניהול עשויים לדרוש התאמות נוספות. אם נתקלתם בבעיה, כתבו לנו מה קרה, באיזה עמוד, באיזה דפדפן או טכנולוגיה מסייעת השתמשתם, וכיצד ניתן לחזור אליכם.' },
  { title: 'פרטי קשר', body: `רכז/ת נגישות: ${CONTACT.email}. טלפון: ${CONTACT.phone}. תאריך הצהרה: 8 בספטמבר 2026.` },
]
const enAccessibility: Section[] = [
  { title: 'Our commitment', body: 'OpenDoor Group works to make this website usable by people with disabilities, in accordance with the Equal Rights for Persons with Disabilities Law, the Service Accessibility Regulations and Israeli Standard 5568 at AA level, as applicable.' },
  { title: 'Features and limits', body: 'The site supports keyboard navigation, skip to content, visible focus, semantic headings and landmarks, text alternatives, responsive layouts and reduced motion. Third-party content, older documents or newly added CMS content may require further remediation.' },
  { title: 'Report an issue', body: `Please tell us what happened, the page, your browser or assistive technology, and how to reach you. Accessibility contact: ${CONTACT.email}. Phone: ${CONTACT.phone}. Statement date: 8 September 2026.` },
]
export function AccessibilityContent({ english = false }: { english?: boolean }) { return <LegalSections sections={english ? enAccessibility : heAccessibility} /> }
