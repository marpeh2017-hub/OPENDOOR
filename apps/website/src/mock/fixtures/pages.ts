import type { CmsPage, PageBlock } from '@urban-renewal/api-contracts'

/**
 * MOCK DATA — replaced by the CMS in Phase 2.
 *
 * ── WHY PAGES ARE DATA, NOT JSX ────────────────────────────────────────────
 *
 * The requirement is that the entire public site be editable without touching
 * source. That is only achievable if a page's CONTENT and its RENDERING are
 * separate from the start. Every string a visitor reads on the homepage lives
 * in this file; the components in `components/blocks/` render blocks and own
 * no company messaging.
 *
 * Building the pages as JSX first and "extracting a CMS later" does not work in
 * practice — by then copy, layout and conditionals are entangled, and the
 * extraction is a rewrite.
 *
 * ── NO STATISTICS, ANYWHERE ────────────────────────────────────────────────
 *
 * There is no block here containing a number about the company: no project
 * count, no years of experience, no resident total, no satisfaction figure, no
 * testimonial, no partner. Not as placeholder, not as "0", not hidden.
 *
 * ── CLAIMS ABOUT THE DIGITAL PRODUCT ───────────────────────────────────────
 *
 * The portal and transparency sections describe capability that is still being
 * built. Their copy says so — "נבנית", "יאפשר" — rather than the present tense
 * a finished product would use. A marketing page that describes unbuilt
 * software in the present tense is the same category of untruth as an invented
 * statistic.
 */

const homepageBlocks: PageBlock[] = [
  /* 1 ── HERO ─────────────────────────────────────────────────────────── */
  {
    id: 'home-hero',
    type: 'HERO',
    order: 0,
    hidden: false,
    eyebrow: { he: 'חברה מארגנת — לא יזם', en: 'An organising company — not the developer' },
    heading: {
      he: 'אופן־דור גרופ מייצגת ומארגנת בעלי דירות בתהליכי התחדשות עירונית',
      en: 'OpenDoor Group represents and organises apartment owners in urban-renewal processes',
    },
    subheading: {
      he: 'מהבדיקה הראשונית, דרך ניהול התהליך ובחירת היזם המתאים, ועד למימוש הפרויקט — בליווי מקצועי ובשקיפות מלאה.',
      en: 'From the initial review, through managing the process and selecting the right developer, to realising the project — with professional guidance and full transparency.',
    },
    primaryCtaLabel: { he: 'בדיקת התאמה להתחדשות עירונית', en: "Check your building's suitability" },
    primaryCtaHref: '/eligibility',
    secondaryCtaLabel: { he: 'כניסה לתיק הדייר', en: 'Resident portal' },
    secondaryCtaHref: '/resident-portal',
    note: {
      he: 'השירות לבעלי הדירות אינו כרוך בעלות ישירה מצד הדיירים.',
      en: 'The service involves no direct cost to the apartment owners.',
    },
  },

  /* 2 ── WHY OPENDOOR ─────────────────────────────────────────────────── */
  {
    id: 'home-why-opendoor',
    type: 'FEATURE_GRID',
    order: 1,
    hidden: false,
    heading: {
      he: 'אתם בעלי הדירות. אנחנו מנהלים את הדרך.',
      en: 'You are the owners. We manage the way through.',
    },
    intro: {
      he: 'בתהליך התחדשות עירונית לכל צד יש תפקיד אחר ואינטרס אחר — וזה טבעי. אופן־דור מארגנת ומייצגת את הצד של בעלי הדירות.',
      en: 'In an urban-renewal process each side has a different role and a different interest — which is natural. OpenDoor organises and represents the owners\u2019 side.',
    },
    items: [
      {
        id: 'wo-management',
        icon: 'route',
        title: { he: 'ניהול התהליך', en: 'Managing the process' },
        body: {
          he: 'תהליך התחדשות עירונית נמשך שנים ומערב עשרות החלטות. אנחנו מנהלים אותו מקצה לקצה, כך שבעלי הדירות יודעים בכל רגע מה קורה ומה השלב הבא.',
          en: 'An urban-renewal process runs for years and involves dozens of decisions. We manage it end to end, so owners always know what is happening and what comes next.',
        },
      },
      {
        id: 'wo-power',
        icon: 'users',
        title: { he: 'כוח מאורגן לבעלי הדירות', en: 'Organised standing for owners' },
        body: {
          he: 'בעל דירה בודד מול גורם מקצועי מאורגן נמצא בעמדה שונה מקבוצה מאורגנת עם ייצוג. הארגון הוא מה שמאפשר לבעלי הדירות להגיע לשולחן עם עמדה משותפת.',
          en: 'A single owner facing an organised professional party is in a different position from an organised group with representation. Organisation is what lets owners come to the table with a shared position.',
        },
      },
      {
        id: 'wo-selection',
        icon: 'scale',
        title: { he: 'בחירת אנשי המקצוע והיזם', en: 'Choosing the professionals and the developer' },
        body: {
          he: 'עורכי דין, שמאים, אדריכלים ויזמים נבחרים על ידי בעלי הדירות. תפקידנו להביא חלופות, להשוות ביניהן ולוודא שההחלטה מתקבלת על בסיס מידע.',
          en: 'Lawyers, appraisers, architects and developers are chosen by the owners. Our role is to bring alternatives, compare them, and make sure the decision rests on information.',
        },
      },
    ],
  },

  /* 3 ── WHY AN ORGANIZING COMPANY ────────────────────────────────────── */
  {
    id: 'home-why-organizer',
    type: 'TEXT_SECTION',
    order: 2,
    hidden: false,
    heading: { he: 'מה זו חברה מארגנת?', en: 'What is an organising company?' },
    body: {
      he: 'תהליך התחדשות עירונית מפגיש בעלי דירות עם יזמים, עורכי דין, שמאים, אדריכלים ורשויות התכנון. לכל אחד מהם תפקיד מוגדר, וכולם נדרשים כדי שפרויקט יצא לפועל.\n\nחברה מארגנת אינה יזם ואינה מבצעת את הבנייה. תפקידה הוא לארגן את בעלי הדירות, לרכז את העבודה מול אנשי המקצוע, ולנהל את התהליך לאורך זמן — מהעמדה של בעלי הדירות.\n\nהשירות לבעלי הדירות אינו כרוך בעלות ישירה מצד הדיירים.',
      en: 'An urban-renewal process brings together apartment owners, developers, lawyers, appraisers, architects and planning authorities. Each has a defined role, and all of them are needed for a project to happen.\n\nAn organising company is not the developer and does not carry out the construction. Its role is to organise the owners, coordinate the work with the professionals, and manage the process over time — from the owners\u2019 side of the table.\n\nThe service involves no direct cost to the apartment owners.',
    },

    /**
     * The relationship map.
     *
     * Note what is NOT here: no firm names, no logos, no "our partners", no
     * count of professionals. Each entry describes what a ROLE does. That is
     * the difference between explaining a structure and claiming a
     * relationship, and only the first is true.
     */
    roleMap: {
      principal: {
        id: 'rm-owners',
        side: 'owners',
        label: { he: 'בעלי הדירות', en: 'The apartment owners' },
        detail: {
          he: 'בעלי הזכויות בנכס. ההחלטות המהותיות בתהליך הן שלהם.',
          en: 'The rights holders. The substantive decisions in the process are theirs.',
        },
      },
      organiser: {
        id: 'rm-opendoor',
        side: 'owners',
        label: { he: 'אופן־דור גרופ', en: 'OpenDoor Group' },
        detail: {
          he: 'מארגנת את בעלי הדירות ומרכזת את העבודה מול הגורמים בתהליך — מהצד של בעלי הדירות.',
          en: 'Organises the owners and coordinates the work with the other parties — from the owners’ side.',
        },
      },
      parties: [
        {
          id: 'rm-lawyer',
          side: 'process',
          label: { he: 'עורך דין', en: 'Lawyer' },
          detail: {
            he: 'מייצג את בעלי הדירות בהסכמים. נבחר על ידם.',
            en: 'Represents the owners in the agreements. Chosen by them.',
          },
        },
        {
          id: 'rm-appraiser',
          side: 'process',
          label: { he: 'שמאי', en: 'Appraiser' },
          detail: {
            he: 'בוחן את הכדאיות והתמורות מנקודת המבט של בעלי הדירות.',
            en: 'Examines viability and consideration from the owners’ point of view.',
          },
        },
        {
          id: 'rm-architect',
          side: 'process',
          label: { he: 'אדריכל', en: 'Architect' },
          detail: {
            he: 'אחראי לתכנון הפרויקט מול מוסדות התכנון.',
            en: 'Responsible for the project design before the planning institutions.',
          },
        },
        {
          id: 'rm-developer',
          side: 'process',
          label: { he: 'יזם', en: 'Developer' },
          detail: {
            he: 'מבצע את הפרויקט ונושא בעלויות הבנייה. צד נפרד, עם אינטרס נפרד.',
            en: 'Carries out the project and bears the construction costs. A separate party, with a separate interest.',
          },
        },
        {
          id: 'rm-authority',
          side: 'process',
          label: { he: 'הרשויות', en: 'The authorities' },
          detail: {
            he: 'הרשות המקומית ומוסדות התכנון, שמאשרים את התוכנית.',
            en: 'The municipality and the planning institutions, which approve the plan.',
          },
        },
      ],
    },
  },

  /* 4 ── HOW WE WORK ──────────────────────────────────────────────────── */
  {
    id: 'home-process',
    type: 'PROCESS',
    order: 3,
    hidden: false,
    heading: { he: 'כך אנחנו עובדים', en: 'How we work' },
    intro: {
      he: 'התהליך המלא מורכב מאחד־עשר שלבים. כך הוא נראה מלמעלה.',
      en: 'The full process has eleven stages. This is how it looks from above.',
    },
    items: [
      {
        id: 'ph-1',
        title: { he: 'בדיקה', en: 'Review' },
        body: {
          he: 'בחינה ראשונית של המתחם ובדיקת ההיתכנות.',
          en: 'An initial look at the complex, and a feasibility review.',
        },
      },
      {
        id: 'ph-2',
        title: { he: 'התארגנות', en: 'Organising' },
        body: {
          he: 'ארגון בעלי הדירות והקמת נציגות שתייצג אותם.',
          en: 'Organising the owners and forming a representation to act for them.',
        },
      },
      {
        id: 'ph-3',
        title: { he: 'בחירת אנשי מקצוע ויזם', en: 'Choosing professionals and a developer' },
        body: {
          he: 'מינוי אנשי המקצוע, בחינת חלופות ובחירת היזם.',
          en: 'Appointing the professionals, reviewing alternatives, selecting the developer.',
        },
      },
      {
        id: 'ph-4',
        title: { he: 'תכנון וקידום', en: 'Planning and approvals' },
        body: {
          he: 'הסכמים, תכנון הפרויקט וקידומו מול הרשויות.',
          en: 'Agreements, project design, and advancing it with the authorities.',
        },
      },
      {
        id: 'ph-5',
        title: { he: 'מימוש ואכלוס', en: 'Delivery' },
        body: {
          he: 'היתר, ביצוע, מסירה וחזרה לבתים החדשים.',
          en: 'Permit, construction, handover and moving into the new homes.',
        },
      },
    ],
  },


  /* 4.5 ── CITY BAND — the light rail ─────────────────────────────────── */
  {
    id: 'home-city-rail',
    type: 'MEDIA',
    order: 4,
    hidden: false,
    slotId: 'JERUSALEM_LIGHT_RAIL',
    assets: [],
    caption: {
      he: 'ירושלים משתנה — תשתיות, תחבורה ומרקם מגורים. אופן־דור פועלת בתוך העיר הזאת, ואינה קשורה לפרויקטים העירוניים שבתמונה.',
      en: 'Jerusalem is changing — infrastructure, transport and residential fabric. OpenDoor works inside this city, and is not connected to the municipal projects pictured.',
    },
  },

  /* 5 ── PROJECTS ─────────────────────────────────────────────────────── */
  {
    id: 'home-projects',
    type: 'PROJECTS',
    order: 5,
    hidden: false,
    heading: { he: 'פרויקטים', en: 'Projects' },
    intro: {
      he: 'מתחמים שאופן־דור מלווה ומארגנת.',
      en: 'Complexes OpenDoor accompanies and organises.',
    },
    limit: 3,
  },

  /* 6 ── PROJECT TRANSPARENCY ─────────────────────────────────────────── */
  {
    id: 'home-transparency',
    type: 'PROJECT_TRANSPARENCY',
    order: 6,
    hidden: false,
    heading: {
      he: 'לדעת איפה הפרויקט עומד — ומה השלב הבא',
      en: 'Knowing where the project stands — and what comes next',
    },
    intro: {
      he: 'המערכת הדיגיטלית של אופן־דור נבנית כדי שבעלי הדירות יוכלו לעקוב אחר התקדמות הפרויקט, המסמכים, העדכונים והפגישות — בלי לחכות לשיחת טלפון. התצוגה שלהלן היא הדגמה של המבנה, ואינה מתארת פרויקט קיים.',
      en: 'OpenDoor\u2019s digital system is being built so owners can follow the project\u2019s progress, documents, updates and meetings without waiting for a phone call. The view below demonstrates the structure and does not describe an existing project.',
    },
    items: [
      {
        id: 'tr-completed',
        title: { he: 'הושלם', en: 'Completed' },
        body: {
          he: 'שלבים שהסתיימו, עם התיעוד שנוצר בהם.',
          en: 'Stages that finished, with the documentation they produced.',
        },
      },
      {
        id: 'tr-current',
        title: { he: 'השלב הנוכחי', en: 'Current stage' },
        body: {
          he: 'מה קורה עכשיו, ומה נדרש מבעלי הדירות בשלב הזה.',
          en: 'What is happening now, and what is asked of owners at this stage.',
        },
      },
      {
        id: 'tr-next',
        title: { he: 'הבא בתור', en: 'Next' },
        body: {
          he: 'נקודת ההחלטה הבאה, כדי שאף אחד לא מופתע.',
          en: 'The next decision point, so nobody is taken by surprise.',
        },
      },
    ],
  },

  /* 7 ── RESIDENT PORTAL / REPRESENTATION ─────────────────────────────── */
  {
    id: 'home-portal',
    type: 'PORTAL',
    order: 7,
    hidden: false,
    heading: {
      he: 'שקיפות שממשיכה גם אחרי האתר',
      en: 'Transparency that continues past the website',
    },
    intro: {
      he: 'לכל בעל דירה יש סביבה אישית לפרויקט שלו. לחברי הנציגות יש בנוסף סביבת עבודה לניהול ההחלטות והמשימות.',
      en: 'Every owner has a personal area for their project. Representation members also get a working environment for decisions and tasks.',
    },
    buildNotice: {
      he: 'הסביבה הדיגיטלית נמצאת בבנייה. חלק מהיכולות המתוארות כאן טרם זמינות.',
      en: 'The digital environment is under construction. Some of the capabilities described here are not yet available.',
    },
    /**
     * The interface demonstration.
     *
     * ── EVERY STRING HERE IS DELIBERATELY GENERIC ─────────────────────────
     *
     * "הפרויקט שלי" instead of a project name. No address, no building, no
     * resident, no date, no number. The demo shows the SHAPE of the resident's
     * view — which is a truthful thing to show about software being built —
     * and it carries a permanent "תצוגה לדוגמה" badge so the frame cannot be
     * read as a live account belonging to a real project.
     *
     * The stage list matches the public process above it on purpose: a visitor
     * should recognise the same five stages they just read about, now as the
     * thing they would personally follow.
     */
    demo: {
      label: { he: 'תצוגה לדוגמה', en: 'Illustrative view' },
      projectLabel: { he: 'הפרויקט שלי', en: 'My project' },
      stages: [
        { id: 'd-1', state: 'completed', title: { he: 'התארגנות', en: 'Organising' } },
        { id: 'd-2', state: 'completed', title: { he: 'נציגות', en: 'Representation' } },
        { id: 'd-3', state: 'current', title: { he: 'בחינת חלופות', en: 'Reviewing alternatives' } },
        { id: 'd-4', state: 'upcoming', title: { he: 'בחירת יזם', en: 'Selecting a developer' } },
        { id: 'd-5', state: 'upcoming', title: { he: 'תכנון', en: 'Planning' } },
      ],
      panels: [
        {
          id: 'd-latest',
          label: { he: 'העדכון האחרון', en: 'Latest update' },
          value: { he: 'נוסף סיכום פגישת נציגות', en: 'A representation meeting summary was added' },
        },
        {
          id: 'd-next',
          label: { he: 'השלב הבא', en: 'Next stage' },
          value: { he: 'בחינת ההצעות שהתקבלו', en: 'Reviewing the proposals received' },
        },
        {
          id: 'd-action',
          label: { he: 'נדרשת פעולה מכם?', en: 'Anything asked of you?' },
          value: { he: 'לא נדרשת פעולה כרגע', en: 'Nothing is required right now' },
        },
      ],
      tabs: [
        { he: 'מסמכים', en: 'Documents' },
        { he: 'עדכונים', en: 'Updates' },
        { he: 'פגישות', en: 'Meetings' },
      ],
      representation: {
        label: { he: 'תצוגת נציגות', en: 'Representation view' },
        items: [
          {
            id: 'dr-decisions',
            label: { he: 'החלטות פתוחות', en: 'Open decisions' },
            value: { he: 'ממתינות להכרעת הנציגות', en: 'Awaiting the representation’s resolution' },
          },
          {
            id: 'dr-tasks',
            label: { he: 'משימות', en: 'Tasks' },
            value: { he: 'מחולקות בין חברי הנציגות', en: 'Divided among representation members' },
          },
          {
            id: 'dr-milestones',
            label: { he: 'אבני דרך', en: 'Milestones' },
            value: { he: 'מה הושלם ומה לפנינו', en: 'What is complete and what lies ahead' },
          },
          {
            id: 'dr-items',
            label: { he: 'נושאים פתוחים', en: 'Open items' },
            value: { he: 'נושאים שטרם נסגרו', en: 'Matters not yet closed' },
          },
        ],
      },
    },

    groups: [
      {
        id: 'pg-resident',
        audience: { he: 'לכל בעלי הדירות', en: 'For every owner' },
        title: { he: 'תיק הדייר', en: 'Resident area' },
        items: [
          { he: 'סטטוס הפרויקט והשלב הנוכחי', en: 'Project status and current stage' },
          { he: 'מסמכים שרלוונטיים לדירה שלכם', en: 'Documents relevant to your apartment' },
          { he: 'עדכונים מהשטח', en: 'Updates from the project' },
          { he: 'פגישות ואישורי הגעה', en: 'Meetings and RSVPs' },
          { he: 'מה נדרש מכם, אם נדרש', en: 'What is asked of you, if anything' },
        ],
      },
      {
        id: 'pg-representative',
        audience: { he: 'לחברי הנציגות', en: 'For representation members' },
        title: { he: 'סביבת הנציגות', en: 'Representation workspace' },
        items: [
          { he: 'החלטות פתוחות שממתינות להכרעה', en: 'Open decisions awaiting resolution' },
          { he: 'משימות הנציגות', en: 'Representation tasks' },
          { he: 'אבני דרך בפרויקט', en: 'Project milestones' },
          { he: 'פגישות וסיכומים', en: 'Meetings and summaries' },
          { he: 'נושאים פתוחים', en: 'Open items' },
        ],
      },
    ],
  },

  /* 8 ── TRUST ────────────────────────────────────────────────────────── */
  {
    id: 'home-trust',
    type: 'TRUST',
    order: 8,
    hidden: false,
    heading: { he: 'איך אנחנו עובדים בפועל', en: 'How we actually work' },
    intro: {
      he: 'אמון נבנה מתהליך ברור, לא מהצהרות. אלה הדברים שאנחנו מסבירים במלואם.',
      en: 'Trust comes from a clear process, not from claims. These are the things we explain in full.',
    },
    items: [
      {
        id: 'tc-decisions',
        title: { he: 'איך מתקבלות החלטות', en: 'How decisions are made' },
        body: { he: 'מי מחליט, על מה, ומתי הנושא מובא לכלל בעלי הדירות.', en: 'Who decides what, and when a matter goes to all owners.' },
      },
      {
        id: 'tc-updates',
        title: { he: 'איך מתעדכנים', en: 'How you stay updated' },
        body: { he: 'באילו ערוצים מגיע מידע, ובאיזו תדירות.', en: 'Which channels carry information, and how often.' },
      },
      {
        id: 'tc-representation',
        title: { he: 'תפקיד הנציגות', en: 'The role of the representation' },
        body: { he: 'מה הנציגות מוסמכת לעשות, ומה נשאר בידי בעלי הדירות.', en: 'What the representation may do, and what stays with the owners.' },
      },
      {
        id: 'tc-professionals',
        title: { he: 'בחירת אנשי מקצוע', en: 'Selecting professionals' },
        body: { he: 'איך נבחרים עורכי דין, שמאים ואדריכלים, ומי מייצג את מי.', en: 'How lawyers, appraisers and architects are chosen, and who represents whom.' },
      },
      {
        id: 'tc-privacy',
        title: { he: 'פרטיות ואבטחת מידע', en: 'Privacy and information security' },
        body: { he: 'איזה מידע נשמר, מי רשאי לראות אותו, ואיך הוא מוגן.', en: 'What is stored, who may see it, and how it is protected.' },
      },
      {
        id: 'tc-sources',
        title: { he: 'מקורות מידע מקצועיים', en: 'Professional information sources' },
        body: { he: 'הפניות למקורות רשמיים, כדי שתוכלו לבדוק בעצמכם.', en: 'Pointers to official sources, so you can check for yourself.' },
      },
    ],
  },

  /* 9 ── KNOWLEDGE ────────────────────────────────────────────────────── */
  {
    id: 'home-knowledge',
    type: 'KNOWLEDGE',
    order: 9,
    hidden: false,
    heading: { he: 'מרכז ידע', en: 'Knowledge centre' },
    intro: {
      he: 'הסברים על התהליך, התפקידים והזכויות — בשפה ברורה, בלי הבטחות.',
      en: 'Explanations of the process, the roles and the rights — in plain language, without promises.',
    },
    limit: 3,
  },

  /* 10 ── FAQ ─────────────────────────────────────────────────────────── */
  {
    id: 'home-faq',
    type: 'FAQ',
    order: 10,
    hidden: false,
    heading: { he: 'שאלות שחוזרות', en: 'Questions we are asked' },
    limit: 5,
  },

  /* 11 ── FINAL CTA ───────────────────────────────────────────────────── */
  {
    id: 'home-cta',
    type: 'CTA',
    order: 11,
    hidden: false,
    heading: {
      he: 'רוצים להבין מה האפשרויות בבניין שלכם?',
      en: 'Want to understand the options for your building?',
    },
    body: {
      he: 'בדיקת ההתאמה אורכת כמה דקות, ואינה מחייבת בשום שלב.',
      en: 'The suitability check takes a few minutes and commits you to nothing.',
    },
    ctaLabel: { he: 'בדיקת התאמה להתחדשות עירונית', en: "Check your building's suitability" },
    ctaHref: '/eligibility',
  },
]

export const MOCK_PAGES: readonly CmsPage[] = [
  {
    id: 'page-home',
    slug: 'home',
    title: { he: 'אופן־דור גרופ', en: 'OpenDoor Group' },
    publishState: 'published',
    blocks: homepageBlocks,
    seo: {
      he: {
        title: 'אופן־דור גרופ — ייצוג וארגון בעלי דירות בהתחדשות עירונית',
        description:
          'אופן־דור גרופ מייצגת ומארגנת בעלי דירות בתהליכי התחדשות עירונית — מהבדיקה הראשונית ועד למימוש הפרויקט.',
      },
      en: {
        title: 'OpenDoor Group — representing apartment owners in urban renewal',
        description:
          'OpenDoor Group represents and organises apartment owners through urban-renewal processes, from the initial review to realising the project.',
      },
    },
    updatedAt: '2026-08-27T00:00:00.000Z',
    updatedByName: 'Mock content',
  },
] as const
