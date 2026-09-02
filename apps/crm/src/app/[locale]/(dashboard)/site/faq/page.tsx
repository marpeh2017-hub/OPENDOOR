import { SectionScaffold } from '@/components/site/section-scaffold'

export default function SiteFaqPage() {
  return (
    <SectionScaffold
      title="שאלות ותשובות"
      description="השאלות הנפוצות. הסדר כאן הוא הסדר באתר."
      willManage={[
        'שאלה ותשובה',
        'סדר ההופעה',
        'קטגוריה',
        'הסתרה והצגה',
      ]}
      phase="פאזה 5"
    />
  )
}
