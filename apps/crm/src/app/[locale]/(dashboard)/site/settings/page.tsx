import { SectionScaffold } from '@/components/site/section-scaffold'

export default function SiteSettingsPage() {
  return (
    <SectionScaffold
      title="הגדרות אתר"
      description="ההגדרות המשותפות לכל העמודים: פרטי קשר ושם האתר."
      willManage={[
        'טלפון, דוא״ל וכתובת',
        'שם האתר ותיאורו',
        'ברירות מחדל לשיתוף',
      ]}
      phase="פאזה 5"
    />
  )
}
