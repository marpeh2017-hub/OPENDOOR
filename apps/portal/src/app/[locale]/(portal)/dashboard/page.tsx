import { ProjectStatusCard } from '@/components/portal/project-status-card'
import { SignatureStatusCard } from '@/components/portal/signature-status-card'
import { DocumentsPreview } from '@/components/portal/documents-preview'
import { AnnouncementsList } from '@/components/portal/announcements-list'
import { ContactCard } from '@/components/portal/contact-card'

export default function ResidentDashboard() {
  return (
    <div className="space-y-5 pb-10">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">שלום, ישראל 👋</h1>
        <p className="text-sm text-gray-500">הנה עדכון עדכני על הפרויקט שלך</p>
      </div>

      {/* Project status */}
      <ProjectStatusCard />

      {/* Signature status */}
      <SignatureStatusCard />

      {/* 2-col grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DocumentsPreview />
        <AnnouncementsList />
      </div>

      {/* Contact */}
      <ContactCard />
    </div>
  )
}
