'use client'

import { useState, Suspense } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectsTable }      from '@/components/projects/projects-table'
import { ProjectsStats }      from '@/components/projects/projects-stats'
import { ProjectsFilters }    from '@/components/projects/projects-filters'
import { NewProjectWizard }   from '@/components/projects/new-project-wizard'
import { CardSkeleton }       from '@/components/ui/skeletons'

export default function ProjectsPage() {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">פרויקטים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ניהול כל פרויקטי ההתחדשות העירונית</p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus size={16} />
          פרויקט חדש
        </Button>
      </div>

      <Suspense fallback={
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      }>
        <ProjectsStats />
      </Suspense>

      <div className="card-surface">
        <ProjectsFilters />
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">טוען פרויקטים...</div>}>
          <ProjectsTable />
        </Suspense>
      </div>

      <NewProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}
