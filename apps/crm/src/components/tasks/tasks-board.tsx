'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, CheckCircle2, Circle, Clock, Plus, Trash2, CalendarClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { cn } from '@/lib/utils'
import { useTasks, useUpdateTask, useDeleteTask, type Task } from '@/hooks/use-tasks'
import { useProjects } from '@/hooks/use-projects'
import { useUsers } from '@/hooks/use-users'
import { useIsManager } from '@/hooks/use-auth'
import { NewTaskDialog } from './new-task-dialog'

export const TASK_STATUS: Record<string, { label: string; cls: string; icon: typeof Circle }> = {
  PENDING:     { label: 'ממתין',   cls: 'text-muted-foreground', icon: Circle },
  IN_PROGRESS: { label: 'בביצוע',  cls: 'text-blue-600',         icon: Clock },
  COMPLETED:   { label: 'הושלם',   cls: 'text-green-600',        icon: CheckCircle2 },
  CANCELLED:   { label: 'בוטל',    cls: 'text-muted-foreground', icon: Circle },
  OVERDUE:     { label: 'באיחור',  cls: 'text-red-600',          icon: AlertCircle },
}

export const TASK_PRIORITY: Record<string, { label: string; cls: string }> = {
  URGENT: { label: 'דחוף',  cls: 'bg-red-100 text-red-700 border-red-200' },
  HIGH:   { label: 'גבוה',  cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  MEDIUM: { label: 'בינוני', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  LOW:    { label: 'נמוך',  cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}

export const TASK_TYPE: Record<string, string> = {
  CALL:                'שיחה',
  MEETING:             'פגישה',
  SIGNATURE_FOLLOWUP:  'מעקב חתימות',
  DOCUMENT_COLLECTION: 'איסוף מסמכים',
  SITE_VISIT:          'ביקור שטח',
  LEGAL_REVIEW:        'בדיקה משפטית',
  APPROVAL:            'אישור',
  GENERAL:             'כללי',
}

const OPEN_STATUSES = new Set(['PENDING', 'IN_PROGRESS'])

function isOverdue(task: Task): boolean {
  if (!task.dueDate || !OPEN_STATUSES.has(task.status)) return false
  const due = new Date(task.dueDate)
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now()
}

function formatDue(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function TasksBoard() {
  const [status, setStatus]         = useState<string>('ALL')
  const [projectId, setProjectId]   = useState<string>('ALL')
  const [assigneeId, setAssigneeId] = useState<string>('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)

  const filters = {
    ...(status     !== 'ALL' ? { status }     : {}),
    ...(projectId  !== 'ALL' ? { projectId }  : {}),
    ...(assigneeId !== 'ALL' ? { assigneeId } : {}),
  }

  const { data, isLoading, isError, error, refetch } = useTasks(filters)
  const { data: projects } = useProjects({ limit: 100 })
  const { data: users }    = useUsers()      // 403 for non-admins → undefined, picker hides
  const canDelete          = useIsManager()  // mirrors MANAGER_ROLES on DELETE /tasks/:id

  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const projectName = useMemo(() => {
    const map = new Map<string, string>()
    projects?.data.forEach(p => map.set(p.id, p.name))
    return map
  }, [projects])

  const overdueCount = data?.filter(isOverdue).length ?? 0

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus} dir="rtl">
          <SelectTrigger className="w-40"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הסטטוסים</SelectItem>
            {Object.entries(TASK_STATUS).map(([v, c]) => (
              <SelectItem key={v} value={v}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectId} onValueChange={setProjectId} dir="rtl">
          <SelectTrigger className="w-52"><SelectValue placeholder="פרויקט" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">כל הפרויקטים</SelectItem>
            {projects?.data.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {users && users.length > 0 && (
          <Select value={assigneeId} onValueChange={setAssigneeId} dir="rtl">
            <SelectTrigger className="w-48"><SelectValue placeholder="אחראי" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">כל האחראים</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1" />

        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            <CalendarClock size={13} />
            {overdueCount} באיחור
          </span>
        )}

        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus size={16} />
          משימה חדשה
        </Button>
      </div>

      <div className="card-surface overflow-hidden">
        {isLoading ? (
          <RowsSkeleton rows={6} />
        ) : isError || !data ? (
          <div className="p-4">
            <QueryError message="שגיאה בטעינת המשימות" error={error} onRetry={() => refetch()} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            message="אין משימות התואמות לסינון"
            hint="צרו משימה חדשה או נקו את הסינון"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right font-semibold">משימה</TableHead>
                <TableHead className="text-right font-semibold">פרויקט</TableHead>
                <TableHead className="text-right font-semibold">אחראי</TableHead>
                <TableHead className="text-right font-semibold">תאריך יעד</TableHead>
                <TableHead className="text-right font-semibold">עדיפות</TableHead>
                <TableHead className="text-right font-semibold">סטטוס</TableHead>
                {canDelete && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(task => {
                const statusCfg   = TASK_STATUS[task.status]     ?? TASK_STATUS.PENDING
                const priorityCfg = TASK_PRIORITY[task.priority] ?? TASK_PRIORITY.MEDIUM
                const StatusIcon  = statusCfg.icon
                const overdue     = isOverdue(task)
                const busy = (updateTask.isPending && updateTask.variables?.id === task.id)
                  || (deleteTask.isPending && deleteTask.variables === task.id)

                return (
                  <TableRow key={task.id} className={cn(busy && 'opacity-50')}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <StatusIcon size={15} className={cn('mt-0.5 flex-shrink-0', statusCfg.cls)} />
                        <div className="min-w-0">
                          <p className={cn(
                            'text-sm font-medium',
                            task.status === 'COMPLETED' && 'line-through text-muted-foreground',
                          )}>
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {TASK_TYPE[task.type] ?? task.type}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">
                      {task.projectId ? (
                        <Link href={`/projects/${task.projectId}`} className="text-primary hover:underline">
                          {projectName.get(task.projectId) ?? task.projectId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {task.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {task.assignee.firstName.slice(0, 1)}{task.assignee.lastName.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{task.assignee.firstName} {task.assignee.lastName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">לא הוקצה</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className={cn(
                        'inline-flex items-center gap-1 text-sm',
                        overdue ? 'font-semibold text-red-600' : 'text-foreground/80',
                      )}>
                        {overdue && <AlertCircle size={13} />}
                        {formatDue(task.dueDate)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                        priorityCfg.cls,
                      )}>
                        {priorityCfg.label}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={task.status}
                        dir="rtl"
                        onValueChange={(next) => {
                          if (next === task.status) return
                          updateTask.mutate({
                            id: task.id,
                            status: next,
                            // Stamp completion so the DB reflects the real transition.
                            completedAt: next === 'COMPLETED' ? new Date().toISOString() : null,
                          })
                        }}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TASK_STATUS).map(([v, c]) => (
                            <SelectItem key={v} value={v}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {canDelete && (
                      <TableCell>
                        <button
                          type="button"
                          aria-label={`מחיקת המשימה ${task.title}`}
                          className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          onClick={() => {
                            if (window.confirm(`למחוק את המשימה "${task.title}"?`)) {
                              deleteTask.mutate(task.id)
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {(updateTask.isError || deleteTask.isError) && (
        <QueryError
          message="הפעולה נכשלה"
          error={updateTask.error ?? deleteTask.error}
        />
      )}

      <NewTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
