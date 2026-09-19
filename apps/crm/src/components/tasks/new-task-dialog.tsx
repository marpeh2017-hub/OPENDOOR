'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCreateTask } from '@/hooks/use-tasks'
import { useProjects } from '@/hooks/use-projects'
import { useUsers } from '@/hooks/use-users'
import { TASK_TYPE, TASK_PRIORITY } from './tasks-board'

const NONE = '__none__'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-select a project (used from the project detail screen). */
  defaultProjectId?: string
}

export function NewTaskDialog({ open, onOpenChange, defaultProjectId }: Props) {
  const [title, setTitle]           = useState('')
  const [type, setType]             = useState('GENERAL')
  const [priority, setPriority]     = useState('MEDIUM')
  const [dueDate, setDueDate]       = useState('')
  const [projectId, setProjectId]   = useState(defaultProjectId ?? NONE)
  const [assigneeId, setAssigneeId] = useState(NONE)
  const [description, setDescription] = useState('')

  const { data: projects } = useProjects({ limit: 100 })
  const { data: users }    = useUsers()
  const createTask         = useCreateTask()

  function reset() {
    setTitle(''); setType('GENERAL'); setPriority('MEDIUM'); setDueDate('')
    setProjectId(defaultProjectId ?? NONE); setAssigneeId(NONE); setDescription('')
    createTask.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    createTask.mutate(
      {
        title: title.trim(),
        type,
        priority,
        status: 'PENDING',
        // Send a full ISO timestamp — Prisma DateTime rejects a bare date string.
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
        projectId:  projectId  === NONE ? null : projectId,
        assigneeId: assigneeId === NONE ? null : assigneeId,
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => { reset(); onOpenChange(false) },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}
    >
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">משימה חדשה</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">כותרת המשימה *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: התקשר לדייר בדירה 4"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>סוג</Label>
              <Select value={type} onValueChange={setType} dir="rtl">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_TYPE).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>עדיפות</Label>
              <Select value={priority} onValueChange={setPriority} dir="rtl">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY).map(([v, c]) => (
                    <SelectItem key={v} value={v}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">תאריך יעד</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>פרויקט</Label>
              <Select value={projectId} onValueChange={setProjectId} dir="rtl">
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא</SelectItem>
                  {projects?.data.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {users && users.length > 0 && (
            <div className="space-y-1.5">
              <Label>אחראי</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId} dir="rtl">
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">תיאור</Label>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="פרטים נוספים (אופציונלי)"
            />
          </div>

          {createTask.isError && (
            <p className="text-sm text-red-600" role="alert">
              {createTask.error instanceof Error ? createTask.error.message : 'יצירת המשימה נכשלה'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={createTask.isPending || !title.trim()}>
              {createTask.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              יצירת משימה
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
