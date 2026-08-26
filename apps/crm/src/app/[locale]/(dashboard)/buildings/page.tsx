import { BuildingsTable } from '@/components/buildings/buildings-table'

export const metadata = { title: 'מבנים' }

export default function BuildingsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">מבנים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            כל המבנים והדירות בפרויקטים — כולל דיירים ורישום בעלויות
          </p>
        </div>
      </div>

      <BuildingsTable />
    </div>
  )
}
