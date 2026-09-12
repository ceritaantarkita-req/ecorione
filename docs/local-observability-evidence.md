# Local Observability Baseline Evidence

Status: **CLOSED / PASS — real-laptop baseline measured on 2026-09-12**

This protocol establishes a bounded local observability baseline for ECORIONE. It is intentionally a laptop-scale evidence checkpoint, not a production SLA or universal performance claim.

Canonical closure note:

- `docs/verification/local-observability-closure-2026-09-12.md`

## Goal

Measure representative local work through existing owner boundaries while keeping the evidence attributable to the exact repository revision, local runtime/model identity, cache state, sample counts, and process-lifetime telemetry.

The checkpoint should answer four narrow questions:

1. can owner-service latency and HTTP errors be measured consistently through the existing observability contract;
2. can ECX planning/hydration be measured while preserving distributed trace continuity into Artifact;
3. can local-model latency be separated into provider-reported latency and client/orchestration overhead without enabling hosted spend;
4. can bounded ECORIONE Node-process resource snapshots be attached to the same run.

## Existing architecture reused

No new observability database or cross-owner telemetry store is introduced.

The harness reuses:

- `GET /v1/ops/observability` for structured process-lifetime counters, histograms, recent request spans, and process resource snapshots;
- `GET /metrics` for Prometheus-compatible projection;
- W3C-compatible trace propagation already implemented by `@ecorione/shared-server`;
- Hub ECX domain metrics;
- Connect model/token/cost/cache/provider-canary metrics;
- Flow and owner HTTP metrics;
- the closed persistence evidence identities as stable read-only semantic probes.

Long-term telemetry retention remains an external-scraper responsibility per ADR-32.

## Commands

Inventory only:

```bash
pnpm evidence:observability:inventory
```

Strict measured run:

```bash
pnpm evidence:observability
```

Optional bounded sample overrides:

```bash
ECORIONE_OBS_OWNER_READ_SAMPLES=8
ECORIONE_OBS_ECX_SAMPLES=5
ECORIONE_OBS_MODEL_SAMPLES=5
ECORIONE_OBS_MODEL_MAX_LATENCY_MS=60000
```

Accepted ranges are intentionally small:

- owner reads: 3–40;
- ECX: 3–20;
- local model: 3–12;
- model maximum latency: 1–120 seconds.

## Preconditions

The strict inventory fails closed unless all of these are true:

- local `HEAD` exactly matches `origin/main`;
- tracked working tree is clean;
- `ECORIONE_INTERNAL_TOKEN` is available;
- `ECORIONE_COST_KILL_SWITCH=1`;
- RnD, Context, Connect, Hub, Artifact, Sandbox, Space, and Flow are healthy;
- every internal-token owner exposes `/v1/ops/observability` with a valid process resource snapshot;
- Connect exposes the configured local runtime and model identity;
- the previously closed persistence evidence state is still available for read-only probe identities.

The Phase 4 runtime must therefore be restarted on the merged observability revision before the real measurement. An older process group cannot satisfy the new process-resource snapshot contract even if its health endpoints are green.

## Representative workloads

### 1. Owner read lane

Repeated read-only requests use identities from the closed persistence checkpoint:

- Hub — Historical Ledger session read;
- Context — episode read;
- Artifact — content read plus exact SHA-256 validation;
- Flow — workflow status read.

The harness records client-observed latency and the matching owner request span. It does not mutate the Ledger, Context, Artifact, or Flow state.

### 2. ECX lane

Each sample:

1. plans one pointer-first ECX packet in Hub using one known Historical Ledger reference and one known Artifact reference;
2. deliberately omits `historySessionId`, so the measurement does not append a handoff event to the Historical Ledger;
3. hydrates both references through Hub;
4. verifies the hydrated Artifact bytes against the known SHA-256;
5. requires the hydrate request ID to appear in both Hub and Artifact spans.

This measures local transport/orchestration behavior. ECX byte counters remain traffic facts, not a token- or dollar-savings claim.

### 3. Local-model lane

The harness runs one warm-up call, then a bounded set of unique local provider-canary prompts through Connect.

Each measured prompt is unique so the run requires `cacheHit=false`. The result retains:

- local target;
- provider identity;
- configured/returned model identity;
- pricing model identity;
- provider-canary latency;
- end-to-end client latency;
- client-minus-provider latency as a bounded transport/orchestration residual;
- token usage;
- actual cost reported by the normal Connect boundary;
- cache hit/miss state.

Hosted calls are not enabled or measured by this checkpoint.

## Resource evidence

`@ecorione/shared-server` exposes a process resource snapshot with:

- PID;
- process uptime;
- RSS;
- V8 heap used/total;
- external and ArrayBuffer bytes;
- cumulative process user/system CPU microseconds.

The strict run stores before/after values and deltas for the eight Phase 4 owner services.

These values are **endpoint-time snapshots and cumulative deltas**, not sampled peaks. They cover the ECORIONE Node owner processes only. They do **not** measure total laptop CPU/RAM, Docker/Temporal/PostgreSQL resource use, GPU/VRAM, or the separate local model server process.

## Raw evidence

The full run state is written mode `0600` under:

```text
.ecorione/evidence/local-observability-state.json
```

`.ecorione/` is gitignored. Raw process snapshots, recent spans, and run-level measurements remain local evidence and must not be committed wholesale.

A closure PR may contain only a sanitized summary after a strict real-laptop PASS.

## Strict gates

A measured run passes only when:

- the four owner-read lanes contain exactly the configured sample count and every semantic probe passes;
- ECX contains exactly the configured sample count and every plan/hydrate probe passes;
- every measured model sample is local, quality-PASS, and an explicit cache miss;
- provider and model identity are present;
- workload error count is zero;
- every measured ECX hydration has both Hub and Artifact request spans under the same propagated request ID;
- process resource snapshots are finite for every required service;
- Connect model-call cache-miss counters increase by at least the measured model sample count;
- Hub ECX plan/hydration counters increase by at least the measured ECX sample count.

No threshold gate is imposed on p50/p95 latency or memory growth in this first baseline. The purpose is to establish measured facts before deciding whether a future regression threshold is justified.

## Measured closure result

Strict inventory and strict measurement both passed on:

```text
revision: bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6
runId: obs-20260912020700-00fbd7e5
owner reads: 8 per lane
ECX samples: 5
local model samples: 5
workload errors: 0
ECX hydrate trace coverage: 5/5
local model cache hits: 0
local model cache misses: 5
```

Measured local runtime/model identity was `openai-compatible` / `gemma4:latest`, with hosted calls disabled. The mutable `:latest` alias is retained as a limitation rather than upgraded into an immutable production identity claim.

See `docs/verification/local-observability-closure-2026-09-12.md` for the sanitized latency/resource tables and exact claim boundary.

## Claim boundary

A successful run proves only a bounded local baseline on the exact tested laptop/revision/runtime configuration.

It does **not** prove:

- production SLA/SLO compliance;
- universal p50/p95 latency;
- peak CPU or peak memory consumption;
- whole-host resource utilization;
- local model server or GPU utilization;
- concurrency/load capacity;
- long-duration stability or leak freedom;
- behavior after process restart unless separately tested;
- hosted-provider latency, quality, price, or reliability;
- autonomous ECX reference selection;
- universal token/cost savings;
- VPS/Cloudflare behavior.

## Closure procedure

The closure procedure was completed in this order:

1. implementation CI passed and the observability harness was merged;
2. local `main` synchronized to the exact merge SHA;
3. Phase 4 restarted on the merged observability revision;
4. `pnpm evidence:observability:inventory` passed;
5. `pnpm evidence:observability` passed without interruption;
6. raw evidence remained gitignored;
7. a sanitized closure note was prepared with exact revision, run ID, sample counts, model/cache identity, latency summaries, trace coverage, process resource deltas, and limitations;
8. closure documentation is subject to exact-head CI, merge, then post-merge CI before the canonical tracker is considered fully synchronized.
