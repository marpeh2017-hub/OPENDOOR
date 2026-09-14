import { NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'http://localhost:4000'

/** Maximum accepted length per field, to bound payload size. */
const MAX = { firstName: 60, lastName: 60, phone: 25, address: 200, message: 2000 }

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'phone' | 'consent', string>>

/** Israeli mobile/landline, tolerant of spaces, dashes and +972. */
const PHONE_RE = /^(?:\+?972|0)(?:[23489]|5[0-9]|7[0-9])\d{7}$/

function normalizePhone(raw: string): string {
  return raw.replace(/[\s-()]/g, '')
}

function validate(body: Record<string, unknown>): FieldErrors {
  const errors: FieldErrors = {}
  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  const phone = normalizePhone(String(body.phone ?? ''))

  if (!firstName) errors.firstName = 'נא למלא שם פרטי'
  else if (firstName.length > MAX.firstName) errors.firstName = 'שם פרטי ארוך מדי'

  if (!lastName) errors.lastName = 'נא למלא שם משפחה'
  else if (lastName.length > MAX.lastName) errors.lastName = 'שם משפחה ארוך מדי'

  if (!phone) errors.phone = 'נא למלא מספר טלפון'
  else if (!PHONE_RE.test(phone)) errors.phone = 'מספר הטלפון אינו תקין'

  if (body.consent !== true) errors.consent = 'יש לאשר את תנאי השימוש ומדיניות הפרטיות'

  return errors
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
  }

  // Honeypot: a hidden field only a bot would fill. Answer 200 so the bot
  // sees success and does not retry, but drop the submission.
  if (String(body.company ?? '').trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const fieldErrors = validate(body)
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ fieldErrors }, { status: 422 })
  }

  // Explicit allow-list, matching CreatePublicLeadDto on the API side. The
  // intake endpoint sets source and status itself, so neither is sent here.
  const payload = {
    firstName: String(body.firstName).trim().slice(0, MAX.firstName),
    lastName: String(body.lastName).trim().slice(0, MAX.lastName),
    phone: normalizePhone(String(body.phone)),
    address: String(body.address ?? '').trim().slice(0, MAX.address) || undefined,
    notes: String(body.message ?? '').trim().slice(0, MAX.message) || undefined,
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/leads/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`[leads] CRM rejected submission: ${res.status} ${await res.text()}`)
      return NextResponse.json({ error: 'שליחת הפרטים נכשלה' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[leads] CRM unreachable:', err)
    return NextResponse.json({ error: 'שליחת הפרטים נכשלה' }, { status: 502 })
  }
}
