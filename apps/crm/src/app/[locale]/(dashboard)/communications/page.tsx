import { CommunicationsLog } from '@/components/communications/communications-log'

export const metadata = { title: 'תקשורת' }

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">תקשורת</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            יומן ההודעות לדיירים בכל הערוצים — וואטסאפ, SMS ואימייל
          </p>
        </div>
      </div>

      <CommunicationsLog />
    </div>
  )
}
