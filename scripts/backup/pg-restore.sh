#!/usr/bin/env bash
#
# Urban Renewal OS — PostgreSQL restore.
#
# ── READ THIS BEFORE YOU NEED IT ─────────────────────────────────────────────
#
# A backup nobody has ever restored is a hypothesis. Run a drill against a
# scratch database now, while it is boring, rather than discovering the gap at
# the worst possible moment.
#
#   DATABASE_URL="postgresql://user:pass@host:5432/restore_drill" \
#     ./pg-restore.sh ./backups/urban_renewal_os-20260908-120000.dump
#
# ── THE SAFETY RULE ──────────────────────────────────────────────────────────
#
# This script REFUSES to restore into a database that already contains tables,
# unless you pass --force. Restoring over a live database is the one mistake
# during an incident that turns a recoverable problem into an unrecoverable
# one, and "I was sure it was the empty one" is how it happens.

set -euo pipefail

DUMP="${1:-}"
FORCE="${2:-}"

log()  { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail() { printf '%s  ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2; exit 1; }

[ -n "$DUMP" ] || fail "Usage: $0 <dump-file> [--force]"
[ -f "$DUMP" ] || fail "No such dump: $DUMP"
[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is required — the database to restore INTO."

PG_RESTORE="pg_restore"
PSQL="psql"
if [ -n "${PG_BIN:-}" ]; then
  PG_RESTORE="${PG_BIN}/pg_restore"
  PSQL="${PG_BIN}/psql"
fi
command -v "$PG_RESTORE" >/dev/null 2>&1 || fail "pg_restore not found. Set PG_BIN."

# ── DATABASE_URL is a PRISMA url, not a libpq one ────────────────────────────
#
# Prisma appends parameters libpq has never heard of — `schema`, `pgbouncer`,
# `connection_limit`, `pool_timeout` — and pg_dump rejects the whole URL with
# "invalid URI query parameter". Handing the app's own connection string
# straight to pg_dump therefore fails on a completely standard setup, which is
# exactly the sort of breakage a backup script must not have.
#
# `schema` is not merely dropped: it names the schema to dump, so it becomes
# `--schema=<name>`. Everything libpq does understand (sslmode and friends) is
# preserved.
strip_prisma_params() {
  local url="$1"
  local base="${url%%\?*}"
  local query=""
  [ "$url" != "$base" ] && query="${url#*\?}"

  PG_SCHEMA=""
  local keep=""
  local IFS='&'
  for pair in $query; do
    [ -n "$pair" ] || continue
    case "${pair%%=*}" in
      schema)         PG_SCHEMA="${pair#*=}" ;;
      sslmode|sslrootcert|sslcert|sslkey|application_name|connect_timeout|options|target_session_attrs)
                      keep="${keep:+${keep}&}${pair}" ;;
      *)              ;;
    esac
  done
  PG_URL="${base}${keep:+?${keep}}"
}

strip_prisma_params "$DATABASE_URL"

# Verify the dump before touching the target.
"$PG_RESTORE" --list "$DUMP" > /dev/null 2>&1 || fail "Dump is unreadable or corrupt: $DUMP"
TABLES=$("$PG_RESTORE" --list "$DUMP" 2>/dev/null | grep -c 'TABLE DATA' || true)
log "Dump verified: ${TABLES} tables with data."

EXISTING=$("$PSQL" "$PG_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "?")

if [ "$EXISTING" = "?" ]; then
  fail "Could not query the target database. Check DATABASE_URL and connectivity."
fi

log "Target currently has ${EXISTING} tables in schema 'public'."

if [ "$EXISTING" != "0" ] && [ "$FORCE" != "--force" ]; then
  fail "Target is NOT empty. Re-run with --force only if you intend to overwrite it."
fi

if [ "$FORCE" = "--force" ] && [ "$EXISTING" != "0" ]; then
  log "WARNING: --force given. Existing objects will be dropped and replaced."
fi

log "Restoring …"
# --clean --if-exists makes the restore idempotent; --no-owner/--no-acl let it
# land in a database whose roles differ from the source's.
"$PG_RESTORE" --dbname="$PG_URL" \
  --clean --if-exists --no-owner --no-acl \
  --exit-on-error \
  "$DUMP"

AFTER=$("$PSQL" "$PG_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "?")
log "Restore complete. Target now has ${AFTER} tables."
log "Verify the application starts and a known row is present before declaring success."
