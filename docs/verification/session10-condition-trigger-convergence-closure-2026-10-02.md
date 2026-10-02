# Session 10 — Deterministic Condition Trigger Closure

Date: **2026-10-02**

Status: **CLOSED / PASS / STAGING VERIFIED**

This checkpoint closes the explicitly authorized Session 10 continuation after Session 9 Automation product convergence.

Session 10 activates the previously reserved `condition` Trigger as a deterministic predicate over an incoming normalized event. It does **not** create polling, an always-on LLM monitor, a second scheduler, a new autonomous service, or a provider-specific Gmail/Telegram connector.

Architecture decision: [ADR-39 — Condition Trigger adalah predicate event, bukan polling engine](../adr/0039-condition-trigger-event-predicate.md). ADR-39 narrows and supersedes the earlier ADR-36 reserved status for `condition`; ADR-36 ownership and Temporal rules remain binding.

## Closed product/runtime scope

Delivered:

- `condition` is now an active Flow-owned Trigger kind alongside `manual`, `time`, `event`, and `webhook`;
- Condition configuration keeps the existing `source` + `eventKind` selector and adds one bounded deterministic predicate;
- predicate fields are restricted to bounded `payload.*` or `metadata.*` paths, with prototype-traversal names rejected;
- V1 operators are `EQ`, `NEQ`, `GT`, `GTE`, `LT`, `LTE`, `CONTAINS`, and `EXISTS`;
- comparison values are bounded JSON primitives only; numeric ordering is type-strict and does not coerce strings into numbers;
- no `eval`, dynamic function execution, user regex, expression language, or arbitrary script is used;
- a selector mismatch remains fail-closed;
- a selector match with predicate `false` returns a deterministic no-op and does not start Temporal execution;
- a predicate `true` continues through the normal Project, exact pinned Flow, Hub policy/approval/capability, Temporal execution, and Run projection path;
- existing event delivery identity/idempotency remains the execution dedupe mechanism after a matching condition dispatch;
- Flow DB migration preserves PE-05 Trigger definitions, manual-fire receipts, and event-delivery receipts while adding the `condition` kind;
- `/automations` now supports creating, editing, listing, enabling/disabling, and inspecting Condition automations;
- Condition UI keeps explicit source, event kind, exact pinned Flow/version, requested autonomy, field, operator, and primitive value;
- Schedule remains time-Trigger-only; Condition is part of non-time Automation;
- `MAX_AUTONOMY_V1` remains L3.

## Authority path

Canonical path for a matching condition:

```text
normalized event
  -> Flow-owned enabled Condition Trigger
  -> source/event selector
  -> deterministic bounded predicate
  -> Project + exact pinned Flow validation
  -> Hub policy / approval / capability authority
  -> Temporal-backed Flow execution
  -> Run projection / audit evidence
```

For a false predicate the path stops before execution:

```text
normalized event
  -> Condition Trigger
  -> deterministic predicate = false
  -> explicit no-op
  -> no Temporal Flow execution
```

Condition does not grant authority. Workspace, Project, Flow version, and requested autonomy continue to come from owner state / Trigger definition rather than external event payload.

## Runtime merge

Runtime PR:

- PR **#429** — `feat: activate Session 10 deterministic Condition Trigger`
- final reviewed head: `f5c7ddfa53473e2179be3aad7b453c5adb4060ba`
- merged runtime `main`: `222b47403a9c6df3f29580a70cca53e2dff40263`
- staging image: `staging-222b47403a9c`

Exact-head gates:

| Gate | Result |
|---|---|
| CI #2671 | PASS |
| Product Eval #1910 | PASS |
| PCS-06 Integrated Browser Acceptance #419 | PASS |
| MCP External HTTPS Acceptance #1222 | PASS |

Merged-main gates:

| Gate | Result |
|---|---|
| CI #2672 | PASS |
| Product Eval #1911 | PASS |
| MCP External HTTPS Acceptance #1223 | PASS |

Exact-head validation includes schema tests, data-preserving migration tests, HTTP condition dispatch/no-op tests, Session 9 compatibility contracts, ADR-39/source contracts, and browser coverage for existing condition cards plus the New condition editor.

## Staging proof

Staging workflow remained fail-safe:

- Staging Deploy **#2091**: gate PASS; deploy skipped;
- Staging Deploy **#2092**: actual deploy PASS.

Actual staging evidence for `222b47403a9c6df3f29580a70cca53e2dff40263`:

- exact expected SHA matched;
- clean DETACHED worktree;
- staging image `staging-222b47403a9c`;
- standard public/auth boundary smoke PASS;
- MCP protected-resource metadata and unauthenticated challenge PASS;
- Operations `healthy: true`, `unhealthyServices: []`;
- 15 configured compose services / 15 running / 0 non-running;
- host Ubuntu 24.04.4 LTS, kernel 6.8.0-136-generic, x86_64;
- rollback set retained current and previous staging images;
- host evidence initially saw 21.81 GiB available; the deploy pipeline pruned BuildKit cache only and stabilized at **29.93 GiB free**;
- PCS-08 staging deploy PASS for exact SHA/tag.

SumoPod remains staging, not production.

## Explicit non-claims

This closure does **not** claim:

- production cutover;
- polling external state;
- scheduled reevaluation of condition predicates;
- an always-on LLM monitor;
- LLM-based semantic predicates;
- stateful windows/aggregation across multiple events;
- provider-specific Gmail, Telegram, Google Drive, CRM, or other connector adapters;
- automatic reply behavior;
- a first-class Task domain;
- L4 autonomy / AutoClick;
- a second scheduler, queue, execution database, credential store, or policy authority;
- external event authority over Workspace, Project, Flow, version, or autonomy.

## Safe resume

Session 10 Deterministic Condition Trigger is **CLOSED / PASS / STAGING VERIFIED**.

Future work must preserve:

1. Flow remains Trigger definition/dispatch owner;
2. Temporal remains time-schedule and durable execution owner;
3. Hub remains policy/approval/capability authority;
4. Condition remains event-driven and deterministic unless a new explicit ADR changes the boundary;
5. false condition remains side-effect-free;
6. matching condition keeps exact pinned Flow and Project routing;
7. no L4 authority escalation;
8. provider-specific connector adapters, polling/stateful condition engines, Task-domain consolidation, semantic/LLM conditions, and production promotion require separate explicit scopes;
9. no Session 11 is automatically opened by this closure.
