/**
 * Same-origin BFF (backend-for-frontend) proxy to the NestJS API Gateway.
 *
 * Why this exists:
 *   The `access_token` cookie is httpOnly and scoped to the CRM origin
 *   (localhost:3001). The browser will never send it cross-origin to the API
 *   Gateway (localhost:4000), and `JwtStrategy` only reads the `Authorization`
 *   header anyway. So the browser talks to THIS same-origin route, which reads
 *   the cookie server-side and forwards it as `Authorization: Bearer <token>`.
 *
 * Security properties:
 *   - The token never reaches client-side JS: it is read via `next/headers`
 *     inside the route handler and only ever placed on the OUTBOUND request.
 *   - Same-origin + SameSite=Lax cookie keeps CSRF protection intact.
 *   - No CORS-with-credentials and no `SameSite=None` needed.
 *   - Upstream status codes are forwarded faithfully — a 403 RBAC denial stays
 *     a 403 and is NOT collapsed into a 401.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/** Response headers that must not be copied from upstream to the client. */
const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie', // never let the API Gateway set cookies on the CRM origin
])

/** Request headers safe to forward upstream. Everything else is dropped. */
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language']

async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await ctx.params

  const token = (await cookies()).get('access_token')?.value
  if (!token) {
    // Return, never throw — api-client needs a parseable 401 to trigger refresh.
    return NextResponse.json({ message: 'לא מחובר' }, { status: 401 })
  }

  const search = req.nextUrl.search
  const upstreamUrl = `${API_BASE}/api/v1/${path.map(encodeURIComponent).join('/')}${search}`

  const headers = new Headers()
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('Authorization', `Bearer ${token}`)

  // Only read a body for methods that can carry one.
  //
  // Read it as an ArrayBuffer, NOT `req.text()`. `text()` decodes the body as
  // UTF-8 and re-encodes it on the way out, which silently corrupts every
  // non-UTF-8 byte — i.e. every `multipart/form-data` upload of a PDF or an
  // image. An ArrayBuffer is passed through byte-for-byte, and the multipart
  // boundary survives because it lives in the `content-type` header, which is
  // already in FORWARDED_REQUEST_HEADERS and is copied verbatim above.
  //
  // This changes only how the body is carried. It does not touch any of the
  // proxy's security properties: the header allow-list is unchanged (so a
  // client-supplied `Authorization` is still dropped and replaced with the
  // cookie-derived one), `STRIPPED_RESPONSE_HEADERS` still removes `set-cookie`
  // and the hop-by-hop headers, and the upstream status is still forwarded
  // untouched (a 403 stays a 403).
  //
  // ⚠ MEMORY — BUFFERING POINT 1 OF 2.
  //
  // `arrayBuffer()` materialises the ENTIRE request body in this Node process
  // before a single byte is forwarded; there is no streaming here. NestJS
  // multer then buffers the same body AGAIN server-side (buffering point 2, in
  // `services/api-gateway/src/documents/documents.controller.ts`). With
  // MAX_DOCUMENT_BYTES at 100 MB — raised for CAD drawings — one in-flight
  // upload costs roughly 200 MB resident ACROSS THE TWO PROCESSES, and
  // concurrent CAD uploads multiply that until the container OOMs. Nothing here
  // applies backpressure or bounds concurrency.
  //
  // The proper fix is a presigned direct-to-S3/MinIO upload: the browser PUTs
  // straight to object storage and only the resulting key comes through this
  // proxy, so neither process ever holds the file. That is deliberately not
  // built yet. Until it is, treat MAX_DOCUMENT_BYTES as a memory dial, not just
  // a policy dial.
  //
  // TODO(security): no malware scanning exists on this path — see the
  // TODO(security) block in `document-upload.constants.ts` for the full
  // statement of what is and is not validated, and the condition under which
  // that remains acceptable.
  let body: ArrayBuffer | undefined
  if (req.method !== 'GET' && req.method !== 'DELETE' && req.method !== 'HEAD') {
    const raw = await req.arrayBuffer()
    if (raw.byteLength > 0) body = raw
  }

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    })
  } catch {
    // Never include the URL or token in the error surfaced to the client.
    return NextResponse.json({ message: 'שרת ה-API אינו זמין' }, { status: 502 })
  }

  const responseHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value)
    }
  })

  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status, headers: responseHeaders })
  }

  const payload = await upstream.arrayBuffer()
  return new NextResponse(payload, { status: upstream.status, headers: responseHeaders })
}

export const GET = handler
export const POST = handler
export const PATCH = handler
export const PUT = handler
export const DELETE = handler

export const dynamic = 'force-dynamic'
