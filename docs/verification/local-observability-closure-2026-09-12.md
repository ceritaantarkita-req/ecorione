# Local Observability Baseline Closure — 2026-09-12

Status: **CLOSED / PASS — bounded local laptop baseline**

This note closes the local observability baseline checkpoint on the exact merged implementation revision below. It records a sanitized summary only; raw spans and process snapshots remain gitignored local evidence.

## Exact tested revision

```text
bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6
```

The strict inventory reported local `HEAD == origin/main`, a clean tracked tree, `ECORIONE_COST_KILL_SWITCH=1`, all eight Phase 4 owner health endpoints healthy, owner `/v1/ops/observability` available, and the closed persistence probe identities available.

Measured run:

```text
runId: obs-20260912020700-00fbd7e5
phase: measured
owner read samples: 8 per lane
ECX samples: 5
local model samples: 5
model max latency gate: 60000 ms
```

Runtime identity during the measurement:

```text
runtime: openai-compatible
model: gemma4:latest
hosted calls: disabled
```

`gemma4:latest` is the runtime identity that was actually measured. It is a mutable alias and therefore is **not** an immutable production model-identity claim.

## Strict result

The run ended with:

```text
PASS strict local observability: representative owner reads, ECX hydration, uncached local-model latency, trace propagation and process resource deltas were measured
```

Workload errors: `0`.

## Owner read baseline

Each owner lane used 8 read-only samples against identities from the already-closed persistence checkpoint.

| Owner | Client p50 ms | Client p95 ms | Server p50 ms | Server p95 ms |
|---|---:|---:|---:|---:|
| Hub Historical Ledger read | 5.981 | 26.439 | 1.725 | 20.558 |
| Context episode read | 4.436 | 17.534 | 1.054 | 12.208 |
| Artifact content read | 12.150 | 62.738 | 7.901 | 57.852 |
| Flow status read | 11.997 | 142.314 | 8.519 | 138.085 |

These are small-sample local observations, not SLA/SLO thresholds.

## ECX baseline

Five pointer-first plan/hydrate samples were measured without appending Historical Ledger handoff events.

| ECX stage | Client p50 ms | Client p95 ms | Server p50 ms | Server p95 ms |
|---|---:|---:|---:|---:|
| Plan | 5.349 | 14.645 | 1.434 | 11.541 |
| Hydrate | 18.623 | 57.065 | 14.252 | 53.418 |

Artifact child-span server latency during hydrate:

```text
p50: 5.870 ms
p95: 8.159 ms
```

Distributed trace coverage passed exactly:

```text
ECX hydrations with Artifact span: 5
expected: 5
```

Hub metric deltas also matched the workload:

```text
ECX plans:      +5
ECX hydrations: +5
```

## Local model baseline

Five unique measured prompts were sent through the normal Connect provider-canary boundary after warm-up.

All five measured calls were local cache misses:

```text
provider: local
configured model: gemma4:latest
response model: gemma4:latest
pricing model: local/provider-token-zero
cache hits: 0
cache misses: 5
input tokens: 350
output tokens: 129
actual cost USD: 0
```

Latency summary:

| Signal | p50 ms | p95 ms |
|---|---:|---:|
| Client end-to-end | 1145.401 | 9109.495 |
| Provider-reported | 1138.240 | 9104.578 |
| Client minus provider | 6.711 | 7.161 |
| Connect server | 1140.789 | 9105.635 |

The large gap between median and maximum/p95 in this five-sample run is retained as measured evidence; no regression threshold is invented from it.

Connect metric deltas matched the intended cache state:

```text
local cache misses: +5
local cache hits:    +0
```

`actual cost USD: 0` is only a fact about this local route. It is not hosted-provider billed-cost evidence.

## Process resource deltas

The harness captured before/after endpoint-time Node-process snapshots for all eight Phase 4 owner services.

| Owner | RSS delta bytes | Heap-used delta bytes |
|---|---:|---:|
| Artifact | +6,316,032 | +3,094,888 |
| Connect | -348,160 | +862,496 |
| Context | +2,228,224 | +627,024 |
| Flow | +3,145,728 | +1,870,248 |
| Hub | +6,291,456 | +3,012,016 |
| RnD | 0 | +91,992 |
| Sandbox | 0 | +87,096 |
| Space | +131,072 | +98,216 |

These are bounded before/after snapshots and cumulative CPU deltas from the Node owner processes. They are **not** sampled peaks and do not establish leak freedom.

## What this checkpoint proves

On revision `bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6`, on the tested local laptop runtime, ECORIONE can:

- expose a consistent observability contract from all eight Phase 4 owner services;
- measure representative read-only owner latency with matching server request spans;
- measure ECX planning/hydration and preserve Hub → Artifact trace continuity;
- separate local model provider latency from the small measured client/provider residual;
- keep local model identity and cache state attached to the run;
- observe workload metric deltas that match the configured sample counts;
- attach bounded Node-process resource before/after deltas;
- complete the defined strict workload with zero workload errors and hosted calls disabled.

## Claim boundary / limitations

This closure does **not** prove:

- a production SLA or SLO;
- universal p50/p95 latency;
- peak CPU, peak RSS, peak heap, GPU or VRAM usage;
- total laptop or model-server resource use;
- concurrency/load capacity;
- long-duration stability or memory-leak freedom;
- immutable local model identity (`gemma4:latest` remains mutable);
- hosted-provider latency, quality, reliability or billed cost;
- autonomous ECX reference selection;
- universal token/cost savings;
- VPS/Cloudflare behavior.

Raw evidence remains local at:

```text
.ecorione/evidence/local-observability-state.json
```

## Closure verdict

**LOCAL OBSERVABILITY BASELINE: CLOSED / PASS — bounded local baseline with explicit small-sample and mutable-model-identity limitations.**

The next operator-approved checkpoint is **UX/product validation**. Immutable local model identity hardening remains ordered after that checkpoint unless the operator changes the sequence.
