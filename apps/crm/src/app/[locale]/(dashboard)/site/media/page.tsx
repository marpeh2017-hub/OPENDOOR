import { SectionScaffold } from '@/components/site/section-scaffold'

export default function SiteMediaPage() {
  return (
    <SectionScaffold
      title="ספריית מדיה"
      description="כל התמונות באתר במקום אחד. החלפת תמונה כאן מחליפה אותה בכל מקום שבו היא מופיעה."
      willManage={[
        'העלאה, החלפה ומחיקה',
        'סיווג: צילום מהפרויקט או תצלום הקשר',
        'טקסט חלופי, כיתוב וקרדיט',
        'נקודת מיקוד',
        'היכן התמונה בשימוש',
      ]}
      willNotTouch={[
        'תמונה ללא סיווג או ללא טקסט חלופי אינה מתפרסמת',
        'תצלום הקשר לא יכול לשמש כתמונת פתיחה של פרויקט',
        'האיור האדריכלי נוצר בקוד ואינו נכנס לספרייה',
      ]}
      phase="פאזה 3"
    />
  )
}
