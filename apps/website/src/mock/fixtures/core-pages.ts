import type { CmsPage, PageBlock } from '@urban-renewal/api-contracts'
import { PORTAL_DEMO } from './portal-demo'

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
 *   1. JERUSALEM AND ITS SURROUNDINGS. The company decided on 2026-10-05 to
 *      present itself as working in Jerusalem and its surroundings, which is
 *      where its projects are. Say it plainly, never "only", and make no
 *      claim about other cities either way.
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
 *   5. WHO PAYS IS SAID PER ROLE. As the owners' organiser, the company is
 *      paid by the developer alone and owners pay it nothing directly (the
 *      two clauses legal review flagged; keep both). As the developer, it
 *      earns from the project itself. Stated in full on /about only. The
 *      developer-role sentence needs the company's and legal confirmation.
 *   6. ONE PLACE PER IDEA. Since the 2026-10 design review each approved text
 *      is stated in full on one page: the offer check on /services, the
 *      transparency text on /trust, "תפקידנו" on /why-organizer, the facts on
 *      /about. Elsewhere it gets at most a line and a link.
 *   7. TWO ROLES, SAID OPENLY (2026-10-06). The company is the developer in
 *      some projects and the owners' organiser in others. Nothing on the site
 *      says "we are not the developer"; every description of the company
 *      says which role it plays where, and that the role is written into the
 *      agreement. The owners' lawyer and appraiser are always theirs.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * /about
 * ══════════════════════════════════════════════════════════════════════════ */

const aboutBlocks: PageBlock[] = [
  {
    // Rebuilt on 2026-10-06 from the company's own text and the approved
    // design: who the company is and where it works, the action and the
    // phone, and Michael's face and one line where a stock photograph was.
    id: 'about-hero',
    type: 'PAGE_HERO',
    order: 0,
    hidden: false,
    eyebrow: { he: 'מי אנחנו', en: 'About us' },
    heading: {
      he: 'התחדשות עירונית מצליחה מתחילה באמון.',
      en: 'Successful urban renewal starts with trust.',
    },
    standfirst: {
      he: 'OpenDoor Group (קבוצת אופן דור יזמות והתחדשות בע״מ) פועלת בתחום ההתחדשות העירונית, עם התמחות בפרויקטי פינוי־בינוי. אנחנו עובדים בעיקר בירושלים והסביבה, מול בעלי דירות, יזמים, אנשי מקצוע ורשויות.',
      en: 'OpenDoor Group (Kvutsat OpenDoor Yazamut VeHithadshut Ltd.) works in urban renewal, specialising in evacuate-and-rebuild (pinui-binui) projects. We work mainly in and around Jerusalem, with apartment owners, developers, professionals and the authorities.',
    },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: 'Talk to us about your building' },
    ctaHref: '/eligibility',
    showPhone: true,
    visual: {
      kind: 'portrait',
      slotId: 'ABOUT_MICHAEL_PORTRAIT',
      quote: {
        he: '״בעלי דירות חזקים יותר כשהם מאורגנים.״',
        en: '“Owners are stronger when they are organised.”',
      },
      quoteBy: { he: 'מיכאל רוזנבך', en: 'Michael Rosenbach' },
    },
    points: [
      {
        id: 'about-pt-pinui',
        icon: 'building',
        title: { he: 'התמחות בפינוי־בינוי', en: 'Evacuate-and-rebuild specialists' },
        body: { he: 'מהבדיקה הראשונית ועד המסירה', en: 'From the first review to handover' },
      },
      {
        id: 'about-pt-area',
        icon: 'pin',
        title: { he: 'ירושלים והסביבה', en: 'Jerusalem and its surroundings' },
        body: {
          he: 'בעלי דירות, יזמים, אנשי מקצוע ורשויות',
          en: 'Owners, developers, professionals and the authorities',
        },
      },
      {
        id: 'about-pt-role',
        icon: 'document-check',
        title: { he: 'יזם או מארגנים, בגלוי', en: 'Developer or organiser, openly' },
        body: { he: 'אומרים מראש, וכותבים בהסכם', en: 'Said up front, and written into the agreement' },
      },
    ],
  },
  {
    id: 'about-models',
    type: 'MODELS',
    order: 1,
    hidden: false,
    heading: { he: 'שני מודלים של עבודה', en: 'Two ways of working' },
    items: [
      {
        id: 'model-developer',
        icon: 'building',
        title: { he: 'כשאנחנו היזם', en: 'When we are the developer' },
        body: {
          he: 'אנחנו מובילים את הפרויקט מהבדיקה הראשונית ועד המסירה. אנחנו בודקים את הכדאיות, מגבשים את התכנון, מחתימים את הדיירים ומלווים את הביצוע.',
          en: 'We lead the project from the first review to handover. We check viability, shape the plans, sign the residents and see construction through.',
        },
        highlight: {
          he: 'ההבדל אצלנו: הדיירים מקבלים את התמונה המלאה כבר מההתחלה, כולל מה הפרויקט צריך כדי להיות כדאי, ולמה.',
          en: 'What is different with us: residents get the full picture from the start, including what the project needs in order to be viable, and why.',
        },
      },
      {
        id: 'model-organiser',
        icon: 'users',
        title: { he: 'כשאנחנו מארגנים את בעלי הדירות', en: 'When we organise the owners' },
        body: {
          he: 'אנחנו מרכזים את הבעלים לנציגות מסודרת, אוספים את המידע הקנייני והתכנוני, ויוצאים לשוק כקבוצה מאורגנת ולא כאוסף של חתימות בודדות.',
          en: 'We bring the owners together into an orderly representation, gather the ownership and planning information, and go to the market as an organised group rather than a collection of individual signatures.',
        },
        highlight: {
          he: 'אנחנו בונים את הבסיס להשוואה בין הצעות, ובוחנים כל הצעה לפי מה שבאמת חשוב: תמורה, ערבויות, לוחות זמנים, ואיתנות היזם.',
          en: 'We build the basis for comparing offers, and examine each one by what really matters: consideration, guarantees, timelines and the developer’s strength.',
        },
      },
    ],
    note: {
      he: 'בכל פרויקט אומרים מראש באיזה מודל אנחנו עובדים, וזה כתוב בהסכם.',
      en: 'In every project we say up front which model we are working in, and it is written into the agreement.',
    },
  },
  {
    // The company's five checks, in its words. They replace the six-label
    // checklist /services used to carry; /services links here.
    id: 'about-checks',
    type: 'CHECKLIST',
    order: 2,
    hidden: false,
    heading: { he: 'מה אנחנו בודקים בהצעה', en: 'What we check in an offer' },
    items: [
      {
        id: 'check-consideration',
        icon: 'chart',
        label: { he: 'התמורה', en: 'The consideration' },
        body: {
          he: 'אם התמורה לדיירים נשענת על כדאיות כלכלית אמיתית, או על הנחות שיתפרקו בהמשך.',
          en: 'Whether the consideration for residents rests on real economic viability, or on assumptions that will fall apart later.',
        },
      },
      {
        id: 'check-guarantees',
        icon: 'shield',
        label: { he: 'הערבויות', en: 'The guarantees' },
        body: {
          he: 'מה מכסות הערבויות בפועל, ומתי הן נכנסות לתוקף.',
          en: 'What the guarantees actually cover, and when they take effect.',
        },
      },
      {
        id: 'check-timelines',
        icon: 'calendar',
        label: { he: 'לוחות הזמנים', en: 'The timelines' },
        body: {
          he: 'אם לוחות הזמנים ריאליים ביחס למצב התכנוני.',
          en: 'Whether the timelines are realistic given the planning status.',
        },
      },
      {
        id: 'check-developer',
        icon: 'building',
        label: { he: 'היזם', en: 'The developer' },
        body: {
          he: 'ניסיון היזם, היכולת הפיננסית שלו ופרויקטים קודמים.',
          en: 'The developer’s experience, financial capacity and previous projects.',
        },
      },
      {
        id: 'check-risks',
        icon: 'alert',
        label: { he: 'הסיכונים', en: 'The risks' },
        body: {
          he: 'מה הסעיפים שמעבירים סיכון מהיזם אל הדיירים.',
          en: 'Which clauses shift risk from the developer to the residents.',
        },
      },
    ],
  },
  {
    id: 'about-stuck',
    type: 'DIAGNOSIS',
    order: 3,
    hidden: false,
    heading: {
      he: 'איפה פרויקטים נתקעים, ואיך מחזירים אותם לתנועה',
      en: 'Where projects stall, and how to get them moving again',
    },
    lead: {
      he: 'רוב הפרויקטים נתקעים בגלל חוסר אמון, מידע חלקי, דיירים שלא מרגישים שמישהו מקשיב להם, או הצעה שלא הייתה כדאית מלכתחילה.',
      en: 'Most projects stall because of mistrust, partial information, residents who do not feel anyone is listening to them, or an offer that was never viable in the first place.',
    },
    body: {
      he: 'כשפרויקט נתקע, אנחנו מתחילים מאבחון: איפה בדיוק הבעיה, מי צריך לשמוע מה, ומה אפשר לתקן.',
      en: 'When a project stalls, we start with a diagnosis: where exactly the problem is, who needs to hear what, and what can be fixed.',
    },
    start: { he: 'אבחון', en: 'Diagnosis' },
    outcomes: [
      { id: 'outcome-offer', label: { he: 'תיקון בהצעה', en: 'Correcting the offer' } },
      { id: 'outcome-residents', label: { he: 'תהליך מחודש מול הדיירים', en: 'A fresh process with the residents' } },
      { id: 'outcome-partner', label: { he: 'שותף אחר', en: 'A different partner' } },
    ],
    caption: {
      he: 'לפעמים זה תיקון בהצעה, לפעמים זה תהליך מחודש מול הדיירים, ולפעמים זו ההבנה שצריך שותף אחר.',
      en: 'Sometimes it is a correction to the offer, sometimes a fresh process with the residents, and sometimes the realisation that a different partner is needed.',
    },
    linkLabel: { he: 'לעמוד הפרויקטים התקועים', en: 'Stalled projects' },
    linkHref: '/stalled-projects',
  },
  {
    // The company's four principles, in its words. They replace "העמדה
    // שלנו", whose three lines linked to texts on other pages.
    id: 'about-how-we-work',
    type: 'PRINCIPLES',
    order: 4,
    hidden: false,
    heading: { he: 'איך אנחנו עובדים', en: 'How we work' },
    items: [
      {
        id: 'pr-data',
        icon: 'files',
        title: { he: 'נתונים, לא הערכות', en: 'Data, not estimates' },
        body: {
          he: 'כל המלצה נשענת על בדיקה: נסח טאבו, מצב תכנוני ותחשיב כלכלי.',
          en: 'Every recommendation rests on checks: the land registry extract, the planning status and an economic calculation.',
        },
      },
      {
        id: 'pr-transparency',
        icon: 'eye',
        title: { he: 'שקיפות בתהליך', en: 'Transparency in the process' },
        body: {
          he: 'בעלי הדירות יודעים בכל שלב איפה הפרויקט עומד, מה נדרש ממי, ומה הצעד הבא.',
          en: 'Owners know at every stage where the project stands, what is required of whom, and what the next step is.',
        },
      },
      {
        id: 'pr-listening',
        icon: 'chat',
        title: { he: 'הקשבה לפני חתימה', en: 'Listening before signing' },
        body: {
          he: 'כל דייר מגיע עם שאלות, חששות ונסיבות משלו. אנחנו מתחילים משם.',
          en: 'Every resident comes with their own questions, worries and circumstances. We start there.',
        },
      },
      {
        id: 'pr-responsibility',
        icon: 'shield-check',
        title: { he: 'אחריות לאורך כל הדרך', en: 'Responsibility all the way' },
        body: {
          he: 'אנחנו לא נעלמים אחרי החתימות.',
          en: 'We do not disappear after the signatures.',
        },
      },
    ],
  },
  {
    // Michael's approved text, unchanged: the biography's first sentence is
    // visible, the full quotation and the rest open under "לקריאה נוספת".
    // The opening clause of the quotation is set large in the page's opening,
    // beside his photograph.
    id: 'about-michael',
    type: 'PROFILE',
    order: 5,
    hidden: false,
    name: { he: 'מיכאל רוזנבך', en: 'Michael Rosenbach' },
    summary: {
      he: 'מיכאל רוזנבך עוסק בהתחדשות עירונית בירושלים והסביבה, ומלווה בעלי דירות ונציגויות מול יזמים, אנשי מקצוע וחברות נדל״ן.',
      en: 'Michael Rosenbach works in urban renewal in and around Jerusalem, supporting owners and their representations in their dealings with developers, professionals and real-estate companies.',
    },
    quote: {
      he: '״בעלי דירות חזקים יותר כשהם מאורגנים, מבינים את הזכויות שלהם ומלווים על ידי מי שמכיר את השחקנים, את המספרים ואת התהליך, אבל מחויב קודם כל אליהם.״',
      en: '“Owners are stronger when they are organised, understand their rights and are supported by someone who knows the players, the numbers and the process — but is committed, first and foremost, to them.”',
    },
    body: {
      he: 'הוא בעל תואר במנהל עסקים עם התמחות במערכות מידע, ובעל רישיון תיווך. השילוב הזה מאפשר לו לקרוא הצעות ומסמכים בעין עסקית, להבין נתונים ומספרים, לבדוק שמה שמוצג בהצעה מעוגן בהתחייבויות, ולנהל את השיח בין בעלי הדירות, היזמים ואנשי המקצוע בצורה ברורה ומעשית.\n\nמיכאל יכול לעזור לכם להבין מה ההצעה כוללת, מה חסר בה, איפה נמצאים הסיכונים ומה הצעדים הבאים שכדאי לשקול, גם אם אתם כבר בתוך תהליך.',
      en: 'He holds a degree in business administration, specialising in information systems, and a real-estate broker’s licence. That combination lets him read offers and documents with a business eye, make sense of data and figures, check that what an offer presents is backed by commitments, and keep the conversation between owners, developers and professionals clear and practical.\n\nMichael can help you understand what an offer includes, what is missing from it, where the risks lie and which next steps are worth considering — even if you are already in a process.',
    },
    slotId: 'ABOUT_MICHAEL_PORTRAIT',
  },
  {
    // The one place on the site where the three facts appear in full. The
    // homepage cuts each to a line and links here.
    id: 'about-facts',
    type: 'VERIFIABLE_FACTS',
    order: 6,
    hidden: false,
    tone: 'inverse',
    heading: { he: 'מה שאפשר לבדוק עלינו', en: 'What you can check about us' },
    intro: {
      he: 'בלי ממוצעים ובלי הבטחות. עובדות שאפשר לאמת מול רשם החברות ומול ההסכם.',
      en: 'No averages and no promises. Facts you can verify at the registrar and in the agreement.',
    },
    items: [
      {
        id: 'about-vf-registered',
        icon: 'building',
        title: { he: 'מי אנחנו, רשמית', en: 'Who we are, officially' },
        body: {
          he: 'קבוצת אופן דור יזמות והתחדשות בע״מ, ח.פ. 515856334. חברה רשומה: אפשר לבדוק אותנו ברשם החברות לפני שמדברים איתנו.',
          en: 'Kvutsat OpenDoor Yazamut VeHithadshut Ltd., company number 515856334. A registered company — you can look us up before you speak to us.',
        },
      },
      {
        id: 'about-vf-role',
        icon: 'document-check',
        title: { he: 'התפקיד שלנו, בגלוי', en: 'Our role, in the open' },
        body: {
          he: 'בכל פרויקט אנחנו אומרים כבר בשיחה הראשונה אם אנחנו היזם או המארגנים מטעם בעלי הדירות, וזה כתוב בהסכם שתקבלו לידיים.',
          en: 'In every project we say in the first conversation whether we are the developer or the organiser acting for the owners, and it is written into the agreement you will hold.',
        },
      },
      {
        // Positioning rule 5. The organiser sentence is the legally reviewed
        // wording; the developer sentence awaits the company's confirmation.
        id: 'about-vf-who-pays',
        icon: 'receipt',
        title: { he: 'מי משלם לנו', en: 'Who pays us' },
        body: {
          he: 'כמארגנים: היזם בלבד, ובעלי הדירות אינם משלמים לחברה תשלום ישיר. כיזם: הרווח שלנו מגיע מהפרויקט עצמו. בשני המקרים זה כתוב בהסכם.',
          en: 'As organisers: the developer alone, and owners pay the company nothing directly. As the developer: we earn from the project itself. Either way, it is written into the agreement.',
        },
      },
      {
        id: 'about-vf-professionals',
        icon: 'users',
        title: { he: 'אנשי מקצוע מטעמכם', en: 'Professionals on your side' },
        body: {
          he: 'עורך הדין והשמאי של בעלי הדירות נבחרים על ידכם ופועלים רק בשבילכם. אנחנו יכולים להמליץ על אנשי מקצוע שאנחנו מכירים, והבחירה נשארת שלכם.',
          en: 'The owners’ lawyer and appraiser are chosen by you and act only for you. We can recommend professionals we know; the choice stays yours.',
        },
      },
    ],
  },
  {
    id: 'about-cta',
    type: 'CTA',
    order: 7,
    hidden: false,
    eyebrow: { he: 'השורה התחתונה', en: 'The bottom line' },
    heading: {
      he: 'המטרה שלנו היא שכל בעל דירה יבין את האפשרויות שלו, יתקדם בביטחון, ושהפרויקט ישרת גם את הדיירים וגם את עתיד השכונה.',
      en: 'Our aim is for every owner to understand their options and move forward with confidence, and for the project to serve both the residents and the future of the neighbourhood.',
    },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: 'Talk to us about your building' },
    ctaHref: '/eligibility',
  },
]

/* ══════════════════════════════════════════════════════════════════════════
 * /why-organizer
 * ══════════════════════════════════════════════════════════════════════════ */

const whyOrganizerBlocks: PageBlock[] = [
  {
    // The opening with the page's thesis drawn (approved 2026-10-06): the
    // header said it in words only, and the page opened without a visual.
    id: 'why-hero',
    type: 'PAGE_HERO',
    order: 0,
    hidden: false,
    eyebrow: { he: 'למה חברה מארגנת', en: 'Why an organising company' },
    heading: { he: 'למה בכלל צריך חברה מארגנת?', en: 'Why does an organising company matter?' },
    standfirst: {
      he: 'כי בתהליך התחדשות עירונית לכל צד יש תפקיד ואינטרס משלו, וזה טבעי. השאלה היא מי מארגן את הצד של בעלי הדירות.',
      en: 'Because every party in an urban-renewal process has a role and an interest of its own, which is entirely normal. The question is who organises the owners’ side.',
    },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: 'Talk to us about your building' },
    ctaHref: '/eligibility',
    visual: {
      kind: 'organise',
      before: {
        title: { he: 'בלי ארגון', en: 'Without organising' },
        body: { he: 'כל בעל דירה לבד מול התהליך', en: 'Each owner facing the process alone' },
      },
      after: {
        title: { he: 'עם ארגון', en: 'With organising' },
        body: {
          he: 'קבוצה אחת, עם נציגות, סביב שולחן אחד',
          en: 'One group, with a representation, around one table',
        },
      },
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
          // From the comparison that used to sit on /services.
          id: 'cb-pace',
          title: { he: 'כל שלב מחכה לזמינות של כולם', en: 'Every step waits for everyone' },
          body: {
            he: 'כל שלב תלוי בזמינות של בעלי הדירות עצמם.',
            en: 'Each step depends on the owners’ own availability.',
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
          id: 'co-pace',
          title: { he: 'תהליך מובנה עם לוחות זמנים', en: 'A structured process with timetables' },
          body: {
            he: 'השלבים ידועים מראש, ומישהו מנהל את התהליך ודואג שיתקדם.',
            en: 'The stages are known in advance, and someone manages the process and keeps it moving.',
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
    // The worries /about used to open with, one per row, each beside what is
    // done about it. The intro is that sentence's first clause. Every answer
    // is wording the site already uses for the work it describes: the offer
    // check (timelines, guarantees, the meaning in your language), the
    // homepage's former "ניהול התהליך" item (the next step, coordinating the
    // professionals and documents), and the services comparison (regular
    // updates, one address). None is an outcome or a guarantee.
    id: 'why-risks',
    type: 'RISKS',
    order: 2,
    hidden: false,
    heading: {
      he: 'מה שבעלי הדירות רואים קודם, ומה עושים עם זה',
      en: 'What owners see first, and what is done about it',
    },
    intro: {
      he: 'גם כשיזם רציני מגיע לשכונה שלכם, בעלי דירות רואים קודם כל את הסיכונים.',
      en: 'Even when a serious developer comes to your neighbourhood, owners see the risks first.',
    },
    rows: [
      {
        id: 'risk-moving',
        icon: 'home',
        risk: { he: 'פינוי מהדירה', en: 'Having to move out' },
        answer: {
          he: 'בודקים את לוחות הזמנים ואת הבטוחות שבהצעה.',
          en: 'We check the timelines and the guarantees in the offer.',
        },
      },
      {
        id: 'risk-uncertainty',
        icon: 'question',
        risk: { he: 'אי־ודאות', en: 'Uncertainty' },
        answer: {
          he: 'בכל שלב יודעים מה הצעד הבא, ומחליטים מתי לצאת אליו.',
          en: 'At every stage you know the next step, and decide when to take it.',
        },
      },
      {
        id: 'risk-bureaucracy',
        icon: 'files',
        risk: { he: 'בירוקרטיה', en: 'Bureaucracy' },
        answer: {
          he: 'מרכזים את אנשי המקצוע, המסמכים והעדכונים.',
          en: 'We coordinate the professionals, the documents and the updates.',
        },
      },
      {
        id: 'risk-disruption',
        icon: 'cone',
        risk: { he: 'טרדה יומיומית', en: 'Everyday disruption' },
        answer: {
          he: 'עדכונים שוטפים וכתובת אחת.',
          en: 'Regular updates, and a single point of contact.',
        },
      },
      {
        id: 'risk-documents',
        icon: 'document',
        risk: { he: 'מסמכים משפטיים וכלכליים', en: 'Legal and financial documents' },
        answer: {
          he: 'מסבירים את המשמעות הכלכלית והמשפטית בשפה שלכם.',
          en: 'We explain the financial and legal implications in your language.',
        },
      },
    ],
  },
  {
    id: 'why-role-map',
    type: 'ROLE_MAP',
    order: 3,
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
        label: { he: 'נציגות בעלי הדירות', en: 'The owners’ representation' },
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
        he: 'מארגנת את בעלי הדירות, מרכזת את העבודה מול שאר הגורמים ומנהלת את התהליך לאורך זמן. בפרויקט שבו OpenDoor היא גם היזם, זה נאמר מראש ונכתב בהסכם.',
        en: 'Organises the owners, coordinates the work with the other parties, and manages the process over time. In a project where OpenDoor is also the developer, that is said up front and written into the agreement.',
      },
    },
    parties: [
      {
        id: 'rm-lawyer',
        side: 'process',
        label: { he: 'עורך הדין של בעלי הדירות', en: 'The owners’ lawyer' },
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
    // "תפקידנו" closes the page beside the call, in one band, as the approved
    // design draws it. The text is the role text, unchanged.
    id: 'why-cta',
    type: 'CTA',
    order: 4,
    hidden: false,
    heading: { he: 'רוצים לראות איך זה עובד בפועל?', en: 'Want to see how this works in practice?' },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: 'Talk to us about your building' },
    ctaHref: '/eligibility',
    summary: {
      heading: { he: 'תפקידנו', en: 'Our role' },
      body: {
        he: 'כשאנחנו מארגנים את בעלי הדירות, אנחנו נותנים לכם שליטה בתהליך: מנגישים את המידע, בונים נציגות מסודרת, מביאים חלופות, מנהלים משא ומתן, ומעלים כל החלטה משמעותית להכרעת בעלי הדירות. כשאנחנו היזם, אנחנו אומרים את זה מראש, ובעלי הדירות מיוצגים על ידי עורך דין ושמאי שהם בוחרים.',
        en: 'When we organise the owners, we give you control of the process: we make the information accessible, build an orderly representation, bring alternatives, lead negotiations, and put every significant decision to the owners. When we are the developer, we say so up front, and the owners are represented by a lawyer and an appraiser they choose.',
      },
      emphasis: {
        he: 'בסוף, אתם מחליטים. אנחנו דואגים שתעשו את זה עם כל המידע שצריך.',
        en: 'In the end, you decide. We make sure you do so with all the information you need.',
      },
    },
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
    // The eight stages at a glance, linking down to each. Reads the journey
    // below rather than copying it.
    id: 'how-index',
    type: 'STAGE_INDEX',
    order: 1,
    hidden: false,
    heading: { he: 'שמונת השלבים', en: 'The eight stages' },
    journeyId: 'how-journey',
  },
  {
    id: 'how-journey',
    type: 'JOURNEY',
    order: 2,
    hidden: false,
    variabilityNote: {
      he: 'פרויקטים נבדלים זה מזה במסלול התכנוני, במבנה הבעלויות, במורכבות המתחם ובלוחות הזמנים. חלק מהשלבים מתרחשים במקביל, וחלקם חוזרים על עצמם. התיאור שלהלן הוא המבנה הכללי ואינו סדר קבוע או התחייבות למועדים.',
      en: 'Projects differ in planning route, ownership structure, complexity and timing. Some stages run in parallel and some repeat. What follows is the general shape, not a fixed sequence or a commitment to dates.',
    },
    stages: [
      {
        id: 'st-1',
        icon: 'search',
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
        icon: 'chat',
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
        icon: 'users',
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
        icon: 'files',
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
        icon: 'clipboard',
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
        icon: 'scale',
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
        icon: 'document-check',
        title: { he: 'קידום התהליך', en: 'Advancing the process' },
        body: {
          he: 'הסכמים, תכנון וקידום מול הרשות המקומית ומוסדות התכנון. זה בדרך כלל השלב הארוך ביותר, והוא תלוי בגורמים שאינם בשליטת אף אחד מהצדדים.',
          en: 'Agreements, design, and progress with the municipality and the planning institutions. Usually the longest stretch, and dependent on things no party controls.',
        },
      },
      {
        id: 'st-8',
        icon: 'eye',
        title: { he: 'ליווי, עדכון ושקיפות לאורך הדרך', en: 'Support, updates and transparency throughout' },
        body: {
          he: 'התהליך לא נגמר בחתימה. עדכונים, תיעוד וגישה למידע ממשיכים עד המימוש, גם כשאין חדשות דרמטיות לדווח.',
          en: 'The process does not end at signature. Updates, records and access to information continue through to completion, including in the stretches when there is nothing dramatic to report.',
        },
      },
    ],
  },
  {
    // Moved from the homepage: what following a project looks like in the
    // personal area, beside the stages it follows.
    id: 'how-status',
    type: 'PROJECT_TRANSPARENCY',
    order: 3,
    hidden: false,
    heading: {
      he: 'לדעת איפה הפרויקט עומד, ומה השלב הבא',
      en: 'Knowing where the project stands, and what comes next',
    },
    intro: {
      he: 'באזור האישי בעלי הדירות עוקבים אחר התקדמות הפרויקט, המסמכים, העדכונים והפגישות, בלי לחכות לשיחת טלפון. התצוגה שלהלן היא הדגמה של המבנה, ואינה מתארת פרויקט קיים.',
      en: 'In the personal area, owners follow the project\u2019s progress, documents, updates and meetings without waiting for a phone call. The view below demonstrates the structure and does not describe an existing project.',
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
  {
    id: 'how-image',
    type: 'MEDIA',
    order: 4,
    hidden: false,
    slotId: 'RESIDENT_MEETING',
    assets: [],
  },
  {
    id: 'how-cta',
    type: 'CTA',
    order: 5,
    hidden: false,
    heading: {
      he: 'השלב הראשון הוא בדיקה, והוא לא מחייב אתכם בכלום.',
      en: 'The first stage is a review, and it commits you to nothing.',
    },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: 'Talk to us about your building' },
    ctaHref: '/eligibility',
  },
]

/* ══════════════════════════════════════════════════════════════════════════
 * /trust
 * ══════════════════════════════════════════════════════════════════════════ */

/*
 * Redesigned 2026-10-11, as approved on the design canvas: a light opening
 * with the documents an owner reads, the working rules as grouped cards, the
 * documents themselves as the page's one dark band, and the personal area
 * with its picture and registration. The approved wording is unchanged; the
 * new lines are the hero's points, the group names, the documents section,
 * and one sentence about registration.
 */
const trustBlocks: PageBlock[] = [
  {
    id: 'trust-hero',
    type: 'PAGE_HERO',
    order: 0,
    hidden: false,
    eyebrow: { he: 'שקיפות ואמון', en: 'Transparency and trust' },
    heading: {
      he: 'שקיפות היא לא הבטחה. היא דרך עבודה.',
      en: 'Transparency is not a promise. It is a way of working.',
    },
    standfirst: {
      he: 'תהליך התחדשות עירונית נמשך שנים, ובמהלכן מתקבלות עשרות החלטות. מה שמאפשר לבעלי הדירות להישאר בשליטה הוא סדר עבודה: מה מתועד, מי רואה מה, ומתי נושא מובא להכרעה.',
      en: 'An urban-renewal process runs for years and involves dozens of decisions. What keeps owners in control is an order of work: what gets recorded, who can see it, and when a matter goes to a decision.',
    },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: 'Talk to us about your building' },
    ctaHref: '/eligibility',
    secondaryCtaLabel: { he: 'המסמכים לקריאה', en: 'Read the documents' },
    secondaryCtaHref: '/forms',
    visual: {
      kind: 'documents',
      items: [
        { id: 'doc-protocol', title: { he: 'פרוטוקול מינוי נציגות בעלי דירות', en: 'Representation protocol' } },
        { id: 'doc-notice', title: { he: 'הודעה על כינוס בעלי דירות', en: 'Notice of an owners’ assembly' } },
        { id: 'doc-agreement', title: { he: 'הסכם לארגון וליווי עסקת פינוי בינוי', en: 'Organising agreement' } },
      ],
      badge: { he: 'נוסח מלא לקריאה', en: 'Full text to read' },
    },
    // The three things the standfirst names, as points under the opening.
    points: [
      { id: 'trust-pt-recorded', icon: 'document', title: { he: 'מה מתועד', en: 'What is recorded' } },
      { id: 'trust-pt-sees', icon: 'eye', title: { he: 'מי רואה מה', en: 'Who sees what' } },
      { id: 'trust-pt-decides', icon: 'scale', title: { he: 'מתי מכריעים', en: 'When decisions are made' } },
    ],
  },
  {
    // Moved from /about, in full, as this page's opening paragraph. A CHAPTER
    // rather than PROSE: PROSE straight after the opening STATEMENT would pair
    // with it and take the statement off the inverse surface.
    id: 'trust-in-process',
    type: 'CHAPTER',
    order: 1,
    hidden: false,
    heading: { he: 'שקיפות בתהליך', en: 'Transparency in the process' },
    body: {
      he: 'התחדשות עירונית היא תהליך מורכב. יש בו החלטות קשות, פשרות, עלויות, עיכובים, אינטרסים שונים, ולעיתים גם מחלוקות בין בעלי הדירות עצמם.\n\nאנחנו לא מטשטשים את זה. אנחנו מסבירים איפה נמצאים הסיכונים, מה המשמעות של כל בחירה ואילו אפשרויות עומדות בפניכם, כי רק כך אפשר לקבל החלטה אחראית ומבוססת.',
      en: 'Urban renewal is a complex process. It involves hard decisions, compromises, costs, delays, competing interests and, at times, disagreements among the owners themselves.\n\nWe do not blur any of that. We explain where the risks lie, what each choice means and which options are open to you — because that is the only way to reach a responsible, well-founded decision.',
    },
    slotId: 'PROCESS_STAGE_2',
  },
  {
    id: 'trust-practice',
    type: 'TRUST',
    order: 2,
    hidden: false,
    heading: { he: 'איך זה עובד אצלנו', en: 'How this works with us' },
    intro: {
      he: 'אלה כללי העבודה שאנחנו מחזיקים בהם. הם מתארים איך אנחנו עובדים, ואינם הבטחה לתוצאה.',
      en: 'These are the working rules we hold ourselves to. They describe how we work; they are not a promise of an outcome.',
    },
    // Grouped since 2026-10-11 (information, decisions, contact): the same
    // seven rules and words, ordered by group.
    items: [
      {
        id: 'tp-documentation',
        group: { he: 'מידע', en: 'Information' },
        icon: 'files',
        title: { he: 'תיעוד', en: 'Documentation' },
        body: {
          he: 'פגישות, הכרעות והסכמות נרשמות ונשמרות. בתהליך ארוך, רישום הוא מה שמאפשר לחזור אחורה ולהבין למה הוחלט מה שהוחלט.',
          en: 'Meetings, resolutions and agreements are written down and kept. Over a long process, a record is what lets anyone go back and understand why a decision was made.',
        },
      },
      {
        id: 'tp-access',
        group: { he: 'מידע', en: 'Information' },
        icon: 'eye',
        title: { he: 'גישה למידע', en: 'Access to information' },
        body: {
          he: 'אנחנו עובדים כך שהמידע הנוגע לבעל דירה ולמתחם יהיה נגיש לו. חומר שמוחזק אצל הנציגות מתוקף תפקידה מוגדר ככזה מראש, ולא מתגלה בדיעבד.',
          en: 'We work so that the information concerning an owner and their complex is reachable by them. Material that sits with the representation because of its role is defined as such in advance, rather than discovered later.',
        },
      },
      {
        id: 'tp-status',
        group: { he: 'מידע', en: 'Information' },
        icon: 'pin',
        title: { he: 'מצב הפרויקט', en: 'Where the project stands' },
        body: {
          he: 'בעל דירה שישאל באיזה שלב התהליך נמצא, מה הסתיים ומה הבא בתור, יקבל תשובה. איננו מצפים ממנו לחפש אותה.',
          en: 'An owner who asks which stage the process has reached, what is finished and what comes next will get an answer. We do not expect them to go looking for it.',
        },
      },
      {
        id: 'tp-decisions',
        group: { he: 'החלטות', en: 'Decisions' },
        icon: 'scale',
        title: { he: 'קבלת החלטות מסודרת', en: 'Orderly decision-making' },
        body: {
          he: 'ברור מה הנציגות מוסמכת להכריע בו ומה מובא לכלל בעלי הדירות. ההבחנה נקבעת מראש ולא לפי הנוחות של הרגע.',
          en: 'It is clear what the representation may settle and what goes to all the owners. That line is drawn in advance, not according to what is convenient at the time.',
        },
      },
      {
        id: 'tp-comparison',
        group: { he: 'החלטות', en: 'Decisions' },
        icon: 'clipboard',
        title: { he: 'השוואת חלופות', en: 'Comparing alternatives' },
        body: {
          he: 'הצעות נבחנות לפי אותם פרמטרים, וההשוואה נשמרת. כך אפשר להסביר בחירה גם שנה אחרי שהתקבלה.',
          en: 'Proposals are examined against the same parameters, and the comparison is kept. That is what makes a choice explainable a year after it was made.',
        },
      },
      {
        id: 'tp-updates',
        group: { he: 'קשר ותיאום', en: 'Contact and coordination' },
        icon: 'chat',
        title: { he: 'עדכונים לבעלי הדירות', en: 'Updates to owners' },
        body: {
          he: 'אנחנו מעדכנים גם כשאין התפתחות דרמטית. שתיקה ארוכה שוחקת אמון יותר מבשורה לא נוחה.',
          en: 'We send an update even when there is no dramatic development. A long silence erodes trust more than unwelcome news does.',
        },
      },
      {
        id: 'tp-coordination',
        group: { he: 'קשר ותיאום', en: 'Contact and coordination' },
        icon: 'users',
        title: { he: 'תיאום בין אנשי המקצוע', en: 'Coordinating the professionals' },
        body: {
          he: 'אנחנו מתאמים בין עורך הדין, השמאי, האדריכל והיועצים, ודואגים שיעבדו מול אותו מידע ואותו לוח זמנים. האחריות המקצועית נשארת אצל כל אחד מהם.',
          en: 'We coordinate between the lawyer, the appraiser, the architect and the consultants, and make sure they work from the same information and the same timeline. Professional responsibility stays with each of them.',
        },
      },
    ],
  },
  {
    // The documents themselves, the page's one dark band: what "transparency"
    // means in practice is that the full text can be read before anyone signs.
    id: 'trust-documents',
    type: 'FEATURE_GRID',
    order: 3,
    hidden: false,
    tone: 'inverse',
    heading: { he: 'המסמכים פתוחים לקריאה', en: 'The documents are open to read' },
    intro: {
      he: 'את הנוסח המלא של המסמכים שבעלי הדירות מקבלים וחותמים עליהם אפשר לקרוא כאן מראש, להדפיס ולשמור.',
      en: 'The full text of the documents owners receive and sign can be read here in advance, printed and kept.',
    },
    items: [
      {
        id: 'td-notice',
        icon: 'calendar',
        title: { he: 'הודעה על כינוס בעלי דירות', en: 'Notice of an owners’ assembly' },
        body: {
          he: 'ההזמנה לכינוס בעלי הדירות במתחם, וסדר היום שלו.',
          en: 'The invitation to the owners’ assembly in the complex, and its agenda.',
        },
        href: '/forms/assembly-notice',
        linkLabel: { he: 'לקריאת הנוסח המלא', en: 'Read the full text' },
      },
      {
        id: 'td-protocol',
        icon: 'users',
        title: { he: 'פרוטוקול מינוי נציגות בעלי דירות', en: 'Representation protocol' },
        body: {
          he: 'הפרוטוקול שבו בעלי הדירות ממנים נציגות מטעמם לקידום שלבי הארגון והבדיקה של הפרויקט.',
          en: 'The protocol in which the owners appoint a representation to advance the project’s organisation and review stages.',
        },
        href: '/forms/representation-protocol',
        linkLabel: { he: 'לקריאת הנוסח המלא', en: 'Read the full text' },
      },
      {
        id: 'td-agreement',
        icon: 'pen',
        title: { he: 'הסכם לארגון וליווי עסקת פינוי בינוי', en: 'Organising and accompaniment agreement' },
        body: {
          he: 'ההסכם בין בעלי הדירות לחברה המארגנת: ההתחייבויות, התוקף והזכויות.',
          en: 'The agreement between the owners and the organising company: the undertakings, its term and the owners’ rights.',
        },
        href: '/forms/organizing-agreement',
        linkLabel: { he: 'לקריאת הנוסח המלא', en: 'Read the full text' },
      },
    ],
    linkLabel: { he: 'לכל הטפסים', en: 'All forms' },
    linkHref: '/forms',
  },
  {
    // The approved text, with one new sentence on registration (2026-10-11),
    // the homepage's picture of the personal area, and its two ways in.
    id: 'trust-digital',
    type: 'PORTAL',
    order: 4,
    hidden: false,
    heading: { he: 'האזור האישי', en: 'The personal area' },
    intro: {
      he: 'באזור האישי כל בעל דירה רואה במקום אחד את השלב שבו הפרויקט נמצא, את העדכונים, את המסמכים שנוגעים לדירה שלו ואת הפגישות הקרובות.',
      en: 'In the personal area every owner sees in one place which stage the project has reached, the updates, the documents relevant to their apartment, and the meetings coming up.',
    },
    body: {
      he: 'משם אפשר גם לשלוח הודעות ופניות, ולחתום על מסמכים כשנדרש. הכניסה נעשית בקוד חד־פעמי שנשלח לטלפון הנייד או לאימייל הרשומים אצלנו. מי שעוד לא רשום אצלנו יכול לבקש הרשמה. סביבה לחברי הנציגות, לניהול ההחלטות והמשימות, עדיין בבנייה.\n\nלצד האזור האישי, הנהלים שלמעלה ממשיכים להתקיים גם בערוצים הרגילים: פגישות, סיכומים כתובים ותקשורת ישירה מול הנציגות.',
      en: 'From there owners can also send messages and requests, and sign documents when needed. Sign-in is by a one-time code sent to the mobile number or email address we hold. If we do not have your details yet, you can ask to register. A workspace for representation members, for managing decisions and tasks, is still being built.\n\nAlongside the personal area, the practices above continue through the ordinary channels too: meetings, written summaries, and direct communication with the representation.',
    },
    ctaLabel: { he: 'כניסה לאזור האישי', en: 'Go to the personal area' },
    ctaHref: '/portal',
    secondaryCtaLabel: { he: 'הרשמה לאזור האישי', en: 'Register for the personal area' },
    secondaryCtaHref: '/portal/register',
    demo: PORTAL_DEMO,
    groups: [],
  },
  {
    id: 'trust-resources',
    type: 'EXTERNAL_RESOURCES',
    order: 5,
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
    order: 6,
    hidden: false,
    heading: { he: 'יש שאלה שלא נענתה כאן?', en: 'A question this page did not answer?' },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: 'Talk to us about your building' },
    ctaHref: '/eligibility',
  },
]


/* ══════════════════════════════════════════════════════════════════════════
 * /services
 * ══════════════════════════════════════════════════════════════════════════ */

const servicesBlocks: PageBlock[] = [
  {
    // The opening, approved 2026-10-06: the scope of the work in one line, the
    // action and the phone, and a map of what is done around the owners'
    // building. The header it replaced was a title and a sentence.
    id: 'services-hero',
    type: 'PAGE_HERO',
    order: 0,
    hidden: false,
    eyebrow: { he: 'השירותים שלנו', en: 'Our services' },
    heading: { he: 'מהבדיקה הראשונה ועד המפתח.', en: 'From the first check to the keys.' },
    standfirst: {
      he: 'יזמות, ארגון בעלי הדירות, בדיקת הצעות וחילוץ פרויקטים תקועים. אנחנו מביאים לשולחן את אנשי המקצוע הנכונים, ובעלי הדירות יודעים בכל שלב איפה הפרויקט עומד.',
      en: 'Development, organising the owners, checking offers and rescuing stalled projects. We bring the right professionals to the table, and owners know at every stage where the project stands.',
    },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: 'Talk to us about your building' },
    ctaHref: '/eligibility',
    showPhone: true,
    visual: {
      kind: 'service-map',
      center: { he: 'הבניין שלכם', en: 'Your building' },
      items: [
        { id: 'map-dev', icon: 'building', label: { he: 'יזמות', en: 'Development' } },
        { id: 'map-organise', icon: 'users', label: { he: 'ארגון בעלי הדירות', en: 'Organising the owners' } },
        { id: 'map-offers', icon: 'search', label: { he: 'בדיקת הצעות', en: 'Checking offers' } },
        { id: 'map-stalled', icon: 'restart', label: { he: 'חילוץ פרויקטים תקועים', en: 'Rescuing stalled projects' } },
      ],
    },
    points: [
      { id: 'services-pt-check', icon: 'check-circle', title: { he: 'בודקים כל הצעה לפני שחותמים', en: 'Every offer checked before signing' } },
      { id: 'services-pt-role', icon: 'check-circle', title: { he: 'אומרים מראש: יזם או מארגנים', en: 'Developer or organiser, said up front' } },
      { id: 'services-pt-stay', icon: 'check-circle', title: { he: 'לא נעלמים אחרי החתימות', en: 'Still here after the signatures' } },
    ],
  },
  {
    // The services as compact cards. The offer check and its six labels
    // moved to /about, rewritten by the company as five checks; the last
    // card links there.
    id: 'services-list',
    type: 'FEATURE_GRID',
    order: 1,
    hidden: false,
    heading: { he: 'מה אנחנו עושים', en: 'What we do' },
    items: [
      {
        id: 'sv-dev',
        icon: 'building',
        title: { he: 'יזמות', en: 'Development' },
        body: {
          he: 'בפרויקטים שבהם אנחנו היזם, אנחנו מובילים את הפרויקט ואחראים לקידומו. בעלי הדירות מיוצגים על ידי עורך דין ושמאי שהם בוחרים.',
          en: 'In projects where we are the developer, we lead the project and are responsible for moving it forward. The owners are represented by a lawyer and an appraiser they choose.',
        },
      },
      {
        id: 'sv-stalled',
        icon: 'restart',
        title: { he: 'חילוץ פרויקטים תקועים', en: 'Rescuing stalled projects' },
        body: {
          he: 'נכנסים לפרויקטים שנעצרו באמצע הדרך, מבינים מה עוצר אותם, ומחזירים אותם לתנועה.',
          en: 'We step into projects that stopped halfway, find out what is holding them up, and get them moving again.',
        },
      },
      {
        id: 'sv-1',
        icon: 'search',
        title: { he: 'בדיקת היתכנות תכנונית וכלכלית', en: 'Planning and financial feasibility review' },
        body: {
          he: 'ניתוח זכויות הבנייה במתחם, בדיקת מדיניות הרשות המקומית והערכת כדאיות ראשונית.',
          en: 'Analysis of the building rights on the complex, a review of local authority policy, and an initial viability assessment.',
        },
      },
      {
        id: 'sv-2',
        icon: 'users',
        title: { he: 'התארגנות בעלי הדירות ובחירת נציגות', en: 'Organising the owners and electing a representation' },
        body: {
          he: 'ניהול אספות, הקמת נציגות בית מוסמכת, ויצירת ערוצי תקשורת שקופים בין כלל בעלי הדירות.',
          en: 'Running meetings, establishing an authorised building representation, and setting up transparent communication among all owners.',
        },
      },
      {
        id: 'sv-3',
        icon: 'scale',
        title: { he: 'מכרז יזמים תחרותי', en: 'A competitive developer tender' },
        body: {
          he: 'מפרט ודרישות חובה, פנייה ליזמים, ניהול המשא ומתן והשוואת ההצעות על בסיס אחיד.',
          en: 'A specification and mandatory requirements, approaching developers, running the negotiation and comparing the offers on common terms.',
        },
      },
      {
        id: 'sv-4',
        icon: 'document-check',
        title: { he: 'ליווי תכנוני ומשפטי עד לחתימה', en: 'Planning and legal support up to signature' },
        body: {
          he: 'גיבוש הסכם מפורט מול עורכי הדין, לוחות זמנים, מנגנוני פיצוי וערבויות בנקאיות לפי חוק המכר.',
          en: 'Shaping a detailed agreement with the lawyers, timetables, compensation mechanisms and bank guarantees under the Sale Law.',
        },
      },
      {
        id: 'sv-5',
        icon: 'key',
        title: { he: 'ליווי בשלב הבנייה והאכלוס', en: 'Support through construction and occupancy' },
        body: {
          he: 'תקשורת שוטפת מול היזם והרשויות, עד לבדיקת המסירה וקבלת המפתח לדירה החדשה.',
          en: 'Ongoing communication with the developer and the authorities, up to the handover inspection and the key to the new apartment.',
        },
      },
      {
        id: 'sv-offer',
        title: { he: 'בדיקת הצעת יזם', en: 'Checking a developer’s offer' },
        body: {
          he: 'חמשת הדברים שאנחנו בודקים בכל הצעה, בעמוד מי אנחנו.',
          en: 'The five things we check in every offer, on our About page.',
        },
        href: '/about#about-checks',
        linkLabel: { he: 'למה שאנחנו בודקים', en: 'What we check' },
      },
    ],
  },
  {
    id: 'services-cta',
    type: 'CTA',
    order: 2,
    hidden: false,
    heading: {
      he: 'רוצים לבדוק אם הבניין שלכם מתאים?',
      en: 'Want to check whether your building is suitable?',
    },
    body: {
      he: 'פנו אלינו לשיחה ראשונית על האפשרויות בבניין שלכם.',
      en: 'Contact us for an initial conversation about your building.',
    },
    ctaLabel: { he: 'דברו איתנו על הבניין שלכם', en: 'Talk to us about your building' },
    ctaHref: '/eligibility',
  },
]

/* ══════════════════════════════════════════════════════════════════════════
 * /stalled-projects
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Projects others got stuck in, which the company says it knows how to move
 * (its own claim, 2026-10-06). The page names the usual reasons, says what is
 * done about each, and then says plainly that not every project can be
 * rescued: that sentence is what makes the rest believable, and it stays.
 */
const stalledBlocks: PageBlock[] = [
  {
    id: 'stalled-header',
    type: 'PAGE_HEADER',
    order: 0,
    hidden: false,
    eyebrow: { he: 'פרויקטים תקועים', en: 'Stalled projects' },
    heading: { he: 'פרויקט שנתקע? אפשר להזיז אותו.', en: 'A stalled project? It can be moved.' },
    standfirst: {
      he: 'הרבה פרויקטים של התחדשות עירונית נעצרים באמצע הדרך. לשם בדיוק אנחנו נכנסים: מבינים מה עוצר, ומחזירים את הפרויקט לתנועה.',
      en: 'Many urban-renewal projects stop halfway. That is exactly where we come in: we find out what is holding the project up, and get it moving again.',
    },
  },
  {
    id: 'stalled-reasons',
    type: 'RISKS',
    order: 1,
    hidden: false,
    heading: { he: 'מה עוצר פרויקטים, ומה אנחנו עושים', en: 'What stalls projects, and what we do' },
    rows: [
      {
        id: 'stall-developer',
        icon: 'building',
        risk: { he: 'היזם עזב או לא מתקדם', en: 'The developer left, or is not moving' },
        answer: {
          he: 'בודקים מה כבר נעשה ומה ההסכמים מאפשרים, ומביאים יזם שיכול להמשיך.',
          en: 'We check what has been done and what the agreements allow, and bring a developer who can carry on.',
        },
      },
      {
        id: 'stall-owners',
        icon: 'users',
        risk: { he: 'חלק מבעלי הדירות מתנגדים', en: 'Some owners object' },
        answer: {
          he: 'יושבים עם כל אחד, מבינים מה מטריד אותו, ובונים הסכמה.',
          en: 'We sit with each of them, understand what worries them, and build agreement.',
        },
      },
      {
        id: 'stall-economics',
        icon: 'chart',
        risk: { he: 'ההצעה כבר לא כלכלית', en: 'The offer no longer adds up' },
        answer: {
          he: 'בודקים את הכדאיות מחדש, ומתאימים את הפרויקט לתנאים של היום.',
          en: 'We check the viability again, and fit the project to today’s conditions.',
        },
      },
      {
        id: 'stall-planning',
        icon: 'clipboard',
        risk: { he: 'התכנון נתקע ברשויות', en: 'Planning is stuck with the authorities' },
        answer: {
          he: 'עובדים עם אדריכלים ויועצים שמכירים את הוועדות, ומקדמים את התיק.',
          en: 'We work with architects and consultants who know the committees, and move the file forward.',
        },
      },
    ],
  },
  {
    id: 'stalled-honest',
    type: 'STATEMENT',
    order: 2,
    hidden: false,
    statement: { he: 'לא כל פרויקט אפשר לחלץ.', en: 'Not every project can be rescued.' },
    support: {
      he: 'אם זה המצב אצלכם, נגיד לכם את זה ביושר ומוקדם, לפני שתשקיעו עוד זמן.',
      en: 'If that is the case with yours, we will tell you honestly and early, before you invest more time.',
    },
  },
  {
    id: 'stalled-cta',
    type: 'CTA',
    order: 3,
    hidden: false,
    heading: { he: 'הפרויקט שלכם נתקע?', en: 'Has your project stalled?' },
    ctaLabel: { he: 'ספרו לנו איפה זה נתקע', en: 'Tell us where it is stuck' },
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
          'יזמות ומעטפת מקצועית מלאה לבעלי דירות בהתחדשות עירונית: בדיקת היתכנות, התארגנות ונציגות, מכרז יזמים, ליווי עד לחתימה וניהול הבנייה והאכלוס.',
      },
      en: {
        title: 'Our services',
        description:
          'Development, and a complete professional envelope for apartment owners in urban renewal: feasibility, organising and representation, a developer tender, support to signature, and oversight through construction and occupancy.',
      },
    },
    updatedAt: '2026-10-06T00:00:00.000Z',
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
          'OpenDoor Group פועלת בהתחדשות עירונית, עם התמחות בפרויקטי פינוי־בינוי בירושלים והסביבה. שני מודלים של עבודה: כיזם, וכמארגנים של בעלי הדירות.',
      },
      en: {
        title: 'About us',
        description:
          'OpenDoor Group works in urban renewal, specialising in evacuate-and-rebuild projects in and around Jerusalem. Two ways of working: as the developer, and as the owners’ organiser.',
      },
    },
    updatedAt: '2026-10-06T00:00:00.000Z',
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
    updatedAt: '2026-10-06T00:00:00.000Z',
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
    updatedAt: '2026-10-06T00:00:00.000Z',
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
    updatedAt: '2026-10-06T00:00:00.000Z',
    updatedByName: 'Mock content',
  },
  {
    id: 'page-stalled-projects',
    slug: 'stalled-projects',
    title: { he: 'פרויקטים תקועים', en: 'Stalled projects' },
    publishState: 'published',
    blocks: stalledBlocks,
    seo: {
      he: {
        title: 'פרויקטים תקועים',
        description:
          'פרויקט התחדשות עירונית שנתקע: יזם שעזב, בעלי דירות שמתנגדים, הצעה שכבר לא כלכלית או תכנון שנתקע ברשויות. מה עוצר פרויקטים, ואיך מחזירים אותם לתנועה.',
      },
      en: {
        title: 'Stalled projects',
        description:
          'An urban-renewal project that has stalled: a developer who left, owners who object, an offer that no longer adds up, or planning stuck with the authorities. What stalls projects, and how to get them moving again.',
      },
    },
    updatedAt: '2026-10-06T00:00:00.000Z',
    updatedByName: 'Mock content',
  },
] as const
