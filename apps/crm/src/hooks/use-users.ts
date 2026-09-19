import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api-client'

/** Mirrors UsersController.findAll (admin roles only — non-admins get 403). */
export interface User {
  id:          string
  email:       string
  firstName:   string
  lastName:    string
  role:        string
  isActive:    boolean
  lastLoginAt: string | null
  createdAt:   string
}

export const userKeys = {
  all:   () => ['users'] as const,
  lists: () => [...userKeys.all(), 'list'] as const,
}

/**
 * Listing users requires an admin role. Callers that merely want to populate a
 * picker should treat a 403 as "no options" rather than an error, so we do not
 * retry on 403.
 */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn:  () => api.get<User[]>('/users'),
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 403) return false
      return failureCount < 2
    },
  })
}

/** Mirrors the body accepted by POST /users (UsersController.create). */
export interface CreateUserDto {
  email:     string
  firstName: string
  lastName:  string
  role:      string
  phone?:    string
  password?: string
}

/** POST /users — ADMIN_ROLES only. `passwordHash` is never returned. */
export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateUserDto) => api.post<User>('/users', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  })
}

/**
 * PATCH /users/:id — ADMIN_ROLES only.
 *
 * NOTE: UpdateUserDto accepts only firstName / lastName / email / phone /
 * language / avatarUrl. `role` and `isActive` are NOT on it — they have their
 * own separately-audited endpoints below, and the global ValidationPipe runs
 * with `forbidNonWhitelisted`, so sending them here is a 400, not a silent
 * no-op.
 */
export interface UpdateUserDto {
  firstName?: string
  lastName?:  string
  email?:     string
  phone?:     string
  language?:  string
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & UpdateUserDto) =>
      api.patch<User>(`/users/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  })
}

/** PATCH /users/:id/role — sensitive; the UI confirms before calling. */
export function useChangeUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch<User>(`/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  })
}

/** PATCH /users/:id/active — sensitive; the UI confirms before calling. */
export function useSetUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<User>(`/users/${id}/active`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  })
}
