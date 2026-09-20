#!/usr/bin/env bash
set -Eeuo pipefail

[[ "$#" -eq 1 ]] || {
  echo "Usage: $0 <40-character-main-sha>" >&2
  exit 2
}
TARGET_SHA="$1"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Usage: $0 <40-character-main-sha>" >&2
  exit 2
}

CONFIG=/etc/ecorione-staging-cd.conf
[[ -f "$CONFIG" && ! -L "$CONFIG" ]] || {
  echo "Missing or unsafe $CONFIG" >&2
  exit 1
}
[[ "$(stat -c '%U' "$CONFIG")" == "root" ]] || {
  echo "$CONFIG must be root-owned" >&2
  exit 1
}
# shellcheck disable=SC1090
source "$CONFIG"

: "${ECORIONE_STAGING_REPO:?missing ECORIONE_STAGING_REPO}"
: "${ECORIONE_STAGING_REPO_OWNER:?missing ECORIONE_STAGING_REPO_OWNER}"
: "${ECORIONE_STAGING_PUBLIC_BASE_URL:?missing ECORIONE_STAGING_PUBLIC_BASE_URL}"
: "${ECORIONE_STAGING_OPS_CREDENTIALS:?missing ECORIONE_STAGING_OPS_CREDENTIALS}"
: "${ECORIONE_STAGING_EDGE_NETWORK:?missing ECORIONE_STAGING_EDGE_NETWORK}"
: "${ECORIONE_STAGING_CERTRESOLVER:?missing ECORIONE_STAGING_CERTRESOLVER}"

REPO="$ECORIONE_STAGING_REPO"
OWNER="$ECORIONE_STAGING_REPO_OWNER"
OPS_FILE="$ECORIONE_STAGING_OPS_CREDENTIALS"
STATE_DIR=/var/lib/ecorione-staging
STATE_FILE="$STATE_DIR/deploy-state.env"
LOCK_FILE=/run/lock/ecorione-staging-deploy.lock

command -v flock >/dev/null 2>&1 || { echo "flock is required" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
command -v sudo >/dev/null 2>&1 || { echo "sudo is required" >&2; exit 1; }
[[ -d "$REPO/.git" ]] || { echo "Missing Git repository $REPO" >&2; exit 1; }
[[ -f "$OPS_FILE" && ! -L "$OPS_FILE" ]] || {
  echo "Missing or unsafe operator credential file" >&2
  exit 1
}
[[ "$(stat -c '%a' "$OPS_FILE")" == "600" ]] || {
  echo "Operator credential file must be mode 600" >&2
  exit 1
}

install -d -o root -g root -m 0755 "$STATE_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "Another ECORIONE staging deployment is already running" >&2
  exit 1
}

owner_git() {
  sudo -u "$OWNER" -H git -C "$REPO" "$@"
}

owner_run_with_tag() {
  local image_tag="$1"
  shift
  sudo -u "$OWNER" -H env \
    ECORIONE_DEPLOY_ENV=deploy/staging.env \
    ECORIONE_COMPOSE_PROJECT=ecorione-staging \
    ECORIONE_COMPOSE_OVERLAY=deploy/compose.sumopod.yml \
    ECORIONE_EDGE_NETWORK="$ECORIONE_STAGING_EDGE_NETWORK" \
    ECORIONE_TRAEFIK_CERTRESOLVER="$ECORIONE_STAGING_CERTRESOLVER" \
    ECORIONE_IMAGE_TAG="$image_tag" \
    bash -c 'cd "$1"; shift; exec "$@"' _ "$REPO" "$@"
}

set_env_image_tag() {
  local image_tag="$1"
  sudo -u "$OWNER" -H python3 - "$REPO/deploy/staging.env" "$image_tag" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
tag = sys.argv[2]
lines = path.read_text().splitlines()
found = False
out = []
for line in lines:
    if line.startswith("ECORIONE_IMAGE_TAG="):
        out.append(f"ECORIONE_IMAGE_TAG={tag}")
        found = True
    else:
        out.append(line)
if not found:
    out.insert(0, f"ECORIONE_IMAGE_TAG={tag}")
path.write_text("\n".join(out) + "\n")
PY
  chmod 0600 "$REPO/deploy/staging.env"
}

wait_for_services() {
  local image_tag="$1"
  local expected running

  expected="$(
    owner_run_with_tag "$image_tag" docker compose \
      -p ecorione-staging \
      --env-file deploy/staging.env \
      -f deploy/compose.yml \
      -f deploy/compose.sumopod.yml \
      config --services | sort
  )"

  for _ in $(seq 1 60); do
    running="$(
      owner_run_with_tag "$image_tag" docker compose \
        -p ecorione-staging \
        --env-file deploy/staging.env \
        -f deploy/compose.yml \
        -f deploy/compose.sumopod.yml \
        ps --status running --services | sort
    )"
    if [[ "$running" == "$expected" ]]; then
      return 0
    fi
    sleep 3
  done

  echo "Timed out waiting for every configured staging service to be running" >&2
  return 1
}

basic_public_check() {
  local code
  code="$(
    curl -fsS -o /dev/null -w '%{http_code}' \
      "$ECORIONE_STAGING_PUBLIC_BASE_URL/" || true
  )"
  [[ "$code" =~ ^[23][0-9]{2}$ ]] || {
    echo "Rollback home check failed: HTTP $code" >&2
    return 1
  }

  code="$(
    curl -sS -o /dev/null -w '%{http_code}' \
      "$ECORIONE_STAGING_PUBLIC_BASE_URL/ops" || true
  )"
  [[ "$code" == "401" ]] || {
    echo "Rollback /ops protection check failed: HTTP $code" >&2
    return 1
  }
}

validate_deployed_revision() {
  local image_tag="$1"
  local expected_sha="$2"
  local ops_user ops_pass

  wait_for_services "$image_tag" || return 1

  owner_run_with_tag "$image_tag" env \
    ECORIONE_PUBLIC_BASE_URL="$ECORIONE_STAGING_PUBLIC_BASE_URL" \
    node scripts/production-public-smoke.mjs || return 1

  ops_user="$(sed -n 's/^username=//p' "$OPS_FILE")"
  ops_pass="$(sed -n 's/^password=//p' "$OPS_FILE")"
  if [[ -z "$ops_user" || -z "$ops_pass" ]]; then
    unset ops_user ops_pass
    echo "Operator credential file is malformed" >&2
    return 1
  fi

  if ! owner_run_with_tag "$image_tag" env \
    ECORIONE_PUBLIC_BASE_URL="$ECORIONE_STAGING_PUBLIC_BASE_URL" \
    ECORIONE_OPS_USER="$ops_user" \
    ECORIONE_OPS_PASSWORD="$ops_pass" \
    node scripts/production-ops-snapshot.mjs; then
    unset ops_user ops_pass
    return 1
  fi
  unset ops_user ops_pass

  owner_run_with_tag "$image_tag" env \
    ECORIONE_EXPECTED_SHA="$expected_sha" \
    node scripts/staging-host-evidence.mjs
}

tracked_status="$(owner_git status --porcelain --untracked-files=no)"
[[ -z "$tracked_status" ]] || {
  echo "Refusing deploy: tracked staging checkout is dirty" >&2
  printf '%s\n' "$tracked_status" >&2
  exit 1
}

owner_git fetch origin main --prune
REMOTE_MAIN="$(owner_git rev-parse refs/remotes/origin/main)"
[[ "$TARGET_SHA" == "$REMOTE_MAIN" ]] || {
  echo "Refusing stale/unreviewed deploy: requested=$TARGET_SHA origin/main=$REMOTE_MAIN" >&2
  exit 1
}

if [[ -e "$STATE_FILE" ]]; then
  [[ -f "$STATE_FILE" && ! -L "$STATE_FILE" ]] || {
    echo "Refusing deploy: unsafe staging release state file" >&2
    exit 1
  }
  [[ "$(stat -c '%U' "$STATE_FILE")" == "root" ]] || {
    echo "Refusing deploy: staging release state must be root-owned" >&2
    exit 1
  }
  STATE_MODE="$(stat -c '%a' "$STATE_FILE")"
  [[ "$STATE_MODE" == "600" || "$STATE_MODE" == "640" || "$STATE_MODE" == "644" ]] || {
    echo "Refusing deploy: staging release state has unsafe mode $STATE_MODE" >&2
    exit 1
  }

  RECORDED_SHA="$(sed -n 's/^current_sha=//p' "$STATE_FILE")"
  RECORDED_TAG="$(sed -n 's/^current_tag=//p' "$STATE_FILE")"
  [[ "$RECORDED_SHA" =~ ^[0-9a-f]{40}$ ]] || {
    echo "Refusing deploy: staging release state has invalid current_sha" >&2
    exit 1
  }
  [[ "$RECORDED_TAG" =~ ^[A-Za-z0-9._-]+$ ]] || {
    echo "Refusing deploy: staging release state has invalid current_tag" >&2
    exit 1
  }

  CURRENT_HEAD="$(owner_git rev-parse HEAD)"
  if [[ "$RECORDED_SHA" == "$TARGET_SHA" && "$CURRENT_HEAD" == "$TARGET_SHA" ]]; then
    echo "Revalidating already-recorded staging deployment sha=$TARGET_SHA tag=$RECORDED_TAG"
    validate_deployed_revision "$RECORDED_TAG" "$TARGET_SHA" || {
      echo "Recorded staging deployment failed health/evidence revalidation" >&2
      exit 1
    }
    echo "PASS PCS-08 staging deploy already recorded and revalidated sha=$TARGET_SHA"
    exit 0
  fi
fi

PREVIOUS_SHA="$(owner_git rev-parse HEAD)"
PREVIOUS_IMAGE="$(
  docker ps \
    --filter label=com.docker.compose.project=ecorione-staging \
    --filter label=com.docker.compose.service=ai \
    --format '{{.Image}}' | head -n 1
)"
PREVIOUS_TAG="${PREVIOUS_IMAGE#ecorione:}"
[[ "$PREVIOUS_TAG" =~ ^[A-Za-z0-9._-]+$ ]] || {
  echo "Unable to determine previous known-good ECORIONE image tag" >&2
  exit 1
}

TARGET_TAG="staging-${TARGET_SHA:0:12}"
echo "PCS-08 deploy target=$TARGET_SHA tag=$TARGET_TAG previous=$PREVIOUS_SHA previous_tag=$PREVIOUS_TAG"

rollback() {
  local reason="$1"
  local rollback_status=0

  echo "Deployment failed: $reason" >&2
  echo "Attempting runtime rollback to $PREVIOUS_SHA ($PREVIOUS_TAG)" >&2

  set +e
  owner_git checkout --detach "$PREVIOUS_SHA" || rollback_status=1
  owner_run_with_tag "$PREVIOUS_TAG" \
    bash scripts/self-host-rollback.sh --apply "$PREVIOUS_TAG" || rollback_status=1
  wait_for_services "$PREVIOUS_TAG" || rollback_status=1
  basic_public_check || rollback_status=1
  set_env_image_tag "$PREVIOUS_TAG" || rollback_status=1
  set -e

  if [[ "$rollback_status" -ne 0 ]]; then
    echo "ROLLBACK FAILED; operator intervention required" >&2
  else
    echo "Rollback verified at basic public boundary" >&2
  fi
  return 1
}

owner_git checkout --detach "$TARGET_SHA"

if ! owner_run_with_tag "$TARGET_TAG" bash scripts/production-preflight.sh; then
  rollback "preflight failed"
  exit 1
fi

if ! owner_run_with_tag "$TARGET_TAG" \
  bash scripts/self-host-upgrade.sh --apply "$TARGET_TAG"; then
  rollback "compose upgrade/build failed"
  exit 1
fi

if ! validate_deployed_revision "$TARGET_TAG" "$TARGET_SHA"; then
  rollback "post-deploy health/evidence validation failed"
  exit 1
fi

set_env_image_tag "$TARGET_TAG"

TMP_STATE="$(mktemp "$STATE_DIR/.deploy-state.XXXXXX")"
{
  printf 'current_sha=%s\n' "$TARGET_SHA"
  printf 'current_tag=%s\n' "$TARGET_TAG"
  printf 'previous_sha=%s\n' "$PREVIOUS_SHA"
  printf 'previous_tag=%s\n' "$PREVIOUS_TAG"
  printf 'deployed_at=%s\n' "$(date -u +%FT%TZ)"
} > "$TMP_STATE"
chmod 0644 "$TMP_STATE"
mv "$TMP_STATE" "$STATE_FILE"

echo "PASS PCS-08 staging deploy sha=$TARGET_SHA tag=$TARGET_TAG"
