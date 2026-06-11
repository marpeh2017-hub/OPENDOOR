import Link from 'next/link'
import { ChevronRight, Phone, MessageSquare, FileSignature, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ResidentOverviewTab }  from '@/components/residents/tabs/overview-tab'
import { ResidentDocumentsTab } from '@/components/residents/tabs/documents-tab'
import { ResidentMeetingsTab }  from '@/components/residents/tabs/meetings-tab'
import { ResidentMessagesTab }  from '@/components/residents/tabs/messages-tab'
import { ResidentActivityTab }  from '@/components/residents/tabs/activity-tab'

type ResidentStatus = 'SIGNED' | 'INTERESTED' | 'UNDECIDED' | 'OBJECTING' | 'DECEASED'

const STATUS_CFG: Record<ResidentStatus, { label: string; cls: string }> = {
  SIGNED:     { label: 'חתם',      cls: 'bg-green-100 text-green-700 border-green-200' },
  INTERESTED: { label: 'מעוניין',  cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  UNDECIDED:  { label: 'לא החליט', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  OBJECTING:  { label: 'מתנגד',    cls: 'bg-red-100 text-red-700 border-red-200' },
  DECEASED:   { label: 'נפטר',     cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export default async function ResidentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Mock – replace with API call
  const resident = {
    id,
    name: 'דוד כהן',
    phone: '050-1234567',
    project: 'הרצל 45, תל אביב',
    apt: 'דירה 4, קומה 3',
    status: 'SIGNED' as ResidentStatus,
    risk: 'LOW',
    docsCount: 3,
    meetingsCount: 3,
    messagesCount: 5,
  }

  const statusCfg = STATUS_CFG[resident.status]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/residents" className="hover:text-foreground transition-colors">דיירים</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-foreground font-medium">{resident.name}</span>
      </div>

      {/* Profile header */}
      <div className="card-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
              {resident.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{resident.name}</h1>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusCfg.cls}`}>
                {statusCfg.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>{resident.phone}</span>
              <span>·</span>
              <span>{resident.project}</span>
              <span>·</span>
              <span>{resident.apt}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <Phone size={14} /> התקשר
            </Button>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <MessageSquare size={14} /> הודעה
            </Button>
            <Button size="sm" className="gap-2 h-9">
              <FileSignature size={14} /> שלח לחתימה
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreHorizontal size={15} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>עדכון סטטוס</DropdownMenuItem>
                <DropdownMenuItem>הוספת הערה</DropdownMenuItem>
                <DropdownMenuItem>קביעת פגישה</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">סמן כמתנגד</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" dir="rtl">
        <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none p-0 h-auto gap-0">
          {[
            { value: 'overview',   label: 'סקירה כללית',  count: null },
            { value: 'documents',  label: 'מסמכים',        count: resident.docsCount },
            { value: 'meetings',   label: 'פגישות',        count: resident.meetingsCount },
            { value: 'messages',   label: 'תקשורת',        count: resident.messagesCount },
            { value: 'activity',   label: 'פעילות',        count: null },
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
