# Database Architecture — Urban Renewal OS

**Status:** canonical. Supersedes the dev-side guidance in
[`POSTGRES_MIGRATION.md`](./POSTGRES_MIGRATION.md), which is retained for
history only.

---

## 1. Environment matrix

| Environment | Engine | Schema file | Notes |
|---|---|---|---|
| Development | **PostgreSQL 17** | `packages/db/prisma/schema.postgres.prisma` | Local server, `urban_renewal_os` |
| Test | **PostgreSQL 17** | `packages/db/prisma/schema.postgres.prisma` | Same local server; Jest runs against it |
| Production | **PostgreSQL** | `packages/db/prisma/schema.postgres.prisma` | **NOT YET DEPLOYED** — no instance exists |

`schema.postgres.prisma` is the **single canonical schema**. Every `db:*`
script is pinned to it with `--schema=prisma/schema.postgres.prisma`, so no
file-swapping is required in any environment.

**SQLite is no longer part of the normal development path.** Nothing in the
default developer workflow, the test suite, or CI touches it.

---

## 2. Local connection & bootstrap

```
DATABASE_URL        = postgresql://postgres:<password>@127.0.0.1:5432/urban_renewal_os
DATABASE_SHADOW_URL = postgresql://postgres:<password>@127.0.0.1:5432/urban_renewal_os_shadow
```

Required extensions (declared in the datasource block and created by the init
migration): `pgcrypto`, `unaccent`, `pg_trgm`.

First-time local bootstrap:

```powershell
$pg = "C:\Program Files\PostgreSQL\17\bin"
$env:PGPASSWORD = "<password>"
& "$pg\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE urban_renewal_os;"
& "$pg\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE urban_renewal_os_shadow;"
& "$pg\psql.exe" -U postgres -h 127.0.0.1 -d urban_renewal_os -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;"

cd packages/db
pnpm db:deploy     # apply migrations
pnpm db:generate   # generate Prisma client
pnpm db:seed       # demo data
```

Local services are started together by `scripts/dev-start.ps1` (PostgreSQL,
MinIO, Redis, API Gateway, CRM, Portal).

PostgreSQL install facts (verified):

- Exactly one installation: `C:\Program Files\PostgreSQL\17`
- Data directory: `C:\Program Files\PostgreSQL\17\data` (contains `PG_VERSION` = `17`)
- Windows service `postgresql-x64-17` is **already registered**, `StartMode = Auto`

---

## 3. Migration layout

```
packages/db/prisma/
├── schema.postgres.prisma                  ← CANONICAL schema
├── schema.prisma                           ← legacy SQLite schema (opt-in only)
├── migrations/                             ← the ONLY directory Prisma scans
│   ├── migration_lock.toml                 ← provider = "postgresql"
│   └── 20260816000000_init_postgres/
│       └── migration.sql                   ← regenerated from canonical schema
├── migrations-sqlite/                      ← archived, NOT scanned by Prisma
│   ├── migration_lock.toml                 ← provider = "sqlite"
│   ├── 20260611111915_init_sqlite/
│   └── 20260816000000_init_postgres_handauthored.sql.bak
└── manual/                                 ← standby SQL, NEVER auto-applied
    └── 001_additive_hardening_columns.sql
```

`prisma migrate status` reports `1 migration found in prisma/migrations`,
confirming that neither `migrations-sqlite/` nor `manual/` is discovered.

---

## 4. Deploy procedure

### First deploy (empty database)

This is the current situation — no production database exists yet.

1. Provision an empty PostgreSQL database.
2. Ensure the role can create extensions (`pgcrypto`, `unaccent`, `pg_trgm`);
   the init migration creates them.
3. Boot the API Gateway. `services/api-gateway/start.sh` runs:
   `npx prisma@6 migrate deploy --schema=./prisma/schema.prisma`
   (the Dockerfile copies `schema.postgres.prisma` over `schema.prisma` at
   build time, so the deployed `schema.prisma` *is* the canonical schema).
4. `20260816000000_init_postgres/migration.sql` creates the full schema —
   41 tables, 23 enums — including all signature-hardening columns.
5. Nothing from `manual/` is needed. Do not run it.

**Verified:** this exact path was rehearsed against a scratch database.
`migrate deploy` applied cleanly and `migrate diff` reported
`No difference detected.` (exit code 0) against the canonical schema.

### Subsequent deploys

`start.sh` runs `prisma migrate deploy` on every boot; it applies only
pending migrations and is a no-op when the database is current.
**Never run `prisma db push` against production.**

### Rollback

Prisma migrations are not automatically reversible. Take a backup before every
deploy and roll back by restore.

---

## 5. Standby additive migration

**File:** `packages/db/prisma/manual/001_additive_hardening_columns.sql`
**Applies to:** an existing database provisioned with the **old hand-authored**
init SQL (`migrations-sqlite/20260816000000_init_postgres_handauthored.sql.bak`).
**Not required today** — no such database exists.

The old hand-authored SQL is missing:

- `signature_records."openedAt"`
- the **entire `signature_evidence` table**, and therefore its
  `"evidenceHash"`, `"pdfBase64"`, `"pdfS3Key"` columns

The standby file additively repairs exactly that gap: nullable columns, no
defaults, no data modification, no drops, wrapped in a transaction, fully
idempotent. It sits outside `prisma/migrations/` so `migrate deploy` can never
pick it up; it must be run by hand with `psql -f`.

**Verified:** applied to a scratch database seeded from the old hand-authored
SQL with representative rows. It succeeded, pre-existing rows were untouched,
all four columns exist and are nullable with no default, and a second run was a
clean no-op.

Do **not** run it against a fresh database — the init migration already covers
everything it does.

---

## 6. Remaining SQLite artifacts

| Artifact | Disposition | Reason |
|---|---|---|
| `prisma/schema.prisma` | **Retain** | Not just legacy — the Docker build copies `schema.postgres.prisma` over this path, and `start.sh` references `./prisma/schema.prisma`. Removing it would break the production image. Its committed SQLite content is only used by the opt-in `db:*:sqlite` scripts. |
| `prisma/migrations-sqlite/` | **Retain** | History-bearing. Holds the original SQLite init migration and the archived hand-authored Postgres init SQL, which is the reference input for the standby additive migration. Invisible to Prisma. |
| `db:generate:sqlite`, `db:migrate:sqlite`, `db:push:sqlite`, `db:studio:sqlite` | **Retain (opt-in)** | Zero-dependency offline scratch workflow. They are never invoked by dev, test, build, or CI. |
| `prisma/dev.db.disabled` | **Removable** | Disabled SQLite database file. Carries no schema or history value. Kept only so an accidental `db push` cannot silently resurrect a SQLite dev path. Safe to delete at any time. |
| `prisma/prisma/dev.db` | **Removable** | Stray nested artifact from an old `db push` with a relative path. No value. Safe to delete. |

Neither removable file is deleted here, to keep this readiness pass
non-destructive.

---

## 7. Relationship to `POSTGRES_MIGRATION.md`

`docs/POSTGRES_MIGRATION.md` documents the **original one-time baselining
procedure**, including the `cp prisma/schema.postgres.prisma
prisma/schema.prisma` swap. That dance is **stale for development**: the
`db:*` scripts are now pinned to the canonical schema and no swap is needed
locally. The file is retained because it records how the baseline migration
was originally produced, and because the equivalent copy still happens inside
the Dockerfile at build time.

**For any current work, this document is authoritative.**
`POSTGRES_MIGRATION.md` should be read as history.
