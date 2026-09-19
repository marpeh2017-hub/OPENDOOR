import { DqDashboard }    from '@/components/data-quality/dq-dashboard'
import { DqIssuesPanel }  from '@/components/data-quality/dq-issues-panel'

export const metadata = {
  title: 'מרכז איכות הנתונים',
}

export default function DataQualityPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">מרכז איכות הנתונים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            איתור, מעקב וטיפול בבעיות איכות נתונים בכל הפרויקטים
          </p>
        </div>
      </div>

      <DqDashboard />
      <DqIssuesPanel />
    </div>
  )
}
