'use client'

import { use } from 'react'
import Link from 'next/link'
import { ChevronRight, MapPin, Users, Calendar } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { CardSkeleton } from '@/components/ui/skeletons'
import { QueryError } from '@/components/ui/query-states'
import { useProject } from '@/hooks/use-projects'
import { ProjectResidentsTab } from '@/components/projects/tabs/residents-tab'
import { ProjectSignaturesTab } from '@/components/projects/tabs/signatures-tab'
import { ProjectDocumentsTab } from '@/components/projects/tabs/documents-tab'
import { ProjectTasksTab } from '@/components/projects/tabs/tasks-tab'
import { ProjectTimelineTab } from '@/components/projects/tabs/timeline-tab'
import { ProjectImportsTab } from '@/components/projects/tabs/imports-tab'
import { ProjectFeasibilityTab } from '@/components/projects/tabs/feasibility-tab'
import { ProjectTeamPanel } from '@/components/projects/project-team-panel'

const STAGE_LABELS: Record<string, string> = {
  DISCOVERY: 'גילוי', FEASIBILITY: 'היתכנות', RESIDENT_ORGANIZATION: 'התארגנות',
  SIGNATURES: 'חתימות', DEVELOPER_SELECTION: 'בחירת יזם', PLANNING: 'תכנון',
  MUNICIPAL_APPROVAL: 'אישור עירוני', PERMIT: 'היתר', EVACUATION: 'פינוי',
  CONSTRUCTION: 'בנייה', DELIVERY: 'מסירה', POST_DELIVERY: 'לאחר מסירה',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('he-IL')
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: project, isLoading, isError, error, refetch } = useProject(id)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton className="h-40" />
        <CardSkeleton className="h-64" />
      </div>
    )
  }

  if (isError || !project) {
    return <QueryError message="שגיאה בטעינת הפרויקט" error={error} onRetry={() => refetch()} />
  }

  const signaturePct = project.totalUnits > 0
    ? Math.round((project.signedUnits / project.totalUnits) * 100)
    : 0

  // Derive real counts from the nested complexes → buildings → apartments tree.
  const buildings  = project.complexes.flatMap(c => c.buildings)
  const apartments = buildings.flatMap(b => b.apartments)
  const residents  = apartments.flatMap(a => a.residents)

  // Project.projectManagerId / lawyerId are direct FKs on the project; the API
  // resolves them to user records. `members` is a separate many-to-many used for
  // access, not for naming the responsible manager.
  const pm     = project.projectManager ?? null
  const lawyer = project.lawyer ?? null
  const goal   = project.signatureGoal ?? 67

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground transition-colors">פרויקטים</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

      {/* Header */}
      <div className="card-surface p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {project.code}
              </span>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                {STAGE_LABELS[project.stage] ?? project.stage}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">{project.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-primary" />
                {project.city}{project.neighborhood ? ` · ${project.neighborhood}` : ''}
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-primary" />
                {project.totalUnits} יחידות
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                {formatDate(project.startDate)} – {formatDate(project.targetEndDate)}
              </div>
            </div>
          </div>

          {/* Signature KPI */}
          <div className="bg-muted/40 rounded-xl p-4 min-w-56 border border-border">
            <div className="flex items-end justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">חתימות</span>
              <span className={`text-2xl font-black ${signaturePct >= goal ? 'text-green-600' : signaturePct >= 51 ? 'text-primary' : 'text-orange-600'}`}>
                {signaturePct}%
              </span>
            </div>
            <Progress value={signaturePct} className="h-2 mb-1.5" />
            <p className="text-xs text-muted-foreground text-left">
              {project.signedUnits} מתוך {project.totalUnits} חתמו · יעד {goal}%
            </p>
          </div>
        </div>

        {/* Team strip */}
        <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-border text-sm">
          <div>
            <span className="text-muted-foreground">מנהל פרויקט: </span>
            <span className="font-medium text-foreground">
              {pm ? `${pm.firstName} ${pm.lastName}` : 'לא הוקצה'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">עורך דין: </span>
            <span className="font-medium text-foreground">
              {lawyer ? `${lawyer.firstName} ${lawyer.lastName}` : 'לא הוקצה'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">מבנים: </span>
            <span className="font-medium text-foreground">{buildings.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">דירות: </span>
            <span className="font-medium text-foreground">{apartments.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="residents" dir="rtl">
        <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none p-0 h-auto gap-0">
          {[
            { value: 'residents',  label: 'דיירים',   count: residents.length },
            { value: 'signatures', label: 'חתימות',   count: null },
            { value: 'documents',  label: 'מסמכים',   count: null },
            { value: 'tasks',      label: 'משימות',   count: null },
            { value: 'timeline',   label: 'ציר זמן',  count: null },
            { value: 'imports',    label: 'ייבוא',    count: null },
            { value: 'feasibility', label: 'דוח אפס',  count: null },
            { value: 'team',       label: 'צוות',     count: null },
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
          <TabsContent value="residents" className="m-0">
            <ProjectResidentsTab projectId={id} />
          </TabsContent>
          <TabsContent value="signatures" className="m-0">
            <ProjectSignaturesTab projectId={id} />
          </TabsContent>
          <TabsContent value="documents" className="m-0">
            <ProjectDocumentsTab projectId={id} />
          </TabsContent>
          <TabsContent value="tasks" className="m-0">
            <ProjectTasksTab projectId={id} />
          </TabsContent>
          <TabsContent value="timeline" className="m-0">
            <ProjectTimelineTab projectId={id} />
          </TabsContent>
          <TabsContent value="imports" className="m-0">
            <ProjectImportsTab projectId={id} projectName={project?.name} />
          </TabsContent>
          <TabsContent value="feasibility" className="m-0">
            <ProjectFeasibilityTab projectId={id} />
          </TabsContent>
          <TabsContent value="team" className="m-0">
            <ProjectTeamPanel project={project} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
