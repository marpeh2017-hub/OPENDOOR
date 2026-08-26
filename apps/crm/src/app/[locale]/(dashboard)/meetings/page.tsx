import { MeetingsList } from '@/components/meetings/meetings-list'

export const metadata = { title: 'פגישות' }

export default function MeetingsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">פגישות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            תיאום פגישות דיירים וצוות, הזמנות, אישורי הגעה ומעקב נוכחות
          </p>
        </div>
      </div>

      <MeetingsList />
    </div>
  )
}
