#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == "--apply" ]] || { echo "Usage: $0 --apply <previous-image-tag>" >&2; exit 2; }
TAG="${2:-}"
[[ "$TAG" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Invalid image tag" >&2; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
ENV_FILE="${ECORIONE_DEPLOY_ENV:-${ECORIONE_PRODUCTION_ENV:-deploy/production.env}}"
COMPOSE_PROJECT="${ECORIONE_COMPOSE_PROJECT:-ecorione}"
COMPOSE_ARGS=(-p "$COMPOSE_PROJECT" --env-file "$ENV_FILE" -f deploy/compose.yml)
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
ECORIONE_IMAGE_TAG="$TAG" docker compose "${COMPOSE_ARGS[@]}" config >/dev/null
ECORIONE_IMAGE_TAG="$TAG" docker compose "${COMPOSE_ARGS[@]}" up -d
printf '%s
' "$(date -u +%FT%TZ) rollback=$TAG" >> data/release-rollback.log
echo "Runtime image rollback applied. Data rollback is separate and must use verified owner backup/restore receipts.";
