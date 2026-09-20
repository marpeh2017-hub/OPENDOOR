import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useCurrentUser } from './use-auth'

/**
 * Mirrors TenantsController.
 *
 * GET /tenants/:id is restricted to SUPER_ADMIN and COMPANY_ADMIN, and a
 * COMPANY_ADMIN may only read their own tenant — which is exactly what this
 * hook does: it reads the tenantId out of the current JWT payload rather than
 * accepting one from the caller.
 */
export interface Tenant {
  id:           string
  name:         string
  slug:         string
  domain:       string | null
  logoUrl:      string | null
  primaryColor: string
  website:      string | null
  email:        string | null
  phone:        string | null
  plan:         string
  isActive:     boolean
  createdAt:    string
}

export const tenantKeys = {
  detail: (id: string) => ['tenant', id] as const,
}

export function useCurrentTenant() {
  const { data: me } = useCurrentUser()
  const tenantId = me?.tenantId

  return useQuery({
    queryKey: tenantKeys.detail(tenantId ?? ''),
    queryFn:  () => api.get<Tenant>(`/tenants/${tenantId}`),
    enabled:  Boolean(tenantId),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useUpdateTenant(tenantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Pick<Tenant, 'name' | 'email' | 'phone' | 'website'>>) =>
      api.patch<Tenant>(`/tenants/${tenantId}`, patch),
    onSuccess: () => {
      if (tenantId) qc.invalidateQueries({ queryKey: tenantKeys.detail(tenantId) })
    },
  })
}
