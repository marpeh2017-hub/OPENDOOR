'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  useProjectMembers, useAddProjectMember, useRemoveProjectMember,
  useAssignProjectTeam, type ProjectDetail, type ProjectMember,
} from '@/hooks/use-projects'
import { useUsers } from '@/hooks/use-users'
import { useIsManager } from '@/hooks/use-auth'

/**
 * Project team: the three named roles (manager / lawyer / architect) plus the
 * open members list.
 *
 * The named slots go through PATCH /projects/:id/team, where `null` clears a
 * slot and an omitted field is left untouched. Members are their own
 * add/remove endpoints. All are MANAGER_ROLES-only; hiding the controls is
 * convenience, the endpoints answer 403 regardless.
 */

const NONE = '__none__'

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'מנהל־על', COMPANY_ADMIN: 'מנהל מערכת', CEO: 'מנכ״ל',
  PROJECT_MANAGER: 'מנהל פרויקט', RESIDENT_RELATIONS_MANAGER: 'מנהל קשרי דיירים',
  FIELD_AGENT: 'נציג שטח', LAWYER: 'עורך דין', ARCHITECT: 'אדריכל',
  ENGINEER: 'מהנדס', DEVELOPER_REP: 'נציג יזם', MUNICIPALITY_USER: 'משתמש עירייה',
  EXTERNAL_CONSULTANT: 'יועץ חיצוני', RESIDENT: 'דייר',
}

const SLOTS = [
  { key: 'projectManagerId', label: 'מנהל פרויקט' },
  { key: 'lawyerId',         label: 'עורך דין' },
  { key: 'architectId',      label: 'אדריכל' },
] as const

function initials(first?: string, last?: string) {
  return `${(first ?? '').slice(0, 1)}${(last ?? '').slice(0, 1)}` || '—'
}

function TeamDialog({
  open, onOpenChange, project,
}: { open: boolean; onOpenChange: (o: boolean) => void; project: ProjectDetail }) {
  const [slots, setSlots] = useState<Record<string, string>>({})
  const { data: users } = useUsers()
  const assign = useAssignProjectTeam()

  useEffect(() => {
    if (!open) return
    setSlots({
      projectManagerId: project.projectManagerId ?? NONE,
      lawyerId:         project.lawyerId ?? NONE,
      architectId:      project.architectId ?? NONE,
    })
    assign.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id])

  function submit() {
    assign.mutate(
      {
        id: project.id,
        // NONE means "clear this slot" and must be sent as an explicit null —
        // omitting the field would leave the existing assignment in place.
        projectManagerId: slots.projectManagerId === NONE ? null : slots.projectManagerId,
        lawyerId:         slots.lawyerId         === NONE ? null : slots.lawyerId,
        architectId:      slots.architectId      === NONE ? null : slots.architectId,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!assign.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שיוך צוות</DialogTitle>
          <DialogDescription className="text-right">
            בחירת ״ללא״ מנקה את השיוך הקיים.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {SLOTS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Select
                value={slots[key] ?? NONE}
                onValueChange={(v) => setSlots(s => ({ ...s, [key]: v }))}
                dir="rtl"
              >
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא</SelectItem>
                  {(users ?? []).map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} · {ROLE_LABELS[u.role] ?? u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {assign.isError && (
          <p className="text-sm text-red-600" role="alert">
            {assign.error instanceof Error ? assign.error.message : 'שיוך הצוות נכשל'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" disabled={assign.isPending} onClick={submit}>
            {assign.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
            שמירה
          </Button>
          <Button type="button" variant="outline" disabled={assign.isPending}
            onClick={() => onOpenChange(false)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddMemberDialog({
  open, onOpenChange, projectId, existing,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  projectId: string
  existing: Set<string>
}) {
  const [userId, setUserId] = useState(NONE)
  const { data: users } = useUsers()
  const add = useAddProjectMember()

  useEffect(() => {
    if (!open) return
    setUserId(NONE)
    add.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const available = (users ?? []).filter(u => !existing.has(u.id))

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!add.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">הוספת חבר צוות</DialogTitle>
          <DialogDescription className="text-right">
            התפקיד בפרויקט נקבע לפי תפקיד המשתמש במערכת.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>משתמש</Label>
          <Select value={userId} onValueChange={setUserId} dir="rtl">
            <SelectTrigger><SelectValue placeholder="בחרו משתמש" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>בחרו משתמש</SelectItem>
              {available.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} · {ROLE_LABELS[u.role] ?? u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {available.length === 0 && (
            <p className="text-xs text-muted-foreground">כל המשתמשים כבר משויכים לפרויקט.</p>
          )}
        </div>

        {add.isError && (
          <p className="text-sm text-red-600" role="alert">
            {add.error instanceof Error ? add.error.message : 'הוספת חבר הצוות נכשלה'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            disabled={userId === NONE || add.isPending}
            onClick={() => add.mutate({ id: projectId, userId }, { onSuccess: () => onOpenChange(false) })}
          >
            {add.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
            הוספה
          </Button>
          <Button type="button" variant="outline" disabled={add.isPending}
            onClick={() => onOpenChange(false)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectTeamPanel({ project }: { project: ProjectDetail }) {
  const canWrite = useIsManager()
  const members  = useProjectMembers(project.id)
  const remove   = useRemoveProjectMember()

  const [teamOpen,   setTeamOpen]   = useState(false)
  const [addOpen,    setAddOpen]    = useState(false)
  const [removeMem,  setRemoveMem]  = useState<ProjectMember | null>(null)

  const list = members.data ?? []
  const existing = new Set(list.map(m => m.user.id))

  return (
    <div className="space-y-5">
      <div className="card-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">בעלי תפקידים</h3>
          {canWrite && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTeamOpen(true)}>
              <UserCog size={14} />
              שיוך צוות
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'מנהל פרויקט', user: project.projectManager },
            { label: 'עורך דין',     user: project.lawyer },
            { label: 'אדריכל',       user: project.architect },
          ].map(({ label, user }) => (
            <div key={label} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              {user ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials(user.firstName, user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user.firstName} {user.lastName}</span>
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">לא שויך</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">חברי צוות</h3>
          {canWrite && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus size={14} />
              הוספה
            </Button>
          )}
        </div>

        {members.isLoading ? (
          <RowsSkeleton rows={3} />
        ) : members.isError ? (
          <div className="p-4">
            <QueryError message="שגיאה בטעינת חברי הצוות" error={members.error}
              onRetry={() => members.refetch()} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState message="אין חברי צוות משויכים" />
        ) : (
          <ul className="divide-y divide-border">
            {list.map(m => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials(m.user?.firstName, m.user?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {m.user?.firstName} {m.user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[m.role ?? m.user?.role ?? ''] ?? m.role ?? m.user?.role}
                  </p>
                </div>
                {canWrite && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="הסרה מהפרויקט"
                    onClick={() => setRemoveMem(m)}
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <TeamDialog open={teamOpen} onOpenChange={setTeamOpen} project={project} />
      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} projectId={project.id} existing={existing} />

      <ConfirmDialog
        open={Boolean(removeMem)}
        onOpenChange={(o) => { if (!o) setRemoveMem(null) }}
        title="הסרת חבר צוות"
        description={`${removeMem?.user?.firstName ?? ''} ${removeMem?.user?.lastName ?? ''} יוסר מהפרויקט ויאבד גישה לנתוניו.`}
        destructive
        confirmLabel="הסרה"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => {
          if (!removeMem) return
          remove.mutate(
            { id: project.id, memberId: removeMem.id },
            { onSuccess: () => setRemoveMem(null) },
          )
        }}
      />
    </div>
  )
}
