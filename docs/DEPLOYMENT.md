# Deployment — Urban Renewal OS

**Status (2026-10-12):** prepared, never executed. The branch
`feat/odg-website-phase1` is on GitHub; nothing has been deployed, and
`odg.co.il` is not registered yet (the lookup answers "non-existent domain"),
so no DNS record can exist.

This document is the paste-and-go half of the work. Creating accounts, entering
payment details and running the deploy commands are yours.

> **Deploy only from GitHub, never from a working folder.** Every deploy below
> runs from a fresh clone of the pushed branch:
>
> ```bash
> git clone --branch feat/odg-website-phase1 https://github.com/marpeh2017-hub/OPENDOOR.git odg-deploy
> cd odg-deploy
> ```
>
> The API image copies `packages/db` whole and runs `prisma migrate deploy` on
> every boot, so whatever migrations sit in the folder reach the live database.
> The development folder holds four untracked draft migrations
> (`20260826113000`, `20260906120000`, `20260910120000`, `20260910150000`);
> one creates a type that a committed migration also creates, so deployed from
> there the first boot would fail, or worse, half-apply. Vercel builds from
> GitHub by itself and is not affected.

`.env.production.example` at the repository root is the complete list of
production settings, each with what it is for. The tables below are the short
version.

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

DNS last. Everything else can be done and verified without touching the domain,
but buy `odg.co.il` now: certificates, email from `info@odg.co.il` (which the
site and the forms already print) and email sign-in codes all wait on it.

1. Database → get `DATABASE_URL`
2. Redis → get `REDIS_URL`
3. Fly (API) → deploy, verify health, note the `*.fly.dev` hostname
   - 3a. First tenant and CRM admin (bootstrap), once
   - 3b. Import and publish the four CMS pages, once
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

From the root of the **fresh clone** (see the box at the top), not a working
folder. The build context is the repository root because the Dockerfile needs
the workspace files, which are not reachable from `services/api-gateway`:

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

If the gateway does not come up, read the first boot's log: in production it
refuses to start, by design, without `MESSAGING_SIMULATE`, the four `*_URL`
origins, an SMS provider or `FIELD_ENCRYPTION_KEY`, and says which.

### 3a. First tenant and CRM admin

Once, after the first successful deploy. The image has `dist/` but no dev tools.
Pass the values as temporary secrets rather than on a command line that lands in
shell history:

```bash
flyctl secrets set --config services/api-gateway/fly.toml BOOTSTRAP_TENANT_NAME="OpenDoor Group" BOOTSTRAP_TENANT_SLUG="opendoor" BOOTSTRAP_ADMIN_EMAIL="..." BOOTSTRAP_ADMIN_PASSWORD="..."
flyctl ssh console --config services/api-gateway/fly.toml -C "node dist/scripts/bootstrap-tenant.js"
flyctl secrets unset --config services/api-gateway/fly.toml BOOTSTRAP_TENANT_NAME BOOTSTRAP_TENANT_SLUG BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
```

The password needs at least 12 characters; re-running changes nothing. The slug
is the one name the whole estate shares: `CMS_TENANT_SLUG` (website),
`PUBLIC_LEAD_TENANT_SLUG` (API) and `CMS_IMPORT_TENANT` (next step) must all be
the same value. The website's code defaults to `opendoor-demo`, so an unset
`CMS_TENANT_SLUG` reads an empty CMS.

### 3b. The four CMS pages

In production the website serves `/about`, `/why-organizer`, `/how-we-work` and
`/trust` only from the CMS, so each answers **404 until it is imported and
published**. From the fresh clone, after 3a, with `DATABASE_URL` pointing at the
production database:

```bash
pnpm install --frozen-lockfile
pnpm --filter @urban-renewal/db db:generate
mkdir -p /tmp/odg-cms
for page in about why-organizer how-we-work trust; do pnpm --filter @urban-renewal/website exec tsx scripts/export-page-fixture.ts $page > /tmp/odg-cms/$page.json; done
for page in about why-organizer how-we-work trust; do DATABASE_URL="..." CMS_IMPORT_TENANT=opendoor pnpm --filter @urban-renewal/website exec tsx ../../services/api-gateway/scripts/import-cms-page.ts /tmp/odg-cms/$page.json --publish; done
```

The import reads back what the website would be served and aborts, leaving the
page unpublished, if anything differs from the fixture. Re-running is safe. Run
it again after any later change to those pages' fixtures, such as the business
partner's profile added to `/about` on 2026-10-12; the CRM's page editor changes
text only, not sections.

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

The **website** additionally needs `NEXT_PUBLIC_PORTAL_URL` — the portal's
public address, e.g. `https://portal.odg.co.il`. Every "אזור אישי" link on the
site goes through `/portal`, which forwards to that address.

> **If it is not set, the site still works, but no owner can sign in from it.**
> `/portal` then forwards to the explanatory page instead, so a production build
> without the variable has no dead links — and also no working route to the
> personal area. Set it in the same step as the portal goes live, redeploy the
> website (Vercel applies a changed variable only to new deployments), and check
> that `https://odg.co.il/he/portal` lands on the portal's login page.

> **Open decision: subdomain or path.** This document assumes `portal.odg.co.il`.
> `docs/ODG_WEBSITE_PHASE1_PLAN.md` §3.3 instead plans the portal at `/resident`
> on the main domain. Either works with the variable above
> (`https://odg.co.il/resident`), but the DNS table, the gateway's `PORTAL_URL`
> and the portal's own base path all follow from the choice, so settle it before
> the portal is deployed rather than after.

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
| One SMS provider: `VONAGE_API_KEY` + `VONAGE_API_SECRET` + `VONAGE_FROM`, or `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM`, or `INFORU_USERNAME` + `INFORU_API_KEY` | Production refuses to start without one. It sends personal-area sign-in codes and form links; links can also go by WhatsApp from the CRM without it. |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` | Document storage. The CRM's Excel import and every uploaded document need it (Cloudflare R2 works; values in the template). |
| `PROTOCOL_PREPARER_ID_NUMBER` | The preparer's ID number, printed on the signed representation protocol. Kept out of the code on purpose. |
| `CMS_REVALIDATE_SECRET` | Shared with the website for on-demand revalidation |
| ~~`COMSIGN_API_KEY`~~ | **Do NOT set.** `createSignatureProvider()` throws on boot if it is present — the ComSign provider is a stub that raises on every call. Setting it takes the gateway down. |
| ~~`DOCUSIGN_CLIENT_ID`~~ | **Do NOT set.** Same: the factory throws, DocuSign has no provider implementation at all. |
| `ANTHROPIC_API_KEY` | The personal area's assistant. Set it on the **website** too (Vercel): the site's question box calls it from there. |
| `RESEND_API_KEY` *or* `SENDGRID_API_KEY`, with `EMAIL_FROM` | Email, whichever is used. `EMAIL_FROM` (`info@odg.co.il`) must be on a domain verified with the provider, so this waits for the domain. Without email, email sign-in answers 503 and owners sign in by phone. |

> **E-signature is IN-HOUSE.** With neither `COMSIGN_API_KEY` nor
> `DOCUSIGN_CLIENT_ID` set, the factory returns `NativeSignatureProvider` and
> signing works. Both third-party providers are unimplemented, and the factory
> throws at start-up rather than silently degrading if either variable appears —
> so the absence of these secrets is the correct production configuration, not
> an omission.

### Configuration — safe in `[env]` or the Vercel UI

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `TRUST_PROXY` | `1` — one proxy hop (Fly's edge). Rate limiting keys on `X-Forwarded-For`; unset, every request buckets under Fly's own address. |
| `WEBSITE_URL`, `CRM_URL`, `PORTAL_URL`, `WEB_URL` | the https origins above — **required** |
| `MESSAGING_SIMULATE` | **`false`**, deliberately, and required: the gateway refuses to start without it. Left `true`, the platform runs normally and silently delivers nothing to residents. |
| `AUTOMATION_WEBHOOK_ALLOWLIST` | Outbound targets. Start-up refuses internal addresses. |
| `LEAD_NOTIFY_PHONE`, `LEAD_NOTIFY_CHANNEL` | Office alert on a new enquiry |
| `PUBLIC_LEAD_TENANT_SLUG` | Which tenant owns website leads: the bootstrap slug |

On the **website** (Vercel), besides `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_PORTAL_URL`:

| Variable | Production value |
|---|---|
| `CMS_TENANT_SLUG` | The bootstrap slug. Unset, the site reads the `opendoor-demo` tenant and the four CMS pages answer 404. |
| `WEBSITE_URL`, `CMS_REVALIDATE_SECRET` | The same secret as on the API; without it a page published in the CRM does not refresh the site. |
| `ANTHROPIC_API_KEY` | The question box on the site. |

`.env.production.example` is the complete list, with comments.

---

## Before the first real visitor

- [ ] Deployed from a fresh clone of the pushed branch, not a working folder
- [ ] `MESSAGING_SIMULATE=false`, and a test message actually arrives
- [ ] `FIELD_ENCRYPTION_KEY` escrowed somewhere that survives losing this laptop
- [ ] Health reports `"redisMode":"client"`
- [ ] `prisma migrate deploy` succeeded — check the first boot's logs
- [ ] First admin created (3a), and `CMS_TENANT_SLUG`, `PUBLIC_LEAD_TENANT_SLUG` and `CMS_IMPORT_TENANT` all equal its slug
- [ ] `/he/about`, `/he/why-organizer`, `/he/how-we-work` and `/he/trust` answer 200, not 404 (3b)
- [ ] `PROTOCOL_PREPARER_ID_NUMBER` set, or the signed protocol prints the preparer's line without the number
- [ ] `info@odg.co.il` receives mail: the site, the notice and every form email print it
- [ ] `NEXT_PUBLIC_PORTAL_URL` set on the website, and `https://odg.co.il/he/portal` lands on the portal's login page — unset, every "אזור אישי" link quietly falls back to the explanatory page
- [ ] Project pages show "כניסה לבעלי דירות". Owners can sign in from launch (decided 2026-10-05), and `RESIDENT_ACCESS` follows the same `NEXT_PUBLIC_PORTAL_URL` as the header link, so this confirms the variable reached the build. Owners' phone numbers must already be registered in the portal, or they reach a sign-in they cannot pass
- [ ] **Automated backups configured and a restore actually tested** (R10)
- [ ] **Uptime and error alerting configured** (R11)

The last two are open highs in `docs/RISK_REGISTER.md` and neither is solved by
deploying. A backup that has never been restored is not a backup.
