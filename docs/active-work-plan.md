# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **PE-03 ACTIVE / TRIGGER CONTROL PLANE**

## Latest closed item

**PE-02 — Project Sources**

Delivered:

```text
Project Sources
  -> Hub binding metadata only
  -> Artifact/Context owner validation
  -> Space owner validation
  -> Flow owner validation
  -> Connect MCP visibility validation
  -> HTTPS URL references
  -> attach/detach audit
  -> Sources UI
```

No owner content is copied into Hub.

## PE-02 implementation evidence

```text
PR #171
reviewed implementation head a6167df469cf491015b232aff8a192b32a25c569
CI #1223 PASS
Product Eval #462 PASS
MCP External HTTPS Acceptance #628 PASS
```

Acceptance: [product-evolution-pe02-acceptance.md](product-evolution-pe02-acceptance.md).

## Active item

**PE-03 — Trigger control plane**

PR #171 is merged and post-merge `main` passed CI #1234, Product Eval #473, and MCP External HTTPS Acceptance #639.

Acceptance: [product-evolution-pe03-acceptance.md](product-evolution-pe03-acceptance.md).

Implementation PR: **#172** (`pe/pe-03-trigger-control-plane-20260919`). Closure requires exact-head CI, Product Eval, and Temporal/Phase 4 runtime acceptance before merge.

PE-03 boundary:

- TriggerDefinition schema/storage;
- manual + time triggers first;
- Project + Flow linkage;
- exact Flow version pin by default;
- IANA timezone;
- concurrency + misfire policy;
- idempotency identity;
- Hub authority evaluation;
- Temporal schedule integration.

Do not pull PE-04 Work/Schedule/Runs product UI beyond the minimum control surface required to validate PE-03.

## Non-negotiable boundaries

- no second scheduler/retry database;
- Temporal remains durability/timer/retry owner;
- Trigger never grants authority;
- no always-on LLM polling;
- MAX_AUTONOMY_V1 stays L3;
- Workspace remains the authority boundary;
- VPS/Cloudflare, AutoClick, and paid W18 rerun remain out of scope.
