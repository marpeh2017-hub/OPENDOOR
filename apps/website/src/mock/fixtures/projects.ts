import type { PublicProject, TimelineStage } from '@urban-renewal/api-contracts'
import { PROJECT_STAGE_ORDER } from '@urban-renewal/api-contracts'
import type { WithProvenance } from '../provenance'

/**
 * MOCK DATA — replaced by the API in Phase 2.
 *
 * See `../provenance.ts` for the rule separating realistic placeholders from
 * fictional UI fixtures, and for the guard that enforces it.
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
 * ── REALISTIC PLACEHOLDERS ─────────────────────────────────────────────────
 *
 * Real OpenDoor project names and locations, so the grid and detail page can be
 * judged against believable content.
 *
 * Every one of these has NO `currentStage` and NO `timeline`. That is not an
 * omission to fill in later — it is the point. Assigning a stage to a real
 * named building would publish an unverified claim about that building's
 * process, which is precisely what was forbidden.
 *
 * The UI must therefore look complete without a stage. If a card or detail page
 * only reads well once a stage is present, the layout is wrong, not the data.
 */
const REALISTIC: MockProject[] = [
  {
    provenance: 'REALISTIC_PLACEHOLDER',
    id: 'p-brlin-39-40',
    slug: 'haim-berlin-39-40',
    name: 'חיים ברלין 39–40',
    type: 'PINUY_BINUY',
    location: { city: 'ירושלים' },
    summary: 'פרויקט התחדשות עירונית בשכונת קטמון, ירושלים.',
    featured: true,
    visibility: 'public',
    publishState: 'published',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    provenance: 'REALISTIC_PLACEHOLDER',
    id: 'p-ben-gurion-8',
    slug: 'ben-gurion-8-ramat-gan',
    name: 'בן גוריון 8, רמת גן',
    type: 'PINUY_BINUY',
    location: { city: 'רמת גן' },
    summary: 'התארגנות בעלי דירות בפרויקט התחדשות עירונית ברמת גן.',
    featured: true,
    visibility: 'public',
    publishState: 'published',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    provenance: 'REALISTIC_PLACEHOLDER',
    id: 'p-herzl-45',
    slug: 'herzl-45-tel-aviv',
    name: 'הרצל 45, תל אביב',
    type: 'PINUY_BINUY',
    location: { city: 'תל אביב' },
    summary: 'ליווי וארגון בעלי דירות בתהליך התחדשות עירונית בתל אביב.',
    featured: false,
    visibility: 'public',
    publishState: 'published',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
]

/**
 * ── FICTIONAL UI FIXTURES ──────────────────────────────────────────────────
 *
 * Invented names, chosen to be unmistakably not-real ("מתחם הדוגמה"). These
 * exercise the states a placeholder cannot: a project mid-process, a project
 * near completion, an early-stage project with almost no content, and an
 * unpublished one.
 *
 * They carry stages and timelines because there is no real building whose
 * process could be misstated.
 */
const FIXTURES: MockProject[] = [
  {
    provenance: 'UI_FIXTURE',
    id: 'f-demo-mid',
    slug: 'demo-complex-mid-process',
    name: 'מתחם הדוגמה — שלב ביניים',
    type: 'PINUY_BINUY',
    location: { city: 'עיר לדוגמה', neighborhood: 'שכונת הדוגמה' },
    summary: 'פרויקט בדיקה לממשק. אינו פרויקט אמיתי.',
    description:
      'רשומת בדיקה המשמשת לפיתוח הממשק בלבד. התוכן כאן אינו מתאר פרויקט קיים.',
    currentStage: 'DEVELOPER_TENDER',
    timeline: timelineAt(5),
    featured: true,
    visibility: 'public',
    publishState: 'published',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
  {
    provenance: 'UI_FIXTURE',
    id: 'f-demo-early',
    slug: 'demo-complex-early',
    name: 'מתחם הדוגמה — שלב מוקדם',
    type: 'TAMA_38_2',
    location: { city: 'עיר לדוגמה' },
    // Deliberately sparse: proves the card and detail page hold up with the
    // minimum a real early-stage project would have.
    summary: 'פרויקט בדיקה בשלב מוקדם, עם מעט מאוד תוכן.',
    currentStage: 'INITIAL_REVIEW',
    timeline: timelineAt(0),
    featured: false,
    visibility: 'public',
    publishState: 'published',
    updatedAt: '2026-08-25T00:00:00.000Z',
  },
  {
    provenance: 'UI_FIXTURE',
    id: 'f-demo-draft',
    slug: 'demo-complex-draft',
    name: 'מתחם הדוגמה — טיוטה',
    type: 'COMBINED',
    location: { city: 'עיר לדוגמה' },
    summary: 'רשומת טיוטה. אינה אמורה להופיע לציבור.',
    currentStage: 'FEASIBILITY',
    timeline: timelineAt(1),
    featured: false,
    // Exists so the repository's publish filter is exercised by real data
    // rather than only asserted in a test.
    visibility: 'internal',
    publishState: 'draft',
    updatedAt: '2026-08-26T00:00:00.000Z',
  },
]

export const MOCK_PROJECTS: readonly MockProject[] = [...REALISTIC, ...FIXTURES]
