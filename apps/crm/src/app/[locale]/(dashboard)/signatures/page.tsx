import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignaturesStats }   from '@/components/signatures/signatures-stats'
import { SignaturesFilters } from '@/components/signatures/signatures-filters'
import { SignaturesTable }   from '@/components/signatures/signatures-table'

export default function SignaturesPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">חתימות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">מעקב ובקרה על בקשות חתימה לפי פרויקט</p>
        </div>
        <Button size="sm" className="gap-2">
          <Send size={15} />
          שליחת בקשות חתימה
        </Button>
      </div>

      <SignaturesStats />

      <div className="card-surface overflow-hidden">
        <SignaturesFilters />
        <SignaturesTable />
      </div>
    </div>
  )
}
