# Production / Self-host Operations

Batch 11 menyediakan baseline operasional yang dapat diuji. Ini bukan klaim bahwa satu Compose file menggantikan host hardening, secret manager, monitoring retention, OAuth provider, atau incident process.

## Deployment

1. Salin `deploy/production.env.example` menjadi `deploy/production.env` dan ganti seluruh `CHANGE_ME`. File target sudah ter-cover pola `.env.*` di `.gitignore` dan tidak boleh di-commit.
2. Generate internal token, Sync owner token, Connect Vault master key, dan Caddy password hash di luar repo. Provider hosted credential dimasukkan ke Connect Vault, bukan Compose/env plaintext.
3. Isi OAuth issuer/resource/JWKS/origin untuk MCP.
4. Jalankan `docker compose --env-file deploy/production.env -f deploy/compose.yml config --quiet`, lalu `docker compose --env-file deploy/production.env -f deploy/compose.yml up -d --build`.
5. Hanya Caddy mempublish 80/443. Service internal berada di Docker network; MCP HTTP tetap `127.0.0.1:17010` dalam network namespace Sync.

Image infrastructure dipin eksplisit: Temporal `1.31.2`, PostgreSQL `17.6-alpine`, Caddy `2.11.4-alpine`, Node build image `22.20.0-bookworm-slim`. Jangan ganti menjadi `latest`; upgrade dilakukan sebagai perubahan tervalidasi.

### Persistent owners

Volume terpisah: RnD, Context, Connect, Hub, Artifact, Sandbox, Space, Flow, Sync, Temporal DB, dan Caddy state. Backup/restore tetap memakai owner-service DR contract Batch 8; volume bukan alasan untuk melakukan cross-service DB read.

### Sandbox

Compose sengaja tidak mount `/var/run/docker.sock`. Tier 0/Tier 1.5 dapat berjalan di service Sandbox. Tier 2 Docker memerlukan sandbox host/daemon terpisah sesuai ADR-10; jangan memperlemah isolation dengan host Docker socket.

## Metrics and traces

Internal-token services expose:

- `GET /metrics` — Prometheus-compatible counters plus bounded percentile summary lines;
- `GET /v1/ops/observability` — structured process-lifetime counters/histograms/recent request spans;
- `GET /healthz` — existing compatibility health endpoint.

HTTP instrumentation records route template, method, status class, duration, request ID, trace ID, and span ID. It never records request/response body, prompt, Authorization, provider key, or user memory content. Label/value lengths and series count are bounded.

`httpJson` propagates the current trace with a child span ID. Direct ECX Artifact hydration and Sync→MCP forwarding also propagate trace headers. Ai `/api/ops` reads owner snapshots server-side and groups recent spans by trace ID. `/ops` renders fleet health, p50/p95, error count, cost/tokens/cache-related counters, MCP, Flow, ECX, and recent distributed traces.

Process metrics reset on restart. Use an external scraper if durable time-series retention is required. Do not copy those metrics back into owner databases.

## Provider canary

Run:

```bash
ECORIONE_CANARY_TARGET=local pnpm run canary:provider
ECORIONE_CANARY_TARGET=hosted pnpm run canary:provider
```

Optional floors: `ECORIONE_CANARY_EXPECT`, `ECORIONE_CANARY_PROMPT`, `ECORIONE_CANARY_MIN_OUTPUT_CHARS`, `ECORIONE_CANARY_MAX_LATENCY_MS`. A canary calls `POST /v1/ops/provider-canary`, which uses the same Connect completion/vault/spend/cost path. CI tests the contract with a deterministic local HTTP provider only. Hosted quality/latency must be measured by the operator with real credentials; no production quality claim is inferred from CI.

## ECX telemetry boundary

ECX exposes packet/candidate/packet-byte and hydration item/byte counters. These answer “how much traffic was exchanged,” not “how many tokens/dollars were saved.” A savings claim remains prohibited until real comparative production telemetry exists.

## Acceptance

`pnpm run acceptance:production-ops` fails unless Compose parses, only Caddy publishes ports, infrastructure images are pinned, owner volumes exist, MCP remains loopback through Sync namespace sharing, Caddy protects operator routes, and no Docker socket is mounted. This gate runs in regular CI.
