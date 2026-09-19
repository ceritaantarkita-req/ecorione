# ECORIONE — Current State & Next Steps

Last updated: **2026-09-19**

Status: **CURRENT / PE-05 ACTIVE / EVENT + WEBHOOK AUTOMATION**

## Current verdict

The original Batch/W/F6 baseline remains closed. Product Evolution is active.

**PE-00 through PE-04 are CLOSED / PASS. PE-05 Event/Webhook automation is ACTIVE.**

## Product Evolution status

| Batch | State |
|---|---:|
| PE-00 Architecture lock | **CLOSED / PASS** |
| PE-01 Project foundation | **CLOSED / PASS** |
| PE-02 Project Sources | **CLOSED / PASS** |
| PE-03 Trigger control plane | **CLOSED / PASS** |
| PE-04 Work + Schedule + Runs | **CLOSED / PASS** |
| PE-05 Event/Webhook automation | **ACTIVE** |
| PE-06 Brain V1 | **BLOCKED BY PE-05** |
| PE-07 Brain + Context + ECX | **BLOCKED BY PE-06** |
| PE-08 Product closure | **BLOCKED BY PE-07** |

## PE-02 delivered boundary

- Hub owns Project binding metadata only.
- Artifact sources are authorized through the existing Context/Artifact boundary.
- Space pages are validated in the same Workspace.
- Flow graphs are validated in the same Workspace and may be explicitly reused across Projects.
- outbound MCP servers must be visible to the same Workspace through Connect.
- URL sources are HTTPS references only; no remote content is copied.
- owner deletion/revocation produces an unavailable source state without deleting canonical owner data.
- attach/detach is audited.
- Ai Project detail includes Sources attach/list/detach UI.
- Project A/B and cross-Workspace negative paths are covered.

Acceptance: [product-evolution-pe02-acceptance.md](product-evolution-pe02-acceptance.md).

## PE-02 reviewed evidence

```text
PR #171
implementation head a6167df469cf491015b232aff8a192b32a25c569
CI #1223 PASS
Product Eval #462 PASS
MCP External HTTPS Acceptance #628 PASS
```

PR #171 is merged to `main` as `c734f00eaa791077c99557e6e89579534c43d651`; PE-02 remains CLOSED / PASS.

## PE-03 closed boundary

PE-03 closed on PR #172 exact head `74730e26321cac06c31243baeeafe29d5f4d75f0` and merged as `c739c09014d8aa20ca8e1b83c5b6be39b4ee649c`. Trigger metadata remains Flow-owned, Temporal remains schedule/runtime truth, and Hub remains authority/policy owner. See [verification/pe-03-trigger-control-plane-closure-2026-09-19.md](verification/pe-03-trigger-control-plane-closure-2026-09-19.md).

## PE-04 closed boundary

PE-04 closed on PR #173 after implementation head `c2cacbbcbee15f46ac4c5e9e43c955f5c952af43` and closure head `94936fa0704991d3536667bb8c947e9d751c813e` passed the required gates. It merged as `c08581a00a20dc6016c570a1fbb777d81e391699`. Work now exposes Project-scoped Schedule, Flow links, and an `operationId`-keyed Run read projection without a Task domain or second execution database. See [verification/pe-04-work-schedule-runs-closure-2026-09-19.md](verification/pe-04-work-schedule-runs-closure-2026-09-19.md).

## Active: PE-05 Event + Webhook automation

PE-05 activates the existing `event | webhook` Trigger kinds under ADR-36. Flow remains Trigger/dispatch owner, Connect remains connector credential/secret owner, Hub remains authority/policy/approval/audit, and Temporal remains durable execution owner. Polling/LLM monitors and a second queue/scheduler are out of scope. Acceptance: [product-evolution-pe05-acceptance.md](product-evolution-pe05-acceptance.md).

## Deferred

- VPS/Cloudflare activation — deferred by operator;
- AutoClick — deferred by design;
- paid W18 rerun — closed/not authorized.
