# Session 9 — A-09 frontend maintainability/decomposition closure

Date: **2026-09-26**

Status: **SAFE / RESUMABLE — A-09 CLOSED / PASS**

Exact product main and proven staging runtime:

```text
3c9279a21ec441ab9fe5ec95583c946a238ccc43
```

There is no unmerged product implementation work at this checkpoint.

## 1. Scope closed

A-09 addressed the frontend maintainability concentration identified by the 2026-09-24 current-main audit. The goal was not a framework rewrite or broad UI redesign. The bounded rule was:

- page/controller boundaries retain owner state, API calls, authorization-sensitive actions, and mutation orchestration;
- pure page-model helpers may move to domain-local helper modules;
- large presentation subtrees may move to typed components;
- extracted presentation/model modules must not become new owner/API boundaries;
- product behavior, service ownership, routes, storage, scheduling, memory, and authorization semantics remain unchanged.

The five audited concentration surfaces are now decomposed through separate reviewed PRs.

## 2. Closed A-09 sequence

### A-09a — Flow

PR **#344 — `refactor: decompose Flow frontend boundary`**

- reviewed head: `804030ea5c117f3ae325f22c47887c7a1debdffd`;
- merge: `3d5f5caf31ff97a36bec316675cd6566c0c907a2`;
- extracted `FlowPageSections.tsx` and `flow-page-model.ts`;
- authority preparation/approval, graph mutation, validation, save/load, execution, approval/input handling, and owner API calls remain in the Flow page boundary;
- extracted modules are source-contract guarded against owner API calls.

Exact-head gates: CI **#36210342789**, Product Eval **#36210342823**, PCS-06 **#36210342907** — PASS.

### A-09b — Ai chat

PR **#345 — `refactor: decompose Ai chat presentation boundary`**

- reviewed head: `2540a505baac310ff8c2c4d369294712870a5c87`;
- merge: `cd654d90398d14a8426b067d79c7449573c7038c`;
- extracted `ChatPageSections.tsx`;
- session/Project reconciliation, attachment upload, send, history, and forget orchestration remain in the Ai page boundary;
- extracted presentation is source-contract guarded against owner API calls.

Exact-head gates: CI **#36210715870**, Product Eval **#36210715880**, PCS-06 **#36210715878** — PASS.

### A-09c — Settings

PR **#346 — `refactor: separate Settings controller boundary`**

- reviewed head: `94fd35e09d43790f58a3dcf5ff509fb6df798b0b`;
- merge: `bd4aeab95554b75e12a3049ea61d235cefafdfb1`;
- Settings runtime/provider/credential/MCP state and API orchestration moved into `useSettingsController.ts`;
- the page remains the product presentation boundary;
- owner routes and settings semantics are unchanged.

Exact-head gates: CI **#36211041298**, Product Eval **#36211041299**, PCS-06 **#36211041346** — PASS.

### A-09d — Work

PR **#347 — `refactor: decompose Work frontend boundary`**

- reviewed head: `aa01002ef117cdb08a24234dd8978dfd2c30dd76`;
- merge: `dca6f652f1a6cb5106ddc14c7922b8925ad61233`;
- extracted `WorkPageSections.tsx` and `work-page-model.ts`;
- Project reconciliation, Flow/Trigger/Run reads, Schedule assist, explicit Save mutations, and Run detail loading remain in the Work page boundary;
- Flow remains Trigger-definition owner and Temporal remains schedule/runtime truth.

Exact-head gates: CI **#36216303219**, Product Eval **#36216303168**, PCS-06 **#36216303152** — PASS.

### A-09e — Space

PR **#348 — `refactor: decompose Space frontend boundary`**

- reviewed head: `ae11342f597e8ebf9227bdeb357c9f5565130ee0`;
- merge / product main: `3c9279a21ec441ab9fe5ec95583c946a238ccc43`;
- extracted `SpacePageSections.tsx` and `space-page-model.ts`;
- Space page/catalog reads, block/page mutations, reference resolution, and Context Core Memory proxy mutations remain in the Space page boundary;
- extracted presentation/model modules are source-contract guarded against owner API calls.

Exact-head gates: CI **#36217912340**, Product Eval **#36217912235**, PCS-06 **#36217912178** — PASS.

The initial Space CI formatting failure was bounded to Prettier output in `SpacePageSections.tsx`. The exact Prettier diff was diagnosed on the PR branch, applied, and the temporary diagnostic `format:check` change was restored before the final reviewed head. No diagnostic script remains on merged main.

## 3. Concentration after A-09

At exact main `3c9279a2...`, the previously audited page modules are approximately:

| Page | Audit baseline | A-09 closure |
|---|---:|---:|
| `apps/ai/app/flow/page.tsx` | ~65 KB | 52,680 chars / 1,458 lines |
| `apps/ai/app/page.tsx` | ~43 KB | 39,468 chars / 1,166 lines |
| `apps/ai/app/settings/page.tsx` | ~50 KB | 28,696 chars / 750 lines |
| `apps/ai/app/work/page.tsx` | ~35–38 KB | 17,473 chars / 516 lines |
| `apps/ai/app/space/page.tsx` | ~32 KB | 16,044 chars / 481 lines |

The closure criterion is not arbitrary line-count minimization. Each audited surface now has an explicit domain-local decomposition boundary and regression coverage preventing extracted presentation/model modules from becoming hidden owner/API layers.

## 4. Ownership and behavior preserved

A-09 introduced no new canonical owner and did not change existing ownership:

- Flow remains graph/Trigger owner;
- Temporal remains durable schedule/workflow truth;
- Hub remains Project/policy/authority owner;
- Context remains memory/retrieval owner;
- Space remains composition/page/block owner;
- Connect remains model/provider/MCP owner;
- RnD remains trace/evidence owner;
- Ai remains the product/browser surface.

A-09 did **not** add:

- a second scheduler or task store;
- a graph database;
- a second chat/history backend;
- a new memory store;
- cross-service database access;
- hosted-provider spend;
- production/public cutover;
- DR-2 runtime work.

## 5. Final merged-main evidence

Merged product main:

```text
3c9279a21ec441ab9fe5ec95583c946a238ccc43
```

Merged-main gates:

- CI **#36218158051 / run #2228** — PASS;
- Product Eval **#36218158067 / run #1467** — PASS.

Automatic Staging Deploy had the expected two-run sequence:

- **#36218205648 / run #1227** — gate PASS, deploy SKIPPED;
- **#36218371018 / run #1228** — gate PASS, deploy PASS.

The actual deploy run executed **Deploy exact reviewed main SHA** for `3c9279a2...`. Runtime evidence then passed:

- public/auth bootstrap and protected Ai/API negative paths;
- MCP protected-resource metadata and unauthenticated OAuth challenge;
- authenticated Operations with `healthy: true` and no unhealthy services;
- exact-host SHA match and clean detached worktree;
- all **15/15 configured services running**;
- stabilized free space **27.69 GiB**.

Therefore exact product main `3c9279a21ec441ab9fe5ec95583c946a238ccc43` is the proven staging runtime revision at this checkpoint.

## 6. Safe resume rule

A-09 is closed. Do not reopen the five surfaces merely to reduce line counts further.

If work resumes from this checkpoint:

1. verify current `main` still descends cleanly from `3c9279a21ec441ab9fe5ec95583c946a238ccc43`;
2. preserve the new local presentation/model/controller boundaries when adding future features;
3. keep owner/API orchestration in the owning page/controller boundary unless a separately reviewed domain client/hook is intentionally introduced;
4. keep extracted presentational modules fetch-free unless a new explicit architecture decision changes that rule;
5. treat **A-10 Compose readiness/health** as the next eligible clean audit boundary;
6. keep A-11 personal-workspace limitation, DR-2 checkpoint 2, native Google Drive integration, provider spend, and production cutover separate;
7. do not open a new scheduler, graph database, memory store, autonomous service, or cross-service database path as part of A-10.

## 7. Checkpoint

```text
A-09: CLOSED / PASS
product main: 3c9279a21ec441ab9fe5ec95583c946a238ccc43
staging runtime: 3c9279a21ec441ab9fe5ec95583c946a238ccc43
open product PRs at closure: none
next eligible clean boundary: A-10 Compose readiness/health
DR-2 checkpoint 2: deferred
production cutover: deferred
```
