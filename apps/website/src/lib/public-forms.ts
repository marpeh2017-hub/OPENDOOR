import type { RepresentationProtocol } from '@urban-renewal/api-contracts'

/**
 * The gateway's public form endpoints (services/api-gateway, forms):
 * starting the representation protocol for a building that is not yet a
 * project, and the neighbours' link. The browser calls them directly, as the
 * lead form does; the neighbours' page reads its form on the server.
 */

export interface PublicFormMeeting {
  compoundName: string
  address: string
  meetingDate: string
  meetingPlace: string
}

/** What a neighbours' link shows. Nobody's details, by design. */
export interface PublicFormView {
  compoundName: string
  text: RepresentationProtocol
  meeting: PublicFormMeeting
  members: { fullName: string; apartmentNumber: string }[]
  signed: number
  open: boolean
}

export function publicApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '')
}

/** Server-side: the form behind a neighbours' link, or null when there is none. */
export async function getPublicForm(token: string): Promise<PublicFormView | null> {
  const base = publicApiBase()
  if (!base) return null
  const res = await fetch(`${base}/api/v1/public/forms/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) throw new Error(`Public form unavailable (${res.status})`)
  return (await res.json()) as PublicFormView
}

/** Browser-side POST to a public form endpoint; the message is the gateway's, in Hebrew. */
export async function postPublicForm<T>(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T & { message?: string | string[] } }> {
  const res = await fetch(`${publicApiBase()}/api/v1/public/forms${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

/** The Israeli ID number's check digit, as the gateway checks it. */
export function isValidIsraeliId(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (!/^\d{5,9}$/.test(digits)) return false
  const padded = digits.padStart(9, '0')
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const product = Number(padded[i]) * ((i % 2) + 1)
    sum += product > 9 ? product - 9 : product
  }
  return sum % 10 === 0
}

/** The gateway's error message, whichever shape it came in. */
export function messageOf(data: { message?: string | string[] }, fallback: string): string {
  if (Array.isArray(data.message)) return data.message[0] ?? fallback
  return data.message || fallback
}
