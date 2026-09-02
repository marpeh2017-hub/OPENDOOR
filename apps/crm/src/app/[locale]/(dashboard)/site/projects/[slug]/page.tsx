import { SectionScaffold } from '@/components/site/section-scaffold'

/**
 * One project's editor.
 *
 * Scaffolded so the route architecture is settled: a project is edited at its
 * own address, and the eight areas from the design gate become tabs beneath it
 * rather than separate pages. Building them is Pass 4B onward.
 */
export default function SiteProjectEditorPage() {
  return (
    <SectionScaffold
      title="עורך הפרויקט"
      description="שמונה אזורים: מידע ציבורי, אבני דרך, תמונות, אימות נתונים, מידע פנימי, בדיקת היתכנות, SEO ופרסום."
      willManage={[
        'מידע ציבורי, ותצוגה מקדימה חיה לצידו',
        'אבני דרך, בלי מועד לאירוע עתידי',
        'תמונות, עם סיווג וטקסט חלופי',
        'אימות נתונים, עם מקור ואסמכתא',
        'בדיקה לפני פרסום',
      ]}
      willNotTouch={[
        'מידע פנימי ובדיקת היתכנות יושבים באזורים נעולים ואינם מתפרסמים',
        'שינוי ערך מאומת מבטל את האימות אוטומטית',
        'עורך ומאמת הן שתי הרשאות נפרדות',
      ]}
      phase="פאזה 4"
    />
  )
}
