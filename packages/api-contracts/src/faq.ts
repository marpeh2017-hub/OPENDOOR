/**
 * The FAQ's topics, and the questions the site opens with.
 *
 * ── WHY THIS LIVES IN THE CONTRACTS ────────────────────────────────────────
 *
 * Three places read it and have to agree. The website's /faq groups its
 * questions under these topics, and shows FAQ_SEED until the CMS holds a
 * published FAQ. The CRM's FAQ editor offers the topics as a choice, and
 * starts a new FAQ from FAQ_SEED rather than from an empty list, so its first
 * draft is exactly what the site shows. The website's chat assistant answers
 * from FAQ_SEED. Kept in one place, a question published from the CRM keeps
 * its topic card on the site, and none of the three can drift from the others.
 *
 * ── TOPIC IDS ARE ADDRESSES ────────────────────────────────────────────────
 *
 * A topic's id is also its anchor on /faq (/faq#costs), so it is part of the
 * site's addresses: a label can be reworded freely, an id cannot. `icon` names
 * one of the website's line icons; the website's type-check fails if it does
 * not.
 */

export const FAQ_TOPICS = [
  { id: 'costs', icon: 'receipt', label: { he: 'עלויות ופיננסים', en: 'Cost and finance' } },
  { id: 'rights', icon: 'home', label: { he: 'התמורה והזכויות שלכם', en: 'Your consideration and rights' } },
  { id: 'security', icon: 'shield', label: { he: 'ביטחון וערבויות', en: 'Security and guarantees' } },
  { id: 'about', icon: 'users', label: { he: 'מי אתם ומה התפקיד שלכם', en: 'Who you are and what you do' } },
] as const

export type FaqTopic = (typeof FAQ_TOPICS)[number]
export type FaqTopicId = FaqTopic['id']

export function isFaqTopicId(value: unknown): value is FaqTopicId {
  return FAQ_TOPICS.some((topic) => topic.id === value)
}

/**
 * One question. `topic` is optional because a question saved in the CMS
 * before topics existed has none; the site shows the topic cards only when
 * every question has one.
 */
export interface FaqEntry {
  id: string
  order: number
  topic?: FaqTopicId
  question: { he: string; en?: string }
  answer: { he: string; en?: string }
}

/** The approved questions, each under its topic, in the site's order. */
export const FAQ_SEED: readonly (FaqEntry & { topic: FaqTopicId })[] = [
  {
    id: 'faq-cost',
    order: 0,
    topic: 'costs',
    question: {
      he: 'כמה זה עולה לנו, בעלי הדירות?',
      en: 'What does it cost us, the apartment owners?',
    },
    answer: {
      he: 'בפרויקטים של התחדשות עירונית מקובל שהיזם נושא בעלויות הפרויקט, ובדרך כלל גם בשכר אנשי המקצוע מטעם בעלי הדירות (עורך דין, שמאי ומפקח), בשכר הדירה בתקופת הבנייה ובהובלה. מה בדיוק משולם, ועל ידי מי, נקבע בהסכם של כל פרויקט. כשאנחנו מארגנים את בעלי הדירות מול יזם, בעלי הדירות אינם משלמים לחברה תשלום ישיר: התשלום לחברה מגיע מהיזם בלבד, וזה כתוב בהסכם. כשאנחנו היזם, זה נאמר מראש וכתוב בהסכם.',
      en: 'In urban-renewal projects the developer customarily bears the project costs, and usually also the fees of the professionals acting for the owners (lawyer, appraiser and supervisor), rent during construction and moving costs. Exactly what is paid, and by whom, is set in each project agreement. When we organise the owners in dealing with a developer, owners pay the company nothing directly: the company is paid by the developer only, and that is written into the agreement. When we are the developer, that is said up front and written into the agreement.',
    },
  },
  {
    id: 'faq-running-costs',
    order: 1,
    topic: 'costs',
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
    topic: 'rights',
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
    topic: 'rights',
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
    topic: 'security',
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
    topic: 'security',
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
    topic: 'about',
    question: { he: 'מה בדיוק התפקיד שלכם?', en: 'What exactly is your role?' },
    answer: {
      he: 'OpenDoor Group היא חברת יזמות והתחדשות עירונית. בחלק מהפרויקטים אנחנו היזם, ובאחרים אנחנו מארגנים ומלווים את בעלי הדירות: מארגנים את המתחם, מביאים בעלי מקצוע מטעמכם, מנהלים את המכרז מול היזמים ומלווים אתכם עד לקבלת המפתח. התפקיד שלנו בכל פרויקט נאמר מראש וכתוב בהסכם שתקבלו לידיים.',
      en: 'OpenDoor Group is an urban renewal and development company. In some projects we are the developer; in others we organise and support the owners: we organise the complex, bring in professionals on your behalf, run the tender with the developers and stay with you until you receive the key. Our role in each project is stated up front and written into the agreement you will hold.',
    },
  },
  {
    id: 'faq-recommend',
    order: 7,
    topic: 'about',
    question: {
      he: 'אתם יכולים להמליץ על עורך דין, שמאי או אדריכל?',
      en: 'Can you recommend a lawyer, an appraiser or an architect?',
    },
    answer: {
      he: 'כן. כאנשים מהתחום אנחנו מכירים שמאים, עורכי דין ואדריכלים, ויכולים להמליץ עליהם. ההמלצה היא רק המלצה: אתם בוחרים, ואנשי המקצוע פועלים מטעמכם.',
      en: 'Yes. As people in the field we know appraisers, lawyers and architects, and can recommend them. A recommendation is only that: you choose, and the professionals act for you.',
    },
  },
  {
    id: 'faq-stalled',
    order: 8,
    topic: 'about',
    question: {
      he: 'הפרויקט שלנו נתקע. אתם יכולים לעזור?',
      en: 'Our project has stalled. Can you help?',
    },
    answer: {
      he: 'הרבה פעמים כן. אנחנו בודקים מה עוצר את הפרויקט: יזם שעזב, בעלי דירות שמתנגדים, הצעה שכבר לא כלכלית או תכנון שנתקע ברשויות, ובונים תוכנית להחזיר אותו לתנועה. לא כל פרויקט אפשר לחלץ, ואם זה המצב אצלכם נגיד לכם את זה ביושר ומוקדם.',
      en: 'Often, yes. We look at what is holding the project up: a developer who left, owners who object, an offer that no longer adds up, or planning stuck with the authorities, and build a plan to get it moving again. Not every project can be rescued; if yours cannot, we will tell you honestly and early.',
    },
  },
]
