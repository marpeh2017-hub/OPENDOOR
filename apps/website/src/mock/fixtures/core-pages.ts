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
 * experience. No awards. No partners. No offices. No statistics of any kind.
 * No team members beyond Michael Rosenbach, whose biography on /about the
 * company supplied; nothing is added to it by inference. The pages are
 * composed so they read as finished without the rest — a layout that needs
 * "over 40 projects" to look complete is a layout that creates pressure to
 * invent the number.
 *
 * ── POSITIONING RULES THE COPY OBEYS ───────────────────────────────────────
 *
 *   1. NATIONAL, NOT ONE CITY. No sentence says or implies that the company
 *      works only in Jerusalem. The Jerusalem graphics stay on the homepage.
 *      One deliberate exception: Michael's biography on /about names
 *      Jerusalem and its surroundings, worded so at the company's request.
 *      Whether the company itself is still positioned nationally is open.
 *   2. THE DEVELOPER IS A PARTNER, NOT AN OPPONENT. The comparison on
 *      /why-organizer describes a structure. It never suggests bad faith, and
 *      it says plainly that a developer representing its own interests is
 *      normal and necessary.
 *   3. NO FEAR. Nothing warns the reader about what might happen to them.
 *      Naming a worry owners already have, as /about opens by doing, is not
 *      a warning, provided the next thing the page does is answer it.
 *   4. CURRENT PRACTICE IS SEPARATED FROM WHAT IS BEING BUILT. Describing
 *      unbuilt software in the present tense is the same category of untruth
 *      as an invented statistic. The personal area for owners is live from
 *      launch (decided 2026-10-05), so /trust describes it in the present
 *      tense, limited to what the portal does. The representation workspace
 *      is not built and stays in the future tense, labelled.
 *   5. WHO PAYS IS SAID ONE WAY. Where a page states it (the homepage note
 *      and facts block, the /about role section) it is the same two clauses:
 *      the developer alone pays the company, and owners pay it nothing
 *      directly. Flagged for legal review.
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
      he: 'התחדשות עירונית שמתחילה בבעלי הדירות',
      en: 'Urban renewal that starts with the apartment owners',
    },
  },
  {
    id: 'about-image',
    type: 'MEDIA',
    order: 1,
    hidden: false,
    assets: [],
    slotId: 'HERO_JERUSALEM_ARCHITECTURE',
    caption: {
      he: 'המחשת AI של מרקם מגורים ירושלמי. אינה תיעוד של פרויקט של החברה.',
      en: 'AI illustration of Jerusalem housing. Not documentation of a company project.',
    },
  },
  {
    id: 'about-statement',
    type: 'STATEMENT',
    order: 2,
    hidden: false,
    statement: {
      he: 'אתם צריכים מישהו שנמצא בצד שלכם.',
      en: 'You need someone on your side.',
    },
  },
  {
    id: 'about-intro',
    type: 'PROSE',
    order: 3,
    hidden: false,
    lead: {
      he: 'גם כשיזם רציני מגיע לשכונה שלכם, בעלי דירות רואים קודם כל את הסיכונים: פינוי מהדירה, אי-ודאות, בירוקרטיה, טרדה יומיומית, ומסמכים משפטיים וכלכליים שלא תמיד קל להבין.',
      en: 'Even when a serious developer comes to your neighbourhood, owners see the risks first: having to move out, uncertainty, bureaucracy, everyday disruption, and legal and financial documents that are not always easy to follow.',
    },
  },
  {
    id: 'about-checks',
    type: 'CHECKLIST',
    order: 4,
    hidden: false,
    heading: {
      he: 'הצעה של יזם מגיעה עם מספרים, מצגות ותוכניות. אנחנו בודקים מה עומד מאחוריהם.',
      en: 'A developer’s offer comes with figures, presentations and plans. We examine what stands behind them.',
    },
    items: [
      { id: 'check-financial', icon: 'chart', label: { he: 'הנתונים הכלכליים', en: 'The financial data' } },
      { id: 'check-consideration', icon: 'home', label: { he: 'התמורות לבעלי הדירות', en: 'The consideration for the owners' } },
      { id: 'check-timelines', icon: 'calendar', label: { he: 'לוחות הזמנים', en: 'The timelines' } },
      { id: 'check-guarantees', icon: 'shield', label: { he: 'הבטוחות', en: 'The guarantees' } },
      { id: 'check-commitments', icon: 'document-check', label: { he: 'ההתחייבויות', en: 'The commitments' } },
      { id: 'check-risks', icon: 'alert', label: { he: 'הסיכונים', en: 'The risks' } },
    ],
    note: {
      he: 'המטרה פשוטה: שלא תצאו מהדירה, תחתמו על מסמך או תתקדמו בפרויקט בלי להבין בדיוק מה אתם מקבלים ולמה אתם מתחייבים.',
      en: 'The aim is simple: that you do not move out, sign a document or move the project forward without understanding exactly what you are getting and what you are committing to.',
    },
  },
  {
    id: 'about-checking-offers',
    type: 'CHAPTER',
    order: 5,
    hidden: false,
    numeral: '01',
    heading: { he: 'בדיקת ההצעה', en: 'Checking the offer' },
    lead: {
      he: 'אנחנו בודקים את ההצעה, משווים בין יזמים, מסבירים את המשמעות הכלכלית והמשפטית בשפה שלכם - ובעיקר מוודאים שהאינטרסים שלכם נשמרים לאורך כל הדרך.',
      en: 'We check the offer, compare developers, explain the financial and legal implications in your language — and above all make sure your interests are protected all the way through.',
    },
    slotId: 'PROCESS_STAGE_6',
  },
  {
    id: 'about-transparency',
    type: 'CHAPTER',
    order: 6,
    hidden: false,
    numeral: '02',
    heading: { he: 'שקיפות בתהליך', en: 'Transparency in the process' },
    body: {
      he: 'התחדשות עירונית היא תהליך מורכב. יש בו החלטות קשות, פשרות, עלויות, עיכובים, אינטרסים שונים, ולעיתים גם מחלוקות בין בעלי הדירות עצמם.\n\nאנחנו לא מטשטשים את זה. אנחנו מסבירים איפה נמצאים הסיכונים, מה המשמעות של כל בחירה ואילו אפשרויות עומדות בפניכם - כי רק כך אפשר לקבל החלטה אחראית ומבוססת.',
      en: 'Urban renewal is a complex process. It involves hard decisions, compromises, costs, delays, competing interests and, at times, disagreements among the owners themselves.\n\nWe do not blur any of that. We explain where the risks lie, what each choice means and which options are open to you — because that is the only way to reach a responsible, well-founded decision.',
    },
    slotId: 'PROCESS_STAGE_2',
  },
  {
    id: 'about-role',
    type: 'CHAPTER',
    order: 7,
    hidden: false,
    numeral: '03',
    heading: { he: 'תפקידנו', en: 'Our role' },
    body: {
      he: 'אנחנו לא יזמים ולא בונים. אנחנו מארגנים ומלווים בעלי דירות בתהליכי התחדשות עירונית, ונותנים לכם שליטה בתהליך: מנגישים את המידע, בונים נציגות מסודרת, מביאים חלופות, מנהלים משא ומתן, ומעלים כל החלטה משמעותית להכרעת בעלי הדירות.',
      en: 'We are not developers, and we do not build. We organise and support apartment owners through urban renewal and give you control of the process: we make the information accessible, build an orderly representation, bring alternatives, lead negotiations, and put every significant decision to the owners.',
    },
    emphasis: {
      he: 'בסוף, אתם מחליטים. אנחנו דואגים שתעשו את זה עם כל המידע שצריך.',
      en: 'In the end, you decide. We make sure you do so with all the information you need.',
    },
    slotId: 'PROCESS_STAGE_3',
  },
  {
    // Who pays is stated here, in the facts, rather than again in the role
    // chapter above: once per page, in the homepage's exact wording.
    id: 'about-facts',
    type: 'VERIFIABLE_FACTS',
    order: 8,
    hidden: false,
    tone: 'inverse',
    heading: { he: 'מה שאפשר לבדוק עלינו', en: 'What you can check about us' },
    intro: {
      he: 'בלי ממוצעים ובלי הבטחות. שלוש עובדות שאפשר לאמת מול רשם החברות ומול ההסכם.',
      en: 'No averages and no promises. Three facts you can verify at the registrar and in the agreement.',
    },
    items: [
      {
        id: 'about-vf-registered',
        icon: 'building',
        title: { he: 'מי אנחנו, רשמית', en: 'Who we are, officially' },
        body: {
          he: 'קבוצת אופן דור יזמות והתחדשות בע״מ, ח.פ. 515856334. חברה רשומה - אפשר לבדוק אותנו ברשם החברות לפני שמדברים איתנו.',
          en: 'Kvutsat OpenDoor Yazamut VeHithadshut Ltd., company number 515856334. A registered company — you can look us up before you speak to us.',
        },
      },
      {
        id: 'about-vf-who-pays',
        icon: 'receipt',
        title: { he: 'מי משלם לנו', en: 'Who pays us' },
        body: {
          he: 'התשלום מגיע מהיזם בלבד. בעלי הדירות אינם משלמים לחברה תשלום ישיר - וזה כתוב בהסכם שתקבלו לידיים.',
          en: 'The developer pays us. Apartment owners pay the company nothing directly — and that is written into the agreement you will hold.',
        },
      },
      {
        id: 'about-vf-boundary',
        icon: 'scale',
        title: { he: 'מה אנחנו לא', en: 'What we are not' },
        body: {
          he: 'לא היזם, לא חברת הבנייה, לא הקבלן. אנחנו מרכזים את התהליך - בעלי הדירות בוחרים את אנשי המקצוע ואת היזם.',
          en: 'Not the developer, not the construction company, not the contractor. We coordinate the process — the owners choose the professionals and the developer.',
        },
      },
    ],
  },
  {
    id: 'about-michael',
    type: 'CHAPTER',
    order: 9,
    hidden: false,
    heading: { he: 'מיכאל רוזנבך', en: 'Michael Rosenbach' },
    quote: {
      he: '״בעלי דירות חזקים יותר כשהם מאורגנים, מבינים את הזכויות שלהם ומלווים על ידי מי שמכיר את השחקנים, את המספרים ואת התהליך - אבל מחויב קודם כל אליהם.״',
      en: '“Owners are stronger when they are organised, understand their rights and are supported by someone who knows the players, the numbers and the process — but is committed, first and foremost, to them.”',
    },
    body: {
      he: 'מיכאל רוזנבך עוסק בהתחדשות עירונית בירושלים והסביבה, ומלווה בעלי דירות ונציגויות מול יזמים, אנשי מקצוע וחברות נדל״ן. הוא בעל תואר במנהל עסקים עם התמחות במערכות מידע, ובעל רישיון תיווך. השילוב הזה מאפשר לו לקרוא הצעות ומסמכים בעין עסקית, להבין נתונים ומספרים, לבדוק שמה שמוצג בהצעה מעוגן בהתחייבויות, ולנהל את השיח בין בעלי הדירות, היזמים ואנשי המקצוע בצורה ברורה ומעשית.\n\nמיכאל יכול לעזור לכם להבין מה ההצעה כוללת, מה חסר בה, איפה נמצאים הסיכונים ומה הצעדים הבאים שכדאי לשקול - גם אם אתם כבר בתוך תהליך.',
      en: 'Michael Rosenbach works in urban renewal in and around Jerusalem, supporting owners and their representations in their dealings with developers, professionals and real-estate companies. He holds a degree in business administration, specialising in information systems, and a real-estate broker’s licence. That combination lets him read offers and documents with a business eye, make sense of data and figures, check that what an offer presents is backed by commitments, and keep the conversation between owners, developers and professionals clear and practical.\n\nMichael can help you understand what an offer includes, what is missing from it, where the risks lie and which next steps are worth considering — even if you are already in a process.',
    },
    slotId: 'ABOUT_MICHAEL_PORTRAIT',
  },
  {
    // A CTA pointing at /eligibility renders `links.enquiryIntro` in place of
    // its own body (cta-block.tsx), so the body below only decides whether that
    // line appears. It repeats the message so this file shows what renders.
    id: 'about-cta',
    type: 'CTA',
    order: 10,
    hidden: false,
    heading: {
      he: 'יזם הגיע לבניין שלכם?',
      en: 'Has a developer come to your building?',
    },
    body: {
      he: 'פנו אלינו לשיחה ראשונית על האפשרויות בבניין שלכם.',
      en: 'Contact us for an initial conversation about your building.',
    },
    ctaLabel: { he: 'דברו איתנו', en: 'Talk to us' },
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
          he: 'פגישה עם בעלי הדירות, הסבר על התהליך ומענה על שאלות. בשלב הזה אנחנו בעיקר מקשיבים: לכל בניין יש היסטוריה משלו, וכדאי להכיר אותה לפני שמתחילים.',
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
          he: 'לבחור נציגים מקרב בעלי הדירות, ולהסכים על דרך העבודה מולם.',
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
    heading: { he: 'האזור האישי', en: 'The personal area' },
    lead: {
      he: 'באזור האישי כל בעל דירה רואה במקום אחד את השלב שבו הפרויקט נמצא, את העדכונים, את המסמכים שנוגעים לדירה שלו ואת הפגישות הקרובות.',
      en: 'In the personal area every owner sees in one place which stage the project has reached, the updates, the documents relevant to their apartment, and the meetings coming up.',
    },
    body: {
      he: 'משם אפשר גם לשלוח הודעות ופניות, ולחתום על מסמכים כשנדרש. הכניסה נעשית בקוד חד־פעמי שנשלח לטלפון הנייד הרשום אצלנו. סביבה לחברי הנציגות, לניהול ההחלטות והמשימות, עדיין בבנייה.\n\nלצד האזור האישי, הנהלים שלמעלה ממשיכים להתקיים גם בערוצים הרגילים: פגישות, סיכומים כתובים ותקשורת ישירה מול הנציגות.',
      en: 'From there owners can also send messages and requests, and sign documents when needed. Sign-in is by a one-time code sent to the mobile number we hold. A workspace for representation members, for managing decisions and tasks, is still being built.\n\nAlongside the personal area, the practices above continue through the ordinary channels too: meetings, written summaries, and direct communication with the representation.',
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


/* ══════════════════════════════════════════════════════════════════════════
 * /services
 * ══════════════════════════════════════════════════════════════════════════ */

const servicesBlocks: PageBlock[] = [
  {
    id: 'services-header',
    type: 'PAGE_HEADER',
    order: 0,
    hidden: false,
    eyebrow: { he: 'OpenDoor Group', en: 'OpenDoor Group' },
    heading: { he: 'מעטפת מקצועית מלאה', en: 'A complete professional envelope' },
    standfirst: {
      he: 'מובילים את בעלי הדירות ממתחם ישן לבית חדש, בבטחה ובשקיפות.',
      en: 'Leading residents from an ageing complex to a new home, safely and transparently.',
    },
  },
  {
    id: 'services-journey',
    type: 'JOURNEY',
    order: 1,
    hidden: false,
    variabilityNote: {
      he: 'פרויקטים נבדלים זה מזה במסלול התכנוני, במבנה הבעלויות ובלוחות הזמנים. חלק מהשלבים מתרחשים במקביל וחלקם חוזרים על עצמם. התיאור שלהלן הוא המבנה הכללי ואינו סדר קבוע או התחייבות למועדים.',
      en: 'Projects differ in planning route, ownership structure and timing. Some stages run in parallel and some repeat. What follows is the general shape, not a fixed sequence or a commitment to dates.',
    },
    stages: [
      {
        id: 'sv-1',
        title: {
          he: 'בדיקת היתכנות תכנונית וכלכלית',
          en: 'Planning and financial feasibility review',
        },
        body: {
          he: 'ניתוח זכויות הבנייה במתחם, בדיקת מדיניות הרשות המקומית והערכת כדאיות כלכלית ראשונית - עבורכם ועבור היזמים. ללא עלות וללא התחייבות.',
          en: 'Analysis of the building rights on the complex, a review of local authority policy, and an initial viability assessment - for you and for the developers. At no cost and with no obligation.',
        },
      },
      {
        id: 'sv-2',
        title: {
          he: 'התארגנות הדיירים ובחירת נציגות',
          en: 'Organising the residents and electing a representation',
        },
        body: {
          he: 'ניהול אספות, הקמת נציגות בית מוסמכת, מינוי עורך דין ומפקח בנייה מטעמכם, ויצירת ערוצי תקשורת שקופים בין כלל בעלי הדירות.',
          en: 'Running meetings, establishing an authorised building representation, appointing a lawyer and a construction supervisor on your behalf, and setting up transparent communication among all owners.',
        },
      },
      {
        id: 'sv-3',
        title: { he: 'מכרז יזמים תחרותי', en: 'A competitive developer tender' },
        body: {
          he: 'כתיבת מפרט טכני ודרישות חובה, פנייה ליזמים מובילים בשוק, ניהול המשא ומתן - כדי שתקבלו תמורה מיטבית וערבויות חזקות.',
          en: 'Writing a technical specification and mandatory requirements, approaching developers active in the market, and running the negotiation - so that you receive sound consideration and strong guarantees.',
        },
      },
      {
        id: 'sv-4',
        title: {
          he: 'ליווי תכנוני ומשפטי עד לחתימה',
          en: 'Planning and legal support up to signature',
        },
        body: {
          he: 'גיבוש הסכם מפורט מול עורכי הדין, הגדרת לוחות זמנים, מנגנוני פיצוי וערבויות בנקאיות לפי חוק המכר.',
          en: 'Shaping a detailed agreement with the lawyers, setting timetables, compensation mechanisms and bank guarantees under the Sale Law.',
        },
      },
      {
        id: 'sv-5',
        title: { he: 'פיקוח על הבנייה והאכלוס', en: 'Overseeing construction and occupancy' },
        body: {
          he: 'תקשורת שוטפת מול היזם והרשויות, סיוע בשלבי הרישוי והבנייה - עד לבדיקת המסירה וקבלת המפתח לדירה החדשה.',
          en: 'Ongoing communication with the developer and the authorities, support through licensing and construction - up to the handover inspection and the key to the new apartment.',
        },
      },
    ],
  },
  {
    id: 'services-comparison',
    type: 'COMPARISON',
    order: 2,
    hidden: false,
    baseline: {
      label: { he: 'עצמאי', en: 'On your own' },
      points: [
        {
          id: 'sc-b-time',
          title: { he: 'זמן להסכם', en: 'Time to an agreement' },
          body: { he: 'שנים, עם עיכובים.', en: 'Years, with delays.' },
        },
        {
          id: 'sc-b-power',
          title: { he: 'כוח מיקוח', en: 'Bargaining position' },
          body: { he: 'מוגבל.', en: 'Limited.' },
        },
        {
          id: 'sc-b-clarity',
          title: { he: 'שקיפות', en: 'Transparency' },
          body: { he: 'חוסר ודאות.', en: 'Uncertainty.' },
        },
      ],
    },
    organised: {
      label: { he: 'עם חברה מארגנת', en: 'With an organiser' },
      points: [
        {
          id: 'sc-o-time',
          title: { he: 'זמן להסכם', en: 'Time to an agreement' },
          body: {
            he: 'תהליך מובנה עם לוחות זמנים.',
            en: 'A structured process with timetables.',
          },
        },
        {
          id: 'sc-o-power',
          title: { he: 'כוח מיקוח', en: 'Bargaining position' },
          body: { he: 'גב מקצועי מול היזם.', en: 'Professional backing opposite the developer.' },
        },
        {
          id: 'sc-o-clarity',
          title: { he: 'שקיפות', en: 'Transparency' },
          body: { he: 'עדכונים שוטפים, כתובת אחת.', en: 'Regular updates, a single point of contact.' },
        },
      ],
    },
  },
  {
    id: 'services-cta',
    type: 'CTA',
    order: 3,
    hidden: false,
    heading: {
      he: 'רוצים לבדוק אם הבניין שלכם מתאים?',
      en: 'Want to check whether your building is suitable?',
    },
    body: {
      he: 'פנו לפגישת ייעוץ ראשונית - ללא עלות וללא התחייבות.',
      en: 'Get in touch for an initial consultation - at no cost and with no obligation.',
    },
    ctaLabel: { he: 'בדיקת התאמה להתחדשות עירונית', en: 'Check your building’s suitability' },
    ctaHref: '/eligibility',
  },
]

/* ══════════════════════════════════════════════════════════════════════════ */

export const CORE_PAGES: readonly CmsPage[] = [
  {
    id: 'page-services',
    slug: 'services',
    title: { he: 'השירותים שלנו', en: 'Our services' },
    publishState: 'published',
    blocks: servicesBlocks,
    seo: {
      he: {
        title: 'השירותים שלנו',
        description:
          'מעטפת מקצועית מלאה לבעלי דירות בהתחדשות עירונית: בדיקת היתכנות, התארגנות ונציגות, מכרז יזמים, ליווי עד לחתימה וניהול הבנייה והאכלוס.',
      },
      en: {
        title: 'Our services',
        description:
          'A complete professional envelope for apartment owners in urban renewal: feasibility, organising and representation, a developer tender, support to signature, and oversight through construction and occupancy.',
      },
    },
    updatedAt: '2026-09-14T00:00:00.000Z',
    updatedByName: 'Mock content',
  },
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
          'OpenDoor Group מארגנת ומלווה בעלי דירות בתהליכי התחדשות עירונית, מהבדיקה הראשונית ועד למימוש הפרויקט.',
      },
      en: {
        title: 'About us',
        description:
          'OpenDoor Group organises and supports apartment owners through urban renewal, from the first review to the finished project.',
      },
    },
    updatedAt: '2026-10-04T00:00:00.000Z',
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
