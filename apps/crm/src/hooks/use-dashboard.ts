import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface DashboardKpis {
  activeProjects:     number
  activeResidents:    number
  avgSignaturePct:    number
  newLeadsThisMonth:  number
  projectsChange:     number
  residentsChange:    number
  signaturesChange:   number
  leadsChange:        number
}

export interface SignatureTrend {
  month:      string
  signatures: number
  target:     number
}

export interface DashboardStats {
  kpis:            DashboardKpis
  signatureTrend:  SignatureTrend[]
  activeProjects:  Array<{
    id:        string
    name:      string
    stage:     string
    signatures: number
    residents:  number
  }>
  recentActivity: Array<{
    id:      string
    type:    string
    user:    string
    action:  string
    project?: string
    time:    string
  }>
  upcomingTasks: Array<{
    id:       string
    title:    string
    due:      string
    priority: string
    type:     string
  }>
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn:  () => api.get<DashboardStats>('/dashboard/stats'),
    staleTime: 60_000,
    // Return mock while API is not ready
    placeholderData: undefined,
  })
}
