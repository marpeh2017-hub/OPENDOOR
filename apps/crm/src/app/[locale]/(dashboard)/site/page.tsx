import { SectionScaffold } from '@/components/site/section-scaffold'

export default function SiteDashboardPage() {
  return (
    <SectionScaffold
      title="לוח בקרה"
      description="מה דורש טיפול באתר. אין כאן מדדי תנועה ואין גרפים: הם לא עוזרים להחליט מה לעשות עכשיו."
      willManage={[
        'פריטים שממתינים לבדיקה',
        'נתונים שממתינים לאימות',
        'טיוטות שלא פורסמו',
        'מה נערך לאחרונה, ועל ידי מי',
        'תמונות ללא טקסט חלופי',
        'עמודים ללא תיאור לגוגל',
      ]}
      phase="פאזה 2"
    />
  )
}
