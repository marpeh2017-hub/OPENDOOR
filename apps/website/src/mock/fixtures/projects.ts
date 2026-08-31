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
    timeline: timelineAt(5),
    featured: false,
    visibility: 'internal',
    publishState: 'draft',
    updatedAt: '2026-08-20T00:00:00.000Z',
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

export const MOCK_PROJECTS: readonly MockProject[] = [...TEMPLATES, ...FIXTURES]
