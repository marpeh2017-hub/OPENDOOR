# PostgreSQL Migration Procedure

> **⚠️ HISTORICAL — SUPERSEDED.**
> See **[`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md)** for the
> current, authoritative database architecture and deploy procedure.
>
> This file records how the original baseline migration was produced. The
> "One-Time Baseline" steps below — in particular copying
> `schema.postgres.prisma` over `schema.prisma` — are **stale for local
> development**. The `db:*` scripts in `packages/db/package.json` are now
> pinned with `--schema=prisma/schema.postgres.prisma`, so no schema swap is
> needed locally. An equivalent copy still happens inside the Dockerfile at
> build time, which is why `start.sh` refers to `./prisma/schema.prisma`.
>
> Retained for history. Do not follow these steps for new work.

## Prerequisites
- Access to a PostgreSQL 15+ instance
- `DATABASE_URL` set to the PostgreSQL connection string
- `DATABASE_SHADOW_URL` set to a separate shadow database

## One-Time Baseline (First Production Deploy)

```bash
# 1. From the repo root:
cd packages/db

# 2. Copy the production schema
cp prisma/schema.postgres.prisma prisma/schema.prisma  # DO NOT commit this swap

# 3. Generate the baseline migration
DATABASE_URL="postgresql://..." npx prisma@6 migrate dev --name init_postgres

# 4. Restore the dev schema
git checkout prisma/schema.prisma

# 5. Commit the generated migration SQL
git add prisma/migrations/
git commit -m "feat: add PostgreSQL baseline migration"
```

## Subsequent Deploys
`start.sh` runs `prisma migrate deploy` automatically.
Never run `prisma db push` against production.

## Rollback
Prisma migrations are not automatically reversible.
Maintain database backups before each deploy.
Keep the migration SQL for manual rollback if needed.
