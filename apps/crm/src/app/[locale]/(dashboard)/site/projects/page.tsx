import { SectionScaffold } from '@/components/site/section-scaffold'

export default function SiteProjectsPage() {
  return (
    <SectionScaffold
      title="פרויקטים"
      description="שני פרויקטים: החיד״א 26 מפורסם, ומתחם טשרניחובסקי - שמעוני טיוטה. פרויקט מופיע באתר רק כשהוא מפורסם, וגם אז מוצג ממנו רק מה שאומת."
      willManage={[
        'מידע ציבורי: שם, מיקום, תיאור ותפקיד OpenDoor',
        'שלב ופרק מוצגים',
        'אבני דרך',
        'תמונות וגלריה',
        'אימות נתונים ומקורות',
        'SEO ופרסום',
      ]}
      willNotTouch={[
        'מידע פנימי והיתכנות אינם מתפרסמים בשום מצב',
        'נתון שלא אומת אינו מופיע באתר',
        'אין פעולה שמפרסמת את כל נתוני הפרויקט',
      ]}
      phase="פאזה 4"
    />
  )
}
