#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--apply" || "$#" -ne 2 ]]; then
  echo "Usage: sudo -E bash $0 --apply <restore-receipt.json>" >&2
  exit 2
fi

[[ "$EUID" -eq 0 ]] || {
  echo "Run as root with sudo -E." >&2
  exit 1
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RESTORE_RECEIPT="$2"
DEPLOY_ENV="${ECORIONE_DEPLOY_ENV:-deploy/staging.env}"
OVERLAY="${ECORIONE_COMPOSE_OVERLAY:-}"
EDGE_NETWORK="${ECORIONE_EDGE_NETWORK:-}"
STANDALONE_RECOVERY="${ECORIONE_DR_STANDALONE_RECOVERY:-0}"

[[ -f "$RESTORE_RECEIPT" && ! -L "$RESTORE_RECEIPT" ]] || {
  echo "Restore receipt must be a regular non-symlink file." >&2
  exit 1
}
[[ "$(stat -c '%a' "$RESTORE_RECEIPT")" == "600" ]] || {
  echo "Restore receipt must be mode 600." >&2
  exit 1
}
[[ -f "$DEPLOY_ENV" && ! -L "$DEPLOY_ENV" ]] || {
  echo "Deployment env must be a regular non-symlink file." >&2
  exit 1
}
[[ "$(stat -c '%a' "$DEPLOY_ENV")" == "600" ]] || {
  echo "Deployment env must be mode 600." >&2
  exit 1
}
if [[ -n "$OVERLAY" ]]; then
  [[ -f "$OVERLAY" && ! -L "$OVERLAY" ]] || {
    echo "Compose overlay must be a regular non-symlink file." >&2
    exit 1
  }
fi
if [[ "$STANDALONE_RECOVERY" == "1" ]]; then
  [[ "$OVERLAY" == "deploy/compose.dr-recovery.yml" ]] || {
    echo "Standalone DR startup requires deploy/compose.dr-recovery.yml." >&2
    exit 1
  }
  [[ -z "$EDGE_NETWORK" ]] || {
    echo "Standalone DR startup must not use ECORIONE_EDGE_NETWORK." >&2
    exit 1
  }
fi

read_json() {
  node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const path = process.argv[2].split(".");
    let value = data;
    for (const key of path) value = value?.[key];
    if (typeof value === "boolean") process.stdout.write(value ? "true" : "false");
    else if (value !== undefined && value !== null) process.stdout.write(String(value));
  ' "$RESTORE_RECEIPT" "$1"
}

SOURCE_SHA="$(read_json sourceSha)"
SOURCE_TAG="$(read_json sourceTag)"
PROJECT="$(read_json composeProject)"
RETRIEVED="$(read_json retrievedFromIndependentTarget)"

[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Invalid source SHA in restore receipt." >&2
  exit 1
}
[[ "$SOURCE_TAG" =~ ^staging-[0-9a-f]{12}$ ]] || {
  echo "Invalid source tag in restore receipt." >&2
  exit 1
}
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || {
  echo "Invalid Compose project in restore receipt." >&2
  exit 1
}
[[ "$RETRIEVED" == "true" ]] || {
  echo "Restore receipt does not prove independent off-host retrieval." >&2
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$SOURCE_SHA" ]] || {
  echo "Git HEAD does not match recovered source SHA." >&2
  exit 1
}
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || {
  echo "Tracked recovery checkout is dirty." >&2
  exit 1
}

EXISTING_CONTAINERS="$(
  docker ps -a     --filter "label=com.docker.compose.project=$PROJECT"     --format '{{.ID}}'
)"
[[ -z "$EXISTING_CONTAINERS" ]] || {
  echo "Refusing recovered startup: Compose project containers already exist." >&2
  exit 1
}

mapfile -t RESTORED_VOLUMES < <(
  node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    for (const item of data.restoredVolumes || []) {
      if (item && typeof item.name === "string") console.log(item.name);
    }
  ' "$RESTORE_RECEIPT"
)
[[ "${#RESTORED_VOLUMES[@]}" -gt 0 ]] || {
  echo "Restore receipt has no restored volumes." >&2
  exit 1
}
for VOLUME in "${RESTORED_VOLUMES[@]}"; do
  docker volume inspect "$VOLUME" >/dev/null || {
    echo "Missing restored volume: $VOLUME" >&2
    exit 1
  }
done

if [[ -n "$EDGE_NETWORK" ]]; then
  docker network inspect "$EDGE_NETWORK" >/dev/null
fi

COMPOSE_ARGS=(-p "$PROJECT" --env-file "$DEPLOY_ENV" -f deploy/compose.yml)
if [[ -n "$OVERLAY" ]]; then
  COMPOSE_ARGS+=(-f "$OVERLAY")
fi

export ECORIONE_IMAGE_TAG="$SOURCE_TAG"
if [[ -n "$EDGE_NETWORK" ]]; then
  export ECORIONE_EDGE_NETWORK="$EDGE_NETWORK"
fi

docker compose "${COMPOSE_ARGS[@]}" config --quiet

STARTED=0
cleanup() {
  if [[ "$STARTED" -eq 1 ]]; then
    echo "Recovered startup failed; removing only attempted project containers/network while preserving restored volumes..." >&2
    docker compose "${COMPOSE_ARGS[@]}" down >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Every ECORIONE owner service in deploy/compose.yml shares the same exact
# application image/tag. Build that image once, then start the topology without
# asking Compose to build each service concurrently. This avoids an OpenSSH-like
# recovery-host class of tooling drift where Compose falls back from Bake/buildx
# and races multiple exporters against the same image tag.
docker compose "${COMPOSE_ARGS[@]}" build ai
docker image inspect "ecorione:${SOURCE_TAG}" >/dev/null

docker compose "${COMPOSE_ARGS[@]}" up -d --no-build
STARTED=1

CONFIGURED="$(docker compose "${COMPOSE_ARGS[@]}" config --services | sort)"
for ATTEMPT in $(seq 1 60); do
  RUNNING="$(docker compose "${COMPOSE_ARGS[@]}" ps --status running --services | sort)"
  if [[ "$RUNNING" == "$CONFIGURED" ]]; then
    STARTED=0
    trap - EXIT
    echo "PASS ECORIONE recovered application topology started"
    echo "source_sha=$SOURCE_SHA"
    echo "source_tag=$SOURCE_TAG"
    echo "compose_project=$PROJECT"
    echo "service_count=$(printf '%s\n' "$RUNNING" | sed '/^$/d' | wc -l)"
    echo "NEXT: run staging-offhost-dr-acceptance.mjs with this restore receipt."
    exit 0
  fi
  sleep 3
done

echo "Recovered application services did not all become running." >&2
exit 1
