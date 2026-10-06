#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

docker compose -f deploy/local-temporal.yml up -d --wait --wait-timeout 90

echo "Temporal is ready on loopback port 7233."
echo "Start ECORIONE with: bash .devcontainer/start.sh"
