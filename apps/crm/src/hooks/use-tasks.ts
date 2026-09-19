import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/** Mirrors TasksController (GET /tasks returns a bare array, not a page). */
export interface Task {
  id:          string
  tenantId:    string
  type:        string
  title:       string
  description: string | null
  status:      string
  priority:    string
  assigneeId:  string | null
  createdById: string | null
  dueDate:     string | null
  completedAt: string | null
  projectId:   string | null
  residentId:  string | null
  notes:       string | null
  createdAt:   string
  updatedAt:   string
  assignee?:   { id: string; firstName: string; lastName: string } | null
}

export const taskKeys = {
  all:   ()          => ['tasks'] as const,
  lists: ()          => [...taskKeys.all(), 'list'] as const,
  list:  (f: object) => [...taskKeys.lists(), f] as const,
}

export function useTasks(params?: { projectId?: string; assigneeId?: string; status?: string }) {
  const q = new URLSearchParams()
  if (params?.projectId)  q.set('projectId',  params.projectId)
  if (params?.assigneeId) q.set('assigneeId', params.assigneeId)
  if (params?.status)     q.set('status',     params.status)

  return useQuery({
    queryKey: taskKeys.list(params ?? {}),
    queryFn:  () => api.get<Task[]>(`/tasks?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<Task>) =>
      api.patch<Task>(`/tasks/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.lists() }),
  })
}

/** Mirrors the body accepted by POST /tasks (TasksController.create). */
export interface CreateTaskDto {
  title:        string
  type?:        string
  description?: string
  status?:      string
  priority?:    string
  assigneeId?:  string | null
  dueDate?:     string | null
  projectId?:   string | null
  residentId?:  string | null
  notes?:       string | null
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateTaskDto) => api.post<Task>('/tasks', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.lists() }),
  })
}

/** DELETE /tasks/:id is MANAGER_ROLES-only — non-managers get a 403 ApiError. */
export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<Task>(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.lists() }),
  })
}
