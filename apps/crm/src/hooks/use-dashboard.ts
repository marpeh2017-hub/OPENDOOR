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

export interface DashboardProject {
  id:         string
  name:       string
  stage:      string
  /** Percent of units signed (0-100). */
  signatures: number
  totalUnits: number
}

export interface DashboardActivity {
  id:        string
  action:    string
  entity:    string
  entityId:  string
  userId:    string | null
  userName:  string | null
  createdAt: string
}

export interface DashboardTask {
  id:       string
  title:    string
  dueDate:  string | null
  priority: string
  assignee: string | null
}

export interface DashboardLeadStatus {
  status: string
  count:  number
}

export interface SignatureTrendPoint {
  month:      string
  /** Cumulative signed units as a percent of total units. */
  signatures: number
  target:     number
}

/** Mirrors DashboardService.getStats() in the API Gateway. */
export interface DashboardStats {
  kpis:           DashboardKpis
  activeProjects: DashboardProject[]
  signatureTrend: SignatureTrendPoint[]
  recentActivity: DashboardActivity[]
  upcomingTasks:  DashboardTask[]
  leadsByStatus:  DashboardLeadStatus[]
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn:  () => api.get<DashboardStats>('/dashboard/stats'),
    staleTime: 60_000,
  })
}
