#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

printf 'ECORIONE Codespaces bootstrap\n'
printf 'Node: %s\n' "$(node --version)"
printf 'pnpm: %s\n' "$(pnpm --version)"

if [[ "$(node --version)" != "v22.20.0" ]]; then
  echo "Expected Node v22.20.0 from .node-version." >&2
  exit 1
fi

if [[ "$(pnpm --version)" != "10.28.0" ]]; then
  echo "Expected pnpm 10.28.0 from packageManager." >&2
  exit 1
fi

pnpm install --frozen-lockfile

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "Created local .env from .env.example. Secrets remain unset."
else
  echo "Existing local .env preserved."
fi

mkdir -p data

echo "Bootstrap complete. Codespaces keeps forwarded ports private by default."
echo "Run: bash .devcontainer/start.sh"
