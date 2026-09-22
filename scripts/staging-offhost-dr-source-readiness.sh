#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--check" || "$#" -ne 1 ]]; then
  echo "Usage: sudo -E bash $0 --check" >&2
  exit 2
fi

[[ "$EUID" -eq 0 ]] || {
  echo "Run as root with sudo -E." >&2
  exit 1
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE_FILE="/var/lib/ecorione-staging/deploy-state.env"
ENV_FILE="${ECORIONE_DEPLOY_ENV:-deploy/staging.env}"
PROJECT="${ECORIONE_COMPOSE_PROJECT:-ecorione-staging}"
OVERLAY="${ECORIONE_COMPOSE_OVERLAY:-deploy/compose.sumopod.yml}"
EDGE_NETWORK="${ECORIONE_EDGE_NETWORK:-inmydraft-demos_web}"
PUBLIC_BASE_URL="${ECORIONE_PUBLIC_BASE_URL:-https://ecorione.inmydraft.com}"
BACKUP_ROOT="${ECORIONE_STAGING_BACKUP_ROOT:-/var/lib/ecorione-staging/backups}"
HELPER_IMAGE="postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

for command_name in docker node git sudo sha256sum tar ssh scp flock df stat; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done
docker compose version >/dev/null 2>&1 || fail "docker compose v2 is required"

for FILE in "$STATE_FILE" "$ENV_FILE" "$OVERLAY"; do
  [[ -f "$FILE" && ! -L "$FILE" ]] || fail "unsafe or missing file: $FILE"
done

[[ "$(stat -c '%U:%G' "$STATE_FILE")" == "root:root" ]] ||   fail "release receipt must be root-owned"
STATE_MODE="$(stat -c '%a' "$STATE_FILE")"
[[ "$STATE_MODE" == "600" || "$STATE_MODE" == "640" || "$STATE_MODE" == "644" ]] ||   fail "release receipt has unsafe mode $STATE_MODE"
[[ "$(stat -c '%a' "$ENV_FILE")" == "600" ]] || fail "deployment env must be mode 600"

CURRENT_SHA="$(sed -n 's/^current_sha=//p' "$STATE_FILE")"
CURRENT_TAG="$(sed -n 's/^current_tag=//p' "$STATE_FILE")"
[[ "$CURRENT_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "invalid current_sha in release receipt"
[[ "$CURRENT_TAG" =~ ^staging-[0-9a-f]{12}$ ]] || fail "invalid current_tag in release receipt"
[[ "$CURRENT_TAG" == "staging-${CURRENT_SHA:0:12}" ]] ||   fail "release receipt tag does not match current_sha"

REPO_OWNER="$(stat -c '%U' "$ROOT")"
git_as_owner() {
  sudo -u "$REPO_OWNER" -H git -C "$ROOT" "$@"
}

HEAD_SHA="$(git_as_owner rev-parse HEAD)"
[[ "$HEAD_SHA" == "$CURRENT_SHA" ]] || fail "Git HEAD does not match release receipt"
[[ -z "$(git_as_owner status --porcelain --untracked-files=no)" ]] ||   fail "tracked staging worktree is dirty"

for SCRIPT in   scripts/staging-offhost-dr-export.sh   scripts/staging-offhost-dr-bundle.mjs   scripts/staging-offhost-dr-transfer.sh   scripts/staging-offhost-dr-fetch.sh   scripts/staging-offhost-dr-verify.mjs   scripts/staging-offhost-dr-replacement-preflight.sh   scripts/staging-offhost-dr-restore.mjs   scripts/staging-offhost-dr-start.sh   scripts/staging-offhost-dr-acceptance.mjs   scripts/staging-offhost-dr-reboot-evidence.mjs   scripts/staging-offhost-dr-canary.mjs   scripts/staging-offhost-dr-canary-inner.mjs; do
  [[ -f "$SCRIPT" && ! -L "$SCRIPT" ]] || fail "missing or unsafe DR tool: $SCRIPT"
done

docker image inspect "$HELPER_IMAGE" >/dev/null ||   fail "pinned helper image is not present locally"
docker network inspect "$EDGE_NETWORK" >/dev/null ||   fail "configured staging edge network is missing"

export ECORIONE_EXPECTED_SHA="$CURRENT_SHA"
export ECORIONE_DEPLOY_ENV="$ENV_FILE"
export ECORIONE_COMPOSE_PROJECT="$PROJECT"
export ECORIONE_COMPOSE_OVERLAY="$OVERLAY"
export ECORIONE_EDGE_NETWORK="$EDGE_NETWORK"
export ECORIONE_PUBLIC_BASE_URL="$PUBLIC_BASE_URL"

node scripts/staging-pcs09-inventory.mjs --strict >/dev/null

COMPOSE_ARGS=(
  compose
  -p "$PROJECT"
  --env-file "$ENV_FILE"
  -f deploy/compose.yml
  -f "$OVERLAY"
)

docker "${COMPOSE_ARGS[@]}" config --quiet
CONFIGURED="$(docker "${COMPOSE_ARGS[@]}" config --services | sort)"
RUNNING="$(docker "${COMPOSE_ARGS[@]}" ps --status running --services | sort)"
[[ "$CONFIGURED" == "$RUNNING" ]] || fail "not all configured staging services are running"

VOLUMES="$(
  docker volume ls     --filter "label=com.docker.compose.project=$PROJECT"     --format '{{.Name}}' | sort
)"
[[ -n "$VOLUMES" ]] || fail "no staging Compose volumes found"

TOTAL_KIB=0
LARGEST_KIB=0
VOLUME_COUNT=0
for VOLUME in $VOLUMES; do
  KIB="$(
    docker run --rm --entrypoint sh       -v "$VOLUME:/source:ro"       "$HELPER_IMAGE"       -lc 'du -sk /source | cut -f1'
  )"
  [[ "$KIB" =~ ^[0-9]+$ ]] || fail "unable to measure volume $VOLUME"
  TOTAL_KIB=$((TOTAL_KIB + KIB))
  (( VOLUME_COUNT += 1 ))
  if (( KIB > LARGEST_KIB )); then
    LARGEST_KIB="$KIB"
  fi
done

DF_PATH="$BACKUP_ROOT"
if [[ ! -e "$DF_PATH" ]]; then
  DF_PATH="$(dirname "$BACKUP_ROOT")"
fi
[[ -d "$DF_PATH" && ! -L "$DF_PATH" ]] || fail "backup root parent is missing or unsafe"

AVAILABLE_KIB="$(df -Pk "$DF_PATH" | awk 'NR==2 {print $4}')"
[[ "$AVAILABLE_KIB" =~ ^[0-9]+$ ]] || fail "unable to measure backup filesystem free space"
REQUIRED_KIB=$((TOTAL_KIB + LARGEST_KIB + 1048576))
(( AVAILABLE_KIB >= REQUIRED_KIB )) || {
  echo "available_kib=$AVAILABLE_KIB required_kib=$REQUIRED_KIB" >&2
  fail "insufficient free disk for fresh cold backup plus isolated verification"
}

AI_CONTAINER="$(docker "${COMPOSE_ARGS[@]}" ps -q ai)"
[[ -n "$AI_CONTAINER" ]] || fail "AI container is missing"
AI_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$AI_CONTAINER")"
[[ "$AI_IMAGE" == "ecorione:$CURRENT_TAG" ]] ||   fail "AI image tag does not match release receipt"

echo "PASS ECORIONE source-host DR readiness"
echo "source_sha=$CURRENT_SHA"
echo "source_tag=$CURRENT_TAG"
echo "compose_project=$PROJECT"
echo "volume_count=$VOLUME_COUNT"
echo "volume_total_kib=$TOTAL_KIB"
echo "backup_required_kib=$REQUIRED_KIB"
echo "target_min_free_kib=$REQUIRED_KIB"
echo "backup_available_kib=$AVAILABLE_KIB"
echo "external_inputs_ready=not_checked"
echo "IMPORTANT: no backup/export/remote transfer was created by this readiness check."
