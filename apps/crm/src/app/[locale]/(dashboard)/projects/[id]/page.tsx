import Link from 'next/link'
import { ChevronRight, MapPin, Users, Calendar, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ProjectResidentsTab } from '@/components/projects/tabs/residents-tab'
import { ProjectSignaturesTab } from '@/components/projects/tabs/signatures-tab'
import { ProjectDocumentsTab } from '@/components/projects/tabs/documents-tab'
import { ProjectTasksTab } from '@/components/projects/tabs/tasks-tab'
import { ProjectTimelineTab } from '@/components/projects/tabs/timeline-tab'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Mock data – replace with API call
  const project = {
    id,
    code: 'TLV-001',
    name: 'רחוב הרצל 45',
    city: 'תל אביב',
    neighborhood: 'לב העיר',
    stage: 'SIGNATURES',
    stageLabel: 'חתימות',
    residents: 48,
    signed: 34,
    startDate: '01.01.2024',
    targetDate: '31.12.2026',
    projectManager: 'אבי שפירא',
    lawyer: 'עו"ד שרה לוי',
  }

  const signaturePct = Math.round((project.signed / project.residents) * 100)

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
                {project.stageLabel}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">{project.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-primary" />
                {project.city} · {project.neighborhood}
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-primary" />
                {project.residents} דיירים
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                {project.startDate} – {project.targetDate}
              </div>
            </div>
          </div>

          {/* Signature KPI */}
          <div className="bg-muted/40 rounded-xl p-4 min-w-56 border border-border">
            <div className="flex items-end justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">חתימות</span>
              <span className={`text-2xl font-black ${signaturePct >= 67 ? 'text-green-600' : signaturePct >= 51 ? 'text-primary' : 'text-orange-600'}`}>
                {signaturePct}%
              </span>
            </div>
            <Progress value={signaturePct} className="h-2 mb-1.5" />
            <p className="text-xs text-muted-foreground text-left">
              {project.signed} מתוך {project.residents} חתמו
            </p>
          </div>
        </div>

        {/* Team strip */}
        <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-border text-sm">
          <div>
            <span className="text-muted-foreground">מנהל פרויקט: </span>
            <span className="font-medium text-foreground">{project.projectManager}</span>
          </div>
          <div>
            <span className="text-muted-foreground">עורך דין: </span>
            <span className="font-medium text-foreground">{project.lawyer}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="residents" dir="rtl">
        <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none p-0 h-auto gap-0">
          {[
            { value: 'residents',  label: 'דיירים',   count: 48 },
            { value: 'signatures', label: 'חתימות',   count: 34 },
            { value: 'documents',  label: 'מסמכים',   count: 12 },
            { value: 'tasks',      label: 'משימות',   count: 7  },
            { value: 'timeline',   label: 'ציר זמן',  count: null },
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
        </div>
      </Tabs>
    </div>
  )
}
