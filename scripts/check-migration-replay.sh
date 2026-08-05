#!/usr/bin/env bash
# Apply this branch's new migrations to a scratch database and check the result
# matches prisma/schema.prisma.
#
# Two PRs can each add a migration that is fine on its own, merge cleanly in git
# because they touch different files, and only then collide — the second one
# alters an object the first one already changed, or the pair leaves the schema
# somewhere prisma/schema.prisma does not describe. Nothing catches that until
# `migrate deploy` runs somewhere real.
#
# The same final assertion also catches a schema.prisma edit with no migration
# (e.g. someone ran `db push` locally and forgot `migrate dev`): the database
# built from the base schema will not match HEAD's schema, and the failure
# message below says so explicitly.
#
# What this does, against a throwaway database:
#   1. builds the schema as it exists on the base ref
#   2. records the base ref's migrations as already applied
#   3. runs `migrate deploy`, which applies exactly this branch's new migrations
#      (skipped when none were added — used for schema-only drift checks)
#   4. asserts the database now matches prisma/schema.prisma exactly
#
# Step 1 builds from the base schema rather than replaying the migrations from
# empty because this history has no baseline migration: the first ~10 tables
# were created by `db push` before migrations started, so a replay from empty
# fails on the first migration. See README "Local setup".
#
# Usage:
#   scripts/check-migration-replay.sh [base-ref]     # default origin/main
#
# Env:
#   DATABASE_URL           required — a scratch database that can be clobbered
#   MIGRATION_BASE_REF     alternative way to pass the base ref
#   FORCE_REMOTE_TARGET=1  allow a non-loopback DATABASE_URL (don't)

set -euo pipefail

BASE_REF="${1:-${MIGRATION_BASE_REF:-origin/main}}"
MIGRATIONS_DIR="prisma/migrations"

: "${DATABASE_URL:?DATABASE_URL is required (point it at a scratch database)}"

# This script drops nothing, but it does write freely to whatever it is aimed
# at. Refuse anything that is not obviously a local throwaway.
host="$(printf '%s\n' "$DATABASE_URL" | sed -E 's#^[^:]+://([^@]*@)?([^:/?]+).*#\2#')"
if [ "${FORCE_REMOTE_TARGET:-}" != "1" ]; then
  case "$host" in
    localhost | 127.0.0.1 | ::1 | postgres) ;;
    *)
      echo "error: DATABASE_URL points at '${host}', which is not loopback." >&2
      echo "       This script writes to that database. Set FORCE_REMOTE_TARGET=1 only if you are certain." >&2
      exit 2
      ;;
  esac
fi

# prisma.config.ts prefers DATABASE_URL_UNPOOLED. Keep both on the scratch
# database so a stray .env value cannot redirect any of the steps below.
export DATABASE_URL_UNPOOLED="$DATABASE_URL"

if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
  echo "error: base ref '$BASE_REF' not found. Fetch it first (git fetch origin main)." >&2
  exit 2
fi

MERGE_BASE="$(git merge-base "$BASE_REF" HEAD)"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

list_migrations() {
  git ls-tree -r --name-only "$1" -- "$MIGRATIONS_DIR/" |
    awk -F/ 'NF > 3 { print $3 }' |
    sort -u
}

list_migrations "$MERGE_BASE" >"$work/base"
list_migrations HEAD >"$work/head"
comm -13 "$work/base" "$work/head" >"$work/added"

added_count="$(wc -l <"$work/added" | tr -d ' ')"

# The baseline below is plain CREATE TABLE, and the migrations after it assume
# they are the only thing that has touched this database. Against a database
# that already has content, the run either dies with a confusing "already
# exists" or — worse, if a _prisma_migrations table is already there — reports a
# result that says nothing about whether these migrations actually work.
# In CI the service container is always fresh; this is for local runs.
echo "==> Checking the scratch database is empty"
set +e
npx --no-install prisma migrate diff \
  --from-config-datasource \
  --to-empty \
  --exit-code >/dev/null 2>&1
empty=$?
set -e
if [ "$empty" -eq 2 ]; then
  echo "${GITHUB_ACTIONS:+::error::}The database at '${host}' is not empty." >&2
  echo "  This check must start from nothing, or its result means nothing." >&2
  echo "  Point DATABASE_URL at a throwaway database, or drop and recreate this one:" >&2
  echo "    docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=ci -e POSTGRES_USER=ci -e POSTGRES_DB=migcheck postgres:18" >&2
  echo "    DATABASE_URL=postgresql://ci:ci@127.0.0.1:55432/migcheck $0 ${BASE_REF}" >&2
  exit 2
elif [ "$empty" -ne 0 ]; then
  echo "error: could not inspect the database at '${host}'. Is it reachable?" >&2
  exit 2
fi

echo "==> Building the schema as of ${BASE_REF} ($(git rev-parse --short "$MERGE_BASE"))"
git show "${MERGE_BASE}:prisma/schema.prisma" >"$work/base.prisma"
npx --no-install prisma migrate diff \
  --from-empty \
  --to-schema "$work/base.prisma" \
  --script >"$work/baseline.sql"
npx --no-install prisma db execute --file "$work/baseline.sql"

echo "==> Recording $(wc -l <"$work/base" | tr -d ' ') base migration(s) as applied"
while read -r name; do
  [ -n "$name" ] || continue
  if ! out="$(npx --no-install prisma migrate resolve --applied "$name" 2>&1)"; then
    echo "Failed to record base migration '${name}' as applied:" >&2
    printf '%s\n' "$out" | sed 's/^/    /' >&2
    exit 1
  fi
done <"$work/base"

if [ "$added_count" -eq 0 ]; then
  echo "==> No migrations added against ${BASE_REF}; skipping deploy (schema-drift check only)."
else
  echo "==> Applying this branch's new migration(s)"
  sed 's/^/    /' "$work/added"
  npx --no-install prisma migrate deploy
fi

# `migrate deploy` succeeding only means the SQL ran. It does not mean the
# result is the schema the application expects — a migration that adds a column
# the schema does not declare, or omits one it does, still applies cleanly. The
# same check catches a schema.prisma edit with no accompanying migration.
echo "==> Checking the result matches prisma/schema.prisma"
set +e
npx --no-install prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --exit-code >"$work/drift.txt" 2>&1
drift=$?
set -e

if [ "$drift" -eq 2 ]; then
  if [ "$added_count" -eq 0 ]; then
    echo "${GITHUB_ACTIONS:+::error::}prisma/schema.prisma changed, but no migration adds the DDL." >&2
    echo "The database matches the base schema; HEAD's schema differs by:" >&2
    sed 's/^/    /' "$work/drift.txt" >&2
    echo >&2
    echo "Fix: run 'npx prisma migrate dev' (or 'npm run db:migrate') so the new" >&2
    echo "     SQL ships with the schema change. Do not rely on 'db push' alone." >&2
  else
    echo "${GITHUB_ACTIONS:+::error::}Migrations applied, but the database does not match prisma/schema.prisma." >&2
    echo "The difference (database -> schema) is what your migrations failed to make:" >&2
    sed 's/^/    /' "$work/drift.txt" >&2
    echo >&2
    echo "Fix: regenerate the migration with 'npx prisma migrate dev' so its SQL and" >&2
    echo "     prisma/schema.prisma agree, or hand-write the missing statements." >&2
  fi
  exit 1
elif [ "$drift" -ne 0 ]; then
  echo "${GITHUB_ACTIONS:+::error::}Could not compare the database with prisma/schema.prisma." >&2
  sed 's/^/    /' "$work/drift.txt" >&2
  exit 1
fi

if [ "$added_count" -eq 0 ]; then
  echo "OK: prisma/schema.prisma matches the base database shape (no DDL drift)."
else
  echo "OK: new migrations apply cleanly on top of ${BASE_REF} and match prisma/schema.prisma."
fi
