'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, ShieldAlert, MoreHorizontal, Pencil, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ApiError } from '@/lib/api-client'
import {
  useUsers, useCreateUser, useUpdateUser, useChangeUserRole, useSetUserActive,
  type User,
} from '@/hooks/use-users'
import { useIsAdmin, useCurrentUser } from '@/hooks/use-auth'

/**
 * User administration.
 *
 * SECURITY NOTES
 *  - No credential ever passes through this screen. `passwordHash`, tokens and
 *    `mfaSecret` are not in the API's response shape at all, and the CRM does
 *    not offer a password field: a new user signs in via a one-time code. The
 *    API's `POST /users/:id/password` endpoint exists for an out-of-band admin
 *    flow and is deliberately NOT wired here.
 *  - Role change and deactivation are separate, separately-audited endpoints,
 *    and both confirm before firing.
 *  - Hiding these controls from non-admins is convenience only. Every /users
 *    route is `@Roles(...ADMIN_ROLES)` and answers 403 regardless of what the
 *    browser renders.
 */

/** UserRole values a tenant admin may assign. SUPER_ADMIN is not tenant-scoped. */
const ASSIGNABLE_ROLES: Record<string, string> = {
  COMPANY_ADMIN:              'מנהל מערכת',
  PROJECT_MANAGER:            'מנהל פרויקט',
  RESIDENT_RELATIONS_MANAGER: 'מנהל קשרי דיירים',
  FIELD_AGENT:                'נציג שטח',
  LAWYER:                     'עורך דין',
  ARCHITECT:                  'אדריכל',
  ENGINEER:                   'מהנדס',
  DEVELOPER_REP:              'נציג יזם',
  MUNICIPALITY_USER:          'משתמש עירייה',
  EXTERNAL_CONSULTANT:        'יועץ חיצוני',
}

const ALL_ROLE_LABELS: Record<string, string> = {
  ...ASSIGNABLE_ROLES,
  SUPER_ADMIN: 'מנהל־על',
  RESIDENT:    'דייר',
  CEO:         'מנכ״ל',
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return 'מעולם לא'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function NewUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', role: 'FIELD_AGENT' })
  const create = useCreateUser()

  const valid = form.firstName.trim() && form.lastName.trim() && form.email.trim()

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!n) create.reset(); onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">משתמש חדש</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            create.mutate(
              {
                firstName: form.firstName.trim(),
                lastName:  form.lastName.trim(),
                email:     form.email.trim(),
                role:      form.role,
              },
              { onSuccess: () => { setForm({ firstName: '', lastName: '', email: '', role: 'FIELD_AGENT' }); onOpenChange(false) } },
            )
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-first">שם פרטי *</Label>
              <Input id="u-first" value={form.firstName} required
                onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-last">שם משפחה *</Label>
              <Input id="u-last" value={form.lastName} required
                onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-email">אימייל *</Label>
            <Input id="u-email" type="email" value={form.email} required
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>תפקיד</Label>
            <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))} dir="rtl">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ASSIGNABLE_ROLES).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* No password field on purpose: the CRM never handles credentials.
              The user is created without one and signs in via OTP / a reset. */}
          <p className="text-xs text-muted-foreground">
            המשתמש נוצר ללא סיסמה ויתחבר באמצעות קוד חד־פעמי.
          </p>

          {create.isError && (
            <p className="text-sm text-red-600" role="alert">
              {create.error instanceof Error ? create.error.message : 'יצירת המשתמש נכשלה'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!valid || create.isPending}>
              {create.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              יצירה
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Profile edit only. Role and active state are NOT editable here by design. */
function EditUserDialog({
  open, onOpenChange, user,
}: { open: boolean; onOpenChange: (o: boolean) => void; user: User | null }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const update = useUpdateUser()

  useEffect(() => {
    if (!open || !user) return
    setForm({ firstName: user.firstName, lastName: user.lastName, email: user.email ?? '', phone: '' })
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id])

  const valid = form.firstName.trim() && form.lastName.trim()

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!update.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">עריכת משתמש</DialogTitle>
          <DialogDescription className="text-right">
            שינוי תפקיד והשבתה מתבצעים בנפרד, מתפריט הפעולות.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid || !user) return
            update.mutate(
              {
                id: user.id,
                firstName: form.firstName.trim(),
                lastName:  form.lastName.trim(),
                ...(form.email.trim() ? { email: form.email.trim() } : {}),
                ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
              },
              { onSuccess: () => onOpenChange(false) },
            )
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ue-first">שם פרטי *</Label>
              <Input id="ue-first" value={form.firstName} required
                onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ue-last">שם משפחה *</Label>
              <Input id="ue-last" value={form.lastName} required
                onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ue-email">אימייל</Label>
            <Input id="ue-email" type="email" value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ue-phone">טלפון</Label>
            <Input id="ue-phone" value={form.phone} dir="ltr" className="text-left"
              onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>

          {update.isError && (
            <p className="text-sm text-red-600" role="alert">
              {update.error instanceof Error ? update.error.message : 'עדכון המשתמש נכשל'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!valid || update.isPending}>
              {update.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              שמירה
            </Button>
            <Button type="button" variant="outline" disabled={update.isPending}
              onClick={() => onOpenChange(false)}>ביטול</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Role change — its own dialog because it is a privilege escalation surface. */
function RoleDialog({
  open, onOpenChange, user,
}: { open: boolean; onOpenChange: (o: boolean) => void; user: User | null }) {
  const [role, setRole] = useState('FIELD_AGENT')
  const change = useChangeUserRole()

  useEffect(() => {
    if (!open || !user) return
    setRole(user.role)
    change.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id])

  const changed = Boolean(user) && role !== user?.role

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!change.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שינוי תפקיד</DialogTitle>
          <DialogDescription className="text-right">
            התפקיד קובע לאילו נתונים ופעולות יש למשתמש גישה. השינוי נרשם ביומן
            הביקורת ונכנס לתוקף בכניסה הבאה למערכת.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>תפקיד</Label>
          <Select value={role} onValueChange={setRole} dir="rtl">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ASSIGNABLE_ROLES).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {changed && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {user?.firstName} {user?.lastName}: {ALL_ROLE_LABELS[user?.role ?? ''] ?? user?.role}
            {' → '}
            <span className="font-semibold">{ASSIGNABLE_ROLES[role]}</span>
          </p>
        )}

        {change.isError && (
          <p className="text-sm text-red-600" role="alert">
            {change.error instanceof Error ? change.error.message : 'שינוי התפקיד נכשל'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            disabled={!changed || change.isPending}
            onClick={() => user && change.mutate({ id: user.id, role }, { onSuccess: () => onOpenChange(false) })}
          >
            {change.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
            שינוי תפקיד
          </Button>
          <Button type="button" variant="outline" disabled={change.isPending}
            onClick={() => onOpenChange(false)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UsersPanel() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser,   setEditUser]   = useState<User | null>(null)
  const [roleUser,   setRoleUser]   = useState<User | null>(null)
  const [activeUser, setActiveUser] = useState<User | null>(null)

  const { data, isLoading, isError, error, refetch } = useUsers()
  const setActive = useSetUserActive()
  const isAdmin   = useIsAdmin()
  const { data: me } = useCurrentUser()

  // GET /users is ADMIN_ROLES-only. A 403 is a legitimate answer, not a failure.
  const forbidden = error instanceof ApiError && error.status === 403

  if (!isAdmin || forbidden) {
    return (
      <div className="card-surface p-6 text-center space-y-2">
        <ShieldAlert className="mx-auto text-muted-foreground" size={22} />
        <p className="text-sm text-foreground">ניהול משתמשים</p>
        <p className="text-sm text-muted-foreground">
          הרשאות ניהול משתמשים שמורות למנהלי מערכת בלבד.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">משתמשים</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            ניהול חברי הצוות והרשאותיהם
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus size={15} />
          משתמש חדש
        </Button>
      </div>

      <div className="card-surface overflow-hidden">
        {isLoading ? (
          <RowsSkeleton rows={4} />
        ) : isError || !data ? (
          <div className="p-4">
            <QueryError message="שגיאה בטעינת המשתמשים" error={error} onRetry={() => refetch()} />
          </div>
        ) : data.length === 0 ? (
          <EmptyState message="אין משתמשים" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right font-semibold">משתמש</TableHead>
                <TableHead className="text-right font-semibold">אימייל</TableHead>
                <TableHead className="text-right font-semibold">תפקיד</TableHead>
                <TableHead className="text-right font-semibold">כניסה אחרונה</TableHead>
                <TableHead className="text-right font-semibold">סטטוס</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(u => {
                const isSelf = me?.userId === u.id
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                            {u.firstName.slice(0, 1)}{u.lastName.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {u.firstName} {u.lastName}
                          {isSelf && <span className="mr-1.5 text-xs text-muted-foreground">(אני)</span>}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-sm">{ALL_ROLE_LABELS[u.role] ?? u.role}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatLastLogin(u.lastLoginAt)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          u.isActive
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                      >
                        {u.isActive ? 'פעיל' : 'מושבת'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal size={15} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[11rem]">
                          <DropdownMenuItem onSelect={() => setEditUser(u)}>
                            <Pencil size={14} className="ml-2" /> עריכת פרטים
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={isSelf} onSelect={() => setRoleUser(u)}>
                            <UserCog size={14} className="ml-2" /> שינוי תפקיד
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isSelf}
                            className={u.isActive ? 'text-red-600' : undefined}
                            onSelect={() => setActiveUser(u)}
                          >
                            <ShieldAlert size={14} className="ml-2" />
                            {u.isActive ? 'השבתת משתמש' : 'הפעלת משתמש'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <NewUserDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <EditUserDialog open={Boolean(editUser)} onOpenChange={(o) => { if (!o) setEditUser(null) }} user={editUser} />
      <RoleDialog     open={Boolean(roleUser)} onOpenChange={(o) => { if (!o) setRoleUser(null) }} user={roleUser} />

      <ConfirmDialog
        open={Boolean(activeUser)}
        onOpenChange={(o) => { if (!o) setActiveUser(null) }}
        title={activeUser?.isActive ? 'השבתת משתמש' : 'הפעלת משתמש'}
        description={
          activeUser?.isActive
            ? `${activeUser.firstName} ${activeUser.lastName} לא יוכל להתחבר למערכת. הרשומות שיצר נשמרות והפעולה הפיכה.`
            : `${activeUser?.firstName ?? ''} ${activeUser?.lastName ?? ''} יוכל להתחבר למערכת שוב.`
        }
        destructive={Boolean(activeUser?.isActive)}
        confirmLabel={activeUser?.isActive ? 'השבתה' : 'הפעלה'}
        pending={setActive.isPending}
        error={setActive.error}
        onConfirm={() => {
          if (!activeUser) return
          setActive.mutate(
            { id: activeUser.id, isActive: !activeUser.isActive },
            { onSuccess: () => setActiveUser(null) },
          )
        }}
      />
    </div>
  )
}
