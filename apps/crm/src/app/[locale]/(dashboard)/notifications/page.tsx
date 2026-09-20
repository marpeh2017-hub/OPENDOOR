import { NotificationsPageContent } from '@/components/notifications/notifications-page-content'

export const metadata = { title: 'התראות' }

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">התראות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            עדכונים על פגישות, משימות, חתימות ומסמכים המופנים אליכם
          </p>
        </div>
      </div>

      <NotificationsPageContent />
    </div>
  )
}
