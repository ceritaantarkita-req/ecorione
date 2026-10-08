#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Reuse the canonical local engine so Codespaces gets the same local-only
# secret bootstrap, full Phase 4 service set, Temporal readiness, and
# startup health gates as operator-controlled local development.
exec env \
  ECORIONE_TEMPORAL_USE_DOCKER=1 \
  ECORIONE_ENGINE_NO_OPEN=1 \
  ECORIONE_AI_PORT=3000 \
  pnpm engine:start
