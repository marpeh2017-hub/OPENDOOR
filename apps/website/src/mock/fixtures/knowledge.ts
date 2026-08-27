import type {
  ExternalResource, FaqItem, KnowledgeArticle, KnowledgeCategory,
} from '@urban-renewal/api-contracts'

/**
 * MOCK DATA — replaced by the API in Phase 2.
 *
 * ── DELIBERATELY SMALL ─────────────────────────────────────────────────────
 *
 * Six articles across four categories, not sixty. The brief forbids generating
 * SEO filler, and a large body of machine-written articles would be exactly
 * that: it would need deleting before launch, and in the meantime it would make
 * the listing page look finished while containing nothing worth reading.
 *
 * Six is enough to exercise every state the UI has: listing, category filter,
 * detail, related articles, related projects, search, and locale switching.
 *
 * ── CONTENT SUBSTANCE ──────────────────────────────────────────────────────
 *
 * The bodies below explain PROCESS and ROLES — what an organising company does,
 * what a representation is, what stages exist. They contain no legal advice, no
 * financial figures, no guarantees, and no claims about OpenDoor's results,
 * because none of those have been supplied and §3 forbids inventing them.
 */

export const MOCK_CATEGORIES: readonly KnowledgeCategory[] = [
  {
    id: 'c-pinuy-binuy',
    slug: 'pinuy-binuy',
    name: 'פינוי־בינוי',
    description: 'תהליך שבו מבנים קיימים נהרסים ונבנים מחדש בהיקף גדול יותר.',
    articleCount: 2,
  },
  {
    id: 'c-tama-38',
    slug: 'tama-38',
    name: 'תמ״א 38',
    description: 'חיזוק או הריסה ובנייה מחדש של מבנים קיימים.',
    articleCount: 1,
  },
  {
    id: 'c-owner-rights',
    slug: 'owner-rights',
    name: 'זכויות בעלי דירות',
    description: 'מה חשוב לבעלי דירות לדעת לאורך התהליך.',
    articleCount: 2,
  },
  {
    id: 'c-representation',
    slug: 'representation',
    name: 'נציגות דיירים',
    description: 'תפקיד הנציגות והחברה המארגנת.',
    articleCount: 1,
  },
] as const

const byId = Object.fromEntries(MOCK_CATEGORIES.map((c) => [c.id, c]))

export const MOCK_ARTICLES: readonly KnowledgeArticle[] = [
  {
    id: 'a-what-is-pinuy-binuy',
    slug: 'what-is-pinuy-binuy',
    title: 'מהו פינוי־בינוי?',
    summary: 'הסבר קצר על מהות התהליך, מי המשתתפים בו ומה סדר הפעולות הכללי.',
    body:
      'פינוי־בינוי הוא תהליך שבו מתחם מגורים קיים נהרס ונבנה מחדש, בדרך כלל בהיקף בנייה גדול יותר. ' +
      'התהליך מערב בעלי דירות, נציגות דיירים, חברה מארגנת, אנשי מקצוע כמו עורכי דין ושמאים, יזם, ורשויות התכנון.\n\n' +
      'לכל אחד מהגורמים תפקיד שונה. בעלי הדירות הם בעלי הנכס ומקבלי ההחלטות. הנציגות מייצגת אותם מול שאר הגורמים. ' +
      'החברה המארגנת מנהלת את התהליך ומרכזת את העבודה מול אנשי המקצוע. היזם הוא מי שמבצע את הפרויקט בפועל.\n\n' +
      'התהליך אורך זמן ואינו מובטח: פרויקטים עשויים להתקדם בקצב שונה, ולעיתים אינם יוצאים לפועל.',
    category: byId['c-pinuy-binuy']!,
    tags: ['פינוי־בינוי', 'תהליך'],
    attribution: 'אופן־דור גרופ',
    publishedAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    relatedArticleSlugs: ['what-does-an-organizing-company-do', 'what-is-a-residents-representation'],
    locale: 'he',
  },
  {
    id: 'a-organizing-company',
    slug: 'what-does-an-organizing-company-do',
    title: 'מה עושה חברה מארגנת?',
    summary: 'ההבדל בין חברה מארגנת, יזם ואנשי מקצוע — ומדוע ההפרדה חשובה.',
    body:
      'חברה מארגנת מייצגת ומארגנת את בעלי הדירות. היא אינה היזם ואינה מבצעת את הבנייה.\n\n' +
      'תפקידה כולל ארגון בעלי הדירות, ליווי הקמת נציגות, ריכוז העבודה מול אנשי המקצוע, ' +
      'בחינת חלופות ובחירת יזם, וניהול התהליך לאורך זמן.\n\n' +
      'ההפרדה בין הגורמים אינה עניין טכני. ליזם ולבעלי הדירות יש אינטרסים שונים, וזה טבעי. ' +
      'חברה מארגנת שמייצגת את בעלי הדירות מאפשרת להם להגיע לשולחן המשא ומתן מאורגנים ועם מידע מסודר.\n\n' +
      'השירות לבעלי הדירות אינו כרוך בעלות ישירה מצדם.',
    category: byId['c-representation']!,
    tags: ['חברה מארגנת', 'נציגות'],
    attribution: 'אופן־דור גרופ',
    publishedAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    relatedArticleSlugs: ['what-is-a-residents-representation', 'what-is-pinuy-binuy'],
    locale: 'he',
  },
  {
    id: 'a-representation',
    slug: 'what-is-a-residents-representation',
    title: 'מהי נציגות דיירים ומה תפקידה?',
    summary: 'כיצד נבחרת נציגות, מה היא מוסמכת לעשות ומה נשאר בידי בעלי הדירות.',
    body:
      'נציגות דיירים היא קבוצה מצומצמת של בעלי דירות שנבחרת לייצג את כלל הבעלים מול הגורמים השונים בתהליך.\n\n' +
      'הנציגות מרכזת את התקשורת, משתתפת בפגישות, ומביאה סוגיות להכרעה בפני כלל בעלי הדירות. ' +
      'החלטות מהותיות נשארות בידי בעלי הדירות עצמם.\n\n' +
      'עבודה מסודרת של נציגות דורשת מידע זמין, סדר יום ברור ותיעוד. זה חלק ממה שחברה מארגנת אמורה לספק.',
    category: byId['c-representation']!,
    tags: ['נציגות'],
    attribution: 'אופן־דור גרופ',
    publishedAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    relatedArticleSlugs: ['what-does-an-organizing-company-do'],
    locale: 'he',
  },
  {
    id: 'a-tama-38',
    slug: 'tama-38-explained',
    title: 'תמ״א 38 — חיזוק מול הריסה ובנייה',
    summary: 'שני המסלולים המרכזיים וההבדל המעשי ביניהם עבור בעלי דירות.',
    body:
      'תמ״א 38 כוללת שני מסלולים עיקריים: חיזוק המבנה הקיים, או הריסתו ובנייתו מחדש.\n\n' +
      'במסלול החיזוק הדיירים בדרך כלל נשארים בבניין במהלך העבודות. במסלול ההריסה והבנייה המבנה נהרס ונבנה מחדש, ' +
      'והדיירים עוברים לתקופת הביניים.\n\n' +
      'לכל מסלול השלכות שונות על לוחות זמנים, על התמורות ועל חיי הדיירים בתקופת הביצוע.',
    category: byId['c-tama-38']!,
    tags: ['תמ״א 38'],
    attribution: 'אופן־דור גרופ',
    publishedAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    locale: 'he',
  },
  {
    id: 'a-before-you-sign',
    slug: 'before-you-sign',
    title: 'לפני שחותמים — מה חשוב לבדוק',
    summary: 'שאלות שכדאי לבעלי דירות לשאול לפני חתימה על מסמך כלשהו בתהליך.',
    body:
      'חתימה על מסמך בתהליך התחדשות עירונית היא פעולה משפטית. לפני חתימה כדאי לוודא שהמסמך הוסבר, ' +
      'שיש ייצוג משפטי מטעם בעלי הדירות, ושברור מה המסמך מחייב ומה לא.\n\n' +
      'חשוב להבין מי מייצג את מי: עורך דין מטעם היזם אינו מייצג את בעלי הדירות.\n\n' +
      'המידע כאן הוא כללי ואינו מהווה ייעוץ משפטי.',
    category: byId['c-owner-rights']!,
    tags: ['זכויות', 'הסכמים'],
    attribution: 'אופן־דור גרופ',
    publishedAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    relatedArticleSlugs: ['what-does-an-organizing-company-do'],
    locale: 'he',
  },
  {
    id: 'a-timeline-expectations',
    slug: 'how-long-does-it-take',
    title: 'כמה זמן לוקח תהליך התחדשות עירונית?',
    summary: 'למה קשה לתת תשובה אחת, ומה משפיע על משך התהליך.',
    body:
      'משך התהליך משתנה מאוד בין פרויקטים, ותלוי בגורמים כמו מספר בעלי הדירות, מורכבות הבעלויות, ' +
      'הליכי התכנון ברשות המקומית, ומצב השוק.\n\n' +
      'אין לוח זמנים אחיד, ואף גורם אינו יכול להתחייב למועד סיום. מה שכן אפשר הוא לנהל את התהליך בשקיפות: ' +
      'לדעת באיזה שלב הפרויקט נמצא, מה הפעולה הבאה, ומי אחראי עליה.',
    category: byId['c-owner-rights']!,
    tags: ['לוחות זמנים'],
    attribution: 'אופן־דור גרופ',
    publishedAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    locale: 'he',
  },
] as const

export const MOCK_FAQ: readonly FaqItem[] = [
  {
    id: 'q-cost',
    question: 'כמה עולה השירות לבעלי הדירות?',
    answer: 'השירות לבעלי הדירות אינו כרוך בעלות ישירה מצד הדיירים.',
    category: 'כללי',
    order: 1,
  },
  {
    id: 'q-are-you-developer',
    question: 'האם אופן־דור היא יזם?',
    answer:
      'לא. אופן־דור גרופ מייצגת ומארגנת בעלי דירות. היא אינה יזם ואינה מבצעת את הבנייה. ' +
      'בחירת היזם נעשית על ידי בעלי הדירות, בליווי החברה.',
    category: 'כללי',
    order: 2,
  },
  {
    id: 'q-existing-representation',
    question: 'כבר יש לנו נציגות. זה רלוונטי לנו?',
    answer:
      'כן. נציגות קיימת יכולה להיעזר בליווי מקצועי לניהול התהליך, ריכוז מידע ועבודה מול אנשי המקצוע.',
    category: 'נציגות',
    order: 3,
  },
  {
    id: 'q-developer-approached',
    question: 'יזם כבר פנה אלינו. מה עכשיו?',
    answer:
      'פנייה של יזם היא נקודת התחלה, לא החלטה. מומלץ לבעלי הדירות להתארגן ולבחון חלופות לפני התקדמות.',
    category: 'תהליך',
    order: 4,
  },
  {
    id: 'q-timeline',
    question: 'כמה זמן זה לוקח?',
    answer:
      'משך התהליך משתנה בין פרויקטים ותלוי בגורמים רבים. אין לוח זמנים אחיד, ואיננו מתחייבים למועד סיום.',
    category: 'תהליך',
    order: 5,
  },
] as const

/**
 * External authoritative sources.
 *
 * ⚠ NOT PARTNERS. These are text references to public bodies, rendered without
 * logos and without any wording implying endorsement, cooperation or
 * affiliation — §16 is explicit, and the site has already had to remove one
 * band of real company names presented as partners.
 *
 * URLs are marked unverified where they have not been checked; the UI must not
 * present an unverified link as authoritative.
 */
export const MOCK_EXTERNAL_RESOURCES: readonly ExternalResource[] = [
  {
    id: 'r-hitchadshut',
    label: 'הרשות הממשלתית להתחדשות עירונית',
    url: 'https://www.gov.il/he/departments/urban_renewal_authority',
    description: 'מידע רשמי על מסלולי התחדשות עירונית וזכויות בעלי דירות.',
  },
  {
    id: 'r-gov-planning',
    label: 'מינהל התכנון',
    url: 'https://www.gov.il/he/departments/iplan',
    description: 'מידע על הליכי תכנון ורישוי.',
  },
  {
    id: 'r-consumer',
    label: 'המועצה הישראלית לצרכנות',
    url: 'https://www.consumers.org.il',
    description: 'מידע צרכני כללי.',
  },
] as const
