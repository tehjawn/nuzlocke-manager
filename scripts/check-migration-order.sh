#!/usr/bin/env bash
# Check that migrations added on this branch cannot reorder against the base.
#
# Prisma applies migrations in lexicographic directory order, but `migrate
# deploy` only applies what is *unapplied*. So if two PRs each add a migration
# and the one with the earlier timestamp merges second, production applies them
# in merge order while a fresh database applies them in timestamp order. The
# two schemas diverge, and nothing notices until a new environment is built.
#
# Checks, in order:
#   1. existing migrations are not touched
#   2. added directory names are parseable as <timestamp>_<name>
#   3. added timestamps are real instants, not far-future typos
#   4. added migrations sort strictly after every migration on the base
#   5. no two migrations share a timestamp
#
# Usage:
#   scripts/check-migration-order.sh [base-ref]     # default origin/main
#
# Env:
#   MIGRATION_BASE_REF   alternative way to pass the base ref

set -euo pipefail

BASE_REF="${1:-${MIGRATION_BASE_REF:-origin/main}}"
MIGRATIONS_DIR="prisma/migrations"

# GitHub renders ::error:: as an annotation; locally it would just be noise.
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  ANNOTATE="::error::"
else
  ANNOTATE=""
fi

failed=0
fail() {
  echo "${ANNOTATE}$*" >&2
  failed=1
}

if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
  echo "error: base ref '$BASE_REF' not found. Fetch it first (git fetch origin main)." >&2
  exit 2
fi

MERGE_BASE="$(git merge-base "$BASE_REF" HEAD)"

# Migration directory names in a tree. The depth check skips
# migration_lock.toml, which sits directly in the migrations directory.
list_migrations() {
  git ls-tree -r --name-only "$1" -- "$MIGRATIONS_DIR/" |
    awk -F/ 'NF > 3 { print $3 }' |
    sort -u
}

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

list_migrations "$MERGE_BASE" >"$work/base"
list_migrations HEAD >"$work/head"
comm -13 "$work/base" "$work/head" >"$work/added"

base_count="$(wc -l <"$work/base" | tr -d ' ')"
added_count="$(wc -l <"$work/added" | tr -d ' ')"
echo "Base (${BASE_REF} @ $(git rev-parse --short "$MERGE_BASE")): ${base_count} migration(s)"
echo "Added on this branch: ${added_count}"
[ "$added_count" -eq 0 ] || sed 's/^/  /' "$work/added"
# Not a failure. Several migrations in one PR are ordered relative to each other
# and still checked against the base individually, so they are safe — the
# convention is about keeping review and rollback small, not correctness.
if [ "$added_count" -gt 1 ]; then
  echo "${GITHUB_ACTIONS:+::notice::}This branch adds ${added_count} migrations. One per PR is the convention; check this is deliberate."
fi
echo

# --- 1. Migrations already on the base must not be touched. Prisma records a
# checksum at apply time, so an edited migration is never re-run where it is
# already applied but *is* run as edited in a fresh database — the same
# divergence as (3). `migrate deploy` refuses to run at all once it notices.
#
# This runs even when nothing was added: editing in place adds no directory.
#
# Every changed path counts, whatever git calls the change. Filtering on status
# letters missed type changes (swapping migration.sql for a symlink reports T,
# not M) and files added inside a directory that already exists. --no-renames
# keeps a rename from being reported only against its new path, which would hide
# that the old, already-applied directory went away.
while read -r dir; do
  [ -n "$dir" ] || continue
  grep -qx "$dir" "$work/base" || continue
  fail "Migration '${dir}' already exists on ${BASE_REF}, but this branch changes what is inside it.
  Prisma stores a checksum for each applied migration and will refuse to deploy
  once one no longer matches. Fix: restore it and add a new migration instead."
done < <(
  git diff --no-renames --name-only "$MERGE_BASE" HEAD -- "$MIGRATIONS_DIR/" |
    awk -F/ 'NF > 3 { print $3 }' |
    sort -u
)

if [ "$added_count" -eq 0 ]; then
  [ "$failed" -eq 0 ] || exit 1
  echo "OK: no migrations added, and none of the existing ones were touched."
  exit 0
fi

# --- 2. Names must be parseable, or the timestamp comparison is meaningless.
while read -r name; do
  if ! [[ "$name" =~ ^[0-9]{14}_[A-Za-z0-9_]+$ ]]; then
    fail "Migration '${name}' is not named <14-digit timestamp>_<name>. Prisma orders migrations by directory name; a name it cannot parse cannot be ordered."
  fi
done <"$work/added"
[ "$failed" -eq 0 ] || exit 1

# --- 3. The timestamp must be a real instant, and not far in the future. These
# are written by hand here, so a slipped digit is plausible — and a migration
# dated 2027 does not fail, it silently forces every later migration past 2027.
while read -r problem; do
  [ -n "$problem" ] || continue
  fail "Migration timestamp ${problem}.
  Fix: rename the directory with the time you actually created it, or let
  'npx prisma migrate dev' generate the name."
done < <(
  cut -c1-14 "$work/added" | sort -u | python3 -c '
import datetime, sys

limit = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)
for line in sys.stdin:
    ts = line.strip()
    if not ts:
        continue
    try:
        when = datetime.datetime.strptime(ts, "%Y%m%d%H%M%S").replace(
            tzinfo=datetime.timezone.utc
        )
    except ValueError:
        print(f"{ts} is not a real date and time")
        continue
    if when > limit:
        print(f"{ts} is dated {when:%Y-%m-%d %H:%M} UTC, which is more than two days from now")
'
)

# --- 4. Every added migration must sort after everything already on the base.
newest_base="$(tail -n 1 "$work/base")"
if [ -n "$newest_base" ]; then
  newest_base_ts="${newest_base:0:14}"
  while read -r name; do
    ts="${name:0:14}"
    if [ "$((10#$ts))" -le "$((10#$newest_base_ts))" ]; then
      fail "Migration '${name}' sorts at or before '${newest_base}', which is already on ${BASE_REF}.
  A fresh database would apply these in a different order than production did.
  Fix: rebase on ${BASE_REF}, then rename the directory with a timestamp later
  than ${newest_base_ts}. The SQL does not change — only the directory name."
    fi
  done <"$work/added"
fi

# --- 5. No two migrations may share a timestamp. With hand-rounded timestamps
# (…180000) two authors picking the same hour is entirely plausible, and then
# apply order is decided by the arbitrary name suffix. Only collisions that
# involve a migration added here are this branch's problem.
while read -r ts; do
  [ -n "$ts" ] || continue
  colliding="$(grep -h "^${ts}_" "$work/head" | tr '\n' ' ')"
  fail "Timestamp ${ts} is used by more than one migration: ${colliding}
  Apply order between them falls back to the name suffix, which is arbitrary.
  Fix: re-timestamp the migration added on this branch."
done < <(cut -c1-14 "$work/head" | sort | uniq -d | grep -Fxf <(cut -c1-14 "$work/added" | sort -u) || true)

[ "$failed" -eq 0 ] || exit 1

echo "OK: added migrations sort after everything on ${BASE_REF}, timestamps are unique, and no existing migration was touched."
