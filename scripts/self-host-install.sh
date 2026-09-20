#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null

ENV_FILE="${ECORIONE_DEPLOY_ENV:-${ECORIONE_PRODUCTION_ENV:-deploy/production.env}}"
ENV_TEMPLATE="${ECORIONE_DEPLOY_ENV_TEMPLATE:-deploy/production.env.example}"
COMPOSE_PROJECT="${ECORIONE_COMPOSE_PROJECT:-ecorione}"
COMPOSE_OVERLAY="${ECORIONE_COMPOSE_OVERLAY:-}"
EDGE_NETWORK="${ECORIONE_EDGE_NETWORK:-}"
COMPOSE_ARGS=(-p "$COMPOSE_PROJECT" --env-file "$ENV_FILE" -f deploy/compose.yml)
if [[ -n "$COMPOSE_OVERLAY" ]]; then
  [[ -f "$COMPOSE_OVERLAY" ]] || { echo "Missing Compose overlay $COMPOSE_OVERLAY" >&2; exit 1; }
  [[ ! -L "$COMPOSE_OVERLAY" ]] || { echo "Refusing deploy: Compose overlay $COMPOSE_OVERLAY must not be a symlink" >&2; exit 1; }
  COMPOSE_ARGS+=(-f "$COMPOSE_OVERLAY")
fi
if [[ -n "$EDGE_NETWORK" ]]; then
  docker network inspect "$EDGE_NETWORK" >/dev/null 2>&1 || { echo "Required Docker edge network $EDGE_NETWORK does not exist" >&2; exit 1; }
fi

if [[ ! -f "$ENV_FILE" ]]; then
  [[ -f "$ENV_TEMPLATE" ]] || { echo "Missing env template $ENV_TEMPLATE" >&2; exit 1; }
  mkdir -p "$(dirname "$ENV_FILE")"
  cp "$ENV_TEMPLATE" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Prepared $ENV_FILE from $ENV_TEMPLATE; replace CHANGE_ME values before deployment."
  exit 0
fi

[[ ! -L "$ENV_FILE" ]] || { echo "Refusing deploy: $ENV_FILE must not be a symlink" >&2; exit 1; }
mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
[[ -z "$mode" || "$mode" == "600" ]] || { echo "Refusing deploy: $ENV_FILE must be mode 600; current mode is $mode" >&2; exit 1; }
if grep -q 'CHANGE_ME' "$ENV_FILE"; then
  echo "Refusing deploy: CHANGE_ME remains in $ENV_FILE" >&2
  exit 1
fi

docker compose "${COMPOSE_ARGS[@]}" config >/dev/null

if [[ "${1:-}" != "--apply" ]]; then
  echo "Configuration valid for project=$COMPOSE_PROJECT env=$ENV_FILE overlay=${COMPOSE_OVERLAY:-none}. Re-run with --apply to build and start."
  exit 0
fi

docker compose "${COMPOSE_ARGS[@]}" up -d --build
echo "ECORIONE self-host baseline started for project=$COMPOSE_PROJECT. Verify staging/production health at the intended boundary before traffic."
