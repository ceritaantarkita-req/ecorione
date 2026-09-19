# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **PE-05 ACTIVE / EVENT + WEBHOOK AUTOMATION**

## Latest closed item

**PE-04 — Work + Schedule + unified Runs**

```text
PR #173
reviewed implementation head c2cacbbcbee15f46ac4c5e9e43c955f5c952af43
closure evidence head 94936fa0704991d3536667bb8c947e9d751c813e
CI 35435383786 PASS
Product Eval 35435383936 PASS
MCP External HTTPS Acceptance 35435383793 PASS
closure-head CI 35435554011 PASS
closure-head Product Eval 35435554018 PASS
closure-head MCP External HTTPS Acceptance 35435554042 PASS
merge main c08581a00a20dc6016c570a1fbb777d81e391699
```

Acceptance: [product-evolution-pe04-acceptance.md](product-evolution-pe04-acceptance.md).  
Closure evidence: [verification/pe-04-work-schedule-runs-closure-2026-09-19.md](verification/pe-04-work-schedule-runs-closure-2026-09-19.md).

## Active item

**PE-05 — Event + Webhook automation**

Branch: `pe/pe-05-event-webhook-automation-20260919`.

Acceptance: [product-evolution-pe05-acceptance.md](product-evolution-pe05-acceptance.md).

Current boundary:

- activate existing `event | webhook` Trigger kinds only;
- normalize non-time delivery before Flow dispatch;
- explicit Workspace + Project routing;
- exact pinned Flow version;
- stable event/webhook dedupe identity;
- disabled Trigger and duplicate delivery suppression;
- verified/authenticated webhook ingress for a real integration path;
- Hub policy/capability/approval remains binding;
- Connect remains credential/secret owner;
- Temporal remains durable Flow runtime;
- failures surface through existing audit/trace/Run evidence;
- no polling daemon, LLM monitor, second queue, second scheduler, or `condition` activation.

PE-06 Brain V1 remains blocked.

## Non-negotiable boundaries

- no second scheduler/retry database;
- Temporal remains durability/timer/retry owner;
- Trigger never grants authority;
- no always-on LLM polling;
- MAX_AUTONOMY_V1 stays L3;
- Workspace remains the authority boundary;
- VPS/Cloudflare, AutoClick, and paid W18 rerun remain out of scope.
