import { redirect } from 'next/navigation'
import { Phone, Mail, Home, Percent, ShieldAlert } from 'lucide-react'
import { apiGet, NotAuthenticated } from '@/lib/api'
import { PreferencesPanel } from '@/components/portal/preferences-panel'
import { ContactUpdateRequest } from '@/components/portal/contact-update-request'
import { LogoutButton } from '@/components/portal/logout-button'
import { SIGNATURE_STATUS_LABELS, type PortalProfile } from '@/lib/profile'

/**
 * The resident's own record.
 *
 * ── WHAT THE MOCK PROMISED THAT DOES NOT EXIST ──────────────────────────────
 *
 *   - A "התראות Push" toggle. `PUSH` is a value in the channel enum with no
 *     provider behind it — `ProviderRegistry` builds SMS, WhatsApp, email,
 *     portal and in-app, and nothing else. A switch for a channel that cannot
 *     deliver is a promise the system cannot keep.
 *   - A dark-mode switch and an "אבטחה ופרטיות" row that went nowhere.
 *   - "מזהה: RES-00124", an id format this system does not use.
 *
 * ── AND WHAT IT DID NOT SHOW ────────────────────────────────────────────────
 *
 * The resident's own ownership share, and where they stand on signing. Both are
 * their own facts, both are material to them, and both were missing from a page
 * that had room for a dark-mode toggle.
 */
export const dynamic = 'force-dynamic'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  let data: PortalProfile
  try {
    data = await apiGet<PortalProfile>('portal/profile')
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      redirect(`/${locale}/login${err.code ? `?reason=${err.code}` : ''}`)
    }
    throw err
  }

  const initials = `${data.resident.firstName?.[0] ?? ''}${data.resident.lastName?.[0] ?? ''}`

  return (
    <div className="space-y-5 pb-10">
      <div className="card-surface flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-teal-500 text-xl font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-gray-800">{data.resident.name}</p>
          <p className="truncate text-sm text-teal-600">{data.home.projectName}</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {data.home.buildingAddress} · דירה {data.home.apartmentNumber}
          </p>
        </div>
      </div>

      {/* Both, because they are separate columns and they disagree in real
          data: a resident can carry `signatureStatus: OBJECTING` with the
          boolean still false. The dashboard already reads it this way, and one
          page showing the banner while the other hides it would look like the
          system had lost track of their position. */}
      {(data.standing.isObjecting || data.standing.signatureStatus === 'OBJECTING') && (
        <div className="card-surface flex items-start gap-3 border-2 border-amber-200 p-4">
          <ShieldAlert size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-gray-800">רשמנו את התנגדותך</p>
            <p className="mt-0.5 text-xs text-gray-500">
              אם זו טעות או שהעמדה שלך השתנתה, פנו אלינו.
            </p>
          </div>
        </div>
      )}

      <div className="card-surface overflow-hidden">
        <div className="border-b border-border bg-gray-50/50 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">הפרטים שלי</h2>
        </div>
        <div className="divide-y divide-border">
          <Row icon={Phone} label="טלפון" value={data.resident.phone ?? '—'} ltr />
          <Row icon={Mail} label="אימייל" value={data.resident.email ?? '—'} ltr />
          <Row
            icon={Home}
            label="כתובת"
            value={`${data.home.buildingAddress}, דירה ${data.home.apartmentNumber}`}
          />
          {/* Their own share, and the reason the signature threshold moves.
              Missing from the mock, which had room for a dark-mode toggle. */}
          <Row
            icon={Percent}
            label="חלקך בנכס"
            value={`${data.home.ownershipPercentage}%`}
          />
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="border-b border-border bg-gray-50/50 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">סטטוס חתימה</h2>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-sm text-gray-800">
            {SIGNATURE_STATUS_LABELS[data.standing.signatureStatus] ?? data.standing.signatureStatus}
          </p>
        </div>
      </div>

      <ContactUpdateRequest pending={data.pendingContactRequest} />

      <PreferencesPanel preferences={data.preferences} />

      {data.preferences.doNotContact && (
        // Recorded, and not something to switch off from an app: a resident who
        // asked for silence should see that it stuck, and ask a person to lift
        // it. See the endpoint's DTO for the reasoning.
        <div className="card-surface p-4">
          <p className="text-sm font-medium text-gray-800">ביקשת שלא ניצור איתך קשר</p>
          <p className="mt-0.5 text-xs text-gray-500">
            הבקשה רשומה אצלנו. אם תרצו לחדש את הקשר, פנו אלינו.
          </p>
        </div>
      )}

      <LogoutButton locale={locale} />
    </div>
  )
}

function Row({
  icon: Icon, label, value, ltr,
}: {
  icon: typeof Phone
  label: string
  value: string
  ltr?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
        <Icon size={15} className="text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="truncate text-sm font-medium text-gray-800" dir={ltr ? 'ltr' : undefined}>
          {value}
        </p>
      </div>
    </div>
  )
}
