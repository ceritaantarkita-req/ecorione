# Session 10 — A-11 browser Workspace-context closure

Date: **2026-09-26**

Status: **SAFE / RESUMABLE — A-11 CLOSED / PASS**

Exact implementation main and proven staging runtime:

```text
38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5
```

There is no unmerged A-11 implementation work at this checkpoint.

## 1. Scope closed

A-11 addressed the 2026-09-24 audit limitation that browser-facing product surfaces owned a Personal Workspace assumption through page/controller-level `ws_personal` constants.

The bounded closure rule was:

- centralize browser Workspace selection behind one validated browser context;
- keep Personal as the V1 compatibility default rather than a page-owned policy decision;
- allow a valid explicit `?workspace=ws_...` selection to override a valid persisted `ecorione.workspaceId`;
- fall back to canonical `DEFAULT_WORKSPACE_ID` when URL/storage candidates are absent or invalid;
- make Workspace-scoped browser owner reads wait until browser Workspace resolution is ready;
- preserve existing Hub/Context/Flow/Space/Connect ownership and authorization semantics;
- do not create a Workspace registry/switcher, multi-user identity model, new backend authority model, new service/database, scheduler, graph store, memory store, cross-service database access, native Google Drive integration, hosted-provider spend, DR-2 runtime work, or production cutover.

## 2. Implementation

PR **#352 — `feat: remove browser personal-workspace assumption`**

Final reviewed head:

```text
173ba037182ca999f93c22942c564cff08d8ab6c
```

Squash merge / implementation main:

```text
38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5
```

The implementation adds one shared browser Workspace-selection contract and provider, then binds Ai Chat, Projects, Work/Schedule, Brain, Space, Flow, and Settings to that context instead of page-level Personal constants.

Important behavior preserved by the implementation:

- URL Workspace selection has precedence over persisted browser selection;
- invalid candidates fail back to the canonical Personal default;
- Projects reconcile Workspace-scoped Project state before history reads;
- Project navigation propagates the active Workspace;
- Flow fails closed rather than serializing against an unresolved Workspace context;
- Settings seeds its Workspace state from the active browser context;
- existing owner APIs remain the authority boundary.

This removes the browser-page assumption. It does **not** claim that every arbitrary Workspace ID is provisioned, authorized, or user-switchable; owner APIs still decide what exists and what is allowed.

## 3. Exact-head review evidence

Final PR head `173ba037182ca999f93c22942c564cff08d8ab6c` passed:

- CI run **36247296154 / #2255** — PASS;
- Product Eval run **36247296109 / #1494** — PASS;
- PCS-06 Integrated Browser Acceptance run **36247296118 / #195** — PASS.

The final PR diff contained the shared Workspace provider/selection helper, browser surface integration, deterministic unit/source-contract coverage, and active-scope documentation. A temporary formatter diagnostic workflow used during branch repair was removed before the reviewed head.

## 4. Merged-main evidence

Merged implementation main:

```text
38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5
```

Merged-main gates:

- CI run **36247543178 / #2256** — PASS;
- Product Eval run **36247543181 / #1495** — PASS.

The governed staging workflow then evaluated that exact current `main` SHA.

## 5. Automatic staging proof

The expected two-run sequence occurred:

- Staging Deploy **36247594902 / #1283** — gate PASS, deploy SKIPPED because the peer merged-main gate was not yet green;
- Staging Deploy **36247794456 / #1284** — gate PASS, deploy PASS.

Run #1284 executed **Deploy exact reviewed main SHA** with:

```text
TARGET_SHA=38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5
```

The remote deploy moved the staging worktree from the A-10 documentation checkpoint to exact A-11 implementation main and built/tagged `ecorione:staging-38fa0b8563a0`.

Post-deploy validation passed:

- public/auth bootstrap: PASS;
- protected Ai/API negative paths: PASS, including Projects/history, Brain, Space, chat, and forget boundaries;
- MCP protected-resource metadata: PASS;
- MCP unauthenticated OAuth challenge: PASS;
- Operations snapshot: `healthy: true`;
- Operations unhealthy services: **0**;
- exact host SHA: MATCH;
- staging worktree: clean detached;
- configured services: **15/15 running**;
- host evidence initially reported **26.27 GiB** available;
- post-retention stabilized free space: **27.66 GiB**.

Therefore `38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5` is the proven staging runtime revision for A-11.

## 6. Closure decision

A-11 is CLOSED / PASS at the bounded browser-context layer.

The closed invariant is:

> browser product pages do not own a hardcoded Personal Workspace policy; they consume one validated browser Workspace context while Personal remains the compatibility default.

This closure intentionally stops before broader product/identity work. A future Workspace picker/directory, multi-user identity system, membership administration, Workspace provisioning UX, or backend authority redesign would be a new explicitly authorized scope and must reuse the existing owner boundaries rather than reinterpret this closure.

## 7. Ownership and non-scope preserved

A-11 did not change canonical ownership:

- Hub remains Project/policy/authority owner;
- Context remains memory/retrieval owner;
- Flow remains graph/Trigger owner;
- Temporal remains durable schedule/workflow truth;
- Space remains page/block composition owner;
- Connect remains provider/model/MCP owner;
- Artifact remains artifact-byte owner;
- RnD remains trace/evidence/dataset owner;
- Sync remains device/ciphertext relay + public MCP bridge;
- Ai remains the browser/product surface.

A-11 did **not** add:

- a Workspace registry or switcher;
- multi-user identity/auth redesign;
- another scheduler;
- a graph database;
- another memory store;
- cross-service database access;
- native Google Drive integration;
- hosted-provider spend;
- DR-2 runtime work;
- production cutover.

## 8. Safe resume rule

A-11 is closed. Do not reopen the browser Workspace-context implementation merely to add broader Workspace or identity product scope.

If work resumes from this checkpoint:

1. distinguish the A-11 implementation/proven-runtime SHA `38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5` from any later documentation-only bookkeeping SHA;
2. preserve the shared browser Workspace-selection precedence and fail-safe Personal compatibility default;
3. preserve owner-side authorization and existence checks; do not treat a browser-selected Workspace ID as authority by itself;
4. treat Workspace directory/switcher, provisioning, memberships, or multi-user identity as separately reviewed product/security work;
5. do not implicitly open another numbered audit item solely because A-11 is closed;
6. keep DR-2 checkpoint 2, native Google Drive, hosted-provider spend, and production cutover deferred/separate.

## 9. Checkpoint

```text
A-11: CLOSED / PASS
implementation PR: #352
final reviewed head: 173ba037182ca999f93c22942c564cff08d8ab6c
implementation main: 38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5
proven staging runtime: 38fa0b8563a0f73fb44b1705e4f0e1418d8a23c5
exact-head CI/Product Eval/PCS-06: PASS
merged-main CI #2256: PASS
merged-main Product Eval #1495: PASS
actual staging deploy #1284: PASS
configured staging services: 15/15 running
staging Operations unhealthy services: 0
stabilized staging free space: 27.66 GiB
open implementation PRs at closure: none
next audit scope: none implicitly opened
DR-2 checkpoint 2: deferred
native Google Drive: deferred
hosted-provider spend: deferred
production cutover: deferred
```
