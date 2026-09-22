#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--check" || "$#" -ne 3 ]]; then
  echo "Usage: sudo -E bash $0 --check <metadata.json> <retrieval-receipt.env>" >&2
  exit 2
fi

[[ "$EUID" -eq 0 ]] || {
  echo "Run as root with sudo -E." >&2
  exit 1
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

META="$2"
RETRIEVAL="$3"
DEPLOY_ENV="${ECORIONE_DEPLOY_ENV:-deploy/staging.env}"
RECOVERY_OVERLAY="deploy/compose.dr-recovery.yml"
LOOPBACK_PORT="${ECORIONE_DR_LOOPBACK_PORT:-18080}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

for command_name in docker node git sha256sum ss; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done
docker compose version >/dev/null 2>&1 || fail "docker compose v2 is required"

for FILE in "$META" "$RETRIEVAL" "$DEPLOY_ENV" "$RECOVERY_OVERLAY"; do
  [[ -f "$FILE" && ! -L "$FILE" ]] || fail "unsafe or missing file: $FILE"
done

[[ "$(stat -c '%a' "$META")" == "600" ]] || fail "metadata must be mode 600"
[[ "$(stat -c '%a' "$RETRIEVAL")" == "600" ]] || fail "retrieval receipt must be mode 600"
[[ "$(stat -c '%a' "$DEPLOY_ENV")" == "600" ]] || fail "deployment env must be mode 600"

[[ "$LOOPBACK_PORT" =~ ^[0-9]+$ ]] || fail "ECORIONE_DR_LOOPBACK_PORT must be numeric"
(( LOOPBACK_PORT >= 1024 && LOOPBACK_PORT <= 65535 )) ||   fail "ECORIONE_DR_LOOPBACK_PORT must be between 1024 and 65535"

[[ -z "${ECORIONE_EDGE_NETWORK:-}" ]] ||   fail "replacement-host recovery must not inherit ECORIONE_EDGE_NETWORK from the lost SumoPod edge"
if [[ -n "${ECORIONE_COMPOSE_OVERLAY:-}" && "${ECORIONE_COMPOSE_OVERLAY}" != "$RECOVERY_OVERLAY" ]]; then
  fail "replacement-host preflight allows only $RECOVERY_OVERLAY"
fi

read_meta() {
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const value = m[process.argv[2]];
    if (typeof value === "string") process.stdout.write(value);
  ' "$META" "$1"
}

SOURCE_SHA="$(read_meta sourceSha)"
SOURCE_TAG="$(read_meta sourceTag)"
PROJECT="$(read_meta composeProject)"
BUNDLE_FILENAME="$(read_meta bundleFilename)"

[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "invalid sourceSha in DR metadata"
[[ "$SOURCE_TAG" =~ ^staging-[0-9a-f]{12}$ ]] || fail "invalid sourceTag in DR metadata"
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail "invalid composeProject in DR metadata"
[[ "$BUNDLE_FILENAME" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.ecdr$ ]] ||   fail "invalid bundleFilename in DR metadata"

read_receipt() {
  sed -n "s/^$1=//p" "$RETRIEVAL" | tail -n 1
}

[[ "$(read_receipt schema_version)" == "1" ]] || fail "unsupported retrieval receipt schema"
[[ "$(read_receipt failure_domain_ack)" == "1" ]] || fail "retrieval receipt lacks failure-domain acknowledgement"
[[ "$(read_receipt retrieval_verified)" == "1" ]] || fail "retrieval receipt is not verified"
[[ "$(read_receipt bundle_filename)" == "$BUNDLE_FILENAME" ]] ||   fail "retrieval receipt bundle does not match DR metadata"
[[ "$(read_receipt metadata_filename)" == "$(basename "$META")" ]] ||   fail "retrieval receipt metadata filename mismatch"

EXPECTED_META_SHA="$(read_receipt metadata_sha256)"
[[ "$EXPECTED_META_SHA" =~ ^[0-9a-f]{64}$ ]] || fail "invalid metadata hash in retrieval receipt"
ACTUAL_META_SHA="$(sha256sum "$META" | cut -d' ' -f1)"
[[ "$ACTUAL_META_SHA" == "$EXPECTED_META_SHA" ]] || fail "retrieved metadata checksum mismatch"

[[ "$(git rev-parse HEAD)" == "$SOURCE_SHA" ]] ||   fail "replacement-host Git HEAD does not match recovered source SHA"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] ||   fail "replacement-host tracked worktree is dirty"

EXISTING_CONTAINERS="$(
  docker ps -a     --filter "label=com.docker.compose.project=$PROJECT"     --format '{{.ID}}'
)"
[[ -z "$EXISTING_CONTAINERS" ]] ||   fail "replacement host is not clean: Compose project containers already exist"

EXISTING_VOLUMES="$(
  docker volume ls     --filter "label=com.docker.compose.project=$PROJECT"     --format '{{.Name}}'
)"
[[ -z "$EXISTING_VOLUMES" ]] ||   fail "replacement host is not clean: Compose project volumes already exist"

if ss -H -ltn | awk '{print $4}' | grep -Eq ":${LOOPBACK_PORT}$"; then
  fail "loopback recovery port $LOOPBACK_PORT is already in use"
fi

export ECORIONE_COMPOSE_PROJECT="$PROJECT"
export ECORIONE_COMPOSE_OVERLAY="$RECOVERY_OVERLAY"
export ECORIONE_DR_LOOPBACK_PORT="$LOOPBACK_PORT"
unset ECORIONE_EDGE_NETWORK

bash scripts/production-preflight.sh

CONFIG="$(
  docker compose     -p "$PROJECT"     --env-file "$DEPLOY_ENV"     -f deploy/compose.yml     -f "$RECOVERY_OVERLAY"     config
)"

grep -Fq "127.0.0.1:${LOOPBACK_PORT}" <<<"$CONFIG" ||   fail "recovery Compose config does not publish Caddy on the expected loopback port"
if grep -Eq 'published:[[:space:]]*"?80"?$|published:[[:space:]]*"?443"?$' <<<"$CONFIG"; then
  fail "recovery Compose config unexpectedly publishes public 80/443"
fi
if grep -Fq "inmydraft-demos_web" <<<"$CONFIG"; then
  fail "recovery Compose config unexpectedly depends on the historical SumoPod edge network"
fi

echo "PASS ECORIONE clean replacement-host preflight"
echo "source_sha=$SOURCE_SHA"
echo "source_tag=$SOURCE_TAG"
echo "compose_project=$PROJECT"
echo "recovery_overlay=$RECOVERY_OVERLAY"
echo "loopback_base=http://127.0.0.1:$LOOPBACK_PORT"
echo "IMPORTANT: this proves a clean standalone recovery boundary only; no volumes or application containers were created."
