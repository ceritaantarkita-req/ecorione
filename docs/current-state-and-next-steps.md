# ECORIONE — Current State & Next Steps

Last updated: **2026-09-19**

Status: **CURRENT / PE-03 ACTIVE / TRIGGER CONTROL PLANE**

## Current verdict

The original Batch/W/F6 baseline remains closed. Product Evolution is active.

**PE-00, PE-01, and PE-02 are CLOSED / PASS. PE-03 Trigger control plane is ACTIVE.**

## Product Evolution status

| Batch | State |
|---|---:|
| PE-00 Architecture lock | **CLOSED / PASS** |
| PE-01 Project foundation | **CLOSED / PASS** |
| PE-02 Project Sources | **CLOSED / PASS** |
| PE-03 Trigger control plane | **ACTIVE** |
| PE-04 Work + Schedule + Runs | **BLOCKED BY PE-03** |
| PE-05 Event/Webhook automation | **BLOCKED BY PE-04** |
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

## Active: PE-03 Trigger control plane

PE-03 introduces the generalized Trigger control plane using existing Flow + Temporal + Hub authority. Active implementation is PR #172 on `pe/pe-03-trigger-control-plane-20260919`. It must not create a second scheduler or autonomous polling subsystem, and PE-04 remains blocked until the exact reviewed PE-03 head passes its closure gates and merges.

## Deferred

- VPS/Cloudflare activation — deferred by operator;
- AutoClick — deferred by design;
- paid W18 rerun — closed/not authorized.
