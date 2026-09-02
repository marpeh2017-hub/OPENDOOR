import { SectionScaffold } from '@/components/site/section-scaffold'

export default function SiteKnowledgePage() {
  return (
    <SectionScaffold
      title="מרכז ידע"
      description="הכתבות במרכז הידע, הקטגוריות שלהן והקישור שלהן לפרויקטים."
      willManage={[
        'כותרת, תקציר וגוף הכתבה',
        'קטגוריה',
        'קישור לפרויקטים',
        'עברית, ואנגלית אם קיימת',
        'טיוטה, בדיקה, פרסום',
      ]}
      willNotTouch={[
        'עיצוב הטקסט מוגבל לכותרות, פסקאות, רשימות והדגשה',
      ]}
      phase="פאזה 5"
    />
  )
}
