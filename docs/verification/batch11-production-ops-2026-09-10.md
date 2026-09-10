# Batch 11 — Production Operations & Observability Verification

Date: 2026-09-10  
Status: implementation candidate; exact-head and merge closure evidence pending

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
- production deployment acceptance added to CI.

## Evidence policy

CI proves the canary mechanism using a deterministic OpenAI-compatible local stub. It does not contain hosted provider credentials and therefore does not claim real hosted-provider quality or latency. Process metrics are operational projections; durable time series require an external scraper. ECX counters are traffic evidence only and do not establish cost/token savings.

Final exact-head CI/MCP acceptance, implementation merge, post-merge main CI, closure PR, and final post-closure main evidence are recorded only after those events occur.
