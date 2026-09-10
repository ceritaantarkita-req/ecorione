#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ECORIONE_PRODUCTION_ENV:-deploy/production.env}"

fail() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "[preflight] $*"; }

command -v docker >/dev/null 2>&1 || fail "docker is required"
docker compose version >/dev/null 2>&1 || fail "docker compose v2 is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"

[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE is missing; create it from deploy/production.env.example"
[[ ! -L "$ENV_FILE" ]] || fail "$ENV_FILE must not be a symlink"
if grep -q 'CHANGE_ME' "$ENV_FILE"; then
  fail "placeholder CHANGE_ME remains in $ENV_FILE"
fi

if command -v stat >/dev/null 2>&1; then
  mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
  if [[ -n "$mode" && "$mode" != "600" ]]; then
    fail "$ENV_FILE must be mode 600; current mode is $mode"
  fi
fi

info "validating production Compose"
docker compose --env-file "$ENV_FILE" -f deploy/compose.yml config --quiet

if command -v pnpm >/dev/null 2>&1; then
  info "running repository production-operations acceptance"
  pnpm run acceptance:production-ops
else
  info "pnpm not installed on host; repository acceptance skipped here (CI must already be green)"
fi

available_kb="$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')"
if [[ -n "$available_kb" && "$available_kb" -lt 5242880 ]]; then
  fail "less than 5 GiB free disk space is available on the deployment filesystem"
fi

if command -v ss >/dev/null 2>&1; then
  info "current listeners on application edge ports"
  ss -lnt '( sport = :80 or sport = :443 )' || true
fi

info "PASS: configuration is ready for scripts/self-host-install.sh --apply"
