#!/usr/bin/env bash
# Delete Vercel preview deployments for a PR/branch. Never deletes production.
#
# Usage:
#   scripts/vercel-preview-cleanup.sh <pr-number> <head-ref> [commit-sha ...]
#
# Env:
#   VERCEL_TOKEN       required
#   VERCEL_ORG_ID      required (team_…)
#   VERCEL_PROJECT_ID  required (prj_…)

set -euo pipefail

if [ "${1:-}" = "" ] || [ "${2:-}" = "" ]; then
  echo "usage: $0 <pr-number> <head-ref> [commit-sha ...]" >&2
  exit 2
fi

PR_NUMBER="$1"
HEAD_REF="$2"
shift 2

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"

API="https://api.vercel.com"
AUTH_HEADER="Authorization: Bearer ${VERCEL_TOKEN}"
TEAM_QS="teamId=${VERCEL_ORG_ID}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Cleaning preview deployments for PR #${PR_NUMBER} (ref=${HEAD_REF})"

printf '%s\n' "$@" > "$TMP_DIR/shas.txt"

# Collect recent deployments (paginate a few pages; previews are recent).
: > "$TMP_DIR/deployments.ndjson"
until=""
for _ in 1 2 3 4 5; do
  url="${API}/v6/deployments?${TEAM_QS}&projectId=${VERCEL_PROJECT_ID}&limit=100"
  if [ -n "$until" ]; then
    url="${url}&until=${until}"
  fi
  curl -sS -H "$AUTH_HEADER" "$url" > "$TMP_DIR/page.json"
  python3 - "$TMP_DIR/page.json" "$TMP_DIR/deployments.ndjson" <<'PY'
import json, sys
page_path, out_path = sys.argv[1], sys.argv[2]
page = json.load(open(page_path))
deps = page.get("deployments") or []
with open(out_path, "a") as out:
    for dep in deps:
        out.write(json.dumps(dep) + "\n")
open(page_path + ".count", "w").write(str(len(deps)))
if deps:
    open(page_path + ".until", "w").write(str(deps[-1].get("created") or ""))
else:
    open(page_path + ".until", "w").write("")
PY
  count="$(cat "$TMP_DIR/page.json.count")"
  until="$(cat "$TMP_DIR/page.json.until")"
  if [ "$count" -eq 0 ] || [ -z "$until" ]; then
    break
  fi
done

python3 - "$PR_NUMBER" "$HEAD_REF" "$TMP_DIR/shas.txt" "$TMP_DIR/deployments.ndjson" "$TMP_DIR/to-delete.txt" <<'PY'
import json, sys

pr, head_ref, shas_path, deps_path, out_path = sys.argv[1:6]
shas = {line.strip() for line in open(shas_path) if line.strip()}
to_delete = []
seen = set()

for line in open(deps_path):
    dep = json.loads(line)
    uid = dep.get("uid") or dep.get("id")
    if not uid or uid in seen:
        continue

    target = (dep.get("target") or "").lower()
    if target == "production":
        continue

    meta = dep.get("meta") or {}
    ref = meta.get("githubCommitRef") or ""
    if ref in ("main", "master"):
        continue

    pr_id = str(meta.get("githubPrId") or "")
    sha = meta.get("githubCommitSha") or ""
    labeled = str(meta.get("deployPreviewLabel") or "") in ("1", "true", "yes")

    match = False
    if pr_id == str(pr):
        match = True
    elif ref == head_ref:
        match = True
    elif labeled and sha and sha in shas:
        match = True
    elif ref == "HEAD" and sha and sha in shas:
        # Actions CLI checkouts often report ref=HEAD.
        match = True

    if match:
        seen.add(uid)
        to_delete.append(uid)

open(out_path, "w").write("\n".join(to_delete) + ("\n" if to_delete else ""))
print(f"Matched {len(to_delete)} preview deployment(s).")
PY

if [ ! -s "$TMP_DIR/to-delete.txt" ]; then
  echo "No matching preview deployments to delete."
  exit 0
fi

failed=0
deleted=0
while IFS= read -r uid; do
  [ -n "$uid" ] || continue
  echo "Deleting ${uid}…"
  code="$(curl -sS -o "$TMP_DIR/del.json" -w '%{http_code}' -X DELETE \
    -H "$AUTH_HEADER" \
    "${API}/v13/deployments/${uid}?${TEAM_QS}")"
  if [ "$code" = "200" ]; then
    echo "  deleted ${uid}"
    deleted=$((deleted + 1))
  else
    echo "  failed to delete ${uid} (HTTP ${code}): $(head -c 300 "$TMP_DIR/del.json")"
    failed=1
  fi
done < "$TMP_DIR/to-delete.txt"

echo "Deleted ${deleted} preview deployment(s)."
if [ "$failed" -ne 0 ]; then
  exit 1
fi
