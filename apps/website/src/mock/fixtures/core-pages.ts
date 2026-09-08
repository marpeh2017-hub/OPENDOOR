import type { CmsPage, PageBlock } from '@urban-renewal/api-contracts'

/**
 * MOCK CONTENT — replaced by the CMS in Phase 2.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THE FOUR CORE INFORMATIONAL PAGES
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Every sentence a visitor reads on /about, /why-organizer, /how-we-work and
 * /trust lives in this file. The components render blocks and own no company
 * messaging, which is what makes the eventual CMS a swap rather than a
 * rewrite.
 *
 * ── WHAT IS NOT HERE, AND WILL NOT BE INVENTED ─────────────────────────────
 *
 * No founding year. No project count. No resident count. No years of
 * experience. No team members. No awards. No partners. No offices. No
 * statistics of any kind. The pages are composed so they read as finished
 * without them — a layout that needs "over 40 projects" to look complete is a
 * layout that creates pressure to invent the number.
 *
 * ── POSITIONING RULES THE COPY OBEYS ───────────────────────────────────────
 *
 *   1. NATIONAL, NOT ONE CITY. No sentence says or implies that the company
 *      works only in Jerusalem. The Jerusalem graphics stay on the homepage.
 *   2. THE DEVELOPER IS A PARTNER, NOT AN OPPONENT. The comparison on
 *      /why-organizer describes a structure. It never suggests bad faith, and
 *      it says plainly that a developer representing its own interests is
 *      normal and necessary.
 *   3. NO FEAR. Nothing warns the reader about what might happen to them.
 *   4. CURRENT PRACTICE IS SEPARATED FROM WHAT IS BEING BUILT. On /trust the
 *      digital resident area is described in the future tense and labelled,
 *      because describing unbuilt software in the present tense is the same
 *      category of untruth as an invented statistic.
 *   5. THE COST SENTENCE APPEARS ONCE, on /about. Flagged for legal review.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * /about
 * ══════════════════════════════════════════════════════════════════════════ */

const aboutBlocks: PageBlock[] = [
  {
    id: 'about-header',
    type: 'PAGE_HEADER',
    order: 0,
    hidden: false,
    eyebrow: { he: 'OpenDoor Group', en: 'OpenDoor Group' },
    heading: {
      he: 'אנחנו עומדים בצד של בעלי הדירות.',
      en: 'We stand on the owners’ side of the table.',
    },
    standfirst: {
      he: 'ייצוג וארגון בעלי דירות בהתחדשות עירונית, מהבדיקה הראשונית ועד למימוש הפרויקט.',
      en: 'Representing and organising apartment owners through urban renewal, from the first review to the finished project.',
    },
  },
  {
    id: 'about-statement',
    type: 'STATEMENT',
    order: 1,
    hidden: false,
    statement: {
      he: 'תהליך שנמשך שנים צריך מישהו שמנהל אותו.',
      en: 'A process that runs for years needs someone managing it.',
    },
    support: {
      he: 'לא כדי להחליט במקום בעלי הדירות, אלא כדי שההחלטות יתקבלו על בסיס מידע מסודר.',
      en: 'Not to decide for the owners, but so the decisions rest on information that has been put in order.',
    },
  },
  {
    id: 'about-why',
    type: 'PROSE',
    order: 2,
    hidden: false,
    lead: {
      he: 'בעלי הדירות הם בעלי הנכס ומקבלי ההחלטות. מולם עומדים גורמים מקצועיים שעוסקים בכך דרך קבע, ולכל אחד מהם תפקיד ואינטרס משלו. זה המבנה הרגיל של התהליך, ולא פגם בו.',
      en: 'The owners hold the property and make the decisions. Across from them sit professionals who do this for a living, each with a defined role and an interest of their own. That is simply how the process is built.',
    },
    body: {
      he: 'הפער אינו בידע המשפטי או התכנוני. הוא בזמן ובארגון. גורם מקצועי מגיע לפגישה עם התמונה המלאה ועם ניסיון מצטבר, ובעל דירה מגיע אליה אחרי יום עבודה, עם מה שהספיק לקרוא.\n\nתפקידה של חברה מארגנת הוא לסגור את הפער הזה. לרכז את המידע, לתאם בין אנשי המקצוע שבעלי הדירות בחרו, להביא חלופות להשוואה, ולוודא שכל החלטה מתועדת ומובנת לכל מי שנוגע בה.\n\nהחברה אינה יזם ואינה מבצעת את הבנייה. היא גם אינה מחליפה ייעוץ משפטי, שמאי או תכנוני עצמאי: אלה ניתנים על ידי אנשי מקצוע שבעלי הדירות ממנים, ואחריותם נשארת שלהם.',
      en: 'The gap is not legal or planning knowledge. It is time and organisation. A professional arrives at a meeting with the full picture and years of pattern recognition; an owner arrives after a day’s work with whatever they managed to read.\n\nAn organising company exists to close that gap: to gather the information, coordinate the professionals the owners have appointed, bring alternatives that can actually be compared, and make sure every decision is documented and understood by everyone it affects.\n\nThe company is not the developer and does not carry out construction. Nor does it replace independent legal, valuation or planning advice: that comes from professionals the owners appoint, and the responsibility stays with them.',
    },
  },
  {
    id: 'about-image',
    type: 'MEDIA',
    order: 3,
    hidden: false,
    slotId: 'ABOUT_ISRAELI_RESIDENTIAL',
    assets: [],
    caption: {
      he: 'מרקם מגורים ישראלי. תמונת הקשר, לא פרויקט של החברה.',
      en: 'Israeli residential fabric. Context, not a project of ours.',
    },
  },
  {
    id: 'about-principles',
    type: 'TRUST',
    order: 4,
    hidden: false,
    heading: { he: 'איך אנחנו עובדים בפועל', en: 'How we actually work' },
    intro: {
      he: 'ארבעה עקרונות שקובעים איך התהליך מתנהל, ומה בעלי הדירות יכולים לצפות לו.',
      en: 'Four principles that govern how the process runs, and what owners can expect from it.',
    },
    items: [
      {
        id: 'ap-decisions',
        title: { he: 'ההחלטות נשארות אצל בעלי הדירות', en: 'The decisions stay with the owners' },
        body: {
          he: 'אנחנו מביאים חלופות ומידע. הבחירה בין אנשי מקצוע, בין הצעות ובין מסלולים היא של בעלי הדירות.',
          en: 'We bring alternatives and information. Choosing between professionals, offers and routes is the owners’ to do.',
        },
      },
      {
        id: 'ap-information',
        title: { he: 'מידע מסודר לפני כל החלטה', en: 'Information in order before every decision' },
        body: {
          he: 'החלטה מתקבלת אחרי שהחומר הרלוונטי נאסף, הוסבר, וזמין לכל מי שצריך אותו.',
          en: 'A decision is taken once the relevant material has been gathered, explained, and made available to everyone who needs it.',
        },
      },
      {
        id: 'ap-documentation',
        title: { he: 'תיעוד לאורך כל הדרך', en: 'Documented throughout' },
        body: {
          he: 'פגישות, הכרעות והסכמות מתועדות. בתהליך שנמשך שנים, זיכרון אנושי אינו תחליף לרישום.',
          en: 'Meetings, resolutions and agreements are recorded. In a process that runs for years, memory is no substitute for a record.',
        },
      },
      {
        id: 'ap-continuity',
        title: { he: 'רציפות, גם כשהתהליך ארוך', en: 'Continuity, across a long process' },
        body: {
          he: 'נציגויות מתחלפות ואנשים עוברים דירה. מה שנשמר צריך להישאר נגיש גם למי שהצטרף באמצע.',
          en: 'Representations change and people move. What has been recorded needs to stay available to whoever joins partway through.',
        },
      },
    ],
  },
  {
    id: 'about-digital',
    type: 'PROSE',
    order: 5,
    hidden: false,
    heading: { he: 'מה שנשמר, נשאר נגיש', en: 'What is recorded stays reachable' },
    body: {
      he: 'אנחנו בונים סביבה דיגיטלית שבה בעלי דירות יוכלו לראות היכן התהליך עומד בלי להמתין לשיחת טלפון. עד שתהיה זמינה, המידע נמסר במפגשים, בסיכומים כתובים ובתקשורת ישירה עם הנציגות.',
      en: 'We are building a digital environment where owners can see where the process stands without waiting for a phone call. Until it is available, information is delivered in meetings, in written summaries, and directly through the representation.',
    },
  },
  /* ── COST CLAIM: FLAGGED FOR LEGAL REVIEW BEFORE PRODUCTION ────────────
   *
   * The `ctaSupport` sentence in the block below states that the service
   * involves no direct cost to the apartment owners. It is APPROVED and
   * deliberately kept, but it is the strongest commercial representation on
   * the site and it has not been cleared against every engagement model. It
   * must be confirmed before launch; if an exception exists the sentence is
   * rewritten rather than deleted.
   *
   * IT APPEARS IN TWO PLACES ON THE SITE, AND NOWHERE ELSE: here, and as
   * `eligibility.noCost` on the eligibility form (added in Pass 2). Both are
   * points where a visitor is deciding whether to engage, which is the only
   * context where the sentence is answering a question they actually have.
   *
   * Do NOT add it to a project card, to the projects index or to a project
   * page. Repetition turns a factual statement into a marketing message and
   * multiplies the legal exposure, which is why the project system introduced
   * in Pass 3B carries no cost copy at all. Both existing occurrences are in
   * scope for the same legal review.
   * ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'about-cta',
    type: 'CTA',
    order: 6,
    hidden: false,
    heading: {
      he: 'רוצים להבין מה האפשרויות בבניין שלכם?',
      en: 'Want to understand the options for your building?',
    },
    body: {
      he: 'בדיקת ההתאמה אורכת כמה דקות, ואינה מחייבת בשום שלב. השירות אינו כרוך בתשלום ישיר מצד בעלי הדירות.',
      en: 'The suitability check takes a few minutes and commits you to nothing. The service involves no direct cost to the apartment owners.',
    },
    ctaLabel: { he: 'בדיקת התאמה להתחדשות עירונית', en: 'Check your building’s suitability' },
    ctaHref: '/eligibility',
  },
]

/* ══════════════════════════════════════════════════════════════════════════
 * /why-organizer
 * ══════════════════════════════════════════════════════════════════════════ */

const whyOrganizerBlocks: PageBlock[] = [
  {
    id: 'why-header',
    type: 'PAGE_HEADER',
    order: 0,
    hidden: false,
    heading: { he: 'למה בכלל צריך חברה מארגנת?', en: 'Why does an organising company matter?' },
    standfirst: {
      he: 'כי בתהליך התחדשות עירונית לכל צד יש תפקיד ואינטרס משלו, וזה טבעי. השאלה היא מי מארגן את הצד של בעלי הדירות.',
      en: 'Because every party in an urban-renewal process has a role and an interest of its own, which is entirely normal. The question is who organises the owners’ side.',
    },
  },
  {
    id: 'why-comparison',
    type: 'COMPARISON',
    order: 1,
    hidden: false,
    heading: { he: 'מה משתנה כשהתהליך מאורגן', en: 'What changes when the process is organised' },
    baseline: {
      label: { he: 'בלי תהליך מאורגן', en: 'Without an organised process' },
      points: [
        {
          id: 'cb-info',
          title: { he: 'מידע מגיע בחלקים', en: 'Information arrives in pieces' },
          body: {
            he: 'כל בעל דירה שומע גרסה אחרת, בזמן אחר וממקור אחר. בשלב מסוים קשה לדעת מה עדכני.',
            en: 'Each owner hears a different version, at a different time, from a different source. Before long nobody is sure what is current.',
          },
        },
        {
          id: 'cb-alone',
          title: { he: 'כל אחד מול הכל', en: 'Each owner facing everything alone' },
          body: {
            he: 'בעל דירה בודד מנהל מולו גורמים שעוסקים בכך מקצועית, לצד עבודה ומשפחה.',
            en: 'A single owner negotiates with people who do this professionally, alongside a job and a family.',
          },
        },
        {
          id: 'cb-compare',
          title: { he: 'קשה להשוות הצעות', en: 'Offers are hard to compare' },
          body: {
            he: 'בלי מבנה אחיד, שתי הצעות דומות נראות שונות, ושתי הצעות שונות נראות דומות.',
            en: 'With no common structure, two similar offers look different and two different offers look alike.',
          },
        },
      ],
    },
    organised: {
      label: { he: 'עם תהליך מאורגן', en: 'With an organised process' },
      points: [
        {
          id: 'co-info',
          title: { he: 'מידע אחד, לכולם', en: 'One set of information, for everyone' },
          body: {
            he: 'אותו מידע מגיע לכל בעלי הדירות, באותו זמן, ונשאר זמין גם אחר כך.',
            en: 'The same information reaches every owner at the same time, and stays available afterwards.',
          },
        },
        {
          id: 'co-group',
          title: { he: 'קבוצה עם ייצוג', en: 'A group with representation' },
          body: {
            he: 'נציגות שנבחרה מתוך בעלי הדירות מגיעה לשולחן עם עמדה משותפת ומגובשת.',
            en: 'A representation chosen from among the owners comes to the table with a shared, settled position.',
          },
        },
        {
          id: 'co-compare',
          title: { he: 'השוואה במבנה אחיד', en: 'Comparison on common terms' },
          body: {
            he: 'חלופות נבחנות לפי אותם פרמטרים, ומה שנבחן נשאר מתועד.',
            en: 'Alternatives are examined against the same parameters, and what was examined stays on record.',
          },
        },
      ],
    },
    note: {
      he: 'הטור הראשון מתאר מבנה, לא אשמה. היזם הוא שותף הכרחי לפרויקט, והוא מייצג את עצמו ואת האינטרסים שלו, כפי שמצופה מכל צד מקצועי. תפקידנו הוא לוודא שגם לבעלי הדירות יש צד מאורגן.',
      en: 'The first column describes a structure, not a fault. The developer is an essential partner in the project, and represents its own interests as any professional party would. Our job is to make sure the owners have an organised side too.',
    },
  },
  {
    id: 'why-role-map',
    type: 'ROLE_MAP',
    order: 2,
    hidden: false,
    heading: { he: 'מי עושה מה, ומי בחר בו', en: 'Who does what, and who appointed them' },
    intro: {
      he: 'לכל גורם בתהליך תפקיד מוגדר. ההסבר שלהלן הוא על מבנה התהליך, ואינו ייעוץ משפטי.',
      en: 'Every party in the process has a defined role. What follows explains that structure; it is not legal advice.',
    },
    ownersSide: [
      {
        id: 'rm-owners',
        side: 'owners',
        label: { he: 'בעלי הדירות', en: 'The apartment owners' },
        detail: {
          he: 'בעלי הזכויות בנכס. ההחלטות המהותיות בתהליך הן שלהם.',
          en: 'The rights holders. The substantive decisions are theirs.',
        },
      },
      {
        id: 'rm-representation',
        side: 'owners',
        label: { he: 'נציגות הדיירים', en: 'The residents’ representation' },
        detail: {
          he: 'נבחרת מתוך בעלי הדירות, מרכזת את התקשורת ומביאה סוגיות להכרעה בפני כלל הבעלים.',
          en: 'Chosen from among the owners. It centralises communication and brings matters to all the owners for decision.',
        },
      },
    ],
    organiser: {
      id: 'rm-opendoor',
      side: 'owners',
      label: { he: 'חברה מארגנת · OpenDoor Group', en: 'Organising company · OpenDoor Group' },
      detail: {
        he: 'מארגנת את בעלי הדירות, מרכזת את העבודה מול שאר הגורמים ומנהלת את התהליך לאורך זמן. אינה יזם ואינה מבצעת בנייה.',
        en: 'Organises the owners, coordinates the work with the other parties, and manages the process over time. Not the developer, and does not build.',
      },
    },
    parties: [
      {
        id: 'rm-lawyer',
        side: 'process',
        label: { he: 'עורך הדין של הדיירים', en: 'The residents’ lawyer' },
        detail: {
          he: 'מייצג את בעלי הדירות בהסכמים, ונבחר על ידם. עורך דין מטעם היזם אינו מייצג אותם.',
          en: 'Represents the owners in the agreements, and is appointed by them. The developer’s lawyer does not represent them.',
        },
      },
      {
        id: 'rm-appraiser',
        side: 'process',
        label: { he: 'שמאי', en: 'Appraiser' },
        detail: {
          he: 'בוחן את הכדאיות ואת התמורות מנקודת המבט של בעלי הדירות.',
          en: 'Examines viability and consideration from the owners’ point of view.',
        },
      },
      {
        id: 'rm-architect',
        side: 'process',
        label: { he: 'אדריכל ויועצים', en: 'Architect and consultants' },
        detail: {
          he: 'אחראים לתכנון הפרויקט ולקידומו מול מוסדות התכנון.',
          en: 'Responsible for the design and for advancing it before the planning institutions.',
        },
      },
      {
        id: 'rm-developer',
        side: 'process',
        label: { he: 'יזם', en: 'Developer' },
        detail: {
          he: 'מבצע את הפרויקט ונושא בעלויות הבנייה. שותף הכרחי, שמייצג את האינטרסים שלו.',
          en: 'Carries out the project and bears the construction costs. An essential partner, representing its own interests.',
        },
      },
    ],
    independenceNote: {
      he: 'חברה מארגנת אינה מחליפה ייעוץ משפטי, שמאי, תכנוני או מקצועי אחר. אנשי המקצוע נבחרים על ידי בעלי הדירות, פועלים מטעמם, והאחריות המקצועית נשארת שלהם.',
      en: 'An organising company does not replace independent legal, valuation, planning or other professional advice. Those professionals are chosen by the owners, act on their behalf, and remain professionally responsible for their own work.',
    },
  },
  {
    id: 'why-cta',
    type: 'CTA',
    order: 3,
    hidden: false,
    heading: { he: 'רוצים לראות איך זה עובד בפועל?', en: 'Want to see how this works in practice?' },
    ctaLabel: { he: 'בדיקת התאמה להתחדשות עירונית', en: 'Check your building’s suitability' },
    ctaHref: '/eligibility',
  },
]

/* ══════════════════════════════════════════════════════════════════════════
 * /how-we-work
 * ══════════════════════════════════════════════════════════════════════════ */

const howWeWorkBlocks: PageBlock[] = [
  {
    id: 'how-header',
    type: 'PAGE_HEADER',
    order: 0,
    hidden: false,
    heading: { he: 'שמונה שלבים, לאורך שנים.', en: 'Eight stages, over several years.' },
    standfirst: {
      he: 'זה הסדר הכללי של התהליך, ומה נדרש מבעלי הדירות בכל שלב.',
      en: 'This is the general shape of the process, and what is asked of owners at each stage.',
    },
  },
  {
    id: 'how-journey',
    type: 'JOURNEY',
    order: 1,
    hidden: false,
    variabilityNote: {
      he: 'פרויקטים נבדלים זה מזה במסלול התכנוני, במבנה הבעלויות, במורכבות המתחם ובלוחות הזמנים. חלק מהשלבים מתרחשים במקביל, וחלקם חוזרים על עצמם. התיאור שלהלן הוא המבנה הכללי ואינו סדר קבוע או התחייבות למועדים.',
      en: 'Projects differ in planning route, ownership structure, complexity and timing. Some stages run in parallel and some repeat. What follows is the general shape, not a fixed sequence or a commitment to dates.',
    },
    stages: [
      {
        id: 'st-1',
        title: { he: 'בדיקה ראשונית', en: 'First review' },
        body: {
          he: 'בחינה של המתחם ושל ההיתכנות הראשונית, לפני שנדרשת מבעלי הדירות התחייבות כלשהי.',
          en: 'A look at the complex and at initial feasibility, before anything is asked of the owners.',
        },
        asks: {
          he: 'כתובת הבניין ופרטי קשר. זה הכל בשלב הזה.',
          en: 'The building address and a contact. That is all at this stage.',
        },
      },
      {
        id: 'st-2',
        title: { he: 'היכרות עם בעלי הדירות', en: 'Meeting the owners' },
        body: {
          he: 'פגישה עם הדיירים, הסבר על התהליך ומענה על שאלות. בשלב הזה אנחנו בעיקר מקשיבים: לכל בניין יש היסטוריה משלו, וכדאי להכיר אותה לפני שמתחילים.',
          en: 'A meeting with the residents, an explanation of the process, and answers to questions. Mostly we listen: every building has its own history, and it is worth knowing before anything starts.',
        },
        asks: {
          he: 'להגיע לפגישה, ולהביא את השאלות שבאמת מטרידות אתכם.',
          en: 'Come to the meeting, and bring the questions that actually worry you.',
        },
      },
      {
        id: 'st-3',
        title: { he: 'התארגנות ובניית נציגות', en: 'Organising and forming a representation' },
        body: {
          he: 'בחירת נציגות מתוך בעלי הדירות, שתרכז את התקשורת ותביא סוגיות להכרעה בפני כלל הבעלים.',
          en: 'Choosing a representation from among the owners, to centralise communication and bring matters to all the owners for decision.',
        },
        asks: {
          he: 'לבחור נציגים מקרב הדיירים, ולהסכים על דרך העבודה מולם.',
          en: 'Choose representatives from among the residents, and agree how you will work with them.',
        },
      },
      {
        id: 'st-4',
        title: { he: 'איסוף מידע ובדיקות מקצועיות', en: 'Gathering information and professional review' },
        body: {
          he: 'מינוי אנשי המקצוע מטעם בעלי הדירות ואיסוף המידע שנדרש כדי לקבל החלטות: מצב תכנוני, מצב הבעלויות והבדיקות הרלוונטיות למתחם.',
          en: 'Appointing the owners’ professionals and gathering what is needed to decide: planning status, ownership position, and the reviews relevant to the complex.',
        },
        asks: {
          he: 'לבחור את אנשי המקצוע, ולהמציא מסמכי בעלות במידת הצורך.',
          en: 'Choose the professionals, and provide ownership documents where needed.',
        },
      },
      {
        id: 'st-5',
        title: { he: 'גיבוש צרכים ועקרונות', en: 'Setting out needs and principles' },
        body: {
          he: 'מה חשוב לבעלי הדירות בפרויקט הזה. לא כל מתחם רוצה את אותו דבר, וכדאי שהעקרונות יהיו ברורים לפני שמדברים עם מישהו מבחוץ.',
          en: 'What matters to these owners in this project. Not every complex wants the same thing, and the principles are better settled before anyone outside is involved.',
        },
        asks: {
          he: 'להשתתף בדיון ולהביע עמדה. גם אי הסכמה היא מידע חשוב.',
          en: 'Take part in the discussion and say what you think. Disagreement is useful information too.',
        },
      },
      {
        id: 'st-6',
        title: { he: 'בחינת חלופות ויזמים', en: 'Examining alternatives and developers' },
        body: {
          he: 'פנייה לגורמים רלוונטיים, קבלת הצעות והשוואתן לפי אותם פרמטרים. ההשוואה מתועדת, כדי שאפשר יהיה לחזור אליה.',
          en: 'Approaching relevant parties, receiving proposals, and comparing them against the same parameters. The comparison is documented so it can be revisited.',
        },
        asks: {
          he: 'להחליט. הבחירה בין החלופות היא של בעלי הדירות, לא שלנו.',
          en: 'Decide. Choosing between the alternatives is the owners’ call, not ours.',
        },
      },
      {
        id: 'st-7',
        title: { he: 'קידום התהליך', en: 'Advancing the process' },
        body: {
          he: 'הסכמים, תכנון וקידום מול הרשות המקומית ומוסדות התכנון. זה בדרך כלל השלב הארוך ביותר, והוא תלוי בגורמים שאינם בשליטת אף אחד מהצדדים.',
          en: 'Agreements, design, and progress with the municipality and the planning institutions. Usually the longest stretch, and dependent on things no party controls.',
        },
      },
      {
        id: 'st-8',
        title: { he: 'ליווי, עדכון ושקיפות לאורך הדרך', en: 'Support, updates and transparency throughout' },
        body: {
          he: 'התהליך לא נגמר בחתימה. עדכונים, תיעוד וגישה למידע ממשיכים עד המימוש, גם כשאין חדשות דרמטיות לדווח.',
          en: 'The process does not end at signature. Updates, records and access to information continue through to completion, including in the stretches when there is nothing dramatic to report.',
        },
      },
    ],
  },
  {
    id: 'how-image',
    type: 'MEDIA',
    order: 2,
    hidden: false,
    slotId: 'RESIDENT_MEETING',
    assets: [],
    caption: {
      he: 'בנייה קיימת לצד בנייה מחודשת. תמונת הקשר, לא פרויקט של החברה.',
      en: 'Existing construction beside renewed construction. Context, not a project of ours.',
    },
  },
  {
    id: 'how-cta',
    type: 'CTA',
    order: 3,
    hidden: false,
    heading: {
      he: 'השלב הראשון הוא בדיקה, והוא לא מחייב אתכם בכלום.',
      en: 'The first stage is a review, and it commits you to nothing.',
    },
    ctaLabel: { he: 'בדיקת התאמה להתחדשות עירונית', en: 'Check your building’s suitability' },
    ctaHref: '/eligibility',
  },
]

/* ══════════════════════════════════════════════════════════════════════════
 * /trust
 * ══════════════════════════════════════════════════════════════════════════ */

const trustBlocks: PageBlock[] = [
  {
    id: 'trust-statement',
    type: 'STATEMENT',
    order: 0,
    hidden: false,
    statement: {
      he: 'שקיפות היא לא הבטחה. היא דרך עבודה.',
      en: 'Transparency is not a promise. It is a way of working.',
    },
    support: {
      he: 'תהליך התחדשות עירונית נמשך שנים, ובמהלכן מתקבלות עשרות החלטות. מה שמאפשר לבעלי הדירות להישאר בשליטה הוא סדר עבודה: מה מתועד, מי רואה מה, ומתי נושא מובא להכרעה.',
      en: 'An urban-renewal process runs for years and involves dozens of decisions. What keeps owners in control is an order of work: what gets recorded, who can see it, and when a matter goes to a decision.',
    },
  },
  {
    id: 'trust-practice',
    type: 'TRUST',
    order: 1,
    hidden: false,
    heading: { he: 'איך זה עובד אצלנו', en: 'How this works with us' },
    intro: {
      he: 'אלה כללי העבודה שאנחנו מחזיקים בהם. הם מתארים איך אנחנו עובדים, ואינם הבטחה לתוצאה.',
      en: 'These are the working rules we hold ourselves to. They describe how we work; they are not a promise of an outcome.',
    },
    items: [
      {
        id: 'tp-documentation',
        title: { he: 'תיעוד', en: 'Documentation' },
        body: {
          he: 'פגישות, הכרעות והסכמות נרשמות ונשמרות. בתהליך ארוך, רישום הוא מה שמאפשר לחזור אחורה ולהבין למה הוחלט מה שהוחלט.',
          en: 'Meetings, resolutions and agreements are written down and kept. Over a long process, a record is what lets anyone go back and understand why a decision was made.',
        },
      },
      {
        id: 'tp-access',
        title: { he: 'גישה למידע', en: 'Access to information' },
        body: {
          he: 'אנחנו עובדים כך שהמידע הנוגע לבעל דירה ולמתחם יהיה נגיש לו. חומר שמוחזק אצל הנציגות מתוקף תפקידה מוגדר ככזה מראש, ולא מתגלה בדיעבד.',
          en: 'We work so that the information concerning an owner and their complex is reachable by them. Material that sits with the representation because of its role is defined as such in advance, rather than discovered later.',
        },
      },
      {
        id: 'tp-updates',
        title: { he: 'עדכונים לדיירים', en: 'Updates to residents' },
        body: {
          he: 'אנחנו מעדכנים גם כשאין התפתחות דרמטית. שתיקה ארוכה שוחקת אמון יותר מבשורה לא נוחה.',
          en: 'We send an update even when there is no dramatic development. A long silence erodes trust more than unwelcome news does.',
        },
      },
      {
        id: 'tp-decisions',
        title: { he: 'קבלת החלטות מסודרת', en: 'Orderly decision-making' },
        body: {
          he: 'ברור מה הנציגות מוסמכת להכריע בו ומה מובא לכלל בעלי הדירות. ההבחנה נקבעת מראש ולא לפי הנוחות של הרגע.',
          en: 'It is clear what the representation may settle and what goes to all the owners. That line is drawn in advance, not according to what is convenient at the time.',
        },
      },
      {
        id: 'tp-coordination',
        title: { he: 'תיאום בין אנשי המקצוע', en: 'Coordinating the professionals' },
        body: {
          he: 'אנחנו מתאמים בין עורך הדין, השמאי, האדריכל והיועצים, ודואגים שיעבדו מול אותו מידע ואותו לוח זמנים. האחריות המקצועית נשארת אצל כל אחד מהם.',
          en: 'We coordinate between the lawyer, the appraiser, the architect and the consultants, and make sure they work from the same information and the same timeline. Professional responsibility stays with each of them.',
        },
      },
      {
        id: 'tp-comparison',
        title: { he: 'השוואת חלופות', en: 'Comparing alternatives' },
        body: {
          he: 'הצעות נבחנות לפי אותם פרמטרים, וההשוואה נשמרת. כך אפשר להסביר בחירה גם שנה אחרי שהתקבלה.',
          en: 'Proposals are examined against the same parameters, and the comparison is kept. That is what makes a choice explainable a year after it was made.',
        },
      },
      {
        id: 'tp-status',
        title: { he: 'מצב הפרויקט', en: 'Where the project stands' },
        body: {
          he: 'בעל דירה שישאל באיזה שלב התהליך נמצא, מה הסתיים ומה הבא בתור, יקבל תשובה. איננו מצפים ממנו לחפש אותה.',
          en: 'An owner who asks which stage the process has reached, what is finished and what comes next will get an answer. We do not expect them to go looking for it.',
        },
      },
    ],
  },
  {
    id: 'trust-digital',
    type: 'PROSE',
    order: 2,
    hidden: false,
    heading: { he: 'תיק הדייר הדיגיטלי', en: 'The digital resident area' },
    lead: {
      he: 'הסביבה הדיגיטלית לבעלי הדירות נמצאת בבנייה. חלק מהיכולות המתוארות כאן טרם זמינות.',
      en: 'The digital environment for owners is being built. Some of the capabilities described here are not yet available.',
    },
    body: {
      he: 'הכוונה היא שכל בעל דירה יוכל לראות במקום אחד את השלב שבו הפרויקט נמצא, את העדכון האחרון, את המסמכים שנוגעים לדירה שלו ואת המועדים הקרובים. לחברי הנציגות מתוכננת סביבה נוספת לניהול ההחלטות והמשימות.\n\nעד שהסביבה תהיה זמינה במלואה, הנהלים שלמעלה מתקיימים בערוצים הרגילים: פגישות, סיכומים כתובים ותקשורת ישירה מול הנציגות.',
      en: 'The intent is that every owner can see in one place which stage the project has reached, the latest update, the documents relevant to their apartment, and what is coming up. A further environment for managing decisions and tasks is planned for representation members.\n\nUntil that environment is fully available, the practices above run through the ordinary channels: meetings, written summaries, and direct communication with the representation.',
    },
  },
  {
    id: 'trust-resources',
    type: 'EXTERNAL_RESOURCES',
    order: 3,
    hidden: false,
    heading: { he: 'מקורות מידע רשמיים', en: 'Official information sources' },
    intro: {
      he: 'גופים ציבוריים שאפשר לבדוק מולם את המידע באופן עצמאי. אין בינינו לבינם קשר עסקי, שיתוף פעולה או המלצה הדדית.',
      en: 'Public bodies you can check the information against independently. We have no business relationship, cooperation or mutual endorsement with any of them.',
    },
  },
  {
    id: 'trust-cta',
    type: 'CTA',
    order: 4,
    hidden: false,
    heading: { he: 'יש שאלה שלא נענתה כאן?', en: 'A question this page did not answer?' },
    ctaLabel: { he: 'בדיקת התאמה להתחדשות עירונית', en: 'Check your building’s suitability' },
    ctaHref: '/eligibility',
  },
]

/* ══════════════════════════════════════════════════════════════════════════ */

export const CORE_PAGES: readonly CmsPage[] = [
  {
    id: 'page-about',
    slug: 'about',
    title: { he: 'מי אנחנו', en: 'About us' },
    publishState: 'published',
    blocks: aboutBlocks,
    seo: {
      he: {
        title: 'מי אנחנו',
        description:
          'OpenDoor Group מייצגת ומארגנת בעלי דירות בתהליכי התחדשות עירונית, מהבדיקה הראשונית ועד למימוש הפרויקט.',
      },
      en: {
        title: 'About us',
        description:
          'OpenDoor Group represents and organises apartment owners through urban renewal, from the first review to the finished project.',
      },
    },
    updatedAt: '2026-08-31T00:00:00.000Z',
    updatedByName: 'Mock content',
  },
  {
    id: 'page-why-organizer',
    slug: 'why-organizer',
    title: { he: 'למה חברה מארגנת', en: 'Why an organising company' },
    publishState: 'published',
    blocks: whyOrganizerBlocks,
    seo: {
      he: {
        title: 'למה חברה מארגנת',
        description:
          'לכל צד בתהליך התחדשות עירונית יש תפקיד ואינטרס משלו. הסבר על מי עושה מה, ולמה בעלי דירות נעזרים בתהליך מאורגן.',
      },
      en: {
        title: 'Why an organising company',
        description:
          'Every party in an urban-renewal process has a role and an interest of its own. Who does what, and why owners benefit from an organised process.',
      },
    },
    updatedAt: '2026-08-31T00:00:00.000Z',
    updatedByName: 'Mock content',
  },
  {
    id: 'page-how-we-work',
    slug: 'how-we-work',
    title: { he: 'כך אנחנו עובדים', en: 'How we work' },
    publishState: 'published',
    blocks: howWeWorkBlocks,
    seo: {
      he: {
        title: 'כך אנחנו עובדים',
        description:
          'שמונת השלבים של תהליך התחדשות עירונית, ומה נדרש מבעלי הדירות בכל שלב.',
      },
      en: {
        title: 'How we work',
        description:
          'The eight stages of an urban-renewal process, and what is asked of owners at each one.',
      },
    },
    updatedAt: '2026-08-31T00:00:00.000Z',
    updatedByName: 'Mock content',
  },
  {
    id: 'page-trust',
    slug: 'trust',
    title: { he: 'שקיפות ואמון', en: 'Transparency and trust' },
    publishState: 'published',
    blocks: trustBlocks,
    seo: {
      he: {
        title: 'שקיפות ואמון',
        description:
          'איך מידע נשמר, נגיש ומגיע לבעלי הדירות לאורך תהליך התחדשות עירונית.',
      },
      en: {
        title: 'Transparency and trust',
        description:
          'How information is kept, reached and delivered to owners through an urban-renewal process.',
      },
    },
    updatedAt: '2026-08-31T00:00:00.000Z',
    updatedByName: 'Mock content',
  },
] as const
