# Deployment — Urban Renewal OS

**Status:** prepared, never executed. No account exists on any platform named
here, nothing has been deployed, and no DNS record has been created.

This document is the paste-and-go half of the work. Creating accounts, entering
payment details and running the deploy commands are yours.

---

## Shape

| Piece | Platform | Why |
|---|---|---|
| API gateway (NestJS) | Fly.io | Long-lived process, Redis connection, Prisma pool, runs migrations on boot. Not a serverless fit. |
| website / crm / portal / web (Next) | Vercel | Four separate projects from one repo, each with its own root directory. |
| PostgreSQL | Supabase or Fly Postgres | Must be reachable from Fly and must support `prisma migrate deploy`. |
| Redis | Upstash or Fly Redis | Sessions, OTP storage, rate limiting. **Not optional** — see the note below. |

> **Redis is not a cache here.** It holds OTP codes, session revocation and rate
> limit counters, so it is load-bearing for authentication.
>
> Production is already guarded: an unset `REDIS_URL` throws at start-up, and a
> set-but-unreachable one yields a real client whose failing commands the health
> check reports as an error. The in-memory fallback is a development
> convenience and cannot silently engage in production. `redisMode` in the
> health response says which is answering.

---

## Order

DNS last. Everything else can be done and verified without touching the domain.

1. Database → get `DATABASE_URL`
2. Redis → get `REDIS_URL`
3. Fly (API) → deploy, verify health, note the `*.fly.dev` hostname
4. Vercel (four apps) → deploy, verify, note the `*.vercel.app` hostnames
5. Wire the origins: set `*_URL` on Fly and `NEXT_PUBLIC_API_URL` on Vercel, redeploy both
6. DNS → point the real hostnames, add custom domains, wait for certificates
7. Update the origins again to the real hostnames, redeploy

Steps 5 and 7 are both needed. Origins are baked into CORS and into the portal's
BFF target, so each side has to learn the other's final address.

---

## 1–2. Database and Redis

Create both, copy the connection strings. Prisma needs `?sslmode=require` on
most managed Postgres. Check that the database allows connections from Fly's
egress; Supabase does by default, some providers need an allowlist.

Do **not** run `prisma migrate deploy` by hand — `start.sh` runs it on every
boot, so the first Fly deploy applies the whole migration history.

## 3. API gateway on Fly

From the **repository root** — the Dockerfile needs the workspace files, which
are not reachable from `services/api-gateway`:

```bash
flyctl launch --no-deploy --config services/api-gateway/fly.toml --dockerfile services/api-gateway/Dockerfile .
```

Then set the secrets (see the table below), then:

```bash
flyctl deploy --config services/api-gateway/fly.toml --dockerfile services/api-gateway/Dockerfile .
```

Verify before going further:

```bash
curl -s https://odg-api.fly.dev/api/v1/health
```

Expect `"status":"healthy"`, every check `ok`, and **`"redisMode":"client"`**.
A `degraded` response names the failing dependency.

`redisMode` is the one to read. `in-memory-fallback` means the per-process
stand-in is answering rather than Redis — which cannot happen in production, but
is worth confirming rather than assuming on any environment you are about to
trust.

## 4. Front ends on Vercel

Four projects, same repository, each with a different **Root Directory**:

| Project | Root Directory | Domain |
|---|---|---|
| website | `apps/website` | `odg.co.il`, `www.odg.co.il` |
| crm | `apps/crm` | `crm.odg.co.il` |
| portal | `apps/portal` | `portal.odg.co.il` |
| web | `apps/web` | `app.odg.co.il` |

Each already has a `vercel.json` with the workspace-aware build command. Leave
Vercel's framework detection on; do not override the build command in the UI or
it will ignore the file.

## 5/7. Wiring the origins

On **Fly** (all four required in production — the gateway now refuses to boot
without them rather than falling back to `localhost` in a credentialed CORS
allowlist):

```
WEBSITE_URL=https://odg.co.il
CRM_URL=https://crm.odg.co.il
PORTAL_URL=https://portal.odg.co.il
WEB_URL=https://app.odg.co.il
```

On **Vercel**, per project, the gateway's address. The portal additionally needs
the server-side `WEBSITE_URL` for its legal links.

## 6. DNS for odg.co.il

Add at the registrar. Vercel and Fly both show the exact target after you add
the custom domain — prefer their value over the placeholder here.

| Host | Type | Value | For |
|---|---|---|---|
| `@` | A | `76.76.21.21` | website apex → Vercel |
| `www` | CNAME | `cname.vercel-dns.com` | website |
| `crm` | CNAME | `cname.vercel-dns.com` | CRM |
| `portal` | CNAME | `cname.vercel-dns.com` | portal |
| `app` | CNAME | `cname.vercel-dns.com` | web |
| `api` | CNAME | `odg-api.fly.dev` | API gateway |

Certificates issue automatically on both platforms once the records resolve;
allow up to an hour. Until then every app is still serving HSTS headers that a
browser ignores over plain HTTP — nothing is broken, nothing is protected yet.

> **Do not submit the domain to hstspreload.org.** The apps send
> `preload` with `includeSubDomains`. Submission is effectively irreversible and
> would commit every present and future `*.odg.co.il` subdomain to working HTTPS
> forever. Get the whole estate onto TLS and leave it there a while first.

---

## Environment variables

### Secrets — `flyctl secrets set`, never `[env]` in fly.toml

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres, likely `?sslmode=require` |
| `REDIS_URL` | Real Redis. See the warning above. |
| `JWT_SECRET` | Long random value. Also the pepper for OTP HMACs, so **rotating it invalidates every session and every outstanding OTP**. |
| `FIELD_ENCRYPTION_KEY` | AES-256-GCM key for national IDs. **Losing this loses the data** — it is not recoverable from a database backup. Escrow it before launch. Production refuses to start without it. |
| `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_FROM` | SMS / OTP delivery |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` | Document storage |
| `CMS_REVALIDATE_SECRET` | Shared with the website for on-demand revalidation |
| `COMSIGN_API_KEY`, `COMSIGN_WEBHOOK_SECRET` | E-signature. The webhook secret is what makes HMAC verification meaningful. |
| `ANTHROPIC_API_KEY` | Assistant features |
| `RESEND_API_KEY` *or* `SENDGRID_API_KEY` | Email, whichever is used |

### Configuration — safe in `[env]` or the Vercel UI

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `TRUST_PROXY` | `1` — one proxy hop (Fly's edge). Rate limiting keys on `X-Forwarded-For`; unset, every request buckets under Fly's own address. |
| `WEBSITE_URL`, `CRM_URL`, `PORTAL_URL`, `WEB_URL` | the https origins above — **required** |
| `MESSAGING_SIMULATE` | **`false`**, deliberately. Left `true`, the platform runs normally and silently delivers nothing to residents. |
| `AUTOMATION_WEBHOOK_ALLOWLIST` | Outbound targets. Start-up refuses internal addresses. |
| `LEAD_NOTIFY_PHONE`, `LEAD_NOTIFY_CHANNEL` | Office alert on a new enquiry |
| `PUBLIC_LEAD_TENANT_SLUG` | Which tenant owns website leads |

`.env.example` is the complete list, with comments.

---

## Before the first real visitor

- [ ] `MESSAGING_SIMULATE=false`, and a test message actually arrives
- [ ] `FIELD_ENCRYPTION_KEY` escrowed somewhere that survives losing this laptop
- [ ] Health reports `"redisMode":"client"`
- [ ] `prisma migrate deploy` succeeded — check the first boot's logs
- [ ] First admin created via `pnpm bootstrap`
- [ ] **Automated backups configured and a restore actually tested** (R10)
- [ ] **Uptime and error alerting configured** (R11)

The last two are open highs in `docs/RISK_REGISTER.md` and neither is solved by
deploying. A backup that has never been restored is not a backup.
