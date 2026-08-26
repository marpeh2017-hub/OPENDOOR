import { GisMapPanel } from '@/components/gis/gis-map-panel'

export const metadata = { title: 'מפה' }

export default function GisPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">מפה</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            תצוגה גיאוגרפית של פרויקטים, מתחמים ומבנים — בסיס לשכבות גוש/חלקה ותכנון
          </p>
        </div>
      </div>

      <GisMapPanel />
    </div>
  )
}
