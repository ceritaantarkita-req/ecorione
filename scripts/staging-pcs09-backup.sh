#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--apply" ]]; then
  echo "Usage: sudo -E bash $0 --apply" >&2
  echo "Creates a verified same-host cold backup of ECORIONE staging volumes." >&2
  exit 2
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root with sudo -E." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPO_OWNER="$(stat -c '%U' "$ROOT")"

git_as_owner() {
  sudo -u "$REPO_OWNER" git -C "$ROOT" "$@"
}

ENV_FILE="${ECORIONE_DEPLOY_ENV:-deploy/staging.env}"
PROJECT="${ECORIONE_COMPOSE_PROJECT:-ecorione-staging}"
OVERLAY="${ECORIONE_COMPOSE_OVERLAY:-deploy/compose.sumopod.yml}"
EDGE_NETWORK="${ECORIONE_EDGE_NETWORK:-inmydraft-demos_web}"
CERT_RESOLVER="${ECORIONE_TRAEFIK_CERTRESOLVER:-letsencrypt}"
PUBLIC_BASE_URL="${ECORIONE_PUBLIC_BASE_URL:-https://ecorione.inmydraft.com}"
BACKUP_ROOT="${ECORIONE_STAGING_BACKUP_ROOT:-/var/lib/ecorione-staging/backups}"
STATE_FILE="/var/lib/ecorione-staging/deploy-state.env"
HELPER_IMAGE="postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94"

if [[ ! -f "$ENV_FILE" || -L "$ENV_FILE" ]]; then
  echo "Unsafe or missing deployment env." >&2
  exit 1
fi
if [[ "$(stat -c '%a' "$ENV_FILE")" != "600" ]]; then
  echo "Deployment env must be mode 600." >&2
  exit 1
fi
if [[ ! -f "$OVERLAY" || -L "$OVERLAY" ]]; then
  echo "Unsafe or missing compose overlay." >&2
  exit 1
fi
if [[ ! -f "$STATE_FILE" || -L "$STATE_FILE" ]]; then
  echo "Unsafe or missing release receipt." >&2
  exit 1
fi
if [[ "$(stat -c '%U:%G' "$STATE_FILE")" != "root:root" ]]; then
  echo "Release receipt must be root-owned." >&2
  exit 1
fi

CURRENT_SHA="$(sed -n 's/^current_sha=//p' "$STATE_FILE")"
CURRENT_TAG="$(sed -n 's/^current_tag=//p' "$STATE_FILE")"

if [[ ! "$CURRENT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid current_sha in release receipt." >&2
  exit 1
fi
if [[ ! "$CURRENT_TAG" =~ ^staging-[0-9a-f]{12}$ ]]; then
  echo "Invalid current_tag in release receipt." >&2
  exit 1
fi
if [[ "$(git_as_owner rev-parse HEAD)" != "$CURRENT_SHA" ]]; then
  echo "HEAD does not match release receipt." >&2
  exit 1
fi
if [[ -n "$(git_as_owner status --porcelain --untracked-files=no)" ]]; then
  echo "Tracked worktree is dirty." >&2
  exit 1
fi

docker image inspect "$HELPER_IMAGE" >/dev/null
docker network inspect "$EDGE_NETWORK" >/dev/null

export ECORIONE_IMAGE_TAG="$CURRENT_TAG"
export ECORIONE_EDGE_NETWORK="$EDGE_NETWORK"
export ECORIONE_TRAEFIK_CERTRESOLVER="$CERT_RESOLVER"

compose() {
  docker compose     -p "$PROJECT"     --env-file "$ENV_FILE"     -f deploy/compose.yml     -f "$OVERLAY"     "$@"
}

compose config --quiet
CONFIGURED="$(compose config --services | sort)"
RUNNING="$(compose ps --status running --services | sort)"
if [[ "$CONFIGURED" != "$RUNNING" ]]; then
  echo "Not all ECORIONE staging services are running." >&2
  exit 1
fi

VOLUMES="$(docker volume ls   --filter "label=com.docker.compose.project=$PROJECT"   --format '{{.Name}}' | sort)"

if [[ -z "$VOLUMES" ]]; then
  echo "No staging Compose volumes found." >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

TOTAL_KIB=0
LARGEST_KIB=0
for VOLUME in $VOLUMES; do
  KIB="$(docker run --rm --entrypoint sh -v "$VOLUME:/source:ro" "$HELPER_IMAGE" -lc 'du -sk /source | cut -f1')"
  if [[ ! "$KIB" =~ ^[0-9]+$ ]]; then
    echo "Unable to measure volume $VOLUME." >&2
    exit 1
  fi
  TOTAL_KIB=$((TOTAL_KIB + KIB))
  if (( KIB > LARGEST_KIB )); then
    LARGEST_KIB="$KIB"
  fi
done

AVAILABLE_KIB="$(df -Pk "$BACKUP_ROOT" | awk 'NR==2 {print $4}')"
REQUIRED_KIB=$((TOTAL_KIB + LARGEST_KIB + 1048576))
if (( AVAILABLE_KIB < REQUIRED_KIB )); then
  echo "Insufficient free disk for backup plus isolated restore verification." >&2
  echo "available_kib=$AVAILABLE_KIB required_kib=$REQUIRED_KIB" >&2
  exit 1
fi

RUN_ID="backup-$(date -u +%Y%m%dT%H%M%SZ)-$(printf '%s' "$CURRENT_SHA" | cut -c1-12)"
BACKUP_DIR="$BACKUP_ROOT/$RUN_ID"
mkdir -m 700 "$BACKUP_DIR"
MANIFEST="$BACKUP_DIR/manifest.tsv"
META="$BACKUP_DIR/manifest.meta"
: >"$MANIFEST"
chmod 600 "$MANIFEST"

cat >"$META" <<EOF
schema_version=1
created_at=$(date -u +%FT%TZ)
source_sha=$CURRENT_SHA
source_tag=$CURRENT_TAG
compose_project=$PROJECT
claim_boundary=same-host cold volume backup with isolated content verification; not off-host disaster recovery
EOF
chmod 600 "$META"

fingerprint_volume() {
  docker run --rm     --entrypoint sh     -v "$1:/source:ro"     "$HELPER_IMAGE"     -lc 'cd /source && find . -type f -exec sha256sum {} \; | LC_ALL=C sort | sha256sum | cut -d" " -f1'
}

file_count_volume() {
  docker run --rm     --entrypoint sh     -v "$1:/source:ro"     "$HELPER_IMAGE"     -lc 'cd /source && find . -type f | wc -l'
}

STOPPED=0
VERIFY_VOLUME=""

cleanup() {
  if [[ -n "$VERIFY_VOLUME" ]]; then
    docker volume rm -f "$VERIFY_VOLUME" >/dev/null 2>&1 || true
    VERIFY_VOLUME=""
  fi
  if [[ "$STOPPED" -eq 1 ]]; then
    echo "Restarting ECORIONE staging after backup operation..."
    compose up -d || true
    STOPPED=0
  fi
}
trap cleanup EXIT

echo "Stopping only the ECORIONE staging Compose project for a coordinated cold snapshot..."
compose stop
STOPPED=1

for VOLUME in $VOLUMES; do
  SAFE_NAME="$(printf '%s' "$VOLUME" | tr -c 'A-Za-z0-9_.-' '_')"
  ARCHIVE="$SAFE_NAME.tar.gz"
  SOURCE_TREE="$(fingerprint_volume "$VOLUME")"
  SOURCE_FILES="$(file_count_volume "$VOLUME")"

  docker run --rm     --entrypoint sh     -v "$VOLUME:/source:ro"     -v "$BACKUP_DIR:/backup"     "$HELPER_IMAGE"     -lc "cd /source && tar -czf /backup/$ARCHIVE ."

  ARCHIVE_SHA="$(sha256sum "$BACKUP_DIR/$ARCHIVE" | cut -d' ' -f1)"
  ARCHIVE_BYTES="$(stat -c '%s' "$BACKUP_DIR/$ARCHIVE")"

  VERIFY_VOLUME="$PROJECT-pcs09-verify-$SAFE_NAME-$$"
  docker volume create "$VERIFY_VOLUME" >/dev/null

  docker run --rm     --entrypoint sh     -v "$VERIFY_VOLUME:/restore"     -v "$BACKUP_DIR:/backup:ro"     "$HELPER_IMAGE"     -lc "cd /restore && tar -xzf /backup/$ARCHIVE"

  RESTORED_TREE="$(fingerprint_volume "$VERIFY_VOLUME")"
  RESTORED_FILES="$(file_count_volume "$VERIFY_VOLUME")"

  if [[ "$SOURCE_TREE" != "$RESTORED_TREE" || "$SOURCE_FILES" != "$RESTORED_FILES" ]]; then
    echo "Isolated restore verification failed for $VOLUME." >&2
    exit 1
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\n'     "$VOLUME" "$ARCHIVE" "$ARCHIVE_BYTES" "$ARCHIVE_SHA" "$SOURCE_TREE" "$SOURCE_FILES"     >>"$MANIFEST"

  docker volume rm -f "$VERIFY_VOLUME" >/dev/null
  VERIFY_VOLUME=""
  echo "PASS backup + isolated content verification: $VOLUME"
done

compose up -d
STOPPED=0

for ATTEMPT in $(seq 1 60); do
  RUNNING="$(compose ps --status running --services | sort)"
  HOME_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$PUBLIC_BASE_URL/" || true)"
  OPS_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$PUBLIC_BASE_URL/ops" || true)"
  if [[ "$RUNNING" == "$CONFIGURED" && "$HOME_CODE" =~ ^[23][0-9]{2}$ && "$OPS_CODE" == "401" ]]; then
    echo "Public boundary ready after backup on attempt $ATTEMPT: home=$HOME_CODE ops=$OPS_CODE"
    break
  fi
  if [[ "$ATTEMPT" -eq 60 ]]; then
    echo "Staging did not recover after backup window." >&2
    exit 1
  fi
  sleep 3
done

sha256sum "$MANIFEST" "$META" >"$BACKUP_DIR/SHA256SUMS"
chmod 600 "$BACKUP_DIR/SHA256SUMS"

trap - EXIT
echo "PASS PCS-09 same-host cold backup + isolated content verification"
echo "backup_dir=$BACKUP_DIR"
echo "source_sha=$CURRENT_SHA"
echo "source_tag=$CURRENT_TAG"
echo "IMPORTANT: this remains the same VPS failure domain and is NOT off-host disaster recovery."
echo "Deployment env, operator credentials, SSH private keys, and the Connect Vault master key are intentionally excluded."
