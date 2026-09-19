'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QueryError, RowsSkeleton } from '@/components/ui/query-states'
import { useCurrentTenant, useUpdateTenant } from '@/hooks/use-tenant'
import { useIsAdmin } from '@/hooks/use-auth'

const PLAN_LABELS: Record<string, string> = {
  starter:    'Starter',
  growth:     'Growth',
  enterprise: 'Enterprise',
}

export function TenantProfileCard() {
  const { data: tenant, isLoading, isError, error, refetch } = useCurrentTenant()
  const update  = useUpdateTenant(tenant?.id)
  const canEdit = useIsAdmin() // PATCH /tenants/:id is SUPER_ADMIN / COMPANY_ADMIN

  const [form, setForm] = useState({ name: '', email: '', phone: '', website: '' })

  // Seed the form once the tenant arrives; server data stays the source of truth.
  useEffect(() => {
    if (tenant) {
      setForm({
        name:    tenant.name    ?? '',
        email:   tenant.email   ?? '',
        phone:   tenant.phone   ?? '',
        website: tenant.website ?? '',
      })
    }
  }, [tenant])

  if (isLoading) return <div className="card-surface"><RowsSkeleton rows={4} /></div>

  if (isError || !tenant) {
    return (
      <QueryError
        message="שגיאה בטעינת פרטי הארגון"
        error={error}
        onRetry={() => refetch()}
      />
    )
  }

  const dirty =
    form.name !== (tenant.name ?? '') ||
    form.email !== (tenant.email ?? '') ||
    form.phone !== (tenant.phone ?? '') ||
    form.website !== (tenant.website ?? '')

  return (
    <div className="card-surface p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">פרטי הארגון</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            מזהה: <span className="font-mono">{tenant.slug}</span>
            {' · '}
            תוכנית {PLAN_LABELS[tenant.plan] ?? tenant.plan}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          tenant.isActive
            ? 'bg-green-100 text-green-700 border-green-200'
            : 'bg-gray-100 text-gray-500 border-gray-200'
        }`}>
          {tenant.isActive ? 'פעיל' : 'לא פעיל'}
        </span>
      </div>

      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => { e.preventDefault(); update.mutate(form) }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="tenant-name">שם הארגון</Label>
          <Input
            id="tenant-name"
            value={form.name}
            disabled={!canEdit}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tenant-email">אימייל</Label>
          <Input
            id="tenant-email"
            type="email"
            value={form.email}
            disabled={!canEdit}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tenant-phone">טלפון</Label>
          <Input
            id="tenant-phone"
            value={form.phone}
            disabled={!canEdit}
            onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tenant-website">אתר</Label>
          <Input
            id="tenant-website"
            value={form.website}
            disabled={!canEdit}
            onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))}
          />
        </div>

        {canEdit && (
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={!dirty || update.isPending}>
              {update.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
              שמירת שינויים
            </Button>
            {update.isSuccess && !dirty && (
              <span className="text-sm text-green-600">נשמר</span>
            )}
            {update.isError && (
              <span className="text-sm text-red-600" role="alert">
                {update.error instanceof Error ? update.error.message : 'השמירה נכשלה'}
              </span>
            )}
          </div>
        )}

        {!canEdit && (
          <p className="sm:col-span-2 text-sm text-muted-foreground">
            עריכת פרטי הארגון מותרת למנהלי מערכת בלבד.
          </p>
        )}
      </form>
    </div>
  )
}
