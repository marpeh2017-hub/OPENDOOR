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
      he: 'בדרך כלל אפס שקלים. כל תהליך ההתחדשות העירונית ממומן על ידי היזם - כולל שכר הטרחה של עורך הדין, המפקח והשמאי מטעמכם, שכר הדירה לתקופת הבנייה והובלת הציוד הלוך וחזור.',
      en: 'Usually nothing. The whole urban-renewal process is funded by the developer - including the fees of the lawyer, supervisor and appraiser acting for you, the rent for the construction period, and moving costs both ways.',
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
      he: 'הדירה החדשה תהיה גדולה יותר, ולכן התשלומים עשויים לעלות. בחלק מהפרויקטים אנחנו דואגים לקרן תחזוקה מהיזם שמסבסדת את ההפרש בשנים הראשונות.',
      en: 'The new apartment will be larger, so these payments may rise. In some projects we arrange a maintenance fund from the developer that subsidises the difference in the first years.',
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
      he: 'תוספת מטראז’, מרפסת שמש, ממ"ד, חניה תת-קרקעית ומחסן - בבניין חדיש שמעלה משמעותית את ערך הנכס, בכפוף לכדאיות הכלכלית ולמדיניות הרשות. התמורה המדויקת נקבעת לכל פרויקט בנפרד.',
      en: 'Additional floor area, a balcony, a protected room, underground parking and storage - in a modern building that raises the value of the property considerably, subject to financial viability and to local authority policy. The exact consideration is settled per project.',
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
      he: 'לא מתחילים בנייה בלי ערבויות בנקאיות לפי חוק המכר - ערבות בשווי הדירה החדשה, ערבות שכירות, ערבות בדק וערבות רישום. אם היזם נקלע לקשיים, הבנק נכנס לנעליו ומבטיח את השלמת הפרויקט.',
      en: 'Construction does not begin without bank guarantees under the Sale Law - a guarantee for the value of the new apartment, a rent guarantee, a defects guarantee and a registration guarantee. If the developer runs into difficulty, the bank steps into its shoes and secures completion.',
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
    group: { he: 'מי אתם ומי אתם מייצגים?', en: 'Who you are and who you represent' },
    question: { he: 'מה בדיוק התפקיד שלכם?', en: 'What exactly is your role?' },
    answer: {
      he: 'אנחנו מייצגים אתכם בלבד. מארגנים את המתחם, מביאים בעלי מקצוע מיטביים מטעמכם, מנהלים את המכרז מול היזמים - ומלווים אתכם עד לקבלת המפתח.',
      en: 'We represent you and no one else. We organise the complex, bring in well-suited professionals on your behalf, run the tender with the developers - and stay with you until you receive the key.',
    },
  },
]
