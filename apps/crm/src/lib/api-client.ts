/**
 * Typed API client for the Urban Renewal OS API Gateway.
 *
 * Requests go to the SAME-ORIGIN BFF proxy at /api/proxy/*, which reads the
 * httpOnly `access_token` cookie server-side and forwards it upstream as an
 * `Authorization: Bearer` header. The token is never exposed to this code.
 *
 * On 401 the client attempts a token refresh once, retries, then redirects to
 * /he/login. 403 (RBAC denial) is surfaced as an ApiError and never triggers
 * a refresh or a redirect.
 */

const PROXY_BASE = '/api/proxy'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Deduplicate concurrent refreshes so a burst of 401s triggers only one call. */
let inflightRefresh: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!inflightRefresh) {
    inflightRefresh = fetch('/api/auth/refresh', { method: 'POST' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        // Clear on the next tick so concurrent callers share this result.
        setTimeout(() => { inflightRefresh = null }, 0)
      })
  }
  return inflightRefresh
}

async function parseError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] }
  if (Array.isArray(data.message)) return data.message.join(', ')
  return data.message ?? `HTTP ${res.status}`
}

async function parseBody<T>(res: Response): Promise<T> {
  if (res.status === 204 || res.status === 304) return undefined as unknown as T
  const text = await res.text()
  if (!text) return undefined as unknown as T
  return JSON.parse(text) as T
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${PROXY_BASE}${path.startsWith('/') ? path : `/${path}`}`

  // A FormData body MUST NOT get an explicit Content-Type: only the browser can
  // generate the `multipart/form-data; boundary=...` value, and overwriting it
  // with `application/json` makes the upstream unable to parse the parts.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  const doFetch = () =>
    fetch(url, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      // Same-origin: the httpOnly cookie is sent automatically. No CORS involved.
      credentials: 'same-origin',
      cache: 'no-store',
    })

  let res = await doFetch()

  // Token expired or missing — try refresh once, then retry.
  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      res = await doFetch()
    }

    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/he/login'
      }
      throw new ApiError(401, 'לא מחובר')
    }
  }

  if (!res.ok) {
    // 403 and everything else propagate as-is — no redirect, no refresh.
    throw new ApiError(res.status, await parseError(res))
  }

  return parseBody<T>(res)
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
export const api = {
  get:    <T>(path: string)                => request<T>(path),
  post:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body ?? {}) }),
  patch:  <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body ?? {}) }),
  put:    <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }),
}

/**
 * Download a server-generated file through the same BFF as every other CRM
 * request. This deliberately never exposes the httpOnly access token to the
 * browser; it also keeps a 403 as a permission error rather than a redirect.
 */
export async function download(path: string, body?: unknown): Promise<{ blob: Blob; fileName: string }> {
  const url = `${PROXY_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const attempt = () => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    credentials: 'same-origin',
    cache: 'no-store',
  })
  let res = await attempt()
  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) res = await attempt()
    if (res.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/he/login'
      throw new ApiError(401, 'לא מחובר')
    }
  }
  if (!res.ok) throw new ApiError(res.status, await parseError(res))
  const disposition = res.headers.get('content-disposition') ?? ''
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  return { blob: await res.blob(), fileName: match?.[1] ?? 'feasibility-report' }
}

/**
 * Multipart upload with real byte-level progress.
 *
 * Uses XMLHttpRequest rather than `fetch` because `fetch` exposes no upload
 * progress events, and the CRM must show a moving progress bar instead of an
 * indeterminate spinner. Everything else matches `request()`: it goes to the
 * same-origin BFF proxy (so the httpOnly cookie is attached automatically and
 * the token never enters this code), and a 401 triggers exactly one refresh +
 * retry before redirecting to login. 403 propagates as an ApiError — it is an
 * RBAC denial, not an expired session.
 *
 * `onProgress` receives 0–100, or null once the request is fully uploaded and
 * the server is still working.
 */
export async function upload<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number | null) => void,
): Promise<T> {
  const url = `${PROXY_BASE}${path.startsWith('/') ? path : `/${path}`}`

  const attempt = () =>
    new Promise<{ status: number; text: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, true)
      xhr.withCredentials = true
      // No Content-Type set on purpose — XHR derives the multipart boundary.
      xhr.upload.onprogress = (e) => {
        if (!onProgress) return
        onProgress(e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : null)
      }
      xhr.upload.onload = () => onProgress?.(null)
      xhr.onload  = () => resolve({ status: xhr.status, text: xhr.responseText })
      xhr.onerror = () => reject(new ApiError(0, 'העלאת הקובץ נכשלה — בעיית רשת'))
      xhr.onabort = () => reject(new ApiError(0, 'ההעלאה בוטלה'))
      xhr.send(form)
    })

  let res = await attempt()

  if (res.status === 401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) res = await attempt()
    if (res.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/he/login'
      throw new ApiError(401, 'לא מחובר')
    }
  }

  let payload: { message?: string | string[] } = {}
  try { payload = res.text ? JSON.parse(res.text) : {} } catch { /* non-JSON body */ }

  if (res.status < 200 || res.status >= 300) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message ?? `HTTP ${res.status}`
    throw new ApiError(res.status, message)
  }

  return payload as T
}

export { ApiError }
