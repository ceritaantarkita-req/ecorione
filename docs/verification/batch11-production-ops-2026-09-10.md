# Batch 11 — Production Operations & Observability Verification

Date: 2026-09-10  
Status: implementation merged and post-merge verified; closure-doc verification pending

## Implemented baseline

- shared bounded HTTP metrics with process p50/p95 and error counters;
- validated/generated `traceparent` context plus internal HTTP propagation;
- protected `/metrics` and `/v1/ops/observability` for tokenized services;
- Connect model/token/cache/cost/provider canary metrics;
- outbound MCP discovery/tool latency and outcome metrics;
- Hub ECX packet/hydration traffic metrics without savings claims;
- Flow run/node/approval/input counters;
- Ai read-only `/ops` aggregator/dashboard with trace grouping;
- provider quality-floor canary through the normal Connect boundary;
- pinned Docker/Compose + Temporal/PostgreSQL/Caddy recipe;
- owner-scoped persistent volumes and operator-route Basic Auth;
- MCP loopback preserved through `network_mode: service:sync`;
- no Docker socket in the baseline;
- production deployment acceptance added as a permanent CI gate.

## Implementation evidence

- implementation branch: `agent/batch11-production-ops-observability-20260910`;
- implementation PR: #27;
- pre-PR one-shot integration verifier `34447593177`: Typecheck, 7 focused observability/provider-canary tests, and real `docker compose config` production-operations acceptance PASS;
- final exact implementation head: `8056db267dd30203e9208a7ccc3fcfb07390bf2c`;
- exact-head CI `34448405724`: Naming, Format, Lint, Typecheck, full Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, and Production Build PASS;
- exact-head MCP External HTTPS Acceptance `34448405823`: PASS;
- PR #27 merged with expected-head lock as `2e52af3bb8652154bd70846120767b67297bc1fd`;
- `main` confirmed at the expected merge SHA;
- post-merge `main` CI `34448620805`: full green including the permanent Production Operations acceptance gate;
- temporary Batch 11 apply/format helper workflows and finalize script are absent from the implementation tree.

## Evidence policy and limits

CI proves the provider-canary mechanism using a deterministic OpenAI-compatible local stub. CI does **not** contain hosted provider credentials and therefore does not claim real hosted-provider quality or latency. A production operator must run the same canary boundary against the configured real provider before making a provider-quality claim.

Process-local metrics are bounded operational projections and reset on process restart; durable historical time series require an external scraper/metrics backend. ECX packet/hydration counters are traffic evidence only and do **not** establish token, latency, or cost savings.

The Compose recipe is the supported production/self-host baseline, not a substitute for host hardening, secret management, backup replication, firewalling, OS patching, or provider account controls.

## Closure result

Batch 11 implementation satisfies its code/runtime Definition of Done and is eligible for `CLOSED` once this closure-doc branch itself passes exact-head repository CI and the closure merge is followed by green `main` CI.

Next planned batch after closure: **Batch 12 — Final Security / Release Closure**.
