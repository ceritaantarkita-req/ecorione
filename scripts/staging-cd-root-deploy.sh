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

# A previous build can exhaust the Docker filesystem before Git can even fetch or
# detach to the next reviewed SHA. Reclaim only reproducible BuildKit cache at the
# start of the governed deploy when free space is below the same floor used by
# self-host-upgrade. Tagged rollback images, containers, networks, and volumes are
# intentionally left untouched.
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
  echo "Docker filesystem is below the ${BUILD_MIN_FREE_GIB} GiB deploy floor; pruning BuildKit cache only."
  docker builder prune --all --force
  free_kib="$(df -Pk "$DOCKER_ROOT" | awk 'NR == 2 { print $4 }')"
  [[ "$free_kib" =~ ^[0-9]+$ ]] || {
    echo "Unable to determine free disk space after BuildKit cache prune" >&2
    exit 1
  }
fi
if (( free_kib < min_free_kib )); then
  free_gib="$(awk -v kib="$free_kib" 'BEGIN { printf "%.2f", kib / 1024 / 1024 }')"
  echo "Refusing deploy: Docker filesystem has ${free_gib} GiB free; ${BUILD_MIN_FREE_GIB} GiB required." >&2
  exit 1
fi

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

wait_for_public_boundary() {
  local attempt home_code ops_code

  for attempt in $(seq 1 60); do
    home_code="$(
      curl -sS -o /dev/null -w '%{http_code}' \
        "$ECORIONE_STAGING_PUBLIC_BASE_URL/" || true
    )"
    ops_code="$(
      curl -sS -o /dev/null -w '%{http_code}' \
        "$ECORIONE_STAGING_PUBLIC_BASE_URL/ops" || true
    )"

    # Readiness accepts both the legacy public home (2xx/3xx) and the
    # private-by-default home (401). The revision-specific smoke test below
    # enforces the intended policy; this loop only waits for the edge to settle.
    if [[ ( "$home_code" =~ ^[23][0-9]{2}$ || "$home_code" == "401" ) && "$ops_code" == "401" ]]; then
      echo "Public boundary ready on attempt $attempt: home=$home_code ops=$ops_code"
      return 0
    fi

    echo "Waiting for public boundary attempt $attempt/60: home=$home_code ops=$ops_code"
    sleep 3
  done

  echo "Timed out waiting for public boundary readiness" >&2
  return 1
}

basic_public_check() {
  wait_for_public_boundary
}

wait_for_ops_health() {
  local image_tag="$1"
  local ops_user="$2"
  local ops_pass="$3"
  local attempt

  for attempt in $(seq 1 20); do
    if owner_run_with_tag "$image_tag" env \
      ECORIONE_PUBLIC_BASE_URL="$ECORIONE_STAGING_PUBLIC_BASE_URL" \
      ECORIONE_OPS_USER="$ops_user" \
      ECORIONE_OPS_PASSWORD="$ops_pass" \
      node scripts/production-ops-snapshot.mjs; then
      echo "Operations healthy on attempt $attempt/20"
      return 0
    fi

    echo "Waiting for Operations health attempt $attempt/20"
    sleep 3
  done

  echo "Timed out waiting for authenticated Operations health" >&2
  return 1
}

validate_deployed_revision() {
  local image_tag="$1"
  local expected_sha="$2"
  local ops_user ops_pass

  wait_for_services "$image_tag" || return 1
  wait_for_public_boundary || return 1

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

  if ! wait_for_ops_health "$image_tag" "$ops_user" "$ops_pass"; then
    unset ops_user ops_pass
    return 1
  fi
  unset ops_user ops_pass

  owner_run_with_tag "$image_tag" env \
    ECORIONE_EXPECTED_SHA="$expected_sha" \
    node scripts/staging-host-evidence.mjs
}

prune_stale_staging_images() {
  local current_tag previous_tag image

  [[ -f "$STATE_FILE" && ! -L "$STATE_FILE" ]] || {
    echo "Skipping staging-image retention: release state is unavailable or unsafe"
    return 0
  }
  [[ "$(stat -c '%U' "$STATE_FILE")" == "root" ]] || {
    echo "Skipping staging-image retention: release state is not root-owned"
    return 0
  }

  current_tag="$(sed -n 's/^current_tag=//p' "$STATE_FILE")"
  previous_tag="$(sed -n 's/^previous_tag=//p' "$STATE_FILE")"
  [[ "$current_tag" =~ ^staging-[A-Za-z0-9._-]+$ ]] || {
    echo "Skipping staging-image retention: current_tag is invalid"
    return 0
  }
  [[ "$previous_tag" =~ ^staging-[A-Za-z0-9._-]+$ ]] || {
    echo "Skipping staging-image retention: previous_tag is invalid"
    return 0
  }

  while IFS= read -r image; do
    [[ "$image" == ecorione:staging-* ]] || continue
    if [[ "$image" == "ecorione:$current_tag" || "$image" == "ecorione:$previous_tag" ]]; then
      echo "Keeping rollback-set image $image"
    elif docker ps -a --format '{{.Image}}' | grep -Fxq "$image"; then
      echo "Keeping container-referenced image $image"
    else
      echo "Removing stale staging image $image"
      docker image rm "$image"
    fi
  done < <(docker image ls ecorione --format '{{.Repository}}:{{.Tag}}')
}

stabilize_post_deploy_capacity() {
  local target_gib target_kib free_kib free_gib

  prune_stale_staging_images

  target_gib="${ECORIONE_DOCKER_POST_DEPLOY_TARGET_GIB:-25}"
  [[ "$target_gib" =~ ^[0-9]+$ && "$target_gib" -ge "$BUILD_MIN_FREE_GIB" ]] || {
    echo "ECORIONE_DOCKER_POST_DEPLOY_TARGET_GIB must be an integer >= $BUILD_MIN_FREE_GIB" >&2
    return 1
  }
  target_kib="$((target_gib * 1024 * 1024))"
  free_kib="$(df -Pk "$DOCKER_ROOT" | awk 'NR == 2 { print $4 }')"
  [[ "$free_kib" =~ ^[0-9]+$ ]] || {
    echo "Unable to determine post-deploy Docker free space" >&2
    return 1
  }

  if (( free_kib < target_kib )); then
    echo "Post-deploy Docker free space is below ${target_gib} GiB target; pruning BuildKit cache only."
    docker builder prune --all --force
    free_kib="$(df -Pk "$DOCKER_ROOT" | awk 'NR == 2 { print $4 }')"
    [[ "$free_kib" =~ ^[0-9]+$ ]] || {
      echo "Unable to determine post-cleanup Docker free space" >&2
      return 1
    }
  fi

  if (( free_kib < min_free_kib )); then
    free_gib="$(awk -v kib="$free_kib" 'BEGIN { printf "%.2f", kib / 1024 / 1024 }')"
    echo "Healthy release recorded, but Docker filesystem has only ${free_gib} GiB free; ${BUILD_MIN_FREE_GIB} GiB minimum required for the next governed deploy." >&2
    return 1
  fi

  free_gib="$(awk -v kib="$free_kib" 'BEGIN { printf "%.2f", kib / 1024 / 1024 }')"
  echo "PASS staging capacity stabilized: ${free_gib} GiB free"
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
  RECORDED_PREVIOUS_SHA="$(sed -n 's/^previous_sha=//p' "$STATE_FILE")"
  RECORDED_PREVIOUS_TAG="$(sed -n 's/^previous_tag=//p' "$STATE_FILE")"
  [[ "$RECORDED_SHA" =~ ^[0-9a-f]{40}$ ]] || {
    echo "Refusing deploy: staging release state has invalid current_sha" >&2
    exit 1
  }
  [[ "$RECORDED_TAG" =~ ^[A-Za-z0-9._-]+$ ]] || {
    echo "Refusing deploy: staging release state has invalid current_tag" >&2
    exit 1
  }
  [[ "$RECORDED_PREVIOUS_SHA" =~ ^[0-9a-f]{40}$ ]] || {
    echo "Refusing deploy: staging release state has invalid previous_sha" >&2
    exit 1
  }
  [[ "$RECORDED_PREVIOUS_TAG" =~ ^[A-Za-z0-9._-]+$ ]] || {
    echo "Refusing deploy: staging release state has invalid previous_tag" >&2
    exit 1
  }

  CURRENT_HEAD="$(owner_git rev-parse HEAD)"
  ACTIVE_IMAGE="$(
    docker ps \
      --filter label=com.docker.compose.project=ecorione-staging \
      --filter label=com.docker.compose.service=ai \
      --format '{{.Image}}' | head -n 1
  )"
  ACTIVE_TAG="${ACTIVE_IMAGE#ecorione:}"
  [[ "$ACTIVE_IMAGE" == "ecorione:$ACTIVE_TAG" && "$ACTIVE_TAG" =~ ^[A-Za-z0-9._-]+$ ]] || {
    echo "Refusing deploy: unable to determine active ECORIONE staging image" >&2
    exit 1
  }
  [[ "$RECORDED_SHA" == "$CURRENT_HEAD" && "$RECORDED_TAG" == "$ACTIVE_TAG" ]] || {
    echo "Refusing deploy: release receipt, Git HEAD, and active image are inconsistent" >&2
    echo "receipt_sha=$RECORDED_SHA head_sha=$CURRENT_HEAD receipt_tag=$RECORDED_TAG active_tag=$ACTIVE_TAG" >&2
    exit 1
  }

  if [[ "$RECORDED_SHA" == "$TARGET_SHA" ]]; then
    echo "Revalidating already-recorded staging deployment sha=$TARGET_SHA tag=$RECORDED_TAG"
    validate_deployed_revision "$RECORDED_TAG" "$TARGET_SHA" || {
      echo "Recorded staging deployment failed health/evidence revalidation" >&2
      exit 1
    }
    stabilize_post_deploy_capacity || exit 1
    echo "PASS PCS-08 staging deploy already recorded and revalidated sha=$TARGET_SHA"
    exit 0
  fi
fi

PREVIOUS_SHA="$(owner_git rev-parse HEAD)"
if [[ -z "${ACTIVE_TAG:-}" ]]; then
  ACTIVE_IMAGE="$(
    docker ps \
      --filter label=com.docker.compose.project=ecorione-staging \
      --filter label=com.docker.compose.service=ai \
      --format '{{.Image}}' | head -n 1
  )"
  ACTIVE_TAG="${ACTIVE_IMAGE#ecorione:}"
fi
PREVIOUS_TAG="$ACTIVE_TAG"
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
  validate_deployed_revision "$PREVIOUS_TAG" "$PREVIOUS_SHA" || rollback_status=1
  set_env_image_tag "$PREVIOUS_TAG" || rollback_status=1
  stabilize_post_deploy_capacity || rollback_status=1
  set -e

  if [[ "$rollback_status" -ne 0 ]]; then
    echo "ROLLBACK FAILED; operator intervention required" >&2
  else
    echo "Rollback fully revalidated at public, Operations, exact-host, and capacity boundaries" >&2
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

stabilize_post_deploy_capacity || exit 1

echo "PASS PCS-08 staging deploy sha=$TARGET_SHA tag=$TARGET_TAG"
