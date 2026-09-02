import { SectionScaffold } from '@/components/site/section-scaffold'

export default function SiteNavigationPage() {
  return (
    <SectionScaffold
      title="תפריטים"
      description="התפריט הראשי של האתר וסדר הפריטים בו."
      willManage={[
        'סדר הפריטים',
        'הסתרה והצגה של פריט',
        'הכיתוב של כל פריט',
      ]}
      willNotTouch={[
        'פריט בתפריט מצביע על עמוד קיים בלבד',
      ]}
      phase="פאזה 5"
    />
  )
}
