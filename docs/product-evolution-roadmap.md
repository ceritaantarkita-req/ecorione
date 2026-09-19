# ECORIONE — Product Evolution Roadmap

Last updated: **2026-09-19**

Status: **ACTIVE — PE-03**

This is the explicit roadmap that follows the closed Batch 1–12 / W / F6 baseline. It uses the prefix **PE (Product Evolution)** so it cannot be confused with old Batch numbers.

Architecture: [product-evolution-architecture.md](product-evolution-architecture.md)  
Agent execution protocol: [product-evolution-agent-guide.md](product-evolution-agent-guide.md)

## Roadmap summary

| Batch | Goal | Starts after |
|---|---|---|
| PE-00 | Lock architecture contracts + migrations | **CLOSED / PASS** |
| PE-01 | Project foundation + project-aware Chat/Ledger/Context | **CLOSED / PASS** |
| PE-02 | Project Sources + owner bindings | **CLOSED / PASS** |
| PE-03 | Trigger control plane + manual/time trigger | **ACTIVE** |
| PE-04 | Work UI + Schedule + unified Runs | PE-03 closed |
| PE-05 | Event/Webhook automation under existing policy | PE-04 closed |
| PE-06 | Brain V1 deterministic graph projection | PE-05 closed |
| PE-07 | Brain -> Context -> ECX optimization + measurement | PE-06 closed |
| PE-08 | Product closure, migration/UX/regression/evidence | PE-07 closed |

Do not execute multiple PE batches in one PR. Do not skip a batch without updating this roadmap and recording why.

---

## PE-00 — Architecture lock and migration contract

**Goal:** remove architectural ambiguity before schema/runtime changes.

### Build

- write/accept ADRs for:
  - Workspace vs Project;
  - project linkage/memory rules;
  - Trigger + Temporal ownership;
  - Flow version/misfire/concurrency;
  - Run projection;
  - Brain projection/privacy;
- inventory every current record/schema/API that needs `projectId`;
- define migration for existing `ws_personal` data and default `prj_personal`;
- define compatibility behavior while old clients omit `projectId`;
- verify Temporal TypeScript 1.23 scheduling semantics from official docs before choosing implementation contract;
- define exact acceptance tests for PE-01.

### Do not

- build Project UI;
- create Trigger runtime;
- migrate user data yet;
- create new service/DB.

### Done when

- ADRs accepted;
- migration matrix exists;
- owner/source-of-truth table exists;
- zero unresolved ownership questions block PE-01;
- CI + Product Eval green on exact head.

---

## PE-01 — Project foundation

**Goal:** make Project a real context boundary without breaking Workspace authority.

### Build

- shared Project schemas using existing `ProjectId`;
- Hub Project metadata registry;
- real default `Personal` Project;
- virtual `All` view;
- project-aware Historical Ledger sessions;
- `projectId` in Chat contract;
- project-aware Context episodes/facts/project memory retrieval;
- project-aware Flow ownership/linkage required by the chosen ADR;
- backward-compatible migration for existing data;
- Projects UI + project switcher;
- project-scoped recent conversations.

### Critical rules

- Workspace remains security boundary;
- no sibling Project memory retrieval;
- no parallel history database;
- ambiguous legacy rows fail closed or remain explicitly unassigned until resolved;
- current global memory remains distinguishable from Project memory.

### Done when

- create/open/switch Project works;
- chat in Project A cannot retrieve Project B memory;
- Personal preserves existing user experience after migration;
- Ledger hash-chain semantics remain valid;
- migration/restart tests pass;
- full CI/Product Eval + relevant runtime acceptance green.

---

## PE-02 — Project Sources

**Goal:** let a Project reference existing owner data without duplicating it.

### Build

- Hub Project binding registry for optional/shared resources;
- Artifact source binding;
- Space page binding;
- Flow binding/reuse where allowed;
- connector/MCP/URL source references;
- Sources UI in Project;
- authorization/sensitivity checks for every bound resource;
- add/remove binding audit events.

### Critical rules

- Project stores references, not copied Artifact/Space/Flow content;
- every binding belongs to the same Workspace;
- owner service remains source of truth;
- cross-Project sharing is explicit.

### Done when

- a Project can attach/detach supported source types;
- deleted/revoked owner resources fail cleanly;
- no cross-workspace binding is possible;
- backup/rebuild semantics remain owner-correct;
- CI/Product Eval green.

---

## PE-03 — Trigger control plane

**Goal:** generalize how work starts without building another execution engine.

### Build

- TriggerDefinition schema and storage;
- trigger kinds contract: manual/time/event/webhook/condition;
- implement **manual + time** first;
- Project + Flow linkage;
- exact Flow-version pin by default;
- IANA timezone;
- concurrency policy;
- misfire policy;
- idempotency identity;
- enable/disable;
- Hub authority evaluation;
- Temporal schedule/timer integration according to PE-00 ADR.

### Critical rules

- Trigger never grants authority;
- no `setInterval`/custom durable scheduler;
- no always-on LLM polling;
- Temporal remains timer/retry/state/recovery owner;
- no L4 autonomy.

### Done when

- manual trigger starts the exact expected Flow version;
- time trigger survives service/worker restart;
- duplicate delivery cannot duplicate side effect;
- overlap/misfire behavior is deterministic and tested;
- approval/policy behavior is unchanged;
- Phase 4/Temporal acceptance + CI/Product Eval green.

---

## PE-04 — Work, Schedule, and Runs

**Goal:** expose the execution system as a coherent product surface.

### Build

- `Work` navigation group;
- Schedule list first, then day/week/month views;
- Project filter/switch;
- Flow links;
- unified Run read model/projection;
- run detail: status, start/end, trigger, exact Flow version, operation, output, cost, approvals, errors;
- Project Activity projection from Ledger/Audit/Flow/RnD where useful;
- link Schedule item -> Trigger -> Flow -> Runs.

### Critical rules

- Schedule reads/writes Trigger definitions; it does not execute work itself;
- Run is a read model, not new execution authority;
- do not create Task domain unless an actual gap is proven.

### Done when

- user can understand what is planned, what is running, what happened, and why;
- schedule edit changes Trigger definition with auditability;
- one Run can be traced to its Trigger/Flow/version/operation;
- no duplicate execution DB is introduced;
- responsive/runtime UX verification passes.

---

## PE-05 — Event and webhook automation

**Goal:** support non-time-based automation safely.

### Build

- event/webhook trigger activation;
- generic event normalization contract;
- connector-specific adapters only where a real integration exists;
- event dedupe/idempotency;
- Project routing;
- Flow dispatch;
- approval behavior for external send/spend/irreversible actions;
- failure/dead-letter/retry visibility through existing runtime/read models.

### Critical rules

- prefer webhook/event delivery over polling;
- no always-on LLM monitor;
- external-send/spend/credential/policy actions retain existing gates;
- secrets remain in Connect Vault.

### Done when

- at least one real event path is proven end-to-end;
- duplicate webhook/event cannot duplicate side effect;
- disabled Trigger does nothing;
- unauthorized event cannot cross Workspace/Project boundary;
- relevant MCP/connector + Flow acceptance green.

---

## PE-06 — Brain V1

**Goal:** provide a Project-scoped relationship view from deterministic repository facts.

### Build

- a `brain-graph` projection/query package or equivalent lightweight boundary;
- deterministic node/edge adapters from owners;
- project-scoped graph API;
- authorization filtering before node/edge response;
- Brain UI with Project selector, filters, node detail, and links to owner surfaces;
- rebuildability tests.

### Start with

Nodes: Project, Conversation, Memory, Artifact, Page, Flow, Trigger, Run, Source, Entity, Decision, Operation.

Edges: BELONGS_TO, CREATED_FROM, USES, REFERENCES, TRIGGERED, EXECUTED, PRODUCED, MENTIONS, SUPERSEDES, GENERATED_FROM.

### Critical rules

- no graph DB;
- no second source of truth;
- deterministic edges first;
- no broad LLM extraction by default;
- sensitive node existence is protected like sensitive content.

### Done when

- graph can be rebuilt from owner data;
- deleting the projection loses no canonical information;
- Project A cannot infer protected Project B nodes/edges;
- UI navigates back to canonical owner records;
- CI/Product Eval + privacy regressions green.

---

## PE-07 — Brain + Context + ECX

**Goal:** use graph structure to narrow context candidates without replacing Context or ECX.

### Build

```text
Project boundary
-> Brain neighborhood
-> Context retrieval
-> ECX semantic-v1
-> context pack
-> model
```

- neighborhood selection contract;
- Context retrieval filter integration;
- ECX candidate-input integration;
- bounded evaluation dataset from real Project/Brain tasks;
- measure:
  - candidate count;
  - selected refs;
  - input/context size;
  - quality/retention;
  - latency;
  - local cost/hosted cost only if separately authorized.

### Critical rules

- Brain does not rank final prompt refs by itself;
- Context remains retrieval owner;
- ECX remains context-pack optimizer;
- no paid evidence without explicit authorization;
- do not claim universal savings from bounded results.

### Done when

- measured results show whether Brain narrowing helps;
- regression guard protects quality/retention;
- benefit is documented with limitations;
- deeper graph complexity is rejected unless evidence justifies it.

---

## PE-08 — Product closure

**Goal:** close the next product roadmap with a clean, reproducible baseline.

### Build/verify

- cross-batch migration audit;
- project-isolation/security audit;
- full local restart/persistence verification;
- backup/restore/rebuild checks for new metadata/projections;
- Windows runtime/installer regression if touched by the roadmap;
- responsive/browser product walkthrough;
- documentation cleanup;
- archive superseded planning snapshots;
- exact-head closure evidence.

### Done when

- no S0/S1 blocker;
- no unresolved cross-Project leakage;
- CI + Product Eval + relevant acceptance all green;
- current docs contain one clear state;
- PE-00 through PE-08 are closed at documented boundaries;
- production deployment remains optional unless separately activated.

## Batch status

As of **2026-09-19**:

```text
PE-00  CLOSED / PASS
PE-01  CLOSED / PASS
PE-02  CLOSED / PASS
PE-03  ACTIVE
PE-04  BLOCKED BY PE-03
PE-05  BLOCKED BY PE-04
PE-06  BLOCKED BY PE-05
PE-07  BLOCKED BY PE-06
PE-08  BLOCKED BY PE-07
```

PE-03 is currently active. PE-04 remains blocked until PE-03 is CLOSED / PASS on the exact reviewed and merged head.
