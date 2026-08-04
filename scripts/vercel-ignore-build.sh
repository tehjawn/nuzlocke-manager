#!/usr/bin/env bash
# Ignored Build Step for Vercel's Git integration.
# Exit 0 = skip build; exit 1 = continue build.
#
# Production always builds. Automatic preview builds are skipped; PRs deploy
# only when labeled "deploy preview" via .github/workflows/vercel-preview.yml.

set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Building production deployment."
  exit 1
fi

echo "Skipping automatic preview build. Add the GitHub label \"deploy preview\" to deploy."
exit 0
