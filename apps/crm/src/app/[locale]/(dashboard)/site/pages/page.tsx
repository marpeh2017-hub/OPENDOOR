import { SectionScaffold } from '@/components/site/section-scaffold'

export default function SitePagesPage() {
  return (
    <SectionScaffold
      title="עמודים"
      description="שמונת העמודים הקבועים של האתר. אפשר יהיה לערוך את הטקסטים והתמונות, לשנות את סדר החלקים ולהסתיר חלק."
      willManage={[
        'עריכת הטקסטים בכל חלק',
        'החלפת תמונות',
        'שינוי סדר החלקים',
        'הסתרה והצגה של חלק',
        'תצוגה מקדימה',
        'טיוטה, בדיקה, פרסום',
        'היסטוריית שינויים',
      ]}
      willNotTouch={[
        'הפריסה והעיצוב של כל חלק',
        'גופנים, צבעים, מרווחים ורוחב',
        'יצירת עמודים חדשים',
        'סוגי החלקים שהאתר יודע להציג',
      ]}
      phase="פאזה 2"
    />
  )
}
