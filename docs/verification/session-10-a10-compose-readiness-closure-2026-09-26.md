# Session 10 — A-10 Compose readiness / health closure

Date: **2026-09-26**

Status: **SAFE / RESUMABLE — A-10 CLOSED / PASS**

Exact implementation main and proven staging runtime:

```text
710127d66218e4d2e8ed23ddbc485b80b8769f6b
```

There is no unmerged A-10 implementation work at this checkpoint.

## 1. Scope closed

A-10 addressed the 2026-09-24 audit finding that ordinary Compose startup had a weaker readiness contract than ECORIONE's later acceptance tooling.

The bounded closure rule was:

- use existing owner-service health semantics rather than inventing a new readiness service;
- add explicit Compose healthchecks where a canonical HTTP health boundary already exists;
- use Temporal's own cluster-health command for Temporal readiness;
- make only required startup dependencies wait for `service_healthy`;
- keep `flow-worker` a process/worker service rather than introducing a second HTTP health owner;
- preserve service ownership, runtime routes, persistence, scheduling, authorization, and data boundaries;
- do not open A-11, DR-2, native Google Drive, production cutover, hosted-provider spend, a graph database, a new scheduler, a new memory store, or cross-service database access.

## 2. Implementation

PR **#350 — `ops: strengthen Compose readiness contracts`**

Final reviewed head:

```text
5fcdf0e4d2ce0a52e5e0197e71ee942a4f5842ba
```

Squash merge / implementation main:

```text
710127d66218e4d2e8ed23ddbc485b80b8769f6b
```

The implementation adds:

- shared HTTP healthcheck timing defaults in production and desktop Compose;
- explicit `/healthz` probes for RnD, Context, Connect, Hub, Artifact, Sandbox, Space, Flow, Sync, and MCP in production Compose;
- matching owner healthchecks for the desktop application fleet;
- a shallow internal Ai `GET /api/healthz` endpoint and Compose probe;
- Temporal readiness using `TEMPORAL_ADDRESS=temporal:7233 temporal operator cluster health | grep -q SERVING`;
- `condition: service_healthy` only on dependency edges whose consumer startup actually requires the dependency to be ready;
- deterministic source-contract coverage in `test/a10-compose-readiness-source-contract.test.ts`.

No new canonical owner or persistence layer was introduced.

## 3. Dependency/readiness shape

The resulting startup shape remains acyclic.

Representative production ordering is:

```text
temporal-db -> temporal
connect -> context
context + connect + rnd -> hub
context -> artifact
hub -> sandbox
temporal + hub -> flow
context + artifact + flow -> space
healthy owner fleet -> flow-worker
sync + hub -> mcp
hub + space + flow -> ai
ai + sync + mcp -> caddy
```

`flow-worker` is still a process consumer. No other service depends on a worker-health endpoint.

## 4. Exact-head review evidence

Final PR head `5fcdf0e4d2ce0a52e5e0197e71ee942a4f5842ba` passed:

- CI run **36221710069 / #2233** — PASS;
- Product Eval run **36221710064 / #1472** — PASS;
- PCS-06 Integrated Browser Acceptance run **36221710061 / #177** — PASS;
- Desktop Installer run **36221710076 / #246** — PASS.

The CI path includes formatting, lint, typecheck, test, Phase 4 real-process acceptance, production operations acceptance, secret scans, dependency/action/runner/toolchain/container reviews, release-security acceptance, and production build.

Two branch-local issues were caught before merge and are not present on main:

1. an intermediate edit briefly misplaced last-service healthcheck YAML under the following top-level section; it was corrected before PR review and the service-block test helper was hardened;
2. initial formatting and one ESLint regex-style failure were corrected on the PR branch before the final exact head.

These were pre-merge branch corrections, not staging/runtime failures.

## 5. Merged-main evidence

Merged implementation main:

```text
710127d66218e4d2e8ed23ddbc485b80b8769f6b
```

Merged-main gates:

- CI run **36222126575 / #2234** — PASS;
- Product Eval run **36222126428 / #1473** — PASS.

CI #2234 passed the production operations acceptance against the final Compose config, including `docker compose ... config --quiet`.

## 6. Automatic staging proof

The governed workflow produced the expected two-run sequence:

- Staging Deploy **36222167625 / #1239** — gate PASS, deploy SKIPPED because the peer main gate was not yet green;
- Staging Deploy **36222328692 / #1240** — gate PASS, deploy PASS.

Run #1240 executed **Deploy exact reviewed main SHA** for:

```text
710127d66218e4d2e8ed23ddbc485b80b8769f6b
```

The staging logs directly demonstrated the A-10 readiness behavior:

- Temporal Postgres became `Healthy` before Temporal started;
- Connect became `Healthy` before Context started;
- RnD + Connect + Context became healthy before Hub-dependent consumers proceeded;
- Temporal + Hub became healthy before Flow started;
- Context + Artifact + Flow became healthy before Space started;
- Space became healthy before Ai and Flow Worker started;
- Sync + MCP + Ai health completed before the Caddy edge was recreated.

Post-deploy validation passed:

- public/auth bootstrap: PASS;
- protected Ai/API negative paths: PASS;
- MCP protected-resource metadata and unauthenticated OAuth challenge: PASS;
- Operations: `healthy: true`, **0 unhealthy services**;
- exact host SHA: MATCH;
- worktree: clean detached;
- **15/15 configured services running**;
- stabilized free space: **29.88 GiB**.

Therefore `710127d66218e4d2e8ed23ddbc485b80b8769f6b` is the proven staging runtime revision for A-10.

## 7. Ownership and scope preserved

A-10 did not change canonical ownership:

- Temporal remains workflow/schedule runtime truth;
- Flow remains graph/Trigger owner;
- Hub remains Project/policy/authority owner;
- Context remains memory/retrieval owner;
- Space remains page/block composition owner;
- Connect remains model/provider/MCP owner;
- Artifact remains artifact-byte owner;
- RnD remains trace/evidence/dataset owner;
- Sync remains device/ciphertext relay + public MCP bridge;
- Ai remains the browser/product surface.

A-10 did **not** add:

- another scheduler;
- a graph database;
- another memory store;
- cross-service database access;
- another chat/history backend;
- hosted-provider spend;
- native Google Drive integration;
- DR-2 runtime work;
- production cutover.

## 8. Safe resume rule

A-10 is closed. Do not reopen Compose readiness merely to add healthchecks to process-only services or to make every service depend on every other service.

If work resumes from this checkpoint:

1. verify repository `main` still descends cleanly from implementation SHA `710127d66218e4d2e8ed23ddbc485b80b8769f6b`;
2. preserve the explicit owner healthchecks and acyclic `service_healthy` dependency direction;
3. new services should expose a canonical readiness contract before another service is allowed to depend on `service_healthy`;
4. do not turn a shallow process health probe into cross-owner business/data validation;
5. treat **A-11 personal-workspace-first limitation** as the next numbered audit boundary only if explicitly selected;
6. keep DR-2 checkpoint 2, native Google Drive, provider spend, production cutover, and speculative architecture changes separate.

## 9. Checkpoint

```text
A-10: CLOSED / PASS
implementation main: 710127d66218e4d2e8ed23ddbc485b80b8769f6b
proven staging runtime: 710127d66218e4d2e8ed23ddbc485b80b8769f6b
exact-head CI/Product Eval/PCS-06/Desktop Installer: PASS
merged-main CI/Product Eval: PASS
actual staging deploy #1240: PASS
configured staging services: 15/15 running
staging Operations unhealthy services: 0
stabilized staging free space: 29.88 GiB
open implementation PRs at closure: none
next numbered audit boundary: A-11, not opened automatically
DR-2 checkpoint 2: deferred
native Google Drive: deferred
production cutover: deferred
```
