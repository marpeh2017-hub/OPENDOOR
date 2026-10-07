import { AccountCard } from '@/components/settings/account-card'
import { TenantProfileCard } from '@/components/settings/tenant-profile-card'
import { UsersPanel } from '@/components/settings/users-panel'

export const metadata = { title: 'הגדרות' }

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            החשבון שלך, פרטי הארגון וניהול המשתמשים
          </p>
        </div>
      </div>

      <AccountCard />
      <TenantProfileCard />
      <UsersPanel />
    </div>
  )
}
