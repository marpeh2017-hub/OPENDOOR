#!/bin/bash
# Run this once to create the PostgreSQL production migration
# Requires: DATABASE_URL pointing to a PostgreSQL database

set -e
cd "$(dirname "$0")/.."

echo "📦 Switching to PostgreSQL schema..."
cp packages/db/prisma/schema.postgres.prisma packages/db/prisma/schema.prisma

echo "🔄 Generating Prisma client for PostgreSQL..."
cd packages/db && npx prisma generate

echo "⬆️  Running migrations against PostgreSQL..."
DATABASE_URL=$DATABASE_URL npx prisma migrate deploy

echo "🌱 Seeding production data..."
DATABASE_URL=$DATABASE_URL npx ts-node prisma/seed.ts

echo "✅ Done! PostgreSQL is ready."

# Restore local SQLite schema
cp prisma/schema.postgres.prisma prisma/schema.prisma.postgres.bak
