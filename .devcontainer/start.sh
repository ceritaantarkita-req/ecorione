#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

docker compose -f deploy/local-temporal.yml up -d --wait --wait-timeout 90

exec pnpm dev
