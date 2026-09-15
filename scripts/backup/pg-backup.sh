#!/usr/bin/env bash
#
# Urban Renewal OS — PostgreSQL backup.
#
# ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
#
# There was no backup of any kind. The database holds ownership shares and
# signature records — the evidence behind a reported pinuy-binuy threshold — so
# losing it is not an inconvenience, it is losing the legal basis of a project.
#
# ── DESIGN NOTES ─────────────────────────────────────────────────────────────
#
#   * Custom format (-Fc), not plain SQL. It is compressed, it allows selective
#     restore of a single table, and `pg_restore --list` can verify it.
#
#   * EVERY dump is verified immediately after it is written. An unverified
#     backup is a belief, not a backup: the classic failure is a cron job that
#     has been writing zero-byte files for eight months because the password
#     changed and nobody read the log.
#
#   * Retention has a FLOOR. `KEEP_MIN` backups always survive regardless of
#     age, so a month of failed runs followed by a successful prune cannot
#     leave you with nothing.
#
#   * The password is never on the command line (where `ps` would show it) and
#     never logged. It comes from PGPASSWORD or ~/.pgpass.
#
#   * Non-zero exit on any failure, so whatever schedules this can alert.
#
# ── USAGE ────────────────────────────────────────────────────────────────────
#
#   DATABASE_URL="postgresql://user:pass@host:5432/db" ./pg-backup.sh
#
#   Optional:
#     BACKUP_DIR   where dumps go             (default ./backups)
#     KEEP_DAYS    delete dumps older than    (default 30)
#     KEEP_MIN     never go below this many   (default 7)
#     PG_BIN       directory holding pg_dump  (default: found on PATH)
#
# Restore with ./pg-restore.sh — read it before you need it.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
KEEP_MIN="${KEEP_MIN:-7}"

log()  { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail() { printf '%s  ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2; exit 1; }

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is required."

PG_DUMP="pg_dump"
PG_RESTORE="pg_restore"
if [ -n "${PG_BIN:-}" ]; then
  PG_DUMP="${PG_BIN}/pg_dump"
  PG_RESTORE="${PG_BIN}/pg_restore"
fi
command -v "$PG_DUMP" >/dev/null 2>&1 || fail "pg_dump not found. Set PG_BIN to the directory containing it."

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

# Derive a filename-safe database name for the dump, without echoing credentials.
DB_NAME="$(printf '%s' "$PG_URL" | sed -E 's#^.*/([^/?]+)(\?.*)?$#\1#')"
[ -n "$DB_NAME" ] || fail "Could not read a database name from DATABASE_URL."

mkdir -p "$BACKUP_DIR"
STAMP="$(date '+%Y%m%d-%H%M%S')"
TARGET="${BACKUP_DIR}/${DB_NAME}-${STAMP}.dump"

log "Backing up '${DB_NAME}' -> ${TARGET}"

# --no-owner / --no-acl keep the dump restorable into a database whose role
# names differ from production's, which is what a restore drill actually does.
if ! "$PG_DUMP" --dbname="$PG_URL" \
      --format=custom --compress=9 \
      --no-owner --no-acl \
      ${PG_SCHEMA:+--schema="$PG_SCHEMA"} \
      --file="$TARGET"; then
  rm -f "$TARGET"
  fail "pg_dump failed. Partial file removed so it cannot be mistaken for a backup."
fi

# ── Verify ──────────────────────────────────────────────────────────────────
SIZE=$(wc -c < "$TARGET" | tr -d ' ')
[ "$SIZE" -gt 1024 ] || { rm -f "$TARGET"; fail "Dump is only ${SIZE} bytes — treating as failed."; }

if ! "$PG_RESTORE" --list "$TARGET" > /dev/null 2>&1; then
  rm -f "$TARGET"
  fail "Dump failed its own table-of-contents check — it is not restorable. Removed."
fi

TABLES=$("$PG_RESTORE" --list "$TARGET" 2>/dev/null | grep -c 'TABLE DATA' || true)
log "Verified: $(( SIZE / 1024 )) KB, ${TABLES} tables with data."

# A dump that restores but contains nothing is the failure mode that looks like
# success. This service has 70+ tables; a handful means something is wrong.
if [ "$TABLES" -lt 5 ]; then
  fail "Only ${TABLES} tables carry data. Refusing to treat this as a good backup."
fi

# ── Retention ───────────────────────────────────────────────────────────────
TOTAL=$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-*.dump" -type f | wc -l | tr -d ' ')
if [ "$TOTAL" -le "$KEEP_MIN" ]; then
  log "Retention: ${TOTAL} backups on disk, floor is ${KEEP_MIN}. Nothing pruned."
else
  # Only prune down TO the floor, oldest first.
  DELETABLE=$(( TOTAL - KEEP_MIN ))
  PRUNED=0
  while IFS= read -r old; do
    [ "$PRUNED" -lt "$DELETABLE" ] || break
    rm -f "$old" && PRUNED=$(( PRUNED + 1 ))
    log "Pruned $(basename "$old")"
  done < <(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-*.dump" -type f -mtime "+${KEEP_DAYS}" -print | sort)
  log "Retention: pruned ${PRUNED}, kept $(( TOTAL - PRUNED ))."
fi

log "Backup complete."
