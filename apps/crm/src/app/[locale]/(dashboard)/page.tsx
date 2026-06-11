import { Suspense } from 'react'
import { KpiCards }              from '@/components/dashboard/kpi-cards'
import { SignatureProgressChart } from '@/components/dashboard/signature-progress-chart'
import { ProjectStagesChart }    from '@/components/dashboard/project-stages-chart'
import { LeadsFunnelChart }      from '@/components/dashboard/leads-funnel-chart'
import { ActiveProjectsTable }   from '@/components/dashboard/active-projects-table'
import { RecentActivityFeed }    from '@/components/dashboard/recent-activity-feed'
import { UpcomingTasksList }     from '@/components/dashboard/upcoming-tasks-list'
import { CardSkeleton }          from '@/components/ui/skeletons'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">לוח בקרה</h1>
          <p className="text-sm text-muted-foreground mt-0.5">סקירה כללית של כל הפרויקטים והפעילות</p>
        </div>
      </div>

      {/* KPI Row */}
      <Suspense fallback={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      }>
        <KpiCards />
      </Suspense>

      {/* Charts Row 1 — signature progress + project stages */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Suspense fallback={<CardSkeleton className="h-64" />}>
            <SignatureProgressChart />
          </Suspense>
        </div>
        <Suspense fallback={<CardSkeleton className="h-64" />}>
          <ProjectStagesChart />
        </Suspense>
      </div>

      {/* Charts Row 2 — leads funnel + upcoming tasks */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Suspense fallback={<CardSkeleton className="h-56" />}>
            <LeadsFunnelChart />
          </Suspense>
        </div>
        <Suspense fallback={<CardSkeleton className="h-56" />}>
          <UpcomingTasksList />
        </Suspense>
      </div>

      {/* Tables Row — active projects + activity feed */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Suspense fallback={<CardSkeleton className="h-80" />}>
          <ActiveProjectsTable />
        </Suspense>
        <Suspense fallback={<CardSkeleton className="h-80" />}>
          <RecentActivityFeed />
        </Suspense>
      </div>
    </div>
  )
}
