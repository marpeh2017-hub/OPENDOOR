import type { PublicProject, TimelineStage } from '@urban-renewal/api-contracts'
import { PROJECT_STAGE_ORDER } from '@urban-renewal/api-contracts'
import type { WithProvenance } from '../provenance'

/**
 * MOCK DATA — replaced by the CMS in Phase 2.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THERE ARE NO PUBLISHED PROJECTS, AND THAT IS THE CORRECT STATE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This file previously carried three realistic-looking project names with real
 * streets and cities. They were placeholders, but a real street name under a
 * company's "our projects" heading is read as a claim by every visitor, and no
 * disclaimer in a code comment reaches them. They are gone.
 *
 * They have NOT been replaced with invented projects. The public site now
 * publishes nothing in this collection, which is honest, and the UI is built
 * to handle it: `/projects` renders a designed empty state and the homepage's
 * projects block hides itself. That behaviour is not a stopgap — it is what
 * the site must do correctly whenever the list is empty, including on the day
 * a real project is unpublished.
 *
 * ── WHAT IS HERE INSTEAD ───────────────────────────────────────────────────
 *
 * TEMPLATES: draft, internal-only records that exist so the SHAPE is ready to
 * fill. They carry no name, no address and no facts. They never render
 * publicly — `isPubliclyVisible` filters on publishState AND visibility, and
 * these fail both — and they are what a future CMS "new project" form starts
 * from.
 *
 * FIXTURES: unmistakably fictional records ("מתחם הדוגמה") that exercise UI
 * states a template cannot. Also internal-only. Also never public.
 *
 * ── ADDING A REAL PROJECT ──────────────────────────────────────────────────
 *
 * Copy a template, fill name / city / summary, set `publishState: 'published'`
 * and `visibility: 'public'`. Nothing else is required: the card and the
 * detail page are built to look finished with only those. Every factual field
 * stays absent until somebody verifies it — see `VerifiedFact`.
 */

export type MockProject = PublicProject & WithProvenance

/**
 * Builds a timeline from a stage, deriving completed/current/future.
 *
 * QUALITATIVE ONLY. There is no percentage anywhere in this function or in
 * `TimelineStage`, because a percentage is a claim: "62% complete" asserts a
 * measurement nobody took. Position in an ordered list of eleven named stages
 * is a fact the UI can show honestly.
 *
 * Used ONLY by fictional fixtures — a real project never gets a derived stage.
 */
function timelineAt(stageIndex: number): TimelineStage[] {
  return PROJECT_STAGE_ORDER.map((stage, index) => ({
    stage,
    state: index < stageIndex ? 'completed' : index === stageIndex ? 'current' : 'upcoming',
  }))
}

/**
 * Verification stamp for the fictional fixtures only.
 *
 * It names itself as a fixture inside the verification record, so even the
 * audit trail cannot be mistaken for a real one. Never use this for a real
 * project: a real fact is verified by a person, and the point of the type is
 * that there is someone to ask.
 */
function fixtureVerification() {
  return { verifiedAt: '2026-08-20', verifiedByName: 'UI fixture' } as const
}

/**
 * ── EMPTY TEMPLATES ────────────────────────────────────────────────────────
 *
 * Three, because a CMS "new project" flow benefits from a starting point that
 * matches the track: the applicable stages and the language differ between
 * pinuy-binuy and the two TAMA routes.
 *
 * Every one is `draft` + `internal`. Structurally complete, factually empty —
 * which is exactly the state a new record should be in.
 */
const TEMPLATES: MockProject[] = [
  {
    provenance: 'UI_FIXTURE',
    id: 'tpl-pinuy-binuy',
    slug: 'template-pinuy-binuy',
    name: '',
    type: 'PINUY_BINUY',
    location: { city: '' },
    summary: '',
    featured: false,
    visibility: 'internal',
    publishState: 'draft',
    updatedAt: '2026-08-30T00:00:00.000Z',
  },
  {
    provenance: 'UI_FIXTURE',
    id: 'tpl-tama-38-2',
    slug: 'template-tama-38-2',
    name: '',
    type: 'TAMA_38_2',
    location: { city: '' },
    summary: '',
    featured: false,
    visibility: 'internal',
    publishState: 'draft',
    updatedAt: '2026-08-30T00:00:00.000Z',
  },
  {
    provenance: 'UI_FIXTURE',
    id: 'tpl-combined',
    slug: 'template-combined',
    name: '',
    type: 'COMBINED',
    location: { city: '' },
    summary: '',
    featured: false,
    visibility: 'internal',
    publishState: 'draft',
    updatedAt: '2026-08-30T00:00:00.000Z',
  },
]

/**
 * ── FICTIONAL UI FIXTURES ──────────────────────────────────────────────────
 *
 * Invented names, chosen to be unmistakably not-real ("מתחם הדוגמה"). These
 * exercise the states a template cannot: a project mid-process, an early-stage
 * project with almost no content, and one held in editorial review.
 *
 * They carry verified facts because there is no real building whose process
 * could be misstated.
 *
 * ALL are internal-only. None reaches a public page.
 */
const FIXTURES: MockProject[] = [
  {
    provenance: 'UI_FIXTURE',
    id: 'f-demo-mid',
    slug: 'demo-complex-mid-process',
    name: 'מתחם הדוגמה, שלב ביניים',
    type: 'PINUY_BINUY',
    location: { city: 'עיר לדוגמה', neighborhood: 'שכונת הדוגמה' },
    summary: 'פרויקט בדיקה לממשק. אינו פרויקט אמיתי.',
    description:
      'רשומת בדיקה המשמשת לפיתוח הממשק בלבד. התוכן כאן אינו מתאר פרויקט קיים.',
    organizingStatus: 'PROCESS_ACTIVE',
    currentStage: { value: 'DEVELOPER_TENDER', ...fixtureVerification() },
    existingUnits: { value: 48, ...fixtureVerification() },
    proposedUnits: { value: 132, ...fixtureVerification() },
    buildingCount: { value: 4, ...fixtureVerification() },
    planningStatus: { value: 'PLAN_SUBMITTED', ...fixtureVerification() },
    approvals: {
      value: [
        {
          id: 'ap-1',
          label: { he: 'החלטת ועדה מחוזית להפקדה', en: 'District committee decision to deposit' },
          authority: 'ועדה מחוזית לדוגמה',
          grantedOn: '2026-02-11',
        },
      ],
      ...fixtureVerification(),
    },
    developer: {
      value: { role: 'DEVELOPER', name: 'חברה יזמית לדוגמה' },
      ...fixtureVerification(),
    },
    materialDates: {
      value: [
        {
          id: 'md-1',
          label: { he: 'מועד הפקדת התכנית', en: 'Plan deposited' },
          occursOn: '2026-03-04',
          isEstimate: false,
        },
        {
          id: 'md-2',
          label: { he: 'מועד דיון צפוי', en: 'Expected hearing' },
          occursOn: '2026-11-01',
          // Exercises the estimate marker: an estimate shown as a commitment
          // is the most common way a timeline becomes a broken promise.
          isEstimate: true,
        },
      ],
      ...fixtureVerification(),
    },
    // Exercises all three milestone states, the approximate-period path, and
    // the rule that an upcoming entry never prints a date even when the record
    // would allow one.
    milestones: [
      {
        id: 'ms-1',
        title: { he: 'כינוס ראשון של בעלי הדירות', en: 'First owners meeting' },
        state: 'completed',
        occurredAt: '2024-03-18',
        note: {
          he: 'מפגש הצגה של התהליך ומענה על שאלות, לפני שנדרשה התחייבות כלשהי.',
          en: 'A meeting explaining the process and answering questions, before anything was asked of the owners.',
        },
        verification: { value: true, ...fixtureVerification() },
      },
      {
        id: 'ms-2',
        title: { he: 'בחירת נציגות מקרב בעלי הדירות', en: 'Representation chosen from among the owners' },
        state: 'completed',
        occurredAt: '2024-09-02',
        verification: { value: true, ...fixtureVerification() },
      },
      {
        id: 'ms-3',
        title: { he: 'בחינת חלופות והשוואתן', en: 'Alternatives examined and compared' },
        state: 'completed',
        // No exact day is known. `periodLabel` is what stops an author from
        // inventing one so the field will accept a value.
        periodLabel: { he: '2025', en: '2025' },
        note: {
          he: 'הצעות נבחנו מול אותם פרמטרים, וההשוואה תועדה כדי שניתן יהיה לחזור אליה.',
          en: 'Proposals were examined against the same parameters, and the comparison was recorded so it can be revisited.',
        },
        verification: { value: true, ...fixtureVerification() },
      },
      {
        id: 'ms-4',
        title: { he: 'קידום התכנית מול מוסדות התכנון', en: 'Advancing the plan before the planning institutions' },
        state: 'current',
        verification: { value: true, ...fixtureVerification() },
      },
      {
        id: 'ms-5',
        title: { he: 'אישור תכנית והמשך להיתרים', en: 'Plan approval and on to permits' },
        state: 'upcoming',
        // Deliberately carries a date the renderer must IGNORE, so the
        // "upcoming milestones never show a date" rule is proved by the UI
        // rather than only asserted in a comment.
        occurredAt: '2027-06-01',
        note: {
          he: 'השלב הבא בתהליך. מועד אינו מוצג משום שהוא אינו ידוע ואינו בשליטתנו.',
          en: 'The next stage. No date is shown because none is known and none is within our control.',
        },
      },
    ],
    timelineNote: {
      he: 'במתחם הזה שלב בחינת החלופות חזר על עצמו לאחר שינוי בתכנית, ולכן הוא מופיע פעם אחת בציר ולא פעמיים.',
      en: 'In this complex the evaluation stage repeated after a change to the plan, so it appears once on the record rather than twice.',
    },
    gallery: [
      {
        id: 'g-1',
        kind: 'image',
        // Intentionally unresolvable: no image is generated or downloaded for
        // a fixture. What is under test is the layout, the aspect ratio
        // reservation and the claim label, none of which need bytes.
        url: '/fixtures/does-not-exist-project.jpg',
        alt: 'תמונת בדיקה. אינה תמונה אמיתית של פרויקט.',
        caption: 'חזית המתחם הקיים.',
        imageType: 'VERIFIED_PROJECT_PHOTO',
        order: 1,
        takenOn: '2026-04-02',
        credit: 'צלם לדוגמה',
      },
      {
        id: 'g-2',
        kind: 'image',
        url: '/fixtures/does-not-exist-context.jpg',
        alt: 'תמונת בדיקה. אינה תמונה אמיתית של פרויקט.',
        caption: 'מרקם מגורים ישראלי אופייני.',
        imageType: 'EDITORIAL_CONTEXT',
        order: 2,
      },
      {
        id: 'g-3',
        kind: 'image',
        url: '/fixtures/does-not-exist-pattern.jpg',
        alt: '',
        // Must be DROPPED by `galleryItems`: a generated drawing is not a
        // gallery item. Present so the filter is proved, not assumed.
        imageType: 'ARCHITECTURAL_PATTERN',
        order: 3,
      },
      {
        id: 'g-4',
        kind: 'image',
        url: '/fixtures/does-not-exist-unclassified.jpg',
        alt: 'תמונת בדיקה ללא סיווג.',
        // No `imageType`. Must also be DROPPED.
        order: 4,
      },
    ],
    timeline: timelineAt(5),
    featured: false,
    visibility: 'internal',
    publishState: 'draft',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    // ── NO PHOTOGRAPHY, RICH DATA ────────────────────────────────────────
    // The state every real project launches in: figures verified, nothing
    // photographed. Proves the page stays complete on the generated pattern
    // alone, and that the gallery section is ABSENT rather than empty.
    provenance: 'UI_FIXTURE',
    id: 'f-demo-nophoto',
    slug: 'demo-complex-no-photo',
    name: 'מתחם הדוגמה, ללא צילום',
    type: 'PINUY_BINUY',
    location: { city: 'עיר לדוגמה', neighborhood: 'שכונת הדוגמה', street: 'רחוב לדוגמה 1' },
    summary: 'פרויקט בדיקה עם נתונים מאומתים וללא צילום. אינו פרויקט אמיתי.',
    organizingStatus: 'PROCESS_ACTIVE',
    currentStage: { value: 'PLANNING', ...fixtureVerification() },
    existingUnits: { value: 120, ...fixtureVerification() },
    // `proposedUnits` deliberately ABSENT: proves the counts band renders two
    // columns rather than three with a hole where the third would be.
    buildingCount: { value: 5, ...fixtureVerification() },
    planningStatus: { value: 'PRE_PLANNING', ...fixtureVerification() },
    milestones: [
      {
        id: 'np-1',
        title: { he: 'גיבוש צרכים עם בעלי הדירות', en: 'Settling needs with the owners' },
        state: 'completed',
        periodLabel: { he: 'קיץ 2025', en: 'Summer 2025' },
        verification: { value: true, ...fixtureVerification() },
      },
      {
        id: 'np-2',
        title: { he: 'בחינת חלופות', en: 'Examining alternatives' },
        state: 'current',
        verification: { value: true, ...fixtureVerification() },
      },
    ],
    featured: false,
    visibility: 'internal',
    publishState: 'draft',
    updatedAt: '2026-08-28T00:00:00.000Z',
  },
  {
    provenance: 'UI_FIXTURE',
    id: 'f-demo-early',
    slug: 'demo-complex-early',
    name: 'מתחם הדוגמה, שלב מוקדם',
    type: 'TAMA_38_2',
    location: { city: 'עיר לדוגמה' },
    // Deliberately sparse: proves the card and detail page hold up with the
    // minimum a real early-stage project would have.
    summary: 'פרויקט בדיקה בשלב מוקדם, עם מעט מאוד תוכן.',
    organizingStatus: 'EARLY_CONVERSATION',
    featured: false,
    visibility: 'internal',
    publishState: 'draft',
    updatedAt: '2026-08-25T00:00:00.000Z',
  },
  {
    provenance: 'UI_FIXTURE',
    id: 'f-demo-review',
    slug: 'demo-complex-review',
    name: 'מתחם הדוגמה, בבדיקה עורכית',
    type: 'COMBINED',
    location: { city: 'עיר לדוגמה' },
    summary: 'רשומה שממתינה לאישור עורכי. אינה אמורה להופיע לציבור.',
    // Exists so the `review` state introduced in Pass 1 is exercised by real
    // data rather than only asserted in a type.
    featured: false,
    visibility: 'internal',
    publishState: 'review',
    updatedAt: '2026-08-26T00:00:00.000Z',
  },
]

/**
 * ── REAL PROJECTS ──────────────────────────────────────────────────────────
 *
 * Everything above this line is a template or a fiction. Everything below is a
 * real complex, and the rules are different.
 *
 * `REALISTIC_PLACEHOLDER` provenance is what enforces them: the guard in
 * `provenance.ts` THROWS in development if a record with this provenance
 * carries any field in `CLAIM_FIELDS`. So a stage, a unit count, a developer
 * or a milestone cannot be added here by anyone, including by accident, until
 * the fixture is given a real verification record. That is a stronger
 * guarantee than a comment asking people to be careful.
 */
const REAL_PROJECTS: MockProject[] = [
  {
    /*
     * ══════════════════════════════════════════════════════════════════════
     *  PILOT 1. IDENTITY ONLY, AND THAT IS THE POINT.
     * ══════════════════════════════════════════════════════════════════════
     *
     * The ONLY facts published here are the ones supplied directly for this
     * pilot: the name, the city and the street address. Nothing else about
     * this complex exists in the repository.
     *
     * `docs/FEASIBILITY_ENGINE_PHASE_0.md` is explicit on the point: "The Hida
     * 26, Jerusalem source documents are not currently in the repository," and
     * its Golden Case status is `PENDING_SOURCE` with no data to be invented.
     * So there is no verified stage, no unit count, no developer, no planning
     * status, no approval, no permit, no date and no milestone to publish, and
     * every one of those fields is therefore ABSENT rather than guessed.
     *
     * This record is the real test of the sparse-data architecture. The page
     * it produces has an identity header, the role band, the resident bridge
     * and one paragraph explaining that no figures are published yet. It must
     * read as a deliberately restrained page rather than a broken one — if it
     * does not, that is a bug in the presentation, not a reason to fill it.
     *
     * ── WHAT MAKES IT PUBLISHABLE WITHOUT FACTS ──────────────────────────
     *
     * `summary` and `description` below describe the PROCESS and OpenDoor's
     * own role, which OpenDoor is the authority on. They assert nothing about
     * the building: no history, no size, no timetable, no outcome. Read them
     * as the only two sentences that could be written about a complex on the
     * day the engagement starts, because that is what they are.
     */
    provenance: 'REALISTIC_PLACEHOLDER',
    id: 'p-hida-26-jerusalem',
    slug: 'hida-26-jerusalem',
    name: 'החיד"א 26',
    // NO `type`. The renewal track has not been confirmed for this complex,
    // and naming one would be a planning claim. `OTHER` is a real category for
    // a genuinely unusual track, not a way to say "unknown", so the field is
    // absent like every other unconfirmed one.
    location: {
      city: 'ירושלים',
      street: 'החיד"א 26',
    },
    summary:
      'מתחם בירושלים שבו אנחנו מלווים ומארגנים את בעלי הדירות בתהליך ההתחדשות העירונית.',
    description:
      'אנחנו מרכזים את המידע עבור בעלי הדירות במתחם, מתאמים בין אנשי המקצוע שהם מינו, ומלווים את התהליך לאורך זמן. ההחלטות נשארות בידי בעלי הדירות.\n\nמידע על המתחם יתפרסם בעמוד זה לאחר שייבדק ויאומת. עד אז מוצגים כאן זהות הפרויקט ותפקידנו בו בלבד.',
    // Editorial, and OpenDoor is the authority on its own working relationship
    // with the complex. It is not a claim about the building.
    organizingStatus: 'PROCESS_ACTIVE',

    /* ── DELIBERATELY ABSENT ────────────────────────────────────────────────
     * currentStage, currentPhase, existingUnits, proposedUnits, buildingCount,
     * planningStatus, developer, professionals, approvals, permits,
     * materialDates, milestones, timeline, timelineNote, heroImage, gallery.
     *
     * Every one of these is a claim about a real building that nobody has
     * verified. Absent is the correct value, and the page is built for it.
     * `heroImage` absent means the generated ARCHITECTURAL_PATTERN takes the
     * full hero band, which is the approved fallback and asserts nothing. */

    featured: true,
    visibility: 'public',
    publishState: 'published',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
]

export const MOCK_PROJECTS: readonly MockProject[] = [
  ...REAL_PROJECTS,
  ...TEMPLATES,
  ...FIXTURES,
]
