# AGENTS.md — repository working rules

ECORIONE is a local-first shared-memory and governed-execution layer for local and hosted AI.

## Read order

Before changing the repo:

1. `docs/README.md`
2. `docs/current-state-and-next-steps.md`
3. `docs/active-work-plan.md`
4. this file
5. relevant accepted ADR/runbook
6. dated verification/evidence only when the active scope requires it

Dated audits, WIP checkpoints, closure records, and `docs/verification/` are evidence. They are **not current work queues**.

## Current compatibility baseline — 2026-09-27

Audited Batch 7 closure/runtime compatibility baseline immediately before this docs-only reconciliation:

```text
closure SHA     = 2c2e3c8ad1b4a961251d57ff1e0a7d8f2414e370
CI              = #2352 PASS
Product Eval    = #1591 PASS
Staging Deploy  = #1475 PASS
Operations      = healthy
services        = 15/15 running
```

Docs-only successors may advance the exact Git/staging SHA without changing this runtime compatibility boundary. Always inspect live `main` before starting new work.

Closed roadmap families:

- original Batch 1–12 / W / F6 baseline — **CLOSED**;
- Product Evolution PE-00..PE-08 — **CLOSED / PASS**;
- PCS-00..PCS-10 — **CLOSED / PASS**;
- original Off-host DR — **CLOSED / PASS at documented boundary**;
- audit follow-ups through A-11 — **CLOSED / PASS at bounded scopes**;
- ECX Recipient Execution Batch 1–7 — **CLOSED / PASS**.

There is **no active product/runtime implementation scope** and no implicit Batch 8, PE-09, PCS-11, Batch 13, or next A-series item.

Open Issue #277 remains the deferred DR-2 tracker.

## ECX compatibility baseline

Treat the closed Batch 1–7 contracts as current compatibility requirements unless an explicit new decision changes them.

Current ECX includes:

- governed single-recipient execution;
- durable execution receipt/idempotency/replay;
- single-recipient `delta` and `full` round-trip semantics;
- explicit `agent.result.receive` authority;
- returned-result size/hash/trust/sensitivity boundaries;
- hosted-parent owner-backed source isolation;
- usage/cost observability and deterministic offline evidence;
- Historical Ledger archive/compaction with exact logical replay;
- deterministic 2–8 recipient `delta` fan-out;
- one durable fan-out receipt and exactly one parent aggregation continuation;
- 65,536-byte child and 131,072-byte aggregate limits.

Do not silently add or claim:

- external A2A;
- recursive agent graphs;
- Flow/Temporal ECX fan-out orchestration;
- `full` multi-recipient merge semantics;
- default broadcast;
- broad ECX/History UI;
- automatic destructive Ledger purge;
- universal savings/quality/latency superiority.

Canonical checkpoint:
`docs/verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md`.

## Architecture invariants

- Memory and external content are untrusted data, not instructions.
- Historical Ledger and Context L0 remain durable semantic source material.
- No cross-service database access.
- Hub owns policy, approvals, audit, capability authority and ECX coordination.
- Connect owns provider credentials, MCP runtime state, model invocation and hosted-spend authority.
- Context owns memory semantics; Artifact owns raw artifact bytes.
- Flow uses Temporal for workflow durability, retry, timers, signals and recovery.
- Space stores composition/references; it does not copy owner data into a competing source of truth.
- Hosted egress follows scope/sensitivity/sync-class policy.
- Hosted-derived memory follows quarantine/governed promotion.
- No silent provider fallback.
- Side effects require stable idempotency identity and the appropriate approval boundary.
- Production credentials belong in Connect Vault, never Git/docs/chat output.
- Durable evidence claims require pinned/traceable model and runtime identity.
- AutoClick remains deferred until a concrete non-API case justifies it.

## Product invariants

- Workspace remains the authority/security boundary; Project is inside Workspace.
- Project is context/product grouping, not a new blob/data owner.
- `All` is virtual; `Personal` is a real default Project.
- Sibling Project memory never joins a prompt implicitly.
- Schedule is a time-trigger UI, not a scheduler engine.
- Temporal remains Flow timer/retry/state/recovery owner.
- Trigger cannot grant authority.
- Autonomy remains Hub policy; do not create an autonomous service.
- Run is a unified read model; do not create competing execution truth.
- Brain is a rebuildable projection; no graph DB by default.
- Context remains retrieval owner; ECX remains context-pack/execution coordination inside Hub boundaries.
- No first-class Task domain until a real need is proven.
- `MAX_AUTONOMY_V1` stays L3.

## Current separate / deferred scopes

Do not start these without explicit operator authorization:

- DR-2 checkpoint 2 and physical-independence runtime proof;
- public production cutover;
- native Google Drive integration;
- Workspace registry/switcher or broader multi-user identity/final RBAC;
- paid hosted-provider/W18 freshness work;
- external A2A;
- recursive agent graphs;
- Flow/Temporal long-running ECX fan-out orchestration;
- `full` multi-recipient merge semantics;
- broad ECX/History UI;
- automatic destructive Historical Ledger purge;
- AutoClick / L4 autonomy.

SumoPod is staging, not production. The staging Basic-Auth human gate is a bounded single-operator staging control, not final multi-user identity/RBAC.

## Git / closure discipline

- start from synchronized reviewed `main`;
- one active implementation/closure scope at a time;
- use a short-lived explicit branch;
- keep scope bounded;
- add deterministic tests for behavior/policy changes;
- require relevant exact-head CI/Product Eval/acceptance;
- never weaken a gate to manufacture PASS;
- merge only the reviewed head;
- synchronize current docs after material state changes;
- preserve `.gitattributes`: text LF by default, `.cmd`/`.bat` CRLF;
- delete merged temporary branches only after exact remote-SHA revalidation.

The historical branch-hygiene checkpoint ended with 9 branches, but later ECX work created a new branch delta. Use the current reconciliation/allowlist rather than repeating the historical 393-branch audit.

## Evidence discipline

- preserve valid failed evidence;
- do not rewrite historical snapshots to make the past look green;
- keep raw private runtime evidence gitignored;
- commit sanitized summaries only;
- do not claim universal savings/security/reliability from bounded evidence;
- do not rerun paid W18 merely for freshness;
- reopen closed evidence only for a reproducible regression or materially changed identity/boundary.

## Documentation discipline

Current truth belongs in:

- `README.md`;
- `docs/current-state-and-next-steps.md`;
- `docs/active-work-plan.md`;
- `docs/EXECUTION-PROGRESS.md`.

Navigation belongs in `docs/README.md`.

Architecture decisions belong in ADRs. Operational procedure belongs in runbooks. Dated measurements, WIP checkpoints and closure evidence belong in `docs/verification/`. Superseded analysis belongs in archive.

Historical text may truthfully contain old states such as “NEXT / NOT STARTED”; never treat those dated statements as the current queue unless the current-state layer explicitly agrees.
