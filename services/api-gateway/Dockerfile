FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# ── Install all dependencies ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/db/package.json             ./packages/db/
COPY services/api-gateway/package.json    ./services/api-gateway/
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules                     ./node_modules
COPY --from=deps /app/packages/db/node_modules         ./packages/db/node_modules
COPY --from=deps /app/services/api-gateway/node_modules ./services/api-gateway/node_modules
COPY packages/db                ./packages/db
COPY services/api-gateway       ./services/api-gateway
COPY tsconfig.base.json         ./

# Use PostgreSQL schema for production, generate Prisma client, and build NestJS
# Combined into a single RUN to prevent Docker layer caching from serving stale Prisma types
RUN cp packages/db/prisma/schema.postgres.prisma packages/db/prisma/schema.prisma \
    && cd packages/db && npx prisma generate \
    && cd /app/services/api-gateway && npx nest build

# ── Production runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Copy built app
COPY --from=builder /app/services/api-gateway/dist       ./dist
COPY --from=builder /app/services/api-gateway/package.json ./
COPY --from=builder /app/node_modules                    ./node_modules
COPY --from=builder /app/packages/db/prisma              ./prisma

# Prisma client binaries
COPY --from=builder /app/node_modules/.pnpm              ./node_modules/.pnpm

# Startup: run migrations then start app
COPY services/api-gateway/start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 4000
CMD ["./start.sh"]
