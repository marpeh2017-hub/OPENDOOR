import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResidentsStats } from '@/components/residents/residents-stats'
import { ResidentsFilters } from '@/components/residents/residents-filters'
import { ResidentsTable } from '@/components/residents/residents-table'

export default function ResidentsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">דיירים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ניהול פרופילי דיירים וסטטוס חתימות</p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus size={15} />
          הוספת דייר
        </Button>
      </div>

      <ResidentsStats />

      <div className="card-surface overflow-hidden">
        <ResidentsFilters />
        <ResidentsTable />
      </div>
    </div>
  )
}
