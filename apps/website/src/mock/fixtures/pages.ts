import type { CmsPage, PageBlock } from '@urban-renewal/api-contracts'

/**
 * MOCK DATA — replaced by the CMS in Phase 2.
 *
 * ── WHY PAGES ARE DATA, NOT JSX ────────────────────────────────────────────
 *
 * The requirement is that the entire public site be editable without touching
 * source. That is only achievable if a page's CONTENT and its RENDERING are
 * separate from the start. Blocks defined as data here render through a fixed
 * set of components; swapping this file for a CMS response changes nothing in
 * the renderer.
 *
 * Building the pages as JSX first and "extracting a CMS later" does not work in
 * practice — by then copy, layout and conditionals are entangled, and the
 * extraction is a rewrite.
 *
 * ── NO STATISTICS, ANYWHERE ────────────────────────────────────────────────
 *
 * There is no block here containing a number about the company: no project
 * count, no years of experience, no resident total, no satisfaction figure, no
 * testimonial, no partner. Not as placeholder, not as "0", not hidden. Those
 * must not exist until verified data is supplied.
 */

const homepageBlocks: PageBlock[] = [
  {
    id: 'home-hero',
    type: 'HERO',
    order: 0,
    hidden: false,
    heading: {
      he: 'אופן־דור גרופ מייצגת ומארגנת בעלי דירות בהתחדשות עירונית',
      en: 'OpenDoor Group represents and organises apartment owners in urban renewal',
    },
    subheading: {
      he: 'מהבדיקה הראשונית, דרך ניהול התהליך ובחירת היזם המתאים, ועד למימוש הפרויקט.',
      en: 'From the initial review, through managing the process and selecting the right developer, to realising the project.',
    },
    primaryCtaLabel: { he: 'בדיקת התאמה להתחדשות עירונית', en: "Check your building's suitability" },
    primaryCtaHref: '/eligibility',
    secondaryCtaLabel: { he: 'למה חברה מארגנת?', en: 'Why an organising company?' },
    secondaryCtaHref: '/why-organizer',
  },
  {
    id: 'home-why-organizer',
    type: 'FEATURE_GRID',
    order: 1,
    hidden: false,
    heading: { he: 'למה חברה מארגנת?', en: 'Why an organising company?' },
    intro: {
      he: 'לכל גורם בתהליך יש תפקיד אחר. אופן־דור מייצגת ומארגנת את בעלי הדירות.',
      en: 'Each participant in the process has a different role. OpenDoor represents and organises the apartment owners.',
    },
    items: [
      {
        id: 'wo-representation',
        icon: 'users',
        title: { he: 'ייצוג מאורגן', en: 'Organised representation' },
        body: {
          he: 'בעלי דירות מגיעים לשולחן מאורגנים, עם מידע מסודר ועמדה משותפת.',
          en: 'Owners come to the table organised, with structured information and a shared position.',
        },
      },
      {
        id: 'wo-management',
        icon: 'clipboard-list',
        title: { he: 'ניהול מקצועי של התהליך', en: 'Professional process management' },
        body: {
          he: 'ריכוז העבודה מול עורכי דין, שמאים, אדריכלים ורשויות — במקום שכל בעל דירה יתמודד לבד.',
          en: 'Coordinating lawyers, appraisers, architects and authorities, rather than leaving each owner alone.',
        },
      },
      {
        id: 'wo-developer',
        icon: 'scale',
        title: { he: 'בחינת חלופות ובחירת יזם', en: 'Comparing options and selecting a developer' },
        body: {
          he: 'השוואה מסודרת בין חלופות, כדי שההחלטה תתקבל על בסיס מידע ולא על בסיס פנייה בודדת.',
          en: 'A structured comparison, so the decision rests on information rather than on a single approach.',
        },
      },
      {
        id: 'wo-transparency',
        icon: 'eye',
        title: { he: 'שקיפות לאורך הדרך', en: 'Transparency throughout' },
        body: {
          he: 'בעלי הדירות יודעים באיזה שלב הפרויקט נמצא, מה קרה לאחרונה ומה הפעולה הבאה.',
          en: 'Owners know what stage the project is at, what happened recently and what comes next.',
        },
      },
    ],
  },
  {
    id: 'home-process',
    type: 'PROCESS',
    order: 2,
    hidden: false,
    heading: { he: 'כך אנחנו עובדים', en: 'How we work' },
    intro: {
      he: 'התהליך בנוי משלבים. בכל שלב ברור מה קורה, מה מצופה מבעלי הדירות ומהי נקודת ההחלטה הבאה.',
      en: 'The process is built in stages. At each one it is clear what happens, what is expected of owners, and what the next decision point is.',
    },
    // Four representative stages, not all eleven — the homepage summarises and
    // links onward; /how-we-work carries the full sequence.
    items: [
      {
        id: 'pr-1',
        title: { he: 'בדיקה ראשונית', en: 'Initial review' },
        body: {
          he: 'בחינה ראשונית של המתחם והתאמתו לתהליך התחדשות עירונית.',
          en: 'A first look at the complex and its suitability for an urban-renewal process.',
        },
      },
      {
        id: 'pr-2',
        title: { he: 'התארגנות והקמת נציגות', en: 'Organising and forming a representation' },
        body: {
          he: 'ארגון בעלי הדירות ובחירת נציגות שתייצג אותם מול שאר הגורמים.',
          en: 'Organising the owners and electing a representation to act for them.',
        },
      },
      {
        id: 'pr-3',
        title: { he: 'בחינת יזמים ובחירה', en: 'Reviewing and selecting a developer' },
        body: {
          he: 'השוואה בין חלופות וניהול משא ומתן מטעם בעלי הדירות.',
          en: 'Comparing alternatives and negotiating on behalf of the owners.',
        },
      },
      {
        id: 'pr-4',
        title: { he: 'תכנון, היתר וביצוע', en: 'Planning, permit and construction' },
        body: {
          he: 'ליווי הפרויקט בשלבי התכנון והרישוי ועד למסירה.',
          en: 'Accompanying the project through planning and licensing to handover.',
        },
      },
    ],
  },
  {
    id: 'home-projects',
    type: 'PROJECTS',
    order: 3,
    hidden: false,
    heading: { he: 'פרויקטים', en: 'Projects' },
    limit: 3,
  },
  {
    id: 'home-knowledge',
    type: 'KNOWLEDGE',
    order: 4,
    hidden: false,
    heading: { he: 'מרכז ידע', en: 'Knowledge centre' },
    intro: {
      he: 'הסברים על התהליך, התפקידים והזכויות — בשפה ברורה.',
      en: 'Explanations of the process, the roles and the rights, in plain language.',
    },
    limit: 3,
  },
  {
    id: 'home-cta',
    type: 'CTA',
    order: 5,
    hidden: false,
    heading: { he: 'רוצים לבדוק אם הבניין שלכם מתאים?', en: 'Want to check whether your building is suitable?' },
    body: {
      he: 'בדיקת ההתאמה אורכת דקות ואינה מחייבת דבר.',
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
