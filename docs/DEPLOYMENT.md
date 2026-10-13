# Deployment — Urban Renewal OS

**Status (2026-10-13):** prepared, never executed. The owner bought `odg.co.il`
on 2026-10-13 (it did not resolve yet that day) and chose to run everything on
Fly.io: low cost, and no server anyone has to maintain.

This document is the step-by-step half of the work. Creating accounts,
entering payment details and pressing **Run workflow** in GitHub are the
owner's; everything else is prepared in the repository.

> **Deploy only from GitHub, never from a working folder.** The workflows in
> `.github/workflows` always run from a clean checkout of the branch you
> choose, which is why they are the way to deploy.
>
> The API image copies `packages/db` whole and runs `prisma migrate deploy` on
> every boot, so whatever migrations sit in the folder reach the live database.
> The development folder holds four untracked draft migrations
> (`20260826113000`, `20260906120000`, `20260910120000`, `20260910150000`);
> one creates a type that a committed migration also creates, so deployed from
> there the first boot would fail, or worse, half-apply. Never run
> `flyctl deploy` from the development folder.

`.env.production.example` at the repository root is the complete list of
production settings, each with what it is for. The tables below are the short
version.

---

## Shape and cost

| Piece | Where | About, per month |
|---|---|---|
| API gateway (NestJS) | Fly.io app `odg-api`, Paris, 1 GB, always on | $6 |
| Website | Fly.io app `odg-website`, 512 MB, always on | $3.5 |
| CRM | Fly.io app `odg-crm`, 512 MB, stops when idle | $0 to 2 |
| Personal area | Fly.io app `odg-portal`, 512 MB, stops when idle | $0 to 2 |
| PostgreSQL | Supabase, free plan, Frankfurt | $0 (Pro: $25) |
| Redis | Upstash, free plan, Frankfurt | $0 |
| Files and backups | Cloudflare R2 | $0 up to 10 GB |
| DNS, and the info@ inbox | Cloudflare DNS and Email Routing | $0 |
| Sending email | Resend | $0 at this volume |
| SMS | Inforu | per message |
| The assistant | Anthropic API | per use |

Fixed cost: about **$10 to 14 a month**. A stopped CRM or personal-area machine
starts again on the next request within a few seconds.

Why not Vercel for the front ends: its free plan allows only personal,
non-commercial use, and Pro is $20 a month per seat. The apps keep their
`vercel.json`, so moving them there later is a settings change, not a code
change.

When the company is established, Supabase Pro ($25) adds daily backups and
removes the free plan's pause after a week without activity. The API touches
the database constantly, so the pause is not expected before then; the nightly
backup workflow (step 10) covers backups in the meantime.

> **Redis is not a cache here.** It holds OTP codes, session revocation and rate
> limit counters, so it is load-bearing for authentication.
>
> Production is already guarded: an unset `REDIS_URL` throws at start-up, and a
> set-but-unreachable one yields a real client whose failing commands the health
> check reports as an error. `redisMode` in the health response says which is
> answering.

---

## Steps

### 0. Accounts (the owner)

Fly.io (needs a card), Supabase, Cloudflare, Upstash, Resend, Inforu and
Anthropic, plus the existing GitHub repository.

Open **Inforu first**: the API refuses to start in production without an SMS
provider's credentials, and a business account can take a few days.

### 1. Cloudflare: DNS and the info@ inbox

1. Cloudflare → Add a site → `odg.co.il`, free plan.
2. At the registrar where the domain was bought, replace the nameservers with
   the two Cloudflare shows. For a new `.co.il` this is best done before the
   domain is first activated.
3. Cloudflare → Email → Email Routing: route `info@odg.co.il` to the mailbox
   the office already reads. From then on mail to info@ arrives; until now it
   bounced, while the site, the notices and every form email print it.

Every record added later for Fly is **DNS only** (grey cloud), not proxied:
Fly issues the certificates itself and must see the traffic.

### 2. Supabase: the database

New project in **Frankfurt (eu-central-1)** with a strong database password.
Connect → **Session pooler** gives `DATABASE_URL`. Use that form everywhere: it
is IPv4 and port 5432, which both Fly and GitHub's runners can reach (the direct
address is IPv6-only).

Do **not** run migrations by hand: the API runs them on every boot.

### 3. Upstash: Redis

New Redis database in Frankfurt. Copy its `rediss://` address (TLS, two s) as
`REDIS_URL`.

### 4. Cloudflare R2: files and backups

Two buckets:

- `odg-documents` for the API's uploads. An API token with read and write on
  it gives `S3_ACCESS_KEY` and `S3_SECRET_KEY`; the endpoint
  `https://<account id>.r2.cloudflarestorage.com` is `S3_ENDPOINT`.
- `odg-backups` for the nightly backups, with a lifecycle rule deleting
  objects after 30 days, and a token of its own limited to that bucket.

### 5. Fly: the four apps and their secrets

1. fly.io → Tokens → create an **organization** token. In GitHub → Settings →
   Secrets and variables → Actions, add it as `FLY_API_TOKEN`.
2. GitHub → Actions → **Deploy to Fly** → Run workflow → `create-apps`. It
   creates `odg-api`, `odg-website`, `odg-crm` and `odg-portal`, and deploys
   nothing. Fly app names are global: if one is taken, change `app = ...` in
   that `fly.toml`, and its `*.fly.dev` address below, and run it again.
3. In the Fly dashboard, set each app's secrets (app → Secrets) from the
   tables under **Settings** below. The public addresses, the tenant slug and
   `MESSAGING_SIMULATE` are already in the `fly.toml` files.

### 6. The API

1. **Deploy to Fly** → `api`. The first boot applies the whole migration history.
2. Check `https://odg-api.fly.dev/api/v1/health`: expect `"status":"healthy"`,
   every check `ok`, and **`"redisMode":"client"`**. A `degraded` answer names
   the failing dependency. If the gateway does not come up, the app's Logs page
   in the Fly dashboard says which required setting is missing.
3. `odg-api` → Certificates → add `api.odg.co.il`, add the record Fly shows in
   Cloudflare (DNS only), and wait until the certificate is issued. The three
   front ends are built against `https://api.odg.co.il`, so this comes before
   step 8.

### 7. First-time setup

GitHub → Actions → **First-time setup**, with the repository secrets
`PROD_DATABASE_URL` (the Session pooler address), `BOOTSTRAP_ADMIN_EMAIL` and
`BOOTSTRAP_ADMIN_PASSWORD` (12+ characters, a lowercase letter, an uppercase
letter and a digit):

1. `bootstrap-admin` creates the tenant `opendoor` and its first CRM
   administrator. Delete `BOOTSTRAP_ADMIN_PASSWORD` from GitHub once the
   administrator has signed in and changed it under הגדרות › החשבון שלי.
2. `import-cms-pages` imports and publishes `/about`, `/why-organizer`,
   `/how-we-work` and `/trust`. In production the website serves them only from
   the CMS, so each answers 404 until this has run. Each import reads back what
   the website would be served and aborts, leaving the page unpublished, if
   anything differs from the fixture. Run it again after any later change to
   those pages' fixtures.

The slug `opendoor` is the one name the whole estate shares:
`PUBLIC_LEAD_TENANT_SLUG` on the API, `CMS_TENANT_SLUG` on the website and
`TENANT_SLUG` in the workflow. Change all three or none.

### 8. The front ends

1. **Deploy to Fly** → `website`, `crm` and `portal` (or `all`). The website's
   build reads the CMS, which is why it waits for step 7.
2. Certificates, each with the records Fly shows added in Cloudflare (DNS
   only):

| Host | App |
|---|---|
| `odg.co.il`, `www.odg.co.il` | `odg-website` |
| `crm.odg.co.il` | `odg-crm` |
| `portal.odg.co.il` | `odg-portal` |
| `api.odg.co.il` | `odg-api` (done in step 6) |

The personal area lives at `portal.odg.co.il`, not at a path of the main site
(the alternative `docs/ODG_WEBSITE_PHASE1_PLAN.md` §3.3 once planned).

> **Do not submit the domain to hstspreload.org.** The apps send `preload` with
> `includeSubDomains`. Submission is effectively irreversible and would commit
> every present and future `*.odg.co.il` subdomain to working HTTPS forever.

### 9. Email and SMS

- **Resend:** add the domain `odg.co.il`, add its records in Cloudflare, and
  verify. Then set `RESEND_API_KEY` and `EMAIL_FROM="info@odg.co.il"` on
  `odg-api`. Without them, email sign-in answers 503 and owners sign in by phone.
- **Inforu:** a sender name approved for the account, and `INFORU_USERNAME` and
  `INFORU_API_KEY` on `odg-api`. Then send one real test message and check that
  it arrives.

### 10. Backups

GitHub repository secrets for the **Nightly database backup** workflow:
`BACKUP_DATABASE_URL` (the Session pooler address), `BACKUP_PASSPHRASE`,
`BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET` (`odg-backups`),
`BACKUP_S3_ACCESS_KEY` and `BACKUP_S3_SECRET_KEY`.

Run it once by hand and check that a file appeared in the bucket. The schedule
(every night at 01:30 UTC) starts once the workflow file is on `main`.

Keep `BACKUP_PASSPHRASE` beside `FIELD_ENCRYPTION_KEY`, somewhere that survives
losing this laptop: without it no backup can be opened.

**Restore drill, before launch.** A backup that has never been restored is not
a backup. Into a scratch database, never production:

```bash
gpg --decrypt --output db.dump 2026-10-20T0130Z.dump.gpg
pg_restore --clean --if-exists --no-owner --dbname "$SCRATCH_DATABASE_URL" db.dump
```

### 11. Monitoring

UptimeRobot (free): a monitor on `https://odg.co.il/he` and one on
`https://api.odg.co.il/api/v1/health` with the keyword `healthy`. Not on the
CRM or the personal area: a check every few minutes would keep their machines
from ever stopping, which is where the saving comes from.

---

## Settings

### API (`odg-api`)

Already in `services/api-gateway/fly.toml`: `NODE_ENV`, `PORT`, `TRUST_PROXY`,
the four origins (`WEBSITE_URL`, `CRM_URL`, `PORTAL_URL`, `WEB_URL`),
`PUBLIC_LEAD_TENANT_SLUG` and `MESSAGING_SIMULATE="false"`.

Secrets, in the Fly dashboard:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase, Session pooler |
| `REDIS_URL` | Upstash, `rediss://` |
| `JWT_SECRET` | Long random value. Also the pepper for OTP HMACs, so **rotating it invalidates every session and every outstanding OTP**. |
| `FIELD_ENCRYPTION_KEY` | AES-256-GCM key for national IDs. **Losing this loses the data**; it is not recoverable from a database backup. Escrow it before launch. Production refuses to start without it. |
| `INFORU_USERNAME`, `INFORU_API_KEY` | Production refuses to start without one SMS provider (Vonage and Twilio also work; see `.env.production.example`). |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION` | R2: bucket `odg-documents`, region `auto`. Every upload needs it. |
| `CMS_REVALIDATE_SECRET` | The same value on `odg-website`. Without it a page published in the CRM does not refresh the site. |
| `PROTOCOL_PREPARER_ID_NUMBER` | Printed on the signed representation protocol. Kept out of the code on purpose. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Step 9 |
| `ANTHROPIC_API_KEY` | The personal area's assistant |
| `LEAD_NOTIFY_PHONE`, `LEAD_NOTIFY_CHANNEL` | Optional: an office alert on every new enquiry |
| ~~`COMSIGN_API_KEY`~~, ~~`DOCUSIGN_CLIENT_ID`~~ | **Do NOT set.** The factory throws at start-up if either is present: neither provider is implemented. |

> **E-signature is IN-HOUSE.** With neither third-party variable set, the
> factory returns `NativeSignatureProvider` and signing works. Their absence is
> the correct production configuration, not an omission.

### Website (`odg-website`)

Build arguments and `[env]` in `apps/website/fly.toml`: `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PORTAL_URL`, `CMS_TENANT_SLUG`.

Secrets: `CMS_REVALIDATE_SECRET` (as on the API) and `ANTHROPIC_API_KEY` (the
question box on the site).

### CRM (`odg-crm`) and personal area (`odg-portal`)

Everything is in their `fly.toml`: `NEXT_PUBLIC_API_URL` and, for the CRM,
`NEXT_PUBLIC_WEBSITE_URL` as build arguments; `API_GATEWAY_URL`, and for the
personal area `WEBSITE_URL`, in `[env]`. No secrets.

`NEXT_PUBLIC_*` values are compiled in at build time: after changing one in a
`fly.toml`, deploy that app again.

---

## Before the first real visitor

- [ ] Deployed through the GitHub workflows, never from a working folder
- [ ] A real test SMS arrived, and a real test email
- [ ] `FIELD_ENCRYPTION_KEY` and `BACKUP_PASSPHRASE` escrowed somewhere that survives losing this laptop
- [ ] Health reports `"redisMode":"client"`
- [ ] The API's first boot logged a successful `prisma migrate deploy`
- [ ] First admin created and signed in; `BOOTSTRAP_ADMIN_PASSWORD` deleted from GitHub
- [ ] `/he/about`, `/he/why-organizer`, `/he/how-we-work` and `/he/trust` answer 200, not 404
- [ ] `PROTOCOL_PREPARER_ID_NUMBER` set, or the signed protocol prints the preparer's line without the number
- [ ] `info@odg.co.il` receives mail
- [ ] `https://odg.co.il/he/portal` lands on the personal area's login page
- [ ] Project pages show "כניסה לבעלי דירות", and owners' phone numbers are registered in the personal area, or they reach a sign-in they cannot pass
- [ ] **A backup was restored into a scratch database** (risk register R10)
- [ ] **Uptime alerts configured** (R11)

The last two are open highs in `docs/RISK_REGISTER.md`, and deploying solves
neither.
