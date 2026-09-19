# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **PE-04 ACTIVE / WORK + SCHEDULE + RUNS**

## Latest closed item

**PE-03 — Trigger control plane**

```text
PR #172
exact reviewed head 74730e26321cac06c31243baeeafe29d5f4d75f0
CI 35427251391 PASS
Product Eval 35427251394 PASS
MCP External HTTPS Acceptance 35427251392 PASS
merge main c739c09014d8aa20ca8e1b83c5b6be39b4ee649c
```

Acceptance: [product-evolution-pe03-acceptance.md](product-evolution-pe03-acceptance.md).  
Closure evidence: [verification/pe-03-trigger-control-plane-closure-2026-09-19.md](verification/pe-03-trigger-control-plane-closure-2026-09-19.md).

## Active item

**PE-04 — Work + Schedule + unified Runs**

Implementation: draft PR **#173** / `pe/pe-04-work-schedule-runs-20260919`.

Acceptance: [product-evolution-pe04-acceptance.md](product-evolution-pe04-acceptance.md).

Current boundary:

- top-level Work surface with Schedule / Flows / Runs;
- Schedule reads/writes PE-03 time Trigger definitions;
- Temporal Schedule `describe()` is runtime truth for paused/upcoming occurrences;
- Project-scoped Flow navigation + exact version deep links;
- Run key = existing `operationId`;
- Run list/detail are rebuilt from RnD lifecycle traces + Temporal/Flow state + Hub audit/approval;
- Trigger identity is propagated into new graph executions;
- workflow evolution uses Temporal patch marker `pe04-run-lifecycle-v1`;
- no `runs` table, no second execution state machine, no Task domain.

PE-05 event/webhook activation remains blocked.

## Non-negotiable boundaries

- no second scheduler/retry database;
- Temporal remains durability/timer/retry owner;
- Trigger never grants authority;
- no always-on LLM polling;
- MAX_AUTONOMY_V1 stays L3;
- Workspace remains the authority boundary;
- VPS/Cloudflare, AutoClick, and paid W18 rerun remain out of scope.
