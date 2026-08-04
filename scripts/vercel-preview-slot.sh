#!/usr/bin/env bash
# Claim or release a stable preview alias hostname for a PR.
#
# Preview deployment URLs contain a per-deployment hash, and Discord OAuth
# requires redirect URIs to match exactly, so previews can only support login
# through a fixed set of hostnames registered ahead of time. Each labelled PR
# borrows one of those slots for as long as it holds the "deploy preview" label.
#
# Usage:
#   scripts/vercel-preview-slot.sh claim   <pr-number>   # prints the slot host
#   scripts/vercel-preview-slot.sh release <pr-number>
#
# Env:
#   VERCEL_TOKEN         required
#   VERCEL_ORG_ID        required (team_…)
#   VERCEL_PROJECT_ID    required (prj_…)
#   PREVIEW_SLOT_HOSTS   optional, space-separated. Must match the redirect URIs
#                        registered in the Discord OAuth app.

set -euo pipefail

ACTION="${1:-}"
PR_NUMBER="${2:-}"

if [ "$ACTION" != "claim" ] && [ "$ACTION" != "release" ]; then
  echo "usage: $0 <claim|release> <pr-number>" >&2
  exit 2
fi
if [ -z "$PR_NUMBER" ]; then
  echo "usage: $0 $ACTION <pr-number>" >&2
  exit 2
fi

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"

SLOT_HOSTS="${PREVIEW_SLOT_HOSTS:-nuzlocke-preview-1.vercel.app nuzlocke-preview-2.vercel.app nuzlocke-preview-3.vercel.app}"

API="https://api.vercel.com"
AUTH_HEADER="Authorization: Bearer ${VERCEL_TOKEN}"
TEAM_QS="teamId=${VERCEL_ORG_ID}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# alias host -> alias uid + deployment id, for this project only.
curl -sS -H "$AUTH_HEADER" \
  "${API}/v4/aliases?${TEAM_QS}&projectId=${VERCEL_PROJECT_ID}&limit=100" \
  > "$TMP_DIR/aliases.json"

# Resolve which PR currently owns a slot. A slot pointing at a deployment that
# no longer exists is stale, not occupied — previews get deleted on cleanup, and
# the alias can outlive them.
owner_of() {
  local deployment_id="$1"
  local code
  code="$(curl -sS -o "$TMP_DIR/dep.json" -w '%{http_code}' \
    -H "$AUTH_HEADER" "${API}/v13/deployments/${deployment_id}?${TEAM_QS}")"
  if [ "$code" != "200" ]; then
    echo "__stale__"
    return 0
  fi
  python3 -c 'import json,sys; print((json.load(open(sys.argv[1])).get("meta") or {}).get("githubPrId") or "")' \
    "$TMP_DIR/dep.json"
}

slot_record() {
  python3 - "$TMP_DIR/aliases.json" "$1" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
want = sys.argv[2]
for entry in data.get("aliases") or []:
    if entry.get("alias") != want:
        continue
    uid = entry.get("uid") or entry.get("id") or ""
    dep = entry.get("deployment") or {}
    dep_id = dep.get("id") or entry.get("deploymentId") or ""
    print(f"{uid} {dep_id}")
    break
PY
}

remove_alias() {
  local uid="$1" host="$2"
  local code
  code="$(curl -sS -o "$TMP_DIR/rm.json" -w '%{http_code}' -X DELETE \
    -H "$AUTH_HEADER" "${API}/v2/aliases/${uid}?${TEAM_QS}")"
  # 404 means someone already removed it. Releasing is idempotent by design:
  # unlabel releases the slot and a later close runs cleanup again.
  if [ "$code" = "200" ] || [ "$code" = "404" ]; then
    echo "  released ${host}"
    return 0
  fi
  echo "  failed to release ${host} (HTTP ${code}): $(head -c 200 "$TMP_DIR/rm.json")" >&2
  return 1
}

if [ "$ACTION" = "release" ]; then
  released=0
  for host in $SLOT_HOSTS; do
    uid=""; dep_id=""
    read -r uid dep_id <<<"$(slot_record "$host")" || true
    [ -n "$uid" ] || continue
    owner=""
    if [ -n "$dep_id" ]; then owner="$(owner_of "$dep_id")"; fi
    if [ "$owner" = "$PR_NUMBER" ] || [ "$owner" = "__stale__" ]; then
      remove_alias "$uid" "$host"
      released=$((released + 1))
    fi
  done
  echo "Released ${released} preview slot(s) for PR #${PR_NUMBER}."
  exit 0
fi

# claim: prefer the slot this PR already holds so re-pushes keep a stable URL,
# then fall back to the first free or stale slot.
occupied=""
free_host=""
own_host=""

for host in $SLOT_HOSTS; do
  uid=""; dep_id=""
  read -r uid dep_id <<<"$(slot_record "$host")" || true
  if [ -z "$uid" ]; then
    if [ -z "$free_host" ]; then free_host="$host"; fi
    continue
  fi
  owner=""
  if [ -n "$dep_id" ]; then owner="$(owner_of "$dep_id")"; fi
  if [ "$owner" = "$PR_NUMBER" ]; then
    own_host="$host"
    break
  fi
  if [ "$owner" = "__stale__" ] || [ -z "$owner" ]; then
    if [ -z "$free_host" ]; then free_host="$host"; fi
    continue
  fi
  occupied="${occupied}  ${host} → PR #${owner}\n"
done

CLAIMED="${own_host:-$free_host}"

if [ -z "$CLAIMED" ]; then
  {
    echo "::error::No preview alias slot is free. Logged-in preview testing is capped at the number of hostnames registered in the Discord OAuth app."
    echo "Currently held:"
    printf "%b" "$occupied"
    echo "Unlabel one of those PRs to free a slot, or register another redirect URI and add it to PREVIEW_SLOT_HOSTS."
  } >&2
  exit 1
fi

# Progress goes to stderr so stdout is only ever the hostname.
if [ -n "$own_host" ]; then
  echo "Reusing preview slot ${CLAIMED} (already held by PR #${PR_NUMBER})." >&2
else
  echo "Claiming preview slot ${CLAIMED} for PR #${PR_NUMBER}." >&2
fi

echo "$CLAIMED"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "host=${CLAIMED}" >> "$GITHUB_OUTPUT"
  echo "url=https://${CLAIMED}" >> "$GITHUB_OUTPUT"
fi
