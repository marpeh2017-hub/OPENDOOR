import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { MeetingDetail } from '@/components/meetings/meeting-detail'

export const metadata = { title: 'פגישה' }

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="space-y-6">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight size={15} />
        חזרה לרשימת הפגישות
      </Link>

      <MeetingDetail meetingId={id} />
    </div>
  )
}
