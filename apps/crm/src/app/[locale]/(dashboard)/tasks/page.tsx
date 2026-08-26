import { TasksBoard } from '@/components/tasks/tasks-board'

export const metadata = { title: 'משימות' }

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">משימות</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            מעקב אחר משימות הצוות לפי פרויקט, אחראי וסטטוס
          </p>
        </div>
      </div>

      <TasksBoard />
    </div>
  )
}
