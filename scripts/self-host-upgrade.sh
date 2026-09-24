#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == "--apply" ]] || { echo "Usage: $0 --apply <image-tag>" >&2; exit 2; }
TAG="${2:-}"
[[ "$TAG" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Invalid image tag" >&2; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
ENV_FILE="${ECORIONE_DEPLOY_ENV:-${ECORIONE_PRODUCTION_ENV:-deploy/production.env}}"
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
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
[[ ! -L "$ENV_FILE" ]] || { echo "Refusing deploy: $ENV_FILE must not be a symlink" >&2; exit 1; }
mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
[[ -z "$mode" || "$mode" == "600" ]] || { echo "Refusing deploy: $ENV_FILE must be mode 600; current mode is $mode" >&2; exit 1; }

# Docker/BuildKit cache is reproducible and can grow across governed staging builds.
# Reclaim cache only when the Docker filesystem has fallen below the pre-build
# floor. Do not run `docker system prune`: images, containers, networks, and
# volumes remain outside this bounded cleanup so the known-good rollback image
# and durable owner data are preserved.
BUILD_MIN_FREE_GIB="${ECORIONE_DOCKER_BUILD_MIN_FREE_GIB:-20}"
[[ "$BUILD_MIN_FREE_GIB" =~ ^[0-9]+$ && "$BUILD_MIN_FREE_GIB" -ge 1 ]] || {
  echo "ECORIONE_DOCKER_BUILD_MIN_FREE_GIB must be a positive integer" >&2
  exit 2
}
DOCKER_ROOT="$(docker info --format '{{.DockerRootDir}}')"
[[ -n "$DOCKER_ROOT" && -d "$DOCKER_ROOT" ]] || {
  echo "Unable to determine Docker root directory" >&2
  exit 1
}
free_kib="$(df -Pk "$DOCKER_ROOT" | awk 'NR == 2 { print $4 }')"
[[ "$free_kib" =~ ^[0-9]+$ ]] || {
  echo "Unable to determine free disk space for Docker root $DOCKER_ROOT" >&2
  exit 1
}
min_free_kib="$((BUILD_MIN_FREE_GIB * 1024 * 1024))"
if (( free_kib < min_free_kib )); then
  echo "Docker filesystem is below the ${BUILD_MIN_FREE_GIB} GiB pre-build floor; pruning BuildKit cache only."
  docker builder prune --all --force
  free_kib="$(df -Pk "$DOCKER_ROOT" | awk 'NR == 2 { print $4 }')"
  [[ "$free_kib" =~ ^[0-9]+$ ]] || {
    echo "Unable to determine free disk space after BuildKit cache prune" >&2
    exit 1
  }
fi
if (( free_kib < min_free_kib )); then
  free_gib="$(awk -v kib="$free_kib" 'BEGIN { printf "%.2f", kib / 1024 / 1024 }')"
  echo "Refusing build: Docker filesystem has ${free_gib} GiB free; ${BUILD_MIN_FREE_GIB} GiB required." >&2
  exit 1
fi

mkdir -p data/release-receipts
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
printf '%s
' "pre-upgrade backup must be verified per docs/data-rebuild-operations.md before this command" > "data/release-receipts/$STAMP.pre-upgrade.txt"
ECORIONE_IMAGE_TAG="$TAG" docker compose "${COMPOSE_ARGS[@]}" config >/dev/null
ECORIONE_IMAGE_TAG="$TAG" docker compose "${COMPOSE_ARGS[@]}" up -d --build
# Caddy consumes its policy from a bind-mounted Caddyfile. Compose does not recreate
# an already-running Caddy container when only that file changes, so explicitly
# recreate the edge container to guarantee reviewed routing/auth changes are loaded.
ECORIONE_IMAGE_TAG="$TAG" docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps --force-recreate caddy
printf '%s
' "$TAG" > "data/release-receipts/$STAMP.applied-tag.txt"
echo "Upgrade applied. Run provider canary, /ops smoke, and backup verification before declaring healthy.";
