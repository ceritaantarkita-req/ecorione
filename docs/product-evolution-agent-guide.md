# ECORIONE — Product Evolution Agent Guide

Last updated: **2026-09-21**

Status: **HISTORICAL / REUSABLE EXECUTION GUIDE — NO ACTIVE PE BATCH**

Use this guide only if a human explicitly opens a new Product Evolution scope. PE-00..PE-08 and the follow-on PCS-00..PCS-10 roadmap are closed; this file is not an instruction to start PE-09.

Read first:

1. [../AGENTS.md](../AGENTS.md)
2. [README.md](README.md)
3. [current-state-and-next-steps.md](current-state-and-next-steps.md)
4. [product-evolution-architecture.md](product-evolution-architecture.md)
5. [product-evolution-roadmap.md](product-evolution-roadmap.md)
6. relevant accepted ADRs/runbooks

## The rule

**One PE batch at a time. One bounded branch/PR at a time. No hidden redesign.**

PE-00 through PE-08 are currently CLOSED / PASS. This guide remains the procedure if a future PE scope is explicitly opened; maintenance hardening must not be mislabeled as a new PE batch.

## Standard batch procedure

For every PE batch:

1. synchronize clean `main`;
2. confirm the batch is explicitly ACTIVE in `active-work-plan.md`;
3. read the architecture + accepted ADRs;
4. inventory existing code before adding new owners/services/tables;
5. update shared schemas/contracts first;
6. update the canonical owner storage/migration;
7. update owner API/service boundary;
8. update orchestration/policy integration;
9. update UI last;
10. add focused deterministic tests;
11. add migration/restart/security tests when state changes;
12. run the smallest relevant local gates;
13. run normal CI + Product Eval on exact PR head;
14. run extra acceptance only when the changed boundary requires it;
15. merge only the reviewed head;
16. update current docs and batch status;
17. do not start the next batch until the previous one is CLOSED.

## Vertical-slice order

Prefer:

```text
schema
-> storage/migration
-> owner API
-> orchestration/policy
-> UI
-> tests/evidence
-> docs
```

Do not start from UI mocks and invent backend semantics later.

## Owner rules

Never bypass current owners:

- Hub: policy, approval, capability authority, audit, Project control metadata;
- Context: memory semantics/retrieval;
- Artifact: raw artifacts;
- Space: page/composition data;
- Flow + Temporal: workflow definition/execution durability;
- Connect: providers, credentials, MCP/connectors, spend;
- RnD: trace/eval evidence;
- Historical Ledger: append-only history.

No cross-service database reads.

## Required checks by change type

### Docs/contract only

- formatting/lint where applicable;
- normal CI;
- Product Eval.

### Schema/storage/migration

- focused schema/repository tests;
- migration from current baseline;
- restart/persistence test;
- backup/rebuild implications reviewed;
- normal CI + Product Eval.

### Flow/Trigger/Temporal

- focused Trigger/Flow tests;
- idempotency/approval tests;
- worker restart/recovery test;
- Phase 4/Temporal acceptance;
- normal CI + Product Eval.

### Connector/event/MCP

- connector/MCP negative-path tests;
- authorization + dedupe/idempotency;
- external acceptance only if the changed boundary requires it;
- normal CI + Product Eval.

### Desktop/packaging

- Windows engine/installer acceptance if packaging/runtime inputs changed.

### Hosted/provider/cost

Do not execute paid calls unless the operator explicitly authorizes the exact scope/budget. Closed W18 evidence is not a reusable spend authorization.

## Migration rules

- migrations must be deterministic and restart-safe;
- preserve existing IDs/history/provenance;
- do not rewrite Historical Ledger events;
- do not merge sibling Project data;
- do not silently classify ambiguous old data;
- every new Project-scoped record must still pass Workspace authorization;
- document rollback/rebuild behavior for derived projections.

## Project-isolation test rule

Every batch that touches Project-aware data must include a negative test:

```text
workspace W
  project A -> data A
  project B -> data B

request scoped to A
  must see A
  must not see B
```

When sensitivity/scope/syncClass also apply, test the intersection rather than Project alone.

## Trigger safety test rule

Every Trigger path that can cause a side effect must prove:

- disabled Trigger does nothing;
- duplicate delivery is idempotent;
- requested autonomy cannot exceed Project/policy ceiling;
- always-gated action still requires approval;
- exact Flow version is traceable;
- retry/restart cannot duplicate side effect.

## Brain safety test rule

Brain must prove:

- projection is rebuildable;
- canonical owners remain sufficient after projection deletion;
- unauthorized nodes/edges are absent, not merely content-redacted;
- Project filters prevent sibling leakage;
- graph output cannot bypass Context/Hub policy.

## Stop conditions

Stop the batch and document the blocker instead of improvising if:

- implementation requires cross-service DB access;
- implementation requires a second scheduler/durability engine;
- a new service is needed but no ADR justifies ownership;
- migration would ambiguously reclassify existing data;
- exact-head CI/eval fails for a real regression;
- a paid provider call is required without authorization;
- a requested behavior would bypass Hub approval/capability policy;
- a graph DB appears necessary without measured evidence.

## Branch naming

Recommended:

```text
pe/pe-00-architecture-YYYYMMDD
pe/pe-01-project-foundation-YYYYMMDD
pe/pe-02-project-sources-YYYYMMDD
...
```

Use a separate docs closure branch only when the implementation PR is already merged and the closure evidence cannot be safely included in that PR.

## Handoff template

At the end of each PE batch, update `active-work-plan.md` with:

```text
Batch:
Status:
Merged PR:
Reviewed head:
Main merge:
What changed:
What did not change:
CI:
Product Eval:
Extra acceptance:
Known limitations:
Next batch:
```

Keep exact run IDs in verification evidence; keep current docs concise.

## Never do these automatically

- open the next batch because the previous one merged;
- create Batch 13;
- deploy VPS/Cloudflare;
- enable AutoClick;
- enable L4 autonomy;
- rerun W18;
- add a graph DB;
- add a Project service;
- add a Task domain;
- create a second history/run/scheduler source of truth.

Any of those requires a new explicit operator decision and, where architectural, an ADR.
