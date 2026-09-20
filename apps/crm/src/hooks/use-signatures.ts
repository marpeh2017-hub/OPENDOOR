import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Signature packages live under /signatures/packages (SignaturesController).
 * Per-resident signature status for a project comes from the project's
 * signature report: GET /projects/:id/signature-report.
 */

export interface SignatureRecordSummary {
  id:       string
  status:   string
  required: boolean
}

export interface SignaturePackage {
  id:                 string
  tenantId:           string
  projectId:          string
  version:            number
  title:              string
  status:             string
  signingOrder:       string
  verificationMethod: string
  expiresAt:          string | null
  completedAt:        string | null
  cancelledAt:        string | null
  createdById:        string | null
  createdAt:          string
  updatedAt:          string
  records:            SignatureRecordSummary[]
}

export interface SignatureReportResident {
  id:              string
  firstName:       string
  lastName:        string
  signatureStatus: string
  phone:           string | null
}

export interface SignatureReport {
  totalUnits:  number
  signedUnits: number
  percentage:  number
  residents:   SignatureReportResident[]
}

export const sigKeys = {
  all:      ()                 => ['signatures'] as const,
  packages: (f: object)        => [...sigKeys.all(), 'packages', f] as const,
  pkg:      (id: string)       => [...sigKeys.all(), 'package', id] as const,
  report:   (projectId: string) => [...sigKeys.all(), 'report', projectId] as const,
}

/** Per-resident signature status for one project. */
export function useSignatureReport(projectId: string | undefined) {
  return useQuery({
    queryKey: sigKeys.report(projectId ?? ''),
    queryFn:  () => api.get<SignatureReport>(`/projects/${projectId}/signature-report`),
    enabled:  Boolean(projectId),
    staleTime: 30_000,
  })
}

export function useSignaturePackages(params?: { projectId?: string; status?: string }) {
  const q = new URLSearchParams()
  if (params?.projectId) q.set('projectId', params.projectId)
  if (params?.status)    q.set('status',    params.status)

  return useQuery({
    queryKey: sigKeys.packages(params ?? {}),
    queryFn:  () => api.get<SignaturePackage[]>(`/signatures/packages?${q.toString()}`),
    staleTime: 30_000,
  })
}

/** Send a reminder for one signer record inside a package. */
export function useSendReminder(packageId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) =>
      api.post<unknown>(`/signatures/packages/${packageId}/remind/${recordId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: sigKeys.pkg(packageId) }),
  })
}
