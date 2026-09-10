#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null
ENV_FILE="deploy/production.env"
if [[ ! -f "$ENV_FILE" ]]; then cp deploy/production.env.example "$ENV_FILE"; chmod 600 "$ENV_FILE"; echo "Prepared $ENV_FILE; replace CHANGE_ME values before deployment."; exit 0; fi
if grep -q 'CHANGE_ME' "$ENV_FILE"; then echo "Refusing deploy: CHANGE_ME remains in $ENV_FILE" >&2; exit 1; fi
docker compose --env-file "$ENV_FILE" -f deploy/compose.yml config >/dev/null
if [[ "${1:-}" != "--apply" ]]; then echo "Configuration valid. Re-run with --apply to build and start."; exit 0; fi
docker compose --env-file "$ENV_FILE" -f deploy/compose.yml up -d --build
echo "ECORIONE self-host baseline started. Verify HTTPS /ops and provider canary before traffic.";
