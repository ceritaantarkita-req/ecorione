# ECORIONE — Current State & Next Steps

Last updated: **2026-09-18**

Status: **CURRENT / canonical handoff**

## Current verdict

The defined Batch 1–12 platform roadmap is closed. The repository has a real local/self-host baseline with Ai, Hub, Connect, Context, Sync, Artifact, Sandbox, Space, Flow/Temporal, RnD, operations tooling, security gates, Windows runtime support, and a Windows installer.

The bounded validation work through W20 is closed at its documented claim boundaries. **F6-E01 through F6-E08 are CLOSED / REPO-SIDE PASS. There is no active item in the previous implementation/hardening plan.**

Repository readiness does **not** mean a real VPS/Cloudflare target is currently activated. Production host activation remains deferred by operator. AutoClick remains deferred by design.

## Current status

| Area | State |
|---|---|
| Batch 1–12 implementation roadmap | **CLOSED** |
| Production/self-host repository baseline | **READY** |
| W03 product/UX runtime validation | **DONE — REAL-LAPTOP VERIFIED** |
| W09/W10 Windows engine/startup | **DONE — WINDOWS RUNTIME VERIFIED** |
| W11 packaged installer lifecycle | **DONE — WINDOWS INSTALLER VERIFIED** |
| W16 automatic selector | **DONE — REPO SIDE** |
| W17 no-oracle local validation | **CLOSED / PASS** |
| W18 hosted economics | **CLOSED / PASS WITH DOCUMENTED DUPLICATE-EXECUTION INCIDENT** |
| W20 final current-state sync | **CLOSED** |
| F6-E01 … F6-E07 | **CLOSED / REPO-SIDE PASS** |
| F6-E08 container image digest pinning | **CLOSED / REPO-SIDE PASS** |
| Compute-host/VPS + Cloudflare activation | **DEFERRED BY OPERATOR** |
| AutoClick | **DEFERRED BY DESIGN** |

Detailed dated evidence remains under `docs/verification/`. Do not copy the full historical chronology back into current-state documents.

## What is real in the product

Current user-facing navigation is Ai, Space, Flow, Operations, and Settings. The underlying platform also contains Historical Ledger, memory/retrieval, Artifact, MCP, Sandbox, Sync, provider/runtime controls, approval/capability policy, spend governance, telemetry, and Temporal-backed durable workflow execution.

The currently discussed Projects / Work / Schedule / Brain product layer is **not implemented yet** and is **not part of F6-E08**.

## F6-E08 closure

F6-E08 is **CLOSED / REPO-SIDE PASS**.

Exact reviewed head `6c46944108cdc275aebc682bd132ec9dc69e14e4` passed:

- CI #1114;
- Product Eval #353;
- MCP External HTTPS Acceptance #528;
- Desktop Installer #70, including Linux bundle and real Windows Setup compilation plus installer SHA-256 generation.

PR #164 merged to `main` at `cacffa6c59d6871ae1ab4e11ae17cd48847864c1`.

The implemented policy digest-pins governed external Node/Postgres/Temporal/Caddy references and continuously rejects mutable/tag-only drift through normal CI and release-security acceptance.

## Existing baseline finish state

The previous implementation/hardening plan is now closed:

1. Batch 1–12 closed;
2. W-series bounded validation closed through W20;
3. F6-E01 through F6-E08 closed;
4. canonical docs synchronized;
5. production VPS/Cloudflare remains intentionally deferred;
6. AutoClick remains intentionally deferred.

No next product roadmap is active yet. Future concepts should be discussed and opened under a new explicit scope rather than extending F6 silently.

## Closed-evidence boundary

W18 is closed. Do not rerun the paid benchmark merely to refresh documentation. Reopen only if a reproducible regression or a materially changed provider/model/runtime identity invalidates the existing evidence.

Historical audits and failed attempts must remain preserved, but they belong in evidence/archive, not in the current work queue.

## Documentation rule

Start at [README.md](README.md), then use:

- [active-work-plan.md](active-work-plan.md) for current execution;
- [EXECUTION-PROGRESS.md](EXECUTION-PROGRESS.md) for compact closure state;
- [fase6-hardening.md](fase6-hardening.md) for Fase 6+ hardening policy;
- [verification/](verification/) only when exact evidence is needed.
