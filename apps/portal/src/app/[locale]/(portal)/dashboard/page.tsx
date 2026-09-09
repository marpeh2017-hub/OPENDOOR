import { redirect } from 'next/navigation'
import { ProjectStatusCard } from '@/components/portal/project-status-card'
import { SignatureStatusCard } from '@/components/portal/signature-status-card'
import { DocumentsPreview } from '@/components/portal/documents-preview'
import { AnnouncementsList } from '@/components/portal/announcements-list'
import { MeetingsCard } from '@/components/portal/meetings-card'
import { ContactCard } from '@/components/portal/contact-card'
import { apiGet, NotAuthenticated } from '@/lib/api'
import type { Dashboard } from '@/lib/dashboard'

/**
 * The resident dashboard.
 *
 * A server component: it reads the httpOnly session cookie through
 * `next/headers` and calls the gateway from the server, so the access token is
 * never handed to the browser and there is no client-side fetch to secure.
 *
 * It also takes no route parameters. Which resident this is comes entirely from
 * the session — the same rule the endpoint follows, held on both sides.
 */
export const dynamic = 'force-dynamic'

export default async function ResidentDashboard({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  let data: Dashboard
  try {
    data = await apiGet<Dashboard>('portal/dashboard')
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      // Includes the case where the resident was archived or moved since
      // signing in: the session no longer describes reality, and the fix is a
      // new one rather than a re-scoped old one.
      redirect(`/${locale}/login${err.code ? `?reason=${err.code}` : ''}`)
    }
    throw err
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-800">שלום, {data.resident.firstName} 👋</h1>
        <p className="text-sm text-gray-500">
          {data.project.name} · דירה {data.resident.apartmentNumber}
        </p>
      </div>

      <ProjectStatusCard project={data.project} buildingAddress={data.resident.buildingAddress} />

      <SignatureStatusCard signature={data.signature} />

      <MeetingsCard meetings={data.meetings} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DocumentsPreview documents={data.documents} />
        <AnnouncementsList messages={data.messages} />
      </div>

      <ContactCard contact={data.contact} />
    </div>
  )
}
