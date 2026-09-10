# Production / Self-host Operations

Last updated: **2026-09-10**

Status: **production/self-host baseline READY; real environment validation remains operator work**

Batch 11 delivered the production operations baseline and Batch 12 closed the planned release/security roadmap. This document describes the current self-host operating model. It is not a claim that repository code replaces host hardening, secret management discipline, durable external monitoring, off-host backup policy, OAuth infrastructure, or incident response.

Current handoff: `docs/current-state-and-next-steps.md`.

## Current verified baseline

- planned platform/production Batch 1–12: **CLOSED**;
- implementation PR #29 merge: `ad67b68290a41e69e18dfa49caefed0090bd9635`;
- closure PR #30 merge: `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`;
- final post-closure main CI `34490006960`: PASS;
- production/self-host label: **READY within documented boundary**.

## Deployment

1. Copy `deploy/production.env.example` to `deploy/production.env` and replace every `CHANGE_ME` value. The target is gitignored and must never be committed.
2. Generate the internal token, Sync owner token, Connect Vault master key, Temporal/Postgres password, MCP handle key, and Caddy operator password hash outside Git.
3. Put hosted provider credentials into the Connect Vault; do not use Compose/env plaintext as the production provider-secret store.
4. Configure the real MCP OAuth issuer/resource/JWKS/allowed origins consistently with the public deployment.
5. Validate Compose before mutation:

```bash
docker compose --env-file deploy/production.env -f deploy/compose.yml config --quiet
```

6. Start the stack:

```bash
docker compose --env-file deploy/production.env -f deploy/compose.yml up -d --build
```

7. Check service state:

```bash
docker compose --env-file deploy/production.env -f deploy/compose.yml ps
```

The repository Compose baseline publishes only Caddy on host 80/443. Internal services stay on the Docker network. MCP HTTP remains loopback-only inside the Sync network namespace; public reachability must stay in front of Sync/Caddy rather than exposing Connect directly.

Infrastructure images are pinned explicitly. Do not replace pins with `latest`; upgrades must be reviewed and verified as release changes.

## Persistent owners

Persistent data remains owner-scoped across RnD, Context, Connect, Hub, Artifact, Sandbox, Space, Flow, Sync, Temporal DB, and Caddy state.

Backup/restore must use the owner-service DR contract. A volume mount is not permission to read another service's database directly.

Historical Ledger and Context L0 ground truth must not be convenience-rewritten during migrations/restores.

## Sandbox

The Compose baseline deliberately does not mount `/var/run/docker.sock` into the application stack.

Tier 0/Tier 1.5 run inside the Sandbox service boundary. Any Docker execution tier requiring a daemon must preserve the separate sandbox-host design from the Sandbox ADR/acceptance; do not weaken isolation by mounting the production host Docker socket into the application service.

## Public edge — recommended Cloudflare Free path

The recommended next real deployment is:

```text
Internet
  -> Cloudflare Free DNS/TLS edge
  -> Cloudflare Tunnel
  -> cloudflared on the VPS
  -> Caddy
  -> Ai / Sync-MCP
  -> internal services
```

Cloudflare is **edge/tunnel only**. ECORIONE compute, Temporal, owner databases, Vault, Artifact storage, and Sandbox stay on the VPS/self-host origin.

The rollout should be staged:

1. deploy and verify the existing Caddy baseline;
2. connect the domain to Cloudflare;
3. create a named tunnel;
4. point a published application route to the verified local Caddy HTTPS origin;
5. validate the public app/MCP path;
6. only then close direct inbound web ports if the operator wants Tunnel-only origin access.

Do not point Cloudflare directly at internal ECORIONE service ports. Do not place a browser-only Cloudflare Access login in front of MCP/OAuth endpoints unless the client flow was intentionally designed for it.

Full procedure and rollback: `docs/cloudflare-free-deployment.md`.

## Metrics and traces

Internal-token services expose:

- `GET /metrics` — Prometheus-compatible counters plus bounded percentile summaries;
- `GET /v1/ops/observability` — structured process-lifetime counters/histograms/recent request spans;
- `GET /healthz` — service health endpoint.

HTTP instrumentation records route template, method, status class, duration, request ID, trace ID, and span ID. It must not record request/response bodies, prompts, Authorization headers, provider keys, or user-memory content.

`httpJson` propagates trace context. ECX Artifact hydration and Sync->MCP forwarding also carry trace headers. Ai `/api/ops` reads owner snapshots server-side and `/ops` presents fleet health, latency percentiles, errors, provider/cost/cache indicators, MCP, Flow, ECX, and recent trace groups.

**Process metrics reset on restart.** Durable production history requires an external scraper/time-series store. Do not create cross-service metrics tables inside owner databases merely to retain telemetry.

## Provider canary

Run through the normal Connect boundary:

```bash
ECORIONE_CANARY_TARGET=local pnpm run canary:provider
ECORIONE_CANARY_TARGET=hosted pnpm run canary:provider
```

Optional controls include expected text, prompt, minimum output length, and maximum latency environment values already supported by the canary.

A hosted canary uses the same provider/Vault/spend/cost path as production calls. CI proves the mechanism with deterministic local-compatible infrastructure; **it does not prove real hosted-provider quality or latency**.

Next production scope should record real:

- provider/model identity;
- latency;
- success/error rate;
- output quality/eval score;
- token usage;
- billed/estimated cost;
- canary timestamp and deployment version.

## ECX telemetry boundary

ECX packet/candidate/packet-byte and hydration item/byte counters describe traffic. They do not prove token or dollar savings by themselves.

A production savings claim requires a real comparative baseline and cost/token evidence. Do not convert lower packet bytes directly into a money-saved claim.

## Backup/restore operations

Before any risky upgrade or migration:

1. create owner-scoped backups according to the DR docs;
2. verify backup manifests/digests;
3. keep an off-host copy if the environment matters;
4. document the image/config version associated with the backup;
5. know whether restore requires the owner service to be offline;
6. do not restore all data merely because an edge/network component failed.

DNS/Tunnel incidents should normally be rolled back at the edge, not by restoring databases.

## Security operations outside repo CI

Repository closure does not perform these automatically:

- OS/kernel/security package updates;
- SSH key/policy hardening;
- firewall rules;
- Cloudflare account MFA/access review;
- provider-account/API-key review;
- off-host backup retention;
- external monitoring/alerting;
- incident response and credential rotation after compromise.

These are the first operational hardening tasks after real deployment.

## Acceptance

`pnpm run acceptance:production-ops` remains a permanent CI gate. It verifies the repository's production topology and invariants, including Compose parsing, pinned infrastructure, owner volumes, Caddy-only public ports, MCP loopback design, operator-route protection, and absence of Docker socket exposure.

For a **real** environment, repository CI must be supplemented with external checks:

- public HTTPS availability;
- protected operator routes;
- MCP protected-resource/auth flows;
- real provider canary when intentionally enabled;
- persistence across restart;
- backup integrity;
- restore drill;
- Cloudflare Tunnel health when using the recommended free edge.

## Next operations order

1. VPS production deployment;
2. Cloudflare Free edge/Tunnel cutover;
3. real provider canaries;
4. durable external telemetry retention;
5. host/account hardening;
6. off-host backup + restore drill;
7. product usage observation;
8. new engineering scope only from collected evidence.
