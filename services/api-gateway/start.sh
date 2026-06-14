#!/bin/sh
set -e

echo "🔄 Running database migrations..."
npx prisma@6 migrate deploy --schema=./prisma/schema.prisma

echo "🚀 Starting API Gateway..."
exec node dist/main
