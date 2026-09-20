'use client'

import { use } from 'react'
import Link from 'next/link'
import { ChevronRight, Phone, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CardSkeleton } from '@/components/ui/skeletons'
import { QueryError } from '@/components/ui/query-states'
import { useResident } from '@/hooks/use-residents'
import { ResidentOverviewTab }  from '@/components/residents/tabs/overview-tab'
import { ResidentDocumentsTab } from '@/components/residents/tabs/documents-tab'
import { ResidentMeetingsTab }  from '@/components/residents/tabs/meetings-tab'
import { ResidentMessagesTab }  from '@/components/residents/tabs/messages-tab'
import { ResidentActivityTab }  from '@/components/residents/tabs/activity-tab'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  SIGNED:        { label: 'חתם',          cls: 'bg-green-100 text-green-700 border-green-200' },
  INTERESTED:    { label: 'מעוניין',       cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  CONTACTED:     { label: 'נוצר קשר',     cls: 'bg-teal-100 text-teal-700 border-teal-200' },
  UNDECIDED:     { label: 'לא החליט',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  OBJECTING:     { label: 'מתנגד',        cls: 'bg-red-100 text-red-700 border-red-200' },
  NOT_CONTACTED: { label: 'לא נוצר קשר', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  UNREACHABLE:   { label: 'לא זמין',      cls: 'bg-orange-100 text-orange-700 border-orange-200' },
}

export default function ResidentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: resident, isLoading, isError, error, refetch } = useResident(id)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton className="h-32" />
        <CardSkeleton className="h-64" />
      </div>
    )
  }

  if (isError || !resident) {
    return <QueryError message="שגיאה בטעינת פרופיל הדייר" error={error} onRetry={() => refetch()} />
  }

  const fullName  = `${resident.firstName} ${resident.lastName}`
  const statusCfg = STATUS_CFG[resident.signatureStatus]
    ?? { label: resident.signatureStatus, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
  const apt         = resident.apartment
  const projectName = apt?.building?.complex?.project?.name
  const waLink = resident.phone
    ? `https://wa.me/${resident.phone.replace(/\D/g, '').replace(/^0/, '972')}`
    : null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/residents" className="hover:text-foreground transition-colors">דיירים</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-foreground font-medium">{fullName}</span>
      </div>

      {/* Profile header */}
      <div className="card-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
              {resident.firstName.slice(0, 1)}{resident.lastName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusCfg.cls}`}>
                {statusCfg.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span dir="ltr" className="font-mono">{resident.phone ?? '—'}</span>
              {projectName && <><span>·</span><span>{projectName}</span></>}
              {apt && <><span>·</span><span>דירה {apt.apartmentNumber}{apt.floor != null ? `, קומה ${apt.floor}` : ''}</span></>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {resident.phone && !resident.doNotContact && (
              <>
                <Button variant="outline" size="sm" className="gap-2 h-9" asChild>
                  <a href={`tel:${resident.phone}`}><Phone size={14} /> התקשר</a>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 h-9" asChild>
                  <a href={waLink!} target="_blank" rel="noopener noreferrer">
                    <MessageSquare size={14} /> הודעה
                  </a>
                </Button>
              </>
            )}
            {resident.doNotContact && (
              <span className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-full px-3 py-1">
                סומן כ"נא לא ליצור קשר"
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" dir="rtl">
        <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none p-0 h-auto gap-0">
          {[
            { value: 'overview',  label: 'סקירה כללית', count: null },
            { value: 'documents', label: 'מסמכים',       count: null },
            { value: 'meetings',  label: 'פגישות',       count: null },
            { value: 'messages',  label: 'תקשורת',       count: null },
            { value: 'activity',  label: 'פעילות',       count: resident.activityLog?.length ?? null },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium gap-2"
            >
              {tab.label}
              {tab.count != null && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview"  className="m-0"><ResidentOverviewTab  residentId={id} /></TabsContent>
          <TabsContent value="documents" className="m-0"><ResidentDocumentsTab residentId={id} /></TabsContent>
          <TabsContent value="meetings"  className="m-0"><ResidentMeetingsTab  residentId={id} /></TabsContent>
          <TabsContent value="messages"  className="m-0"><ResidentMessagesTab  residentId={id} /></TabsContent>
          <TabsContent value="activity"  className="m-0"><ResidentActivityTab  residentId={id} /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
