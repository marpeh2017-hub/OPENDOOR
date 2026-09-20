import { OwnersTable } from '@/components/owners/owners-table'

export const metadata = { title: 'בעלים' }

export default function OwnersPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">בעלים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            מרשם בעלי הזכויות הרשומים בטאבו — נפרד ממרשם הדיירים
          </p>
        </div>
      </div>

      <OwnersTable />
    </div>
  )
}
