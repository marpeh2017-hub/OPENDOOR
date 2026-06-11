/**
 * Typed API client for the Urban Renewal OS API Gateway.
 * All requests attach the access_token cookie automatically (httpOnly → browser sends it).
 * On 401, the client attempts a token refresh once, then redirects to /login.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch('/api/auth/refresh', { method: 'POST' })
  return res.ok
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}/api/v1${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })

  // Token expired — try refresh once
  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      // Retry original request
      const retry = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'include',
      })
      if (retry.ok) return retry.json() as Promise<T>
    }
    // Refresh failed → redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/he/login'
    }
    throw new ApiError(401, 'לא מחובר')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { message?: string }
    throw new ApiError(res.status, data.message ?? `HTTP ${res.status}`)
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T

  return res.json() as Promise<T>
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
export const api = {
  get:    <T>(path: string)                          => request<T>(path),
  post:   <T>(path: string, body: unknown)           => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)           => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)           => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                          => request<T>(path, { method: 'DELETE' }),
}

export { ApiError }
