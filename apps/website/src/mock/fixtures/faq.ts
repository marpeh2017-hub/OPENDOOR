import type { CmsFaqEntry } from '@/lib/cms-source'

/**
 * FAQ seed content.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * /faq reads published questions from the CMS. Until an editor publishes
 * there, the page rendered an empty state, so this file supplies the approved
 * questions as a code fallback — the same "CMS first, code behind it" shape
 * `getPageBySlug` uses for the core pages.
 *
 * It differs from `getPageBySlug` in one way, deliberately: that function
 * fails closed in production, because a CMS page that was published and then
 * withdrawn must not be resurrected by a gateway outage. Nothing has ever been
 * published to the FAQ, so there is nothing to resurrect and the fallback
 * applies in every environment. Once an editor publishes real questions, the
 * CMS wins everywhere and this file stops being read.
 *
 * `group` is not part of `CmsFaqEntry`; it exists only here, so the seed can
 * carry the section headings the copy was written with. Items that arrive
 * from the CMS have no group and render as a flat list, exactly as before.
 */
export interface FaqSeedEntry extends CmsFaqEntry {
  group: { he: string; en: string }
}

export const FAQ_SEED: readonly FaqSeedEntry[] = [
  {
    id: 'faq-cost',
    order: 0,
    group: { he: 'עלויות ופיננסים', en: 'Cost and finance' },
    question: {
      he: 'כמה זה עולה לנו, בעלי הדירות?',
      en: 'What does it cost us, the apartment owners?',
    },
    answer: {
      he: 'בפרויקטים של התחדשות עירונית מקובל שהיזם נושא בעלויות הפרויקט, ובדרך כלל גם בשכר אנשי המקצוע מטעם בעלי הדירות (עורך דין, שמאי ומפקח), בשכר הדירה בתקופת הבנייה ובהובלה. מה בדיוק משולם, ועל ידי מי, נקבע בהסכם של כל פרויקט. לחברה עצמה בעלי הדירות אינם משלמים תשלום ישיר: התשלום לחברה מגיע מהיזם בלבד, וזה כתוב בהסכם.',
      en: 'In urban-renewal projects the developer customarily bears the project costs, and usually also the fees of the professionals acting for the owners (lawyer, appraiser and supervisor), rent during construction and moving costs. Exactly what is paid, and by whom, is set in each project agreement. Owners pay the company itself nothing directly: the company is paid by the developer only, and that is written into the agreement.',
    },
  },
  {
    id: 'faq-running-costs',
    order: 1,
    group: { he: 'עלויות ופיננסים', en: 'Cost and finance' },
    question: {
      he: 'מה קורה עם ארנונה וועד בית בבניין החדש?',
      en: 'What happens with municipal tax and building fees in the new building?',
    },
    answer: {
      he: 'הדירה החדשה גדולה יותר, ולכן הארנונה ודמי ועד הבית עשויים לעלות. בחלק מהפרויקטים נקבע בהסכם עם היזם מנגנון שמסבסד את ההפרש בשנים הראשונות, למשל קרן תחזוקה. זה אחד הנושאים שכדאי לבדוק בהצעה.',
      en: 'The new apartment is larger, so municipal tax and building fees may rise. Some projects set a mechanism in the agreement with the developer that subsidises the difference for the first years, such as a maintenance fund. It is one of the things worth checking in an offer.',
    },
  },
  {
    id: 'faq-consideration',
    order: 2,
    group: { he: 'התמורה והזכויות שלכם', en: 'Your consideration and rights' },
    question: {
      he: 'מה אנחנו מקבלים בתמורה לדירה הקיימת?',
      en: 'What do we receive in exchange for our existing apartment?',
    },
    answer: {
      he: 'בדרך כלל דירה חדשה בבניין חדש, ולעיתים קרובות עם תוספת שטח, מרפסת, ממ״ד, חניה ומחסן. מה בדיוק תקבלו תלוי בכדאיות הכלכלית של הפרויקט ובמדיניות הרשות, ונקבע בהסכם. בדיקת התמורה היא חלק מבדיקת ההצעה.',
      en: 'Usually a new apartment in a new building, often with additional area, a balcony, a protected room, parking and storage. What exactly you receive depends on the project financial viability and local authority policy, and is set in the agreement. Checking the consideration is part of checking the offer.',
    },
  },
  {
    id: 'faq-where-live',
    order: 3,
    group: { he: 'התמורה והזכויות שלכם', en: 'Your consideration and rights' },
    question: {
      he: 'איפה גרים בזמן שהבניין נהרס?',
      en: 'Where do we live while the building is demolished?',
    },
    answer: {
      he: 'ברוב הפרויקטים היזם משלם שכר דירה חודשי בגובה מחיר השוק של דירתכם הנוכחית, לאורך כל תקופת הבנייה ועד קבלת המפתח לדירה החדשה.',
      en: 'In most projects the developer pays monthly rent at the market rate for your current apartment, throughout construction and until you receive the key to the new one.',
    },
  },
  {
    id: 'faq-guarantees',
    order: 4,
    group: { he: 'ביטחון וערבויות', en: 'Security and guarantees' },
    question: {
      he: 'מה קורה אם היזם נקלע לקשיים?',
      en: 'What happens if the developer runs into difficulty?',
    },
    answer: {
      he: 'ההסכם עם היזם צריך לכלול ערבויות בנקאיות לפני תחילת הבנייה: ערבות לפי חוק המכר בשווי הדירה החדשה, ערבות לתשלום שכר הדירה, ערבות בדק וערבות רישום. הערבויות נועדו להבטיח את השלמת הפרויקט, או את החזר שווי הדירה במקרה של קשיים, ולכן בודקים אותן בהסכם לפני החתימה.',
      en: 'The agreement with the developer should include bank guarantees before construction begins: a Sale Law guarantee for the value of the new apartment, a rent guarantee, a defects guarantee and a registration guarantee. They are meant to secure completion of the project, or repayment of the value of the apartment if difficulties arise, which is why they are checked in the agreement before signing.',
    },
  },
  {
    id: 'faq-refusal',
    order: 5,
    group: { he: 'ביטחון וערבויות', en: 'Security and guarantees' },
    question: {
      he: 'מה עושים אם שכן מסרב לחתום?',
      en: 'What if a neighbour refuses to sign?',
    },
    answer: {
      he: 'ברוב המקרים סירוב נובע מחשש או מחוסר הבנה - ניגשים לזה בסבלנות ובדיאלוג. אם מדובר בסרבנות בלתי סבירה, החוק מאפשר רוב מופחת ומעניק מענה משפטי.',
      en: 'Most refusals come from concern or from not having the full picture - we approach it patiently and through conversation. Where a refusal is unreasonable, the law provides for a reduced majority and a legal route.',
    },
  },
  {
    id: 'faq-role',
    order: 6,
    group: { he: 'מי אתם ומה התפקיד שלכם?', en: 'Who you are and what you do' },
    question: { he: 'מה בדיוק התפקיד שלכם?', en: 'What exactly is your role?' },
    answer: {
      he: 'אנחנו מארגנים ומלווים את בעלי הדירות: מארגנים את המתחם, מביאים בעלי מקצוע מטעמכם, מנהלים את המכרז מול היזמים ומלווים אתכם עד לקבלת המפתח. התשלום לחברה מגיע מהיזם בלבד, וזה כתוב בהסכם שתקבלו לידיים.',
      en: 'We organise and support the apartment owners: we organise the complex, bring in professionals on your behalf, run the tender with the developers and stay with you until you receive the key. The company is paid by the developer only, and that is written into the agreement you will hold.',
    },
  },
]
