# ECORIONE — Current State & Next Steps

Last updated: **2026-09-18**

Status: **CURRENT / canonical handoff**

## Current verdict

The defined Batch 1–12 platform roadmap is closed. The repository has a real local/self-host baseline with Ai, Hub, Connect, Context, Sync, Artifact, Sandbox, Space, Flow/Temporal, RnD, operations tooling, security gates, Windows runtime support, and a Windows installer.

The bounded validation work through W20 is closed at its documented claim boundaries. F6-E01 through F6-E07 are also closed repository-side. **F6-E08 is the only active repository-hardening scope.**

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
| F6-E08 container image digest pinning | **IMPLEMENTED / IN REVIEW** |
| Compute-host/VPS + Cloudflare activation | **DEFERRED BY OPERATOR** |
| AutoClick | **DEFERRED BY DESIGN** |

Detailed dated evidence remains under `docs/verification/`. Do not copy the full historical chronology back into current-state documents.

## What is real in the product

Current user-facing navigation is Ai, Space, Flow, Operations, and Settings. The underlying platform also contains Historical Ledger, memory/retrieval, Artifact, MCP, Sandbox, Sync, provider/runtime controls, approval/capability policy, spend governance, telemetry, and Temporal-backed durable workflow execution.

The currently discussed Projects / Work / Schedule / Brain product layer is **not implemented yet** and is **not part of F6-E08**.

## Active scope — F6-E08

Implementation is now present on the F6-E08 branch: external Node/Postgres/Temporal/Caddy references are readable-tag + immutable-digest pinned across Dockerfile, production Compose, local Temporal Compose, and desktop Compose. A deterministic review scans governed container definitions and is wired into normal CI + release-security acceptance.

Scope:

1. pin governed build/runtime image references with `@sha256:` identities while retaining readable tags where supported;
2. add deterministic drift/policy review;
3. add focused regression coverage;
4. wire the review into normal CI and release-security acceptance;
5. run the relevant exact-head CI/Product Eval/acceptance gates;
6. merge only the reviewed head and synchronize canonical docs.

Out of scope:

- provider/model changes;
- hosted benchmark reruns or new paid W18 calls;
- VPS/Cloudflare mutation;
- AutoClick;
- Projects/Schedule/Brain implementation.

## Finish line for the existing baseline

After F6-E08:

1. final repository gates green;
2. canonical docs synchronized;
3. optional final Windows/local smoke only if the changed surface justifies it;
4. freeze/tag the clean baseline;
5. then open the next product roadmap as a new explicit scope.

The next product roadmap should not be mixed into F6-E08.

## Closed-evidence boundary

W18 is closed. Do not rerun the paid benchmark merely to refresh documentation. Reopen only if a reproducible regression or a materially changed provider/model/runtime identity invalidates the existing evidence.

Historical audits and failed attempts must remain preserved, but they belong in evidence/archive, not in the current work queue.

## Documentation rule

Start at [README.md](README.md), then use:

- [active-work-plan.md](active-work-plan.md) for current execution;
- [EXECUTION-PROGRESS.md](EXECUTION-PROGRESS.md) for compact closure state;
- [fase6-hardening.md](fase6-hardening.md) for Fase 6+ hardening policy;
- [verification/](verification/) only when exact evidence is needed.
