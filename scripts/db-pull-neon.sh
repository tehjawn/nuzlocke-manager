#!/usr/bin/env bash
# Pull a snapshot from Neon into local Postgres (destructive to local DB).
#
# Requires:
#   NEON_DATABASE_URL  — Neon connection (prefer direct / unpooled host)
#   DATABASE_URL       — local target (must be localhost)
#
# Usage:
#   pn db:pull-neon
#   NEON_DATABASE_URL=… DATABASE_URL=… ./scripts/db-pull-neon.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  # shellcheck disable=SC1090
  set -a
  # Export KEY=VAL lines; ignore comments / blanks. Strip surrounding quotes.
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" != *=* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    if [[ "$val" == \"*\" ]]; then val="${val:1:${#val}-2}"; fi
    if [[ "$val" == \'*\' ]]; then val="${val:1:${#val}-2}"; fi
    export "$key=$val"
  done < "$file"
  set +a
}

load_env_file ".env"
load_env_file ".env.local"

# Prefer explicit Neon URL; fall back to unpooled neon-looking DATABASE_URL_UNPOOLED
SOURCE_URL="${NEON_DATABASE_URL:-${DATABASE_URL_NEON:-}}"
if [[ -z "$SOURCE_URL" && -n "${DATABASE_URL_UNPOOLED:-}" && "$DATABASE_URL_UNPOOLED" == *"neon.tech"* ]]; then
  SOURCE_URL="$DATABASE_URL_UNPOOLED"
fi

TARGET_URL="${DATABASE_URL:-}"

if [[ -z "$SOURCE_URL" ]]; then
  echo "error: set NEON_DATABASE_URL (Neon direct/unpooled URL) in .env.local" >&2
  exit 1
fi
if [[ -z "$TARGET_URL" ]]; then
  echo "error: set DATABASE_URL to your local Postgres URL" >&2
  exit 1
fi

# Prefer direct Neon host for dumps (pooler can break pg_dump).
if [[ "$SOURCE_URL" == *"-pooler."* ]]; then
  SOURCE_URL="${SOURCE_URL/-pooler./.}"
  echo "note: stripped -pooler from Neon host for pg_dump"
fi

# Safety: never overwrite Neon with itself / refuse non-local targets by default.
if [[ "$TARGET_URL" == *"neon.tech"* ]]; then
  echo "error: DATABASE_URL points at Neon — refusing to overwrite remote." >&2
  echo "       Point DATABASE_URL at localhost Docker first." >&2
  exit 1
fi
if [[ "$TARGET_URL" != *"localhost"* && "$TARGET_URL" != *"127.0.0.1"* ]]; then
  if [[ "${FORCE_REMOTE_TARGET:-}" != "1" ]]; then
    echo "error: DATABASE_URL is not localhost (set FORCE_REMOTE_TARGET=1 to override)." >&2
    exit 1
  fi
fi
if [[ "$SOURCE_URL" == *"localhost"* || "$SOURCE_URL" == *"127.0.0.1"* ]]; then
  echo "error: NEON_DATABASE_URL looks local — expected a Neon URL." >&2
  exit 1
fi

PG18_BIN="${PG18_BIN:-/opt/homebrew/opt/postgresql@18/bin}"
if [[ ! -x "$PG18_BIN/pg_dump" ]]; then
  echo "error: need Postgres 18 client tools (Neon is PG 18)." >&2
  echo "       brew install postgresql@18" >&2
  exit 1
fi

DUMP_DIR="${TMPDIR:-/tmp}/nuzlocke-neon-pull"
mkdir -p "$DUMP_DIR"
DUMP_FILE="$DUMP_DIR/neon-$(date +%Y%m%d-%H%M%S).dump"

echo "==> Dumping Neon → $DUMP_FILE"
"$PG18_BIN/pg_dump" "$SOURCE_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="$DUMP_FILE"
ls -lh "$DUMP_FILE"

echo "==> Resetting local public schema"
"$PG18_BIN/psql" "$TARGET_URL" -v ON_ERROR_STOP=1 -c "
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT ALL ON SCHEMA public TO public;
"

echo "==> Restoring into local"
# Neon (PG18) dumps may SET GUCs local servers don't know (e.g. transaction_timeout).
# Restore as SQL and strip those so restore isn't a hard failure on version skew.
RESTORE_SQL="$DUMP_DIR/restore.sql"
"$PG18_BIN/pg_restore" \
  --no-owner \
  --no-acl \
  --file="$RESTORE_SQL" \
  "$DUMP_FILE"

grep -v -E '^SET (transaction_timeout|idle_session_timeout)[[:space:]]*=' "$RESTORE_SQL" \
  | "$PG18_BIN/psql" "$TARGET_URL" -v ON_ERROR_STOP=1 -f - >/dev/null

echo "==> Sanity counts"
"$PG18_BIN/psql" "$TARGET_URL" -c "ANALYZE;" >/dev/null
"$PG18_BIN/psql" "$TARGET_URL" -c "
SELECT relname AS table, n_live_tup AS approx_rows
FROM pg_stat_user_tables
ORDER BY relname;
"

echo "DONE — local DB refreshed from Neon snapshot."
echo "Dump kept at: $DUMP_FILE"
