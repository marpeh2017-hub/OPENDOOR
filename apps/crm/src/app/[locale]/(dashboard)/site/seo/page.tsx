import { SectionScaffold } from '@/components/site/section-scaffold'

export default function SiteSeoPage() {
  return (
    <SectionScaffold
      title="SEO"
      description="מה שמופיע בגוגל ובשיתוף בהודעות. אם לא ממלאים, האתר משתמש בכותרת ובמשפט הפתיחה של העמוד."
      willManage={[
        'כותרת ותיאור לכל עמוד',
        'ברירות מחדל לכלל האתר',
        'הסתרה ממנועי חיפוש',
        'תצוגה מקדימה של תוצאת חיפוש',
      ]}
      phase="פאזה 5"
    />
  )
}
