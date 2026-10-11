import type { PortalDemo } from '@urban-renewal/api-contracts'

/**
 * The personal area's interface demonstration, shared by the homepage and
 * /trust so the two show the same picture.
 *
 * ── EVERY STRING HERE IS DELIBERATELY GENERIC ─────────────────────────────
 *
 * "הפרויקט שלי" instead of a project name. No address, no building, no
 * resident, no date, no number. The demo shows the SHAPE of the owner's view,
 * which is a truthful thing to show about live software, and it carries a
 * permanent "תצוגה לדוגמה" badge so the frame cannot be read as a live
 * account belonging to a real project.
 *
 * Owners only: the representation workspace is still being built, and the
 * pages describe what an owner gets today.
 */
export const PORTAL_DEMO: PortalDemo = {
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
}
