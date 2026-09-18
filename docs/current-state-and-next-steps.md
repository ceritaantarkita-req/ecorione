# ECORIONE — Current State & Next Steps

Last updated: **2026-09-19**

Status: **CURRENT / canonical handoff**

## Current verdict

The original Batch 1–12 platform roadmap, W-series validation through W20, and F6-E01 through F6-E08 are closed at their documented boundaries. The repository has a stable local/self-host baseline with Ai, Hub, Connect, Context, Sync, Artifact, Sandbox, Space, Flow/Temporal, RnD, operations tooling, security gates, Windows runtime support, and a Windows installer.

The next Product Evolution scope is now **documented but not activated for implementation**.

## Current status

| Area | State |
|---|---|
| Batch 1–12 implementation roadmap | **CLOSED** |
| W03/W09/W10/W11/W16/W17/W18/W20 | **CLOSED at documented boundaries** |
| F6-E01 … F6-E08 | **CLOSED / REPO-SIDE PASS** |
| Production/self-host repository baseline | **READY** |
| Windows runtime + installer | **VERIFIED** |
| Product Evolution architecture | **DOCUMENTED** |
| PE-00 | **PLANNED / NOT ACTIVATED** |
| PE-01 … PE-08 | **BLOCKED BY PRIOR PE BATCH** |
| Compute-host/VPS + Cloudflare activation | **DEFERRED BY OPERATOR** |
| AutoClick | **DEFERRED BY DESIGN** |

Detailed historical evidence remains under `docs/verification/`.

## Next product model

Canonical design:

```text
Project = WHERE / context boundary
Brain   = WHAT IS KNOWN / derived context graph
Trigger = WHEN / WHY work starts
Flow    = HOW work happens
Agent   = WHO/WHAT executes under existing policy
Run     = WHAT ACTUALLY HAPPENED
```

Key decisions already carried into the next design:

- Workspace remains the authority/security boundary; Project is inside Workspace;
- Project does not copy owner data;
- Schedule is a time-trigger UI, not a scheduler engine;
- Temporal remains Flow durability/timer/retry owner;
- autonomy remains Hub policy, not a new autonomous service;
- Run is initially a unified read model, not a second execution DB;
- Brain is a rebuildable projection, not a graph DB;
- Context remains memory/retrieval owner;
- ECX remains context-pack optimizer;
- `All` is virtual; `Personal` is a real default Project;
- no first-class Task domain in initial V1 unless evidence proves it is needed.

Read:

- [product-evolution-architecture.md](product-evolution-architecture.md)
- [product-evolution-roadmap.md](product-evolution-roadmap.md)
- [product-evolution-agent-guide.md](product-evolution-agent-guide.md)

## Product Evolution batches

```text
PE-00 Architecture lock + migration contract
PE-01 Project foundation
PE-02 Project Sources
PE-03 Trigger control plane
PE-04 Work + Schedule + Runs
PE-05 Event/Webhook automation
PE-06 Brain V1
PE-07 Brain + Context + ECX
PE-08 Product closure
```

No batch is active yet. Implementation begins only after explicit operator activation of PE-00.

## Existing closed boundaries remain binding

- do not rerun W18 for freshness;
- do not weaken release/security gates;
- do not silently activate VPS/Cloudflare;
- do not build AutoClick;
- do not lift autonomy to L4;
- do not introduce a second scheduler, history DB, execution truth, or graph DB without a new evidence-backed ADR.

## Documentation rule

Start at [README.md](README.md), then use:

- [active-work-plan.md](active-work-plan.md) for what is active now;
- [product-evolution-architecture.md](product-evolution-architecture.md) for next-product architecture;
- [product-evolution-roadmap.md](product-evolution-roadmap.md) for PE batch order;
- [product-evolution-agent-guide.md](product-evolution-agent-guide.md) for implementation procedure;
- [EXECUTION-PROGRESS.md](EXECUTION-PROGRESS.md) for compact progress;
- [verification/](verification/) only when exact evidence is needed.
