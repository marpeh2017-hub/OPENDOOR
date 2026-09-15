import { isIP } from 'net'

/**
 * Egress allowlist for automation webhooks.
 *
 * ── THE THREAT ─────────────────────────────────────────────────────────────
 *
 * A webhook URL is attacker-influenced data stored in a database, dispatched by
 * a server that sits inside the private network and (in production) inside a
 * cloud VPC. Without restriction that is a server-side request forgery
 * primitive: `http://169.254.169.254/latest/meta-data/iam/security-credentials/`
 * returns cloud credentials, `http://localhost:9000` reaches MinIO, and
 * `http://10.x.x.x` reaches anything else on the internal network. The response
 * body does not even need to come back for the request itself to be damaging.
 *
 * ── TWO INDEPENDENT CHECKS, IN THIS ORDER ──────────────────────────────────
 *
 * 1. `assertPublicDestination` — a BLOCKLIST of private, loopback, link-local
 *    and other special-use ranges. This runs FIRST and is not overridable. Per
 *    the product decision, adding `169.254.169.254` or a `10.0.0.0/8` host to
 *    the allowlist is a VALIDATION ERROR, not merely an allowlist miss: an
 *    operator who types an internal address into the allowlist has made a
 *    mistake the system should refuse to honour rather than faithfully execute.
 *
 * 2. `isHostAllowed` — the allowlist proper: exact hosts and domain suffixes.
 *
 * ── WHY DOMAIN-BASED, NOT IP-BASED ─────────────────────────────────────────
 *
 * The allowlist matches on HOSTNAME. IP-range allowlisting sounds stricter but
 * is unmaintainable here: the plausible targets (Slack, Make, Zapier, a client
 * CRM) are all behind CDNs whose address space rotates without notice, so an IP
 * allowlist would break in production for reasons nobody could diagnose.
 *
 * ── THE RESIDUAL RISK, STATED PLAINLY ──────────────────────────────────────
 *
 * A hostname check happens BEFORE DNS resolution, so a hostname that is on the
 * allowlist and resolves to 127.0.0.1 (DNS rebinding) would pass these checks.
 * Closing that requires resolving the host and validating every returned
 * address immediately before connecting, with the socket pinned to the
 * validated IP. That belongs in the dispatcher that actually opens the
 * connection — which does not exist yet, because WEBHOOK is still not an
 * executable action type. `validateWebhookUrl` is the save-time gate; the
 * connect-time gate must be written alongside the first real dispatch.
 */

/** Parsed CIDR block. */
interface Cidr { base: number; bits: number }

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let out = 0
  for (const p of parts) {
    // Reject '01' and '1e2' style parts: Number() would accept forms that
    // resolvers interpret differently from this parser.
    if (!/^\d{1,3}$/.test(p)) return null
    const n = Number(p)
    if (n > 255) return null
    out = (out << 8) | n
  }
  return out >>> 0
}

function cidr(block: string): Cidr {
  const [ip, bitsRaw] = block.split('/')
  const base = ipv4ToInt(ip!)
  if (base === null) throw new Error(`Bad CIDR in blocklist: ${block}`)
  return { base, bits: Number(bitsRaw) }
}

/**
 * Special-use IPv4 ranges that a webhook must never reach.
 * Sources: RFC1918 (private), RFC3927 (link-local), RFC6598 (CGNAT),
 * RFC5737 (documentation), RFC1122 (this-network, loopback), RFC5771 (multicast).
 */
const BLOCKED_V4: Cidr[] = [
  '0.0.0.0/8',          // this network
  '10.0.0.0/8',         // RFC1918
  '100.64.0.0/10',      // RFC6598 carrier-grade NAT
  '127.0.0.0/8',        // loopback
  '169.254.0.0/16',     // link-local — includes 169.254.169.254 cloud metadata
  '172.16.0.0/12',      // RFC1918
  '192.0.0.0/24',       // IETF protocol assignments
  '192.0.2.0/24',       // TEST-NET-1
  '192.168.0.0/16',     // RFC1918
  '198.18.0.0/15',      // benchmarking
  '198.51.100.0/24',    // TEST-NET-2
  '203.0.113.0/24',     // TEST-NET-3
  '224.0.0.0/4',        // multicast
  '240.0.0.0/4',        // reserved (includes 255.255.255.255)
].map(cidr)

/** Hostnames that resolve to the local machine by definition. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  // AWS/GCP/Azure metadata aliases that are not literal IPs.
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
])

export class WebhookUrlError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
  }
}

function isBlockedV4(ip: string): boolean {
  const value = ipv4ToInt(ip)
  if (value === null) return true // unparseable: refuse rather than guess
  return BLOCKED_V4.some(({ base, bits }) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (value & mask) >>> 0 === (base & mask) >>> 0
  })
}

function isBlockedV6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (v === '::1' || v === '::') return true            // loopback / unspecified
  if (v.startsWith('fe80')) return true                 // link-local
  if (/^f[cd]/.test(v)) return true                     // unique local fc00::/7
  // IPv4-mapped (::ffff:127.0.0.1) must be judged by its IPv4 half.
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isBlockedV4(mapped[1]!)
  return false
}

/**
 * Throws if the host is a private/internal destination.
 *
 * Applied to allowlist ENTRIES as well as to dispatch targets, which is what
 * makes "someone adds 169.254.169.254 to the allowlist" a validation error
 * rather than a successful configuration.
 */
export function assertPublicDestination(host: string): void {
  const bare = host.toLowerCase().replace(/^\[|\]$/g, '')

  if (BLOCKED_HOSTNAMES.has(bare)) {
    throw new WebhookUrlError(
      `Host '${host}' refers to this machine or a cloud metadata service`,
      'WEBHOOK_HOST_INTERNAL',
    )
  }
  // A bare hostname with no dot cannot be a public FQDN; it is an intranet name.
  if (!bare.includes('.') && isIP(bare) === 0) {
    throw new WebhookUrlError(
      `Host '${host}' is not a fully-qualified public hostname`,
      'WEBHOOK_HOST_INTERNAL',
    )
  }
  const version = isIP(bare)
  if (version === 4 && isBlockedV4(bare)) {
    throw new WebhookUrlError(
      `Host '${host}' is in a private, loopback or link-local range`,
      'WEBHOOK_HOST_INTERNAL',
    )
  }
  if (version === 6 && isBlockedV6(bare)) {
    throw new WebhookUrlError(
      `Host '${host}' is a private or loopback IPv6 address`,
      'WEBHOOK_HOST_INTERNAL',
    )
  }
}

/**
 * The configured allowlist, from `AUTOMATION_WEBHOOK_ALLOWLIST` — a
 * comma-separated list of hosts. A leading dot means "this domain and its
 * subdomains" (`.example.com` matches `hooks.example.com`, and `example.com`
 * itself). Anything else must match exactly.
 *
 * Empty (the default) means NO webhook destination is permitted. Failing closed
 * is the only safe default for an egress allowlist.
 */
export function configuredAllowlist(): string[] {
  const raw = process.env['AUTOMATION_WEBHOOK_ALLOWLIST'] ?? ''
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isHostAllowed(host: string, allowlist = configuredAllowlist()): boolean {
  const bare = host.toLowerCase()
  return allowlist.some((entry) =>
    entry.startsWith('.')
      ? bare === entry.slice(1) || bare.endsWith(entry)
      : bare === entry,
  )
}

/**
 * Full save-time validation of a webhook target.
 *
 * Order matters: scheme, then the non-overridable internal-destination check,
 * then the allowlist. Reporting "not on the allowlist" for `127.0.0.1` would
 * invite an operator to fix it by adding `127.0.0.1` to the allowlist.
 */
export function validateWebhookUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new WebhookUrlError('Webhook URL is not a valid absolute URL', 'WEBHOOK_URL_INVALID')
  }

  if (url.protocol !== 'https:') {
    throw new WebhookUrlError(
      // Plain http would put the payload — which carries resident data — on the
      // wire in clear text.
      'Webhook URL must use https',
      'WEBHOOK_URL_NOT_HTTPS',
    )
  }
  if (url.username || url.password) {
    throw new WebhookUrlError(
      'Webhook URL must not embed credentials',
      'WEBHOOK_URL_HAS_CREDENTIALS',
    )
  }

  assertPublicDestination(url.hostname)

  const allowlist = configuredAllowlist()
  if (allowlist.length === 0) {
    throw new WebhookUrlError(
      'No webhook destinations are configured. Set AUTOMATION_WEBHOOK_ALLOWLIST.',
      'WEBHOOK_ALLOWLIST_EMPTY',
    )
  }
  if (!isHostAllowed(url.hostname, allowlist)) {
    throw new WebhookUrlError(
      `Host '${url.hostname}' is not on the webhook allowlist`,
      'WEBHOOK_HOST_NOT_ALLOWED',
    )
  }

  return url
}

/**
 * Validates the allowlist itself at startup.
 *
 * An internal address in the allowlist is a configuration mistake, and the
 * product decision is to treat it as an error rather than quietly ignoring the
 * entry — an operator who believes they allowlisted something needs to be told
 * they did not.
 */
export function validateAllowlistConfiguration(allowlist = configuredAllowlist()): void {
  for (const entry of allowlist) {
    const host = entry.startsWith('.') ? entry.slice(1) : entry
    assertPublicDestination(host)
  }
}
