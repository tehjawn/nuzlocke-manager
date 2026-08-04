#!/usr/bin/env bash
# Claim or release a stable preview alias hostname for a PR.
#
# Preview deployment URLs contain a per-deployment hash, and Discord OAuth
# requires redirect URIs to match exactly, so previews can only support login
# through a fixed set of hostnames registered ahead of time. Each labelled PR
# borrows one of those slots for as long as it holds the "deploy preview" label.
#
# Usage:
#   scripts/vercel-preview-slot.sh claim   <pr-number>          # prints the host
#   scripts/vercel-preview-slot.sh verify  <pr-number> <host>    # still ours?
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

if [ "$ACTION" != "claim" ] && [ "$ACTION" != "release" ] && [ "$ACTION" != "verify" ]; then
  echo "usage: $0 <claim|verify|release> <pr-number> [host]" >&2
  exit 2
fi
if [ "$ACTION" = "verify" ] && [ -z "${3:-}" ]; then
  echo "usage: $0 verify <pr-number> <host>" >&2
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
#
# An HTTP error here must never be mistaken for "no aliases exist": that would
# make every slot look free, and claim would repoint a hostname away from the PR
# currently holding it. curl -sS still exits 0 on a 4xx/5xx, so check the status
# explicitly and confirm the payload really carries an aliases array.
: > "$TMP_DIR/aliases.ndjson"
until_ts=""
for _ in $(seq 1 20); do
  url="${API}/v4/aliases?${TEAM_QS}&projectId=${VERCEL_PROJECT_ID}&limit=100"
  if [ -n "$until_ts" ]; then
    url="${url}&until=${until_ts}"
  fi
  code="$(curl -sS -o "$TMP_DIR/page.json" -w '%{http_code}' -H "$AUTH_HEADER" "$url")"
  if [ "$code" != "200" ]; then
    echo "::error::Failed to list project aliases (HTTP ${code}): $(head -c 300 "$TMP_DIR/page.json")" >&2
    exit 1
  fi
  if ! python3 - "$TMP_DIR/page.json" "$TMP_DIR/aliases.ndjson" <<'PY'
import json, sys
page_path, out_path = sys.argv[1], sys.argv[2]
page = json.load(open(page_path))
aliases = page.get("aliases")
if not isinstance(aliases, list):
    sys.exit(1)
with open(out_path, "a") as out:
    for entry in aliases:
        out.write(json.dumps(entry) + "\n")
nxt = ((page.get("pagination") or {}).get("next")) or ""
open(page_path + ".next", "w").write(str(nxt))
PY
  then
    echo "::error::Alias listing did not contain an \"aliases\" array; refusing to treat slots as free." >&2
    exit 1
  fi
  next_ts="$(cat "$TMP_DIR/page.json.next")"
  if [ -z "$next_ts" ] || [ "$next_ts" = "$until_ts" ]; then
    break
  fi
  until_ts="$next_ts"
done

# Resolve which PR currently owns a slot. A slot pointing at a deployment that
# no longer exists is stale, not occupied — previews get deleted on cleanup, and
# the alias can outlive them. Only a 404 proves absence; on any other error the
# owner is unknown, and guessing "stale" would hand the slot to another PR.
owner_of() {
  local deployment_id="$1"
  local code
  code="$(curl -sS -o "$TMP_DIR/dep.json" -w '%{http_code}' \
    -H "$AUTH_HEADER" "${API}/v13/deployments/${deployment_id}?${TEAM_QS}")"
  if [ "$code" = "404" ]; then
    echo "__stale__"
    return 0
  fi
  if [ "$code" != "200" ]; then
    echo "::error::Cannot resolve slot owner for deployment ${deployment_id} (HTTP ${code}); refusing to guess." >&2
    return 1
  fi
  python3 -c 'import json,sys; print((json.load(open(sys.argv[1])).get("meta") or {}).get("githubPrId") or "")' \
    "$TMP_DIR/dep.json"
}

slot_record() {
  python3 - "$TMP_DIR/aliases.ndjson" "$1" <<'PY'
import json, sys
entries = [json.loads(line) for line in open(sys.argv[1]) if line.strip()]
want = sys.argv[2]
for entry in entries:
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

# Claiming reads the alias list, but the bind only happens after the build and
# deploy — minutes later. Two PRs labelled at once can therefore pick the same
# free slot, and the second bind would silently repoint the first PR's stable
# URL at the wrong deployment. This re-check runs immediately before the bind
# and turns that silent mix-up into a loud failure. It narrows the window rather
# than closing it; a true reservation would need Vercel to support binding an
# alias before a deployment exists.
if [ "$ACTION" = "verify" ]; then
  host="$3"
  uid=""; dep_id=""
  read -r uid dep_id <<<"$(slot_record "$host")" || true
  if [ -z "$uid" ]; then
    echo "Slot ${host} is unbound; safe to claim." >&2
    exit 0
  fi
  owner=""
  if [ -n "$dep_id" ]; then owner="$(owner_of "$dep_id")" || exit 1; fi
  if [ "$owner" = "$PR_NUMBER" ] || [ "$owner" = "__stale__" ] || [ -z "$owner" ]; then
    echo "Slot ${host} is still available to PR #${PR_NUMBER}." >&2
    exit 0
  fi
  echo "::error::Preview slot ${host} was taken by PR #${owner} while this deploy was building. Re-run this workflow to claim a different slot." >&2
  exit 1
fi

if [ "$ACTION" = "release" ]; then
  released=0
  for host in $SLOT_HOSTS; do
    uid=""; dep_id=""
    read -r uid dep_id <<<"$(slot_record "$host")" || true
    [ -n "$uid" ] || continue
    owner=""
    if [ -n "$dep_id" ]; then owner="$(owner_of "$dep_id")" || exit 1; fi
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
  if [ -n "$dep_id" ]; then owner="$(owner_of "$dep_id")" || exit 1; fi
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
