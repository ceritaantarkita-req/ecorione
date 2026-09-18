# ECORIONE documentation map

Last updated: **2026-09-18**

This file is the single navigation entry point for repository documentation. If two documents appear to disagree, use the precedence below instead of trying to reconcile every historical snapshot.

## Read these first

1. **[current-state-and-next-steps.md](current-state-and-next-steps.md)** — current product/repository state and what is actually next.
2. **[active-work-plan.md](active-work-plan.md)** — only the work that is active now.
3. **[EXECUTION-PROGRESS.md](EXECUTION-PROGRESS.md)** — compact milestone/closure summary.
4. **[../AGENTS.md](../AGENTS.md)** — invariants and working rules for humans/agents editing the repo.

For normal continuation work, these four are enough.

## Source-of-truth precedence

When wording conflicts:

```text
current code + tests
  > current-state-and-next-steps.md
  > active-work-plan.md
  > accepted ADRs / owner runbooks
  > EXECUTION-PROGRESS.md
  > dated verification/evidence
  > archived audits and old plans
```

Historical failures and measurements remain valid evidence for the point in time they describe; they are not automatically current blockers.

## Current architecture and product reference

- [prd.md](prd.md) — product/design baseline; **not a current work queue**.
- [blueprint.md](blueprint.md) — original architecture/phase blueprint; **not a current work queue**.
- [research.md](research.md) — technical research and source rationale.
- [adr/README.md](adr/README.md) — accepted architecture decisions.
- [DECISIONS.md](DECISIONS.md) — lightweight chronological decision log.
- [design.md](design.md) — visual/product design system.
- [LICENSING.md](LICENSING.md) — licensing boundary.
- [developer-sdk.md](developer-sdk.md) — developer-facing integration reference.

## Implemented phase contracts

These describe what was implemented during earlier phases. They are useful technical references, not active plans:

- [api-fase1.md](api-fase1.md)
- [api-fase2.md](api-fase2.md)
- [api-fase3.md](api-fase3.md)
- [api-fase4.md](api-fase4.md)

The pre-implementation Fase 2 plan remains only because accepted ADRs cite it as historical rationale. It already carries a historical notice.

## Current operating runbooks

Use these when operating or changing the corresponding subsystem:

- [production-activation.md](production-activation.md)
- [production-operations.md](production-operations.md)
- [release-operations.md](release-operations.md)
- [cloudflare-free-deployment.md](cloudflare-free-deployment.md)
- [security-review.md](security-review.md)
- [capability-permission-operations.md](capability-permission-operations.md)
- [spend-budget-operations.md](spend-budget-operations.md)
- [outbound-mcp-operations.md](outbound-mcp-operations.md)
- [extension-operations.md](extension-operations.md)
- [data-rebuild-operations.md](data-rebuild-operations.md)
- [data-governance-dr-operations.md](data-governance-dr-operations.md)
- [multimodal-operations.md](multimodal-operations.md)
- [voice-operations.md](voice-operations.md)
- [node-registry-flow-canvas-operations.md](node-registry-flow-canvas-operations.md)
- [space-block-runtime-operations.md](space-block-runtime-operations.md)

## Evidence — do not use as a work queue

[verification/](verification/) contains dated closure records, failed attempts, runtime measurements, and exact-head evidence. They are preserved for auditability.

Other dated evidence documents in `docs/` support specific claims and may be referenced by eval provenance. They should not be interpreted as current status unless the current-state document explicitly says so.

## Archive

[archive/](archive/) contains superseded audits, old analysis snapshots, and historical execution material. Archived documents are preserved for provenance only.

## Active vs future scope

Current active scope: **F6-E08 container image digest pinning**.

Production VPS/Cloudflare activation is **deferred by operator**. AutoClick is **deferred by design**.

Projects / Work / Schedule / Brain are a discussed next product evolution. They are intentionally **not yet an active implementation scope**; open them only after the existing baseline is closed/frozen under a new explicit roadmap.
