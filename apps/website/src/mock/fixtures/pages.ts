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
 * The personal area for owners is live, so the homepage describes it in the
 * present tense. The representation workspace is not, and the homepage leaves
 * it out rather than describing it. A marketing page that describes unbuilt
 * software in the present tense is the same category of untruth as an invented
 * statistic.
 */

/**
 * ── THE HOMEPAGE IS A FRONT DOOR, NOT THE WHOLE HOUSE ──────────────────────
 *
 * Until 2026-10 this page carried twelve sections and every argument the site
 * makes, in full. The design review measured it at eleven phone screens and
 * about 690 words, with the same facts repeated word for word on /about. It
 * now says one thing per section, in a line or two, and points to the page
 * where each idea is stated in full: who we are on /about, why owners organise
 * on /why-organizer, the eight stages on /how-we-work. A sentence lives in one
 * place; everywhere else it gets at most a line and a link.
 */
const homepageBlocks: PageBlock[] = [
  /* 1 ── HERO ─────────────────────────────────────────────────────────── */
  {
    id: 'home-hero',
    type: 'HERO',
    order: 0,
    hidden: false,
    heading: {
      he: 'הבניין מתחדש. אתם במרכז.',
      en: 'A new chapter for your building. Led by you.',
    },
    subheading: {
      he: 'OpenDoor Group היא חברת יזמות והתחדשות עירונית בירושלים והסביבה. אנחנו מארגנים את בעלי הדירות, מביאים לשולחן את האנשים הנכונים, ומקדמים גם פרויקטים שנתקעו. אתם מחליטים.',
      en: 'OpenDoor Group is an urban renewal and development company in and around Jerusalem. We organise the owners, bring the right people to the table, and move stalled projects forward too. You decide.',
    },
    primaryCtaLabel: {
      he: 'דברו איתנו על הבניין שלכם',
      en: "Talk to us about your building",
    },
    primaryCtaHref: '/eligibility',
    secondaryCtaLabel: { he: 'אזור אישי', en: 'Personal area' },
    secondaryCtaHref: '/portal',
    // No `note`: who pays is stated once on this page, in the facts below.
  },

  /* 2 ── THREE DOORS ─────────────────────────────────────────────────── */
  /**
   * Where each argument is stated in full. A door's line says what is behind
   * it and nothing more: the page behind it makes the case.
   */
  {
    id: 'home-doors',
    type: 'DOORS',
    order: 1,
    hidden: false,
    heading: { he: 'מאיפה להתחיל', en: 'Where to start' },
    doors: [
      {
        id: 'door-about',
        art: 'side',
        title: { he: 'מי אנחנו', en: 'Who we are' },
        body: {
          he: 'יזמות והתחדשות עירונית, עם בעלי הדירות במרכז.',
          en: 'Urban renewal and development, with the owners at the centre.',
        },
        linkLabel: { he: 'הכירו אותנו', en: 'Meet us' },
        href: '/about',
      },
      {
        id: 'door-why',
        art: 'organise',
        title: { he: 'למה חברה מארגנת', en: 'Why an organising company' },
        body: {
          he: 'מה משתנה כשבעלי הדירות מאורגנים.',
          en: 'What changes when the owners are organised.',
        },
        linkLabel: { he: 'למה זה חשוב', en: 'Why it matters' },
        href: '/why-organizer',
      },
      {
        id: 'door-how',
        art: 'route',
        title: { he: 'כך אנחנו עובדים', en: 'How we work' },
        body: {
          he: 'שלב אחרי שלב, ומה נדרש מכם בכל אחד.',
          en: 'Stage by stage, and what each one asks of you.',
        },
        linkLabel: { he: 'לכל השלבים', en: 'All the stages' },
        href: '/how-we-work',
      },
    ],
  },

  /* 3 ── HOW WE WORK, AT A GLANCE ─────────────────────────────────────── */
  {
    // The shape of the route, not its detail: a few words per stage, and a
    // link to the eight stages on /how-we-work. Each line is cut from that
    // page's text for the stage, or from the homepage's earlier wording.
    id: 'home-process',
    type: 'PROCESS',
    order: 2,
    hidden: false,
    heading: {
      he: 'מהרגע שיזם הגיע לבניין ועד המפתח',
      en: 'From the day a developer comes to your building to the keys',
    },
    linkLabel: { he: 'לכל שמונת השלבים', en: 'All eight stages' },
    linkHref: '/how-we-work',
    items: [
      {
        id: 'ph-1',
        icon: 'search',
        title: { he: 'בדיקה', en: 'Review' },
        body: { he: 'בלי התחייבות מצדכם.', en: 'No commitment on your part.' },
      },
      {
        id: 'ph-2',
        icon: 'users',
        title: { he: 'התארגנות', en: 'Organising' },
        body: { he: 'נציגות מתוך בעלי הדירות.', en: 'A representation chosen from the owners.' },
      },
      {
        id: 'ph-3',
        icon: 'scale',
        title: { he: 'בחירת אנשי מקצוע ויזם', en: 'Choosing professionals and a developer' },
        body: { he: 'הבחירה של בעלי הדירות.', en: 'The owners’ choice.' },
      },
      {
        id: 'ph-4',
        icon: 'clipboard',
        title: { he: 'תכנון וקידום', en: 'Planning and approvals' },
        body: { he: 'הסכמים, תכנון ורשויות.', en: 'Agreements, design, the authorities.' },
      },
      {
        id: 'ph-5',
        icon: 'key',
        title: { he: 'מימוש ואכלוס', en: 'Delivery' },
        body: { he: 'מסירה וחזרה לבית החדש.', en: 'Handover, and home again.' },
      },
    ],
  },

  /* 4 ── THE PEOPLE WE BRING ─────────────────────────────────────────── */
  /**
   * The company's partners, by role, as the company describes them, and the
   * professionals it can recommend (2026-10-06). No firm is named: names wait
   * for each firm's written agreement. The recommendation line keeps the
   * owners' choice in the same sentence.
   */
  {
    id: 'home-network',
    type: 'NETWORK',
    order: 3,
    hidden: false,
    heading: { he: 'האנשים שאנחנו מביאים לשולחן', en: 'The people we bring to the table' },
    intro: {
      he: 'פרויקט התחדשות עירונית טוב כמו האנשים שעובדים עליו. בנינו קשרי עבודה קרובים עם יזמים גדולים ומבוססים, עם משרדי אדריכלים מובילים ועם בודקי בית מנוסים.',
      en: 'An urban-renewal project is as good as the people working on it. We have built close working relationships with large, established developers, leading architecture firms and experienced home inspectors.',
    },
    items: [
      {
        id: 'net-developers',
        icon: 'building',
        title: { he: 'יזמים', en: 'Developers' },
        body: {
          he: 'חברות חזקות, עם ניסיון בפרויקטים דומים ויכולת לממן אותם. כך ההצעות שמגיעות אליכם רציניות מההתחלה.',
          en: 'Strong companies with experience of similar projects and the means to finance them, so the offers you receive are serious from the start.',
        },
      },
      {
        id: 'net-architects',
        icon: 'drafting',
        title: { he: 'אדריכלים', en: 'Architects' },
        body: {
          he: 'משרדים שמכירים את התכנון בירושלים, ויודעים לתכנן בניין שמתאים גם לבעלי הדירות וגם לדרישות הוועדה.',
          en: 'Firms that know planning in Jerusalem, and can design a building that suits both the owners and the planning committee.',
        },
      },
      {
        id: 'net-inspectors',
        icon: 'home-check',
        title: { he: 'בודקי בית', en: 'Home inspectors' },
        body: {
          he: 'בדיקה מקצועית של הדירה החדשה לפני קבלת המפתח, כדי שתקבלו בדיוק את מה שהובטח.',
          en: 'A professional inspection of the new apartment before you take the keys, so you receive exactly what was promised.',
        },
      },
    ],
    note: {
      he: 'כאנשים מהתחום, אנחנו יכולים גם להמליץ לכם על שמאים, עורכי דין ואדריכלים שאנחנו מכירים. ההמלצה היא רק המלצה: אתם בוחרים, ואנשי המקצוע פועלים מטעמכם.',
      en: 'As people in the field, we can also recommend appraisers, lawyers and architects we know. A recommendation is only that: you choose, and the professionals act for you.',
    },
  },

  /* 5 ── THE FACTS, ONE LINE EACH ─────────────────────────────────────── */
  /**
   * The short form of /about's "מה שאפשר לבדוק עלינו", which is the one place
   * the facts appear in full. Each line here is that page's wording cut down.
   *
   * Since 2026-10-06 the company is the developer in some projects and the
   * owners' organiser in others, so the strip no longer says "what we are
   * not" or who pays: it says the role rule instead, and who pays is stated
   * on /about, where it can be said for each role.
   *
   * The company number is literal copy rather than read from `site-config`:
   * this is editorial text a person may reword in the CMS.
   */
  {
    id: 'home-facts',
    type: 'FACT_STRIP',
    order: 4,
    hidden: false,
    // Read by screen readers as the strip's heading; the titles are visible.
    heading: { he: 'עובדות על החברה', en: 'Facts about the company' },
    linkLabel: { he: 'מה שאפשר לבדוק עלינו', en: 'What you can check about us' },
    linkHref: '/about#about-facts',
    items: [
      {
        id: 'vf-registered',
        icon: 'building',
        title: { he: 'חברה רשומה', en: 'A registered company' },
        body: {
          he: 'קבוצת אופן דור יזמות והתחדשות בע״מ, ח.פ. 515856334.',
          en: 'Kvutsat OpenDoor Yazamut VeHithadshut Ltd., company number 515856334.',
        },
      },
      {
        id: 'vf-role',
        icon: 'document-check',
        title: { he: 'התפקיד שלנו, בגלוי', en: 'Our role, in the open' },
        body: {
          he: 'בכל פרויקט אומרים מראש אם אנחנו היזם או המארגנים, וזה כתוב בהסכם.',
          en: 'In every project we say up front whether we are the developer or the organiser, and it is written into the agreement.',
        },
      },
      {
        id: 'vf-professionals',
        icon: 'users',
        title: { he: 'אנשי מקצוע מטעמכם', en: 'Professionals on your side' },
        body: {
          he: 'עורך הדין והשמאי של בעלי הדירות נבחרים על ידכם.',
          en: 'The owners’ lawyer and appraiser are chosen by you.',
        },
      },
    ],
  },

  /* 6 ── THE PERSONAL AREA ────────────────────────────────────────────── */
  {
    id: 'home-portal',
    type: 'PORTAL',
    order: 5,
    hidden: false,
    heading: { he: 'האזור האישי', en: 'The personal area' },
    intro: {
      he: 'איפה הפרויקט עומד, מה השלב הבא, והמסמכים שלכם, בלי לחכות לשיחת טלפון.',
      en: 'Where the project stands, what comes next, and your documents, without waiting for a phone call.',
    },
    ctaLabel: { he: 'כניסה לאזור האישי', en: 'Go to the personal area' },
    ctaHref: '/portal',
    /**
     * The interface demonstration.
     *
     * ── EVERY STRING HERE IS DELIBERATELY GENERIC ─────────────────────────
     *
     * "הפרויקט שלי" instead of a project name. No address, no building, no
     * resident, no date, no number. The demo shows the SHAPE of the owner's
     * view, which is a truthful thing to show about live software, and it
     * carries a permanent "תצוגה לדוגמה" badge so the frame cannot be read as
     * a live account belonging to a real project.
     *
     * Owners only: the representation workspace is still being built, and the
     * homepage describes what an owner gets today.
     */
    demo: {
      label: { he: 'תצוגה לדוגמה', en: 'Illustrative view' },
      projectLabel: { he: 'הפרויקט שלי', en: 'My project' },
      stages: [
        { id: 'd-1', state: 'completed', title: { he: 'התארגנות', en: 'Organising' } },
        { id: 'd-2', state: 'completed', title: { he: 'נציגות', en: 'Representation' } },
        {
          id: 'd-3',
          state: 'current',
          title: { he: 'בחינת חלופות', en: 'Reviewing alternatives' },
        },
        { id: 'd-4', state: 'upcoming', title: { he: 'בחירת יזם', en: 'Selecting a developer' } },
        { id: 'd-5', state: 'upcoming', title: { he: 'תכנון', en: 'Planning' } },
      ],
      panels: [
        {
          id: 'd-latest',
          label: { he: 'העדכון האחרון', en: 'Latest update' },
          value: {
            he: 'נוסף סיכום פגישת נציגות',
            en: 'A representation meeting summary was added',
          },
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
    },
    groups: [],
  },

  /* 7 ── PROJECTS: hidden until the first one is published ───────────── */
  {
    // Hidden, not deleted: the projects page is empty today, and a homepage
    // section that leads to an empty page is a promise it cannot keep. Unhide
    // it in the CMS when the first project is published, and put "פרויקטים"
    // back in PRIMARY_NAV_KEYS (lib/navigation.ts) at the same time.
    id: 'home-projects',
    type: 'PROJECTS',
    order: 6,
    hidden: true,
    heading: { he: 'פרויקטים', en: 'Projects' },
    intro: {
      he: 'פרויקטים שבהם אנחנו היזם, ומתחמים שאנחנו מארגנים ומלווים.',
      en: 'Projects where we are the developer, and complexes we organise and support.',
    },
    limit: 3,
  },

  /* 8 ── FINAL CTA ────────────────────────────────────────────────────── */
  {
    id: 'home-cta',
    type: 'CTA',
    order: 7,
    hidden: false,
    heading: {
      he: 'רוצים לבדוק מה אפשרי אצלכם?',
      en: 'Want to see what is possible for you?',
    },
    body: {
      he: 'פנו אלינו לשיחה ראשונית על האפשרויות בבניין שלכם.',
      en: 'Contact us for an initial conversation about your building.',
    },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: "Talk to us about your building" },
    ctaHref: '/eligibility',
  },
]

export const MOCK_PAGES: readonly CmsPage[] = [
  {
    id: 'page-home',
    slug: 'home',
    title: { he: 'OpenDoor Group', en: 'OpenDoor Group' },
    publishState: 'published',
    blocks: homepageBlocks,
    seo: {
      he: {
        title: 'OpenDoor Group: יזמות והתחדשות עירונית בירושלים',
        description:
          'OpenDoor Group היא חברת יזמות והתחדשות עירונית בירושלים והסביבה. מארגנים את בעלי הדירות, מביאים לשולחן יזמים ואנשי מקצוע, ומקדמים גם פרויקטים שנתקעו.',
      },
      en: {
        title: 'OpenDoor Group: urban renewal and development in Jerusalem',
        description:
          'OpenDoor Group is an urban renewal and development company in and around Jerusalem. We organise apartment owners, bring developers and professionals to the table, and move stalled projects forward.',
      },
    },
    updatedAt: '2026-10-06T00:00:00.000Z',
    updatedByName: 'Mock content',
  },
] as const
