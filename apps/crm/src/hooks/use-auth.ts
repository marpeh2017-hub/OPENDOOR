import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/** Shape returned by GET /auth/me — the decoded JWT payload (never the token). */
export interface CurrentUser {
  userId:   string
  email:    string
  role:     string
  tenantId: string
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn:  () => api.get<CurrentUser>('/auth/me'),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/**
 * Log out.
 *
 * Goes to the Next.js route handler (NOT the BFF proxy) because the handler has
 * to clear the httpOnly cookies on this origin — only a same-origin route
 * handler can issue those Set-Cookie headers. It also revokes the session
 * server-side via the API Gateway before clearing.
 *
 * After a successful call the react-query cache is dropped so no authenticated
 * data survives into the login screen, and a full navigation (not a client-side
 * push) is used so middleware re-evaluates the now-absent cookie.
 */
export function useLogout() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) throw new Error('התנתקות נכשלה')
      return true
    },
    onSettled: () => {
      qc.clear()
      if (typeof window !== 'undefined') {
        window.location.href = '/he/login'
      }
    },
  })
}

const MANAGER_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER']
const ADMIN_ROLES   = ['SUPER_ADMIN', 'COMPANY_ADMIN']

/** Mirrors MANAGER_ROLES in services/api-gateway/src/auth/roles.constants.ts. */
export function useIsManager(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role && MANAGER_ROLES.includes(data.role))
}

/**
 * Mirrors DOCUMENT_WRITE_ROLES in
 * services/api-gateway/src/auth/roles.constants.ts.
 *
 * MUNICIPALITY_USER and EXTERNAL_CONSULTANT are read-only observers of the
 * document library. This hook only HIDES the upload control — the API is the
 * enforcement point and returns 403 for those roles regardless.
 */
const DOCUMENT_WRITE_ROLES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'RESIDENT_RELATIONS_MANAGER',
  'FIELD_AGENT', 'LAWYER', 'ARCHITECT', 'ENGINEER', 'DEVELOPER_REP',
]

export function useCanWriteDocuments(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role && DOCUMENT_WRITE_ROLES.includes(data.role))
}

/**
 * Mirrors IMPORT_ROLES in
 * services/api-gateway/src/auth/roles.constants.ts.
 *
 * FIELD_AGENT is included — field agents collect the owner sheets, so making
 * them wait on a manager to upload one made them the bottleneck on their own
 * task. Still narrower than document upload: LAWYER, ARCHITECT, ENGINEER and
 * DEVELOPER_REP read the project but do not maintain its owner roster.
 *
 * MUST be kept in step with the server list. This hook only HIDES the control —
 * the endpoint returns 403 for every other role regardless, and the E2E suite
 * asserts both directions.
 */
const IMPORT_ROLES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'FIELD_AGENT',
]

export function useCanImport(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role && IMPORT_ROLES.includes(data.role))
}

/** Mirrors ADMIN_ROLES — user management and tenant edits are admin-only. */
export function useIsAdmin(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role && ADMIN_ROLES.includes(data.role))
}

/**
 * Mirrors MEETING_WRITE_ROLES in
 * services/api-gateway/src/auth/roles.constants.ts.
 *
 * Same split as documents: MUNICIPALITY_USER and EXTERNAL_CONSULTANT attend
 * meetings and can answer their OWN invitation, but do not convene, move or
 * cancel them. This hook only HIDES those controls — the endpoint returns 403
 * for those roles regardless, and the E2E suite asserts that independently so
 * this hook can never become the real boundary.
 */
const MEETING_WRITE_ROLES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'RESIDENT_RELATIONS_MANAGER',
  'FIELD_AGENT', 'LAWYER', 'ARCHITECT', 'ENGINEER', 'DEVELOPER_REP',
]

/** Mirrors FEASIBILITY_EDIT_ROLES. Server RBAC remains authoritative. */
const FEASIBILITY_EDIT_ROLES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'LAWYER', 'ARCHITECT', 'ENGINEER',
]

export function useCanEditFeasibility(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role && FEASIBILITY_EDIT_ROLES.includes(data.role))
}

export function useCanWriteMeetings(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.role && MEETING_WRITE_ROLES.includes(data.role))
}

/**
 * Site Manager (CMS) capabilities.
 *
 * Mirrors CMS_VIEW_ROLES / CMS_EDIT_ROLES / CMS_VERIFY_ROLES /
 * CMS_PUBLISH_ROLES in services/api-gateway/src/auth/roles.constants.ts.
 *
 * These hooks only HIDE controls. The API is the enforcement point and answers
 * 403 regardless of what the UI renders, which the E2E suite proves by driving
 * the endpoints with a viewer's token.
 *
 * The tiers narrow faster than elsewhere in this file because the blast radius
 * differs: a CRM mistake reaches a project team, a website mistake reaches
 * every resident and Google and stays quotable after correction.
 */
const CMS_VIEW_ROLES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'CEO', 'PROJECT_MANAGER', 'RESIDENT_RELATIONS_MANAGER',
]
/** CEO reads and does not edit: the drafting queue belongs to who maintains it. */
const CMS_EDIT_ROLES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'RESIDENT_RELATIONS_MANAGER',
]
/** Verification is "I checked this against the source", so it needs the sources. */
const CMS_VERIFY_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER']
/** The only tier that changes what the public can read. Restore lives here too. */
const CMS_PUBLISH_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN']

export function useCmsPermissions(): {
  canView: boolean
  canEdit: boolean
  canVerify: boolean
  canPublish: boolean
} {
  const { data } = useCurrentUser()
  const role = data?.role
  return {
    canView: Boolean(role && CMS_VIEW_ROLES.includes(role)),
    canEdit: Boolean(role && CMS_EDIT_ROLES.includes(role)),
    canVerify: Boolean(role && CMS_VERIFY_ROLES.includes(role)),
    canPublish: Boolean(role && CMS_PUBLISH_ROLES.includes(role)),
  }
}
